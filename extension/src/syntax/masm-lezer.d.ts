export interface Tag {
  readonly id: number;
}

export interface NodeType {
  readonly name: string;
  readonly isError: boolean;
}

export interface SyntaxNode {
  readonly name: string;
  readonly type: NodeType;
  readonly from: number;
  readonly to: number;
  readonly parent: SyntaxNode | null;
  readonly firstChild: SyntaxNode | null;
  readonly nextSibling: SyntaxNode | null;
}

export interface SyntaxNodeRef {
  readonly name: string;
  readonly type: NodeType;
  readonly from: number;
  readonly to: number;
  readonly node: SyntaxNode;
}

export interface Tree {
  readonly length: number;
  iterate(spec: {
    enter(node: SyntaxNodeRef): boolean | void;
    leave?(node: SyntaxNodeRef): void;
    from?: number;
    to?: number;
  }): void;
}

export interface PartialParse {
  advance(): Tree | null;
  readonly parsedPos: number;
}

export interface MasmParser {
  parse(text: string): Tree;
  startParse(text: string): PartialParse;
}

export interface Highlighter {
  style(tags: readonly Tag[]): string | null;
}

export interface Tags {
  readonly variableName: Tag;
  readonly macroName: Tag;
  readonly labelName: Tag;
  readonly typeName: Tag;
  readonly string: Tag;
  definition(tag: Tag): Tag;
  function(tag: Tag): Tag;
  local(tag: Tag): Tag;
  special(tag: Tag): Tag;
}

export const parser: MasmParser;
export const masmHighlightSpec: { readonly [selector: string]: Tag };
export function getStyleTags(
  node: SyntaxNodeRef,
): { tags: readonly Tag[]; opaque: boolean; inherit: boolean } | null;
export function tagHighlighter(
  tags: readonly { tag: Tag | readonly Tag[]; class: string }[],
  options?: { all?: string },
): Highlighter;
export const tags: Tags;
