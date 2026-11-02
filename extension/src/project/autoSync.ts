import * as fs from "fs";
import * as path from "path";
import { IRVINE_INCLUDES } from "./includes";

export const SOURCE_TYPE = ".asm";
export const DEFAULT_EXTRA_TYPES = [".inc", ".mac"];
export const WALK_MAX_DEPTH = 16;
export const WALK_MAX_ENTRIES = 50000;
export const WALK_MAX_FILES = 2000;

export function trackedTypes(extra: unknown): Set<string> {
  const types = new Set([SOURCE_TYPE]);
  if (Array.isArray(extra))
    for (const e of extra)
      if (typeof e === "string" && /^\.[^\\/:*?"<>|.\s]+$/.test(e))
        types.add(e.toLowerCase());
  return types;
}

export const skippedFolder = (name: string): boolean =>
  name.startsWith(".") || /^(bin|node_modules)$/i.test(name);

export function isTracked(
  relPath: string,
  types: ReadonlySet<string>,
): boolean {
  const parts = relPath.split(/[\\/]/).filter(Boolean);
  if (!parts.length || parts.slice(0, -1).some(skippedFolder)) return false;
  const name = parts[parts.length - 1];
  return (
    !IRVINE_INCLUDES.includes(name.toLowerCase()) &&
    types.has(path.extname(name).toLowerCase())
  );
}

export interface WalkLimits {
  depth: number;
  entries: number;
  files: number;
}

const LIMITS: WalkLimits = {
  depth: WALK_MAX_DEPTH,
  entries: WALK_MAX_ENTRIES,
  files: WALK_MAX_FILES,
};

export async function findTracked(
  root: string,
  types: ReadonlySet<string>,
  limits: WalkLimits = LIMITS,
): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  const folders = [{ dir: root, depth: 0 }];
  let entries = 0;
  let truncated = false;
  for (let i = 0; i < folders.length; i++) {
    const { dir, depth } = folders[i];
    let list: fs.Dirent[];
    try {
      list = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (e) {
      continue; // unreadable: left out
    }
    list.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const d of list) {
      if (++entries > limits.entries) return { files, truncated: true };
      if (d.isDirectory()) {
        if (skippedFolder(d.name)) continue;
        if (depth + 1 >= limits.depth) truncated = true;
        else folders.push({ dir: path.join(dir, d.name), depth: depth + 1 });
      } else if (d.isFile() && isTracked(d.name, types)) {
        if (files.length >= limits.files) return { files, truncated: true };
        files.push(path.join(dir, d.name));
      }
    }
  }
  return { files, truncated };
}
