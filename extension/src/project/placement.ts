import * as path from "path";

export interface WorkspaceFolderInfo {
  name: string;
  fsPath: string;
}

export type Placement =
  | { ok: true; dPath: string }
  | { ok: false; reason: string };

export const MAX_GUEST_PATH = 259; // MAX_PATH minus the terminating NUL, in UTF-16 code units
export const MAX_SEGMENT_BYTES = 255; // NAME_MAX of the guest's native file system

export function invalidFilenameReason(name: string): string | null {
  if (!name) return "enter a name";
  if (name.length > 255) return "name is too long";
  if (/[\\/:*?"<>|]/.test(name))
    return 'a name cannot contain \\ / : * ? " < > |';
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(name))
    return "a name cannot contain control characters";
  if (name !== name.trim()) return "a name cannot start or end with a space";
  if (/\.$/.test(name)) return "a name cannot end with a dot";
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i.test(name))
    return "that name is reserved by Windows";
  return null;
}

export function segmentProblem(name: string): string | null {
  const reason = invalidFilenameReason(name);
  if (reason) return reason;
  if (Buffer.byteLength(name, "utf8") > MAX_SEGMENT_BYTES)
    return "name is too long (at most 255 bytes in UTF-8)";
  return null;
}

export const guestPath = (dPath: string): string =>
  "D:\\" + dPath.split("/").join("\\");

export function pathProblem(dPath: string): string | null {
  for (const segment of dPath.split("/")) {
    const reason = segmentProblem(segment);
    if (reason) return '"' + segment + '": ' + reason;
  }
  if (guestPath(dPath).length > MAX_GUEST_PATH)
    return (
      "the full path " +
      guestPath(dPath) +
      " is too long (at most 259 characters)"
    );
  return null;
}

function inside(
  folderPath: string,
  filePath: string,
  p: path.PlatformPath,
): string | null {
  const rel = p.relative(folderPath, filePath);
  if (!rel || rel.startsWith("..") || p.isAbsolute(rel)) return null;
  return rel;
}

export function placeOnDrive(
  filePath: string,
  folders: readonly WorkspaceFolderInfo[],
  p: path.PlatformPath = path,
): Placement {
  // workspace folders can be nested: the innermost one that contains the file
  let best: { folder: WorkspaceFolderInfo; rel: string } | null = null;
  for (const folder of folders) {
    const rel = inside(folder.fsPath, filePath, p);
    if (
      rel !== null &&
      (!best || folder.fsPath.length > best.folder.fsPath.length)
    )
      best = { folder, rel };
  }
  const segments = best ? best.rel.split(/[\\/]+/) : [p.basename(filePath)];
  if (best && folders.length > 1) segments.unshift(best.folder.name);
  const dPath = segments.map((s) => s.normalize("NFC")).join("/");
  const problem = pathProblem(dPath);
  return problem ? { ok: false, reason: problem } : { ok: true, dPath };
}
