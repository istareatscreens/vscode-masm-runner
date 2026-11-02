import { parser as masmParser } from "./masm/parser.js";
import { masmHighlighting, masmHighlightSpec } from "./masm/highlight.js";

export const parser = masmParser.configure({ props: [masmHighlighting] });
export { masmHighlightSpec };
export { getStyleTags, tagHighlighter, tags } from "@lezer/highlight";
