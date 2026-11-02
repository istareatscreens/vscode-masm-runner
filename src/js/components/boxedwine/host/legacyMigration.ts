import type { ContainerStore } from "./containerStore";

export const LEGACY_ROOT_KEY = "/";
export const DELETED_FILES_LOG = ".deletedFiles.log";
export const OLD_TOOLCHAIN = ["assemble.bat", "cmd.bat", "FL.exe", "JWASM", "JWLINK", "irvine"];
export const LEGACY_META_KEY = "legacyImported";

const S_IFMT = 0xf000;
const S_IFDIR = 0x4000;
const S_IFREG = 0x8000;
const MAX_DEPTH = 32;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LegacyFile {
  path: string;
  bytes: Uint8Array;
  mtime: number;
}

export interface LegacySkip {
  path: string;
  reason: string;
}

export interface LegacyTree {
  files: LegacyFile[];
  folders: string[];
  skipped: LegacySkip[];
}

export interface LegacyInode {
  size: number;
  mode: number;
  atime: number;
  mtime: number;
  ctime: number;
  id: string;
}

export interface MigrationResult {
  status: "imported" | "none" | "already" | "read-only" | "failed";
  imported: string[];
  folders: string[];
  kept: string[]; // already in the container, not overwritten
  skipped: LegacySkip[];
  error?: string;
}

export const isLegacyKey = (key: string): boolean => key === LEGACY_ROOT_KEY || UUID.test(key);

export const base64ToBytes = (value: string): Uint8Array => {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** inode.js fromBuffer, on a DataView */
export const decodeInode = (bytes: Uint8Array): LegacyInode => {
  if (bytes.length < 30) throw new Error("inode is " + bytes.length + " bytes");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let id = "";
  for (let i = 30; i < bytes.length; i++) id += String.fromCharCode(bytes[i] & 0x7f);
  return {
    size: view.getUint32(0, true),
    mode: view.getUint16(4, true),
    atime: view.getFloat64(6, true),
    mtime: view.getFloat64(14, true),
    ctime: view.getFloat64(22, true),
    id,
  };
};

// A listing is JSON in UTF-8 when BrowserFS wrote it, in Latin-1 when 0.9.x's btoa did.
const decodeListing = (bytes: Uint8Array): Record<string, string> => {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) {
    text = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  }
  const listing = JSON.parse(text);
  if (!listing || typeof listing !== "object" || Array.isArray(listing)) throw new Error("not a directory listing");
  return listing;
};

export const decodeLegacyStore = (getItem: (key: string) => string | null): LegacyTree | null => {
  const rootValue = getItem(LEGACY_ROOT_KEY);
  if (rootValue === null) return null;
  const tree: LegacyTree = { files: [], folders: [], skipped: [] };
  const rootInode = decodeInode(base64ToBytes(rootValue));
  const walk = (listingKey: string, dir: string, depth: number): void => {
    const raw = getItem(listingKey);
    if (raw === null) {
      tree.skipped.push({ path: dir || "/", reason: "missing directory listing" });
      return;
    }
    const listing = decodeListing(base64ToBytes(raw));
    for (const name of Object.keys(listing).sort()) {
      const path = dir ? dir + "/" + name : name;
      try {
        if (!name || name === "." || name === ".." || /[\\/]/.test(name)) throw new Error("invalid name");
        if (!dir && name === DELETED_FILES_LOG) {
          tree.skipped.push({ path, reason: "overlay deletion log" });
          continue;
        }
        if (!dir && OLD_TOOLCHAIN.some((t) => t.toLowerCase() === name.toLowerCase())) {
          tree.skipped.push({ path, reason: "0.9 toolchain" });
          continue;
        }
        const inodeValue = getItem(listing[name]);
        if (inodeValue === null) throw new Error("missing inode");
        const inode = decodeInode(base64ToBytes(inodeValue));
        const kind = inode.mode & S_IFMT;
        if (kind === S_IFDIR) {
          tree.folders.push(path);
          if (depth < MAX_DEPTH) walk(inode.id, path, depth + 1);
          else tree.skipped.push({ path, reason: "nested too deep" });
        } else if (kind === S_IFREG) {
          const data = getItem(inode.id);
          if (data === null) throw new Error("missing file data");
          tree.files.push({ path, bytes: base64ToBytes(data), mtime: Number.isFinite(inode.mtime) ? inode.mtime : 0 });
        } else {
          tree.skipped.push({ path, reason: "not a file or folder (mode " + inode.mode + ")" });
        }
      } catch (e) {
        tree.skipped.push({ path, reason: String((e as Error).message || e) });
      }
    }
  };
  if ((rootInode.mode & S_IFMT) !== S_IFDIR) throw new Error("the legacy root is not a directory");
  walk(rootInode.id, "", 0);
  return tree;
};

