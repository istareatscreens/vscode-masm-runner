export const BIN = "bin";
export const joinPath = (...parts) => parts.filter((part) => part !== "").join("/");
export const parentOf = (path) => path.slice(0, Math.max(path.lastIndexOf("/"), 0));
export const baseOf = (path) => path.slice(path.lastIndexOf("/") + 1);
export const outputPath = (source, ext) =>
  joinPath(parentOf(source), BIN, baseOf(source).replace(/\.asm$/i, "") + ext);
