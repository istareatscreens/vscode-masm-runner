import type * as MasmLezer from "./masm-lezer";

type Bundle = Pick<
  typeof MasmLezer,
  "parser" | "getStyleTags" | "tagHighlighter" | "tags"
>;
type Tags = MasmLezer.Tags;
type SyntaxNode = MasmLezer.SyntaxNode;

export const TOKEN_TYPES = [
  "masmProcedure",
  "masmMacro",
  "masmLabel",
  "masmVariable",
  "masmParameter",
  "masmLocal",
  "masmType",
  "masmTextLiteral",
] as const;
export const TOKEN_MODIFIERS = ["declaration"] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];
const DECLARATION = 1 << TOKEN_MODIFIERS.indexOf("declaration");

export interface SemanticToken {
  line: number;
  char: number;
  length: number;
  /** index into TOKEN_TYPES */
  type: number;
  /** bit set over TOKEN_MODIFIERS */
  modifiers: number;
}

interface Kind {
  type: TokenType;
  declaration: boolean;
  /** visible only inside its PROC, MACRO or FOR/FORC block */
  scoped: boolean;
}
const USE = "use";
type Classification = Kind | typeof USE | null;

export function highlightRules(
  t: Tags,
): { tag: MasmLezer.Tag; class: string }[] {
  return [
    {
      tag: t.function(t.definition(t.variableName)),
      class: "masmProcedure declaration",
    }, // PROC, ENDP, PROTO
    { tag: t.definition(t.macroName), class: "masmMacro declaration" }, // MACRO
    { tag: t.macroName, class: "masmMacro" }, // a macro call
    { tag: t.function(t.variableName), class: "masmMacro" }, // a macro function call
    { tag: t.labelName, class: "masmLabel" }, // label, macro label, GOTO target
    { tag: t.definition(t.typeName), class: "masmType declaration" }, // STRUCT, UNION, RECORD, SEGMENT, GROUP, TYPEDEF
    { tag: t.typeName, class: "masmType" }, // a type in a declaration
    {
      tag: t.definition(t.local(t.variableName)),
      class: "masmParameter declaration",
    }, // parameters, LOCAL, record fields
    { tag: t.definition(t.variableName), class: "masmVariable declaration" }, // data, equates, text macros, EXTERN, PUBLIC, COMM
    { tag: t.special(t.string), class: "masmTextLiteral" }, // <text>
    { tag: t.variableName, class: USE }, // a plain name
  ];
}

// the kind a name keeps when the document defines it more than once
const GLOBAL_RANK: Partial<Record<TokenType, number>> = {
  masmProcedure: 5,
  masmMacro: 4,
  masmType: 3,
  masmLabel: 2,
  masmVariable: 1,
};

const kind = (type: TokenType, declaration: boolean, scoped = false): Kind => ({
  type,
  declaration,
  scoped,
});

const childNamed = (node: SyntaxNode, name: string): SyntaxNode | null => {
  for (let c = node.firstChild; c; c = c.nextSibling)
    if (c.name === name) return c;
  return null;
};

function refine(
  node: SyntaxNode,
  base: Classification,
  text: string,
): Classification {
  const parent = node.parent;
  if (!parent) return base;
  // only a statement's first name is a definition: COUNT in `arr[COUNT]:DWORD` is a use
  const first = childNamed(parent, "Identifier");
  if (!first || first.from !== node.from)
    return base && base !== USE && base.declaration ? USE : base;
  switch (parent.name) {
    case "Label":
    case "MacroLabel":
      return kind("masmLabel", true); // the contract tags a label definition like a GOTO target
    case "Parameter":
    case "MacroParameter":
      return kind("masmParameter", true, true);
    case "LocalItem":
      return kind("masmLocal", true, true); // the contract tags LOCAL names like parameters
    case "ProtoArg":
      return kind("masmParameter", true); // a prototype has no body to be visible in
    case "BitField":
      return kind("masmVariable", true); // a record field, not a parameter
    case "ForDirective":
    case "ForcDirective":
      return kind("masmParameter", true, true); // FOR x, <...>: the block's parameter
    case "PublicItem":
      return USE; // PUBLIC exports a name the document defines
    case "ExternItem": {
      const directive = childNamed(parent, "Directive");
      if (directive && /^proc$/i.test(text.slice(directive.from, directive.to)))
        return kind("masmProcedure", true); // EXTERN name:PROC
      return base;
    }
  }
  return base;
}

/** in steps, so a cancelled request stops early */
function parse(
  parser: MasmLezer.MasmParser,
  text: string,
  isCancelled: () => boolean,
): MasmLezer.Tree | null {
  const partial = parser.startParse(text);
  for (let step = 0; ; step++) {
    const tree = partial.advance();
    if (tree) return tree;
    if ((step & 63) === 0 && isCancelled()) return null;
  }
}

const highlighters = new WeakMap<Bundle, MasmLezer.Highlighter>();

