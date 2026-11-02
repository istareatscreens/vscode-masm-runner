import anyAscii from "any-ascii";
import { crlf } from "eol";

// by lower-case name without ".inc"
const IRVINE_FILES: Record<string, string> = {
  irvine32: "Irvine32.inc",
  macros: "Macros.inc",
  smallwin: "SmallWin.inc",
  virtualkeys: "VirtualKeys.inc",
  graphwin: "GraphWin.inc",
};

// groups: the indent, the file (a <text> literal, or a name up to a blank or ";"), the rest of the line
const INCLUDE_LINE = /^([ \t]*)include[ \t]+(<[^>\r\n]*>?|[^\s;]+)([^\r\n]*)$/gim;

// an INCLUDE of a bundled Irvine file, by any path and in any letter case, becomes its bundled name
export const convertIrvineImports = (text: string): string =>
  text.replace(INCLUDE_LINE, (line: string, indent: string, file: string, rest: string) => {
    const bracketed = file.startsWith("<");
    const name = bracketed ? file.slice(1).replace(/>$/, "") : file;
    const canonical = IRVINE_FILES[name.split(/[\\/]/).pop()!.replace(/\.inc$/i, "").toLowerCase()];
    if (!canonical) return line;
    return indent + "INCLUDE " + (bracketed ? "<" + canonical + ">" : canonical) + rest;
  });

// U+0300 to U+036F, built from the code points so the source stays plain ASCII
const COMBINING_MARKS = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");

export const removeUnicode = (text: string): string => text.normalize("NFD").replace(COMBINING_MARKS, "");

export const preProcessSource = (text: string): string =>
  crlf(anyAscii(removeUnicode(convertIrvineImports(text))));

export const toCrlf = (text: string): string => crlf(text);

export const isAssemblySource = (dPath: string): boolean => /\.asm$/i.test(dPath);

export const preProcessText = (dPath: string, text: string): string =>
  isAssemblySource(dPath) ? preProcessSource(text) : toCrlf(text);
