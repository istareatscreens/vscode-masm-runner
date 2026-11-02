import * as path from "path";
import type * as MasmLezer from "./masm-lezer";

export type MasmLezerBundle = typeof MasmLezer;

let cached: MasmLezerBundle | null | undefined;

export function loadMasmLezer(
  log: (message: string) => void = console.warn,
): MasmLezerBundle | null {
  if (cached !== undefined) return cached;
  try {
    // the bundle's path is known only at run time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bundle = require(path.join(__dirname, "masm-lezer.js"));
    cached =
      bundle &&
      bundle.parser &&
      bundle.getStyleTags &&
      bundle.tagHighlighter &&
      bundle.tags
        ? (bundle as MasmLezerBundle)
        : null;
    if (!cached)
      log(
        "[MASM Runner] the MASM parser bundle lacks the parser or highlight exports",
      );
  } catch (e) {
    cached = null;
    log("[MASM Runner] the MASM parser bundle could not be loaded: " + e);
  }
  return cached;
}

export function loadMasmParser(
  log: (message: string) => void = console.warn,
): MasmLezer.MasmParser | null {
  const bundle = loadMasmLezer(log);
  return bundle ? bundle.parser : null;
}
