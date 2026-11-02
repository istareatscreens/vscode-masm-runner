import { ContextTracker, ExternalTokenizer } from "@lezer/lr";
import * as T from "./parser.terms.js";
import {
  SPECIALIZED_KEYWORDS,
  CONTEXTUAL_ATTRIBUTES,
  DOT_DIRECTIVES,
  MNEMONIC_DUALS,
} from "./keywords.js";
import { MNEMONICS } from "./mnemonics.js";

// ---------------------------------------------------------------------------
// Keyword tables (upper-case word -> term id)
// ---------------------------------------------------------------------------
function termId(name) {
  const id = T[name];
  if (typeof id !== "number")
    throw new Error(
      `tokens.js: keywords.js refers to unknown grammar term "${name}"`,
    );
  return id;
}

const SPECIALIZE = Object.create(null);
const EXTEND = Object.create(null);
const DOTS = Object.create(null);

function define(table, word, term, source) {
  const key = word.toUpperCase();
  if (key in SPECIALIZE || key in EXTEND || key in DOTS) {
    throw new Error(
      `tokens.js: keyword "${word}" (${source}) is defined twice`,
    );
  }
  table[key] = termId(term);
}
for (const [word, term, source] of SPECIALIZED_KEYWORDS)
  define(SPECIALIZE, word, term, source);
for (const [word, term, source] of CONTEXTUAL_ATTRIBUTES)
  define(EXTEND, word, term, source);
for (const [word, term, source] of DOT_DIRECTIVES)
  define(DOTS, word, term, source);
for (const word of MNEMONICS) {
  if (word in SPECIALIZE || word in EXTEND) {
    throw new Error(
      `tokens.js: mnemonic "${word}" collides with a reference keyword (regenerate with npm run mnemonics)`,
    );
  }
  SPECIALIZE[word] = T.Mnemonic;
}
// Words that are both mnemonics and keywords stay keyword terms here; the
// grammar accepts those terms at instruction position (dualMnemonic).
for (const word of Object.keys(MNEMONIC_DUALS)) {
  if (!(word in SPECIALIZE))
    throw new Error(
      `tokens.js: MNEMONIC_DUALS entry "${word}" is not a reference keyword`,
    );
}

export function specializeIdentifier(value, stack) {
  const key = value.toUpperCase();
  const id = SPECIALIZE[key];
  return id === undefined || stack.context.isName(key) ? -1 : id;
}

export function extendIdentifier(value, stack) {
  const key = value.toUpperCase();
  const id = EXTEND[key];
  return id === undefined || stack.context.isName(key) ? -1 : id;
}

// Only specialized words are recorded: a parameter such as CODE must still read
// as the attribute in ".pushframe Code".
const isSpecialized = (key) => key in SPECIALIZE;
const isReserved = (key) => key in SPECIALIZE || key in EXTEND;

export function specializeDotWord(value) {
  const id = DOTS[value.toUpperCase()];
  return id === undefined ? -1 : id;
}

// ---------------------------------------------------------------------------
// Contextual tokenizer
// ---------------------------------------------------------------------------
const NL = 10,
  SPACE = 32,
  TAB = 9,
  CR = 13,
  LT = 60,
  GT = 62,
  BANG = 33,
  SEMI = 59;

// BNF whiteSpaceCharacter: 8, 9, 11-13, 26, 32
function isSpace(ch) {
  return (
    ch === SPACE ||
    ch === TAB ||
    ch === CR ||
    ch === 11 ||
    ch === 12 ||
    ch === 8 ||
    ch === 26
  );
}

// BNF textLiteral: "<" text ">"; text may contain nested textLiterals and
// "!" character escapes (operator-logical-not-masm.md). An unterminated literal
// extends to the end of the line so the rest of the file is unaffected.
function readTextLiteral(input) {
  let depth = 0;
  for (;;) {
    const ch = input.next;
    if (ch < 0 || ch === NL) break;
    input.advance();
    if (ch === BANG) {
      if (input.next >= 0 && input.next !== NL) input.advance();
      continue;
    }
    if (ch === LT) depth++;
    else if (ch === GT && --depth === 0) break;
  }
  input.acceptToken(T.TextLiteral);
}

