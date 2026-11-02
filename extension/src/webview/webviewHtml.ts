import { createHash, randomBytes } from "crypto";

export const TEMPLATE_FILE = ["media", "webview.html"];

/** read by src/js/boxedwine/page/bw-page-config.js */
export interface PageConfig {
  assetBase: string; // webview URI of media/, ending in "/"
  zipBase: string; // webview URI of media/latest26/, ending in "/"
  containerId: string;
  debugLog?: boolean;
  debugTrace?: boolean;
  wineDebug?: string;
  noSnapshot?: boolean;
}

export const contentSecurityPolicy = (
  cspSource: string,
  nonce: string,
): string =>
  [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' 'unsafe-eval' blob: ${cspSource}`,
    "worker-src blob:",
    `connect-src ${cspSource}`,
    `img-src ${cspSource} data: blob:`,
    `font-src ${cspSource}`,
    `style-src ${cspSource} 'unsafe-inline'`,
  ].join("; ") + ";";

export const createNonce = (): string => randomBytes(16).toString("hex");

export const containerIdFor = (storageUri: string | undefined): string =>
  storageUri
    ? createHash("sha256").update(storageUri).digest("hex")
    : "no-workspace";

// U+2028 and U+2029 end a line in JavaScript source: written as escapes in the JSON
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

export const htmlSafeJson = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEPARATOR)
    .join("\\u2028")
    .split(PARAGRAPH_SEPARATOR)
    .join("\\u2029");

/** MASM_RUNNER_DEBUG (extension host environment): comma-separated log, trace, nosnap, winedebug=<channels> */
export const debugSwitches = (
  value: string | undefined,
): Partial<PageConfig> => {
  const out: Partial<PageConfig> = {};
  for (const item of (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (item === "log") out.debugLog = true;
    else if (item === "trace") out.debugTrace = true;
    else if (item === "nosnap") out.noSnapshot = true;
    else if (item.startsWith("winedebug="))
      out.wineDebug = item.slice("winedebug=".length);
  }
  return out;
};

const replaceAll = (
  text: string,
  token: string,
  value: string,
): { text: string; count: number } => {
  const parts = text.split(token);
  return { text: parts.join(value), count: parts.length - 1 };
};

export interface RenderInput {
  cspSource: string;
  nonce: string;
  assetBase: string;
  config: PageConfig;
}

export function renderWebviewHtml(
  template: string,
  input: RenderInput,
): string {
  if (!/^[0-9a-f]{32}$/.test(input.nonce)) throw new Error("invalid nonce");
  let text = template;
  const expectOnce = (token: string, value: string) => {
    const r = replaceAll(text, token, value);
    if (r.count !== 1)
      throw new Error(
        "webview.html must contain " +
          token +
          " exactly once, found " +
          r.count,
      );
    text = r.text;
  };
  const expectSome = (token: string, value: string) => {
    const r = replaceAll(text, token, value);
    if (r.count < 1) throw new Error("webview.html must contain " + token);
    text = r.text;
  };
  expectOnce("__CSP__", contentSecurityPolicy(input.cspSource, input.nonce));
  expectOnce("__BW_CONFIG__", htmlSafeJson(input.config));
  expectSome("__NONCE__", input.nonce);
  expectSome("__ASSET_BASE__", input.assetBase);
  // a leftover __BW_BUILD_ID__ (gulp did not build media/) only turns instant start off
  const left = (text.match(/__[A-Z][A-Z_]*__/g) || []).filter(
    (t) => t !== "__BW_BUILD_ID__",
  );
  if (left.length)
    throw new Error(
      "webview.html has unknown placeholders: " + [...new Set(left)].join(", "),
    );
  return text;
}