export function classifyMasm(
  lezer: Bundle,
  text: string,
  isCancelled: () => boolean = () => false,
): SemanticToken[] | null {
  const tree = parse(lezer.parser, text, isCancelled);
  if (!tree) return null;
  let highlighter = highlighters.get(lezer);
  if (!highlighter)
    highlighters.set(
      lezer,
      (highlighter = lezer.tagHighlighter(highlightRules(lezer.tags))),
    );

  const classify = (node: MasmLezer.SyntaxNodeRef): Classification => {
    const style = lezer.getStyleTags(node);
    const cls = style && highlighter!.style(style.tags);
    if (!cls) return null;
    const [type, modifier] = cls.split(" ");
    const base: Classification =
      type === USE ? USE : kind(type as TokenType, modifier === "declaration");
    return node.name === "Identifier" ? refine(node.node, base, text) : base;
  };

  const named: {
    from: number;
    to: number;
    cls: Classification;
    statement: SyntaxNode | null;
  }[] = [];
  let caseSensitive = false;
  let visited = 0;
  let cancelled = false;
  tree.iterate({
    enter(node) {
      if ((++visited & 4095) === 0 && isCancelled()) {
        cancelled = true;
        return false;
      }
      if (
        node.name === "OptionItem" &&
        /^\s*CASEMAP\s*:\s*NONE\b/i.test(text.slice(node.from, node.to))
      )
        caseSensitive = true;
      if (SCOPE_OPEN.has(node.name) || SCOPE_CLOSE.has(node.name))
        named.push({
          from: node.from,
          to: node.from,
          cls: null,
          statement: node.node,
        });
      if (node.name !== "Identifier" && node.name !== "TextLiteral")
        return undefined;
      const cls = classify(node);
      if (cls)
        named.push({ from: node.from, to: node.to, cls, statement: null });
      return false;
    },
  });
  if (cancelled) return null;

  const key = (from: number, to: number) => {
    const name = text.slice(from, to).replace(/&/g, ""); // &param& is the parameter's name
    return caseSensitive ? name : name.toUpperCase();
  };

  const globals = new Map<string, TokenType>();
  for (const n of named) {
    if (!n.cls || n.cls === USE || !n.cls.declaration || n.cls.scoped) continue;
    const rank = GLOBAL_RANK[n.cls.type];
    if (rank === undefined) continue;
    const k = key(n.from, n.to);
    const had = globals.get(k);
    if (had === undefined || rank > GLOBAL_RANK[had]!)
      globals.set(k, n.cls.type);
  }

  const scopes: { opener: string; names: Map<string, TokenType> }[] = [];
  const resolve = (k: string): TokenType | undefined => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const t = scopes[i].names.get(k);
      if (t) return t;
    }
    return globals.get(k);
  };
  const out: {
    from: number;
    to: number;
    type: TokenType;
    declaration: boolean;
  }[] = [];
  for (const n of named) {
    if (n.statement) {
      const name = n.statement.name;
      if (SCOPE_OPEN.has(name)) scopes.push({ opener: name, names: new Map() });
      else closeScope(scopes, name);
      continue;
    }
    if (n.cls === USE) {
      const type = resolve(key(n.from, n.to));
      if (type) out.push({ from: n.from, to: n.to, type, declaration: false });
      continue;
    }
    const cls = n.cls as Kind;
    if (cls.scoped && scopes.length)
      scopes[scopes.length - 1].names.set(key(n.from, n.to), cls.type);
    out.push({
      from: n.from,
      to: n.to,
      type: cls.type,
      declaration: cls.declaration,
    });
  }
  return toLineTokens(text, out);
}

const SCOPE_OPEN = new Set([
  "ProcDirective",
  "MacroDirective",
  "ForDirective",
  "ForcDirective",
  "RepeatDirective",
  "WhileDirective",
]);
const SCOPE_CLOSE = new Set(["EndpDirective", "EndmDirective"]);

function closeScope(scopes: { opener: string }[], closer: string): void {
  // ENDP closes the innermost PROC; ENDM the innermost MACRO or repeat block
  const closes = (opener: string) =>
    closer === "EndpDirective"
      ? opener === "ProcDirective"
      : opener !== "ProcDirective";
  for (let i = scopes.length - 1; i >= 0; i--) {
    if (closes(scopes[i].opener)) {
      scopes.length = i;
      return;
    }
  }
}

function toLineTokens(
  text: string,
  ranges: { from: number; to: number; type: TokenType; declaration: boolean }[],
): SemanticToken[] {
  const starts = [0];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1))
    starts.push(i + 1);
  const tokens: SemanticToken[] = [];
  let line = 0;
  for (const r of ranges) {
    const type = TOKEN_TYPES.indexOf(r.type);
    const modifiers = r.declaration ? DECLARATION : 0;
    let from = r.from;
    while (from < r.to) {
      while (line + 1 < starts.length && starts[line + 1] <= from) line++;
      let end = line + 1 < starts.length ? starts[line + 1] - 1 : text.length; // the "\n", or the end
      if (end > starts[line] && text[end - 1] === "\r") end--;
      const to = Math.min(r.to, end);
      if (to > from)
        tokens.push({
          line,
          char: from - starts[line],
          length: to - from,
          type,
          modifiers,
        });
      if (line + 1 >= starts.length) break;
      from = Math.max(from, starts[line + 1]);
    }
  }
  return tokens;
}