// BNF commentDir: COMMENT delimiter text ... text delimiter text ;;
// delimiter: any character except whiteSpaceCharacter. The token starts at the
// delimiter and ends at the end of the line that holds the closing delimiter.
function readBlockComment(input) {
  const delim = input.next;
  input.advance();
  for (;;) {
    const ch = input.next;
    if (ch < 0) break;
    input.advance();
    if (ch === delim) break;
  }
  while (input.next >= 0 && input.next !== NL) input.advance();
  input.acceptToken(T.BlockComment);
}

// BNF arbitraryText: charList (any characters except linefeed)
function readRawText(input) {
  while (input.next >= 0 && input.next !== NL) input.advance();
  input.acceptToken(T.RawText);
}

// BNF fileSpec: fileCharList | textLiteral; fileChar: delimiter (non-whitespace).
// A ";" ends the specification so a trailing comment stays a comment.
function readFileName(input) {
  while (
    input.next >= 0 &&
    input.next !== NL &&
    input.next !== SEMI &&
    !isSpace(input.next)
  )
    input.advance();
  input.acceptToken(T.FileName);
}

// ---------------------------------------------------------------------------
// Macro and repeat bodies, and OPTION NOKEYWORD
// ---------------------------------------------------------------------------
// ML substitutes a MACRO or FOR/IRP parameter, or a LOCAL that opens a body,
// even when it spells a reserved word (not ENDM); a FORC/IRPC parameter only
// through &name&. OPTION NOKEYWORD releases words for the rest of the file.
class Block {
  constructor(kind, names, localsOpen) {
    this.kind = kind; // "macro" | "for" | "forc" | "repeat" | "while"
    this.names = names; // the reserved words the body substitutes (upper case, sorted)
    this.localsOpen = localsOpen; // no statement but LOCAL has opened the body yet
  }
}

// FNV-1a, 32 bits
function fnv(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const sortedUnion = (a, b) => [...new Set([...a, ...b])].sort();

class MacroContext {
  constructor(blocks, released, lineStart, changes) {
    this.blocks = blocks; // the open blocks, innermost last
    this.released = released; // the words OPTION NOKEYWORD released (upper case, sorted)
    this.lineStart = lineStart; // while LOCALs may open the innermost body: the last token ended a line
    this.changes = changes;
    this.names = new Set(released);
    for (const b of blocks) for (const n of b.names) this.names.add(n);
    // The hash gates node reuse; counting the changes keeps a reused
    // fragment from spanning one.
    this.hash =
      changes === 0
        ? 0
        : fnv(
            changes +
              "|" +
              blocks
                .map(
                  (b) =>
                    b.kind + (b.localsOpen ? "+" : "-") + b.names.join(","),
                )
                .join(";") +
              "|" +
              released.join(",") +
              "|" +
              (lineStart ? 1 : 0),
          ) || 1;
  }
  get depth() {
    return this.blocks.length;
  }
  get localsOpen() {
    const b = this.blocks[this.blocks.length - 1];
    return b !== undefined && b.localsOpen;
  }
  isName(key) {
    return this.names.has(key);
  }
  next(blocks, released = this.released, lineStart = false) {
    return new MacroContext(blocks, released, lineStart, this.changes + 1);
  }
  // with the innermost block replaced
  inner(block) {
    return this.next([...this.blocks.slice(0, -1), block], this.released);
  }
  open(kind, names) {
    return this.next([...this.blocks, new Block(kind, names, true)]);
  }
  close() {
    return this.blocks.length ? this.next(this.blocks.slice(0, -1)) : this;
  }
  declare(names) {
    const b = this.blocks[this.blocks.length - 1];
    return names.length
      ? this.inner(new Block(b.kind, sortedUnion(b.names, names), true))
      : this;
  }
  closeLocals() {
    const b = this.blocks[this.blocks.length - 1];
    return this.inner(new Block(b.kind, b.names, false));
  }
  release(words) {
    return words.some((w) => !this.released.includes(w))
      ? this.next(
          this.blocks,
          sortedUnion(this.released, words),
          this.lineStart,
        )
      : this;
  }
}

// The words of a directive's text outside comments, strings and <...> / [...]
// groups, each with whether a comma came before it.
function topLevelWords(text) {
  const words = [];
  let afterComma = false;
  for (let i = 0; i < text.length; ) {
    const ch = text.charCodeAt(i);
    if (ch === SEMI) {
      while (i < text.length && text.charCodeAt(i) !== NL) i++;
    } else if (ch === 39 || ch === 34) {
      const q = ch;
      for (i++; i < text.length; i++)
        if (text.charCodeAt(i) === q && text.charCodeAt(++i) !== q) break;
    } else if (ch === LT || ch === 91) {
      const open = ch,
        shut = ch === LT ? GT : 93;
      let depth = 0;
      for (; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c === BANG && open === LT) i++;
        else if (c === open) depth++;
        else if (c === shut && --depth === 0) break;
      }
      i++;
    } else if (isAlpha(ch)) {
      let end = i;
      while (end < text.length && isNameChar(text.charCodeAt(end))) end++;
      words.push({ key: text.slice(i, end).toUpperCase(), afterComma });
      afterComma = false;
      i = end;
    } else {
      if (ch === 44) afterComma = true;
      else if (!isSpace(ch) && ch !== NL && ch !== 92) afterComma = false;
      i++;
    }
  }
  return words;
}

