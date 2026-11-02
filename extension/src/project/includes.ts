import * as path from "path";
import type { MasmParser } from "../syntax/masm-lezer";

export type { MasmParser };

export const IRVINE_INCLUDES = [
  "irvine32.inc",
  "irvine16.inc",
  "macros.inc",
  "smallwin.inc",
  "virtualkeys.inc",
  "graphwin.inc",
];
export const MAX_DEPTH = 8;
export const MAX_FILES = 64;

export function includeSpecs(parser: MasmParser, text: string): string[] {
  const specs: string[] = [];
  parser.parse(text).iterate({
    enter(n) {
      if (n.name !== "IncludeDirective") return undefined;
      for (let c = n.node.firstChild; c; c = c.nextSibling) {
        if (c.name === "FileName") specs.push(text.slice(c.from, c.to));
        else if (c.name === "TextLiteral")
          specs.push(
            text.slice(c.from + 1, text[c.to - 1] === ">" ? c.to - 1 : c.to),
          );
      }
      return false;
    },
  });
  return specs.map((s) => s.trim()).filter(Boolean);
}

export interface ResolvedInclude {
  path: string;
  text: string;
}

export interface IncludeResult {
  files: ResolvedInclude[];
  unresolved: string[];
  limited: boolean;
}

export interface IncludeEnv {
  readText(absPath: string): Promise<string | null>;
  inWorkspace(absPath: string): boolean;
  path?: path.PlatformPath;
}

const isAbsoluteSpec = (spec: string): boolean =>
  /^[a-z]:/i.test(spec) || /^[\\/]/.test(spec);

export async function resolveIncludes(
  sourcePath: string,
  sourceText: string,
  parser: MasmParser,
  env: IncludeEnv,
): Promise<IncludeResult> {
  const p = env.path || path;
  const key = (f: string) =>
    p === path.win32 || (p === path && process.platform === "win32")
      ? f.toLowerCase()
      : f;
  const seen = new Set<string>([key(p.resolve(sourcePath))]);
  const result: IncludeResult = { files: [], unresolved: [], limited: false };
  const sourceDir = p.dirname(sourcePath);

  const visit = async (
    includer: string,
    text: string,
    depth: number,
  ): Promise<void> => {
    for (const spec of includeSpecs(parser, text)) {
      const name = spec.split(/[\\/]/).pop()!.toLowerCase();
      if (IRVINE_INCLUDES.includes(name)) continue;
      if (isAbsoluteSpec(spec)) {
        result.unresolved.push(spec);
        continue;
      }
      const rel = spec.split(/[\\/]+/).join(p.sep);
      const candidates = [
        p.resolve(p.dirname(includer), rel),
        p.resolve(sourceDir, rel),
      ];
      let found: ResolvedInclude | null = null;
      for (const c of candidates) {
        if (!env.inWorkspace(c)) continue;
        const t = await env.readText(c);
        if (t !== null) {
          found = { path: c, text: t };
          break;
        }
      }
      if (!found) {
        result.unresolved.push(spec);
        continue;
      }
      if (seen.has(key(found.path))) continue;
      if (result.files.length >= MAX_FILES) {
        result.limited = true;
        return;
      }
      seen.add(key(found.path));
      result.files.push(found);
      if (depth + 1 < MAX_DEPTH) await visit(found.path, found.text, depth + 1);
      else if (includeSpecs(parser, found.text).length) result.limited = true;
    }
  };
  await visit(sourcePath, sourceText, 0);
  return result;
}