const lower = (s: string): string => s.toLowerCase();

export const placeLegacyOutputs = (tree: LegacyTree): LegacyTree => {
  const rootFiles = tree.files.filter((f) => !f.path.includes("/"));
  const sources = new Set(rootFiles.filter((f) => /\.asm$/i.test(f.path)).map((f) => lower(f.path.replace(/\.asm$/i, ""))));
  const taken = new Set(tree.files.map((f) => lower(f.path)));
  let moved = false;
  const files = tree.files.map((f) => {
    const m = /^(.+)\.(obj|exe)$/i.exec(f.path);
    if (!m || f.path.includes("/") || !sources.has(lower(m[1]))) return f;
    const target = "bin/" + f.path;
    if (taken.has(lower(target))) return f;
    taken.add(lower(target));
    moved = true;
    return { ...f, path: target };
  });
  const folders = moved && !tree.folders.some((p) => lower(p) === "bin") ? ["bin", ...tree.folders] : tree.folders;
  return { files, folders, skipped: tree.skipped };
};

/** A diagnostic label: FNV-1a, not crypto.subtle, so recording the import cannot fail on its own. */
export const fingerprint = (tree: LegacyTree): string => {
  const lines = tree.files.map((f) => f.path + ":" + f.bytes.length).concat(tree.folders.map((p) => p + "/")).sort().join("\n");
  let h = 0x811c9dc5;
  for (let i = 0; i < lines.length; i++) {
    h ^= lines.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + ":" + tree.files.length;
};

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

export const migrateLegacy = async (
  store: ContainerStore,
  storage: { getItem(key: string): string | null },
  now: number = Date.now(),
): Promise<MigrationResult> => {
  const result: MigrationResult = { status: "none", imported: [], folders: [], kept: [], skipped: [] };
  if (store.readOnly) return { ...result, status: "read-only" };
  try {
    if (await store.getMeta(LEGACY_META_KEY)) return { ...result, status: "already" };
    const decoded = decodeLegacyStore((k) => storage.getItem(k));
    if (!decoded) {
      await store.setMeta(LEGACY_META_KEY, { fingerprint: null, at: now });
      return result;
    }
    const tree = placeLegacyOutputs(decoded);
    result.skipped = tree.skipped;
    const present = new Set(Array.from(store.index.keys(), lower));
    const toImport = tree.files.filter((f) => {
      if (present.has(lower(f.path))) {
        result.kept.push(f.path);
        return false;
      }
      return true;
    });
    const folders = tree.folders.filter((p) => !Array.from(store.folders).some((q) => lower(q) === lower(p)));
    await store.apply({
      putFolders: folders,
      putFiles: toImport.map((f) => ({ path: f.path, bytes: f.bytes, mtime: f.mtime })),
    });
    for (const f of toImport) {
      const back = await store.readFile(f.path);
      if (!back || !sameBytes(new Uint8Array(back.data), f.bytes)) throw new Error("read-back of " + f.path + " did not match");
    }
    await store.setMeta(LEGACY_META_KEY, { fingerprint: fingerprint(tree), at: now, files: toImport.length });
    result.imported = toImport.map((f) => f.path);
    result.folders = folders;
    result.status = "imported";
    return result;
  } catch (e) {
    // no record: the next start tries again from the untouched legacy store
    return { ...result, status: "failed", error: String((e as Error).message || e) };
  }
};