// The word after the keyword and, for MACRO and LOCAL, the first word after each comma.
function declaredNames(text, kind) {
  const words = topLevelWords(text);
  const keywords =
    kind === "macro" ? ["MACRO"] : kind === "for" ? ["FOR", "IRP"] : ["LOCAL"];
  const at = words.findIndex(
    (w, i) => (kind !== "macro" || i > 0) && keywords.includes(w.key),
  );
  if (at < 0) return [];
  const names = [];
  for (let i = at + 1; i < words.length; i++) {
    if (i === at + 1 || (kind !== "for" && words[i].afterComma))
      names.push(words[i].key);
  }
  return [
    ...new Set(names.filter((n) => n !== "ENDM" && isSpecialized(n))),
  ].sort();
}

function releasedWords(text) {
  const words = [];
  for (const m of text
    .replace(/;[^\n]*/g, "")
    .matchAll(/\bNOKEYWORD\s*:\s*<([^<>]*)>/gi)) {
    for (const w of m[1].split(/[\s,]+/)) if (w) words.push(w.toUpperCase());
  }
  return [
    ...new Set(words.filter((n) => n !== "ENDM" && isReserved(n))),
  ].sort();
}

const BLOCK_KINDS = new Map([
  [T.MacroDirective, "macro"],
  [T.ForDirective, "for"],
  [T.ForcDirective, "forc"],
  [T.RepeatDirective, "repeat"],
  [T.WhileDirective, "while"],
]);
const BACKSLASH = 92;

export const macroContext = new ContextTracker({
  start: new MacroContext([], [], false, 0),
  // A line whose first token is not LOCAL closes the body's LOCAL window;
  // skipped tokens leave it open.
  shift(cx, term, stack, input) {
    if (!cx.localsOpen) return cx;
    const ch = input.next;
    if (ch === NL)
      return cx.lineStart ? cx : cx.next(cx.blocks, cx.released, true);
    if (
      !cx.lineStart ||
      isSpace(ch) ||
      ch === BACKSLASH ||
      term === T.LineComment
    )
      return cx;
    return term === T.kwLocal
      ? cx.next(cx.blocks, cx.released, false)
      : cx.closeLocals();
  },
  reduce(cx, term, stack, input) {
    const kind = BLOCK_KINDS.get(term);
    if (kind)
      return cx.open(
        kind,
        kind === "macro" || kind === "for"
          ? declaredNames(input.read(input.pos, stack.pos), kind)
          : [],
      );
    if (term === T.EndmDirective) return cx.close();
    if (term === T.LocalDirective && cx.localsOpen)
      return cx.declare(
        declaredNames(input.read(input.pos, stack.pos), "local"),
      );
    if (term === T.OptionDirective)
      return cx.release(releasedWords(input.read(input.pos, stack.pos)));
    return cx;
  },
  hash: (cx) => cx.hash,
});

// ---------------------------------------------------------------------------
// Identifiers and declared names
// ---------------------------------------------------------------------------
const AMP = 38;
const isDigit = (ch) => ch >= 48 && ch <= 57;
// BNF alpha: A-Z a-z @ _ $ ?
const isAlpha = (ch) =>
  (ch >= 65 && ch <= 90) ||
  (ch >= 97 && ch <= 122) ||
  ch === 64 ||
  ch === 95 ||
  ch === 36 ||
  ch === 63;
const isNameChar = (ch) => isAlpha(ch) || isDigit(ch);

// The name's plain length and, in a macro or repeat body, the length and "&"
// count of its "&"-joined run ("loop_&tag&").
function readName(input, inBody) {
  const first = input.next;
  if (!isAlpha(first) && !(inBody && first === AMP && isAlpha(input.peek(1))))
    return null;
  let plain = 0;
  if (first !== AMP) while (isNameChar(input.peek(plain))) plain++;
  let end = plain,
    amps = 0;
  if (inBody && (first === AMP || input.peek(plain) === AMP)) {
    for (end = 0; ; ) {
      const ch = input.peek(end);
      if (isNameChar(ch)) end++;
      else if (ch === AMP && input.peek(end + 1) !== AMP) {
        end++;
        amps++;
      } else break;
    }
  }
  return { plain, end, amps };
}

// An "&"-joined run is one Identifier where the parser can shift one; "&&" never joins.
export const identifierTokens = new ExternalTokenizer(
  (input, stack) => {
    const name = readName(input, stack.context.depth > 0);
    if (!name) return;
    if (name.amps && stack.canShift(T.Identifier))
      return input.acceptToken(T.Identifier, name.end);
    if (name.plain) input.acceptToken(T.Identifier, name.plain);
  },
  { contextual: true },
);

// ParamName / LocalName: any word but ENDM, which ends the block.
const isEndm = (input, length) =>
  length === 4 && [69, 78, 68, 77].every((c, i) => (input.peek(i) & ~32) === c);
export const nameTokens = new ExternalTokenizer(
  (input, stack) => {
    const local = stack.canShift(T.LocalName);
    if (local ? !stack.context.localsOpen : !stack.canShift(T.ParamName))
      return;
    const name = readName(input, stack.context.depth > 0);
    if (!name) return;
    const length = name.amps ? name.end : name.plain;
    if (length && !isEndm(input, length))
      input.acceptToken(local ? T.LocalName : T.ParamName, length);
  },
  { contextual: true },
);

// argSpace: the zero-length token between two space-separated items of a
// macro argument (an extend tokenizer).
const COMMA = 44,
  RPAREN = 41;
export const argSpaceTokens = new ExternalTokenizer(
  (input, stack) => {
    const next = input.next;
    if (
      next < 0 ||
      next === NL ||
      next === SEMI ||
      next === COMMA ||
      next === RPAREN ||
      !isSpace(input.peek(-1))
    )
      return;
    if (stack.canShift(T.argSpace)) input.acceptToken(T.argSpace);
  },
  { contextual: true, extend: true },
);

export const contextTokens = new ExternalTokenizer(
  (input, stack) => {
    const ch = input.next;
    // Leading whitespace is left to the skip tokenizer; we are called again after it.
    if (ch < 0 || ch === NL || isSpace(ch)) return;
    if (ch === LT) {
      if (stack.canShift(T.TextLiteral)) readTextLiteral(input);
      return;
    }
    if (stack.canShift(T.BlockComment)) return readBlockComment(input);
    if (stack.canShift(T.RawText)) return readRawText(input);
    if (stack.canShift(T.FileName)) return readFileName(input);
  },
  { contextual: true },
);
