import * as nodeFs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";

export interface ExportFile {
  ext: string; // ".obj" | ".exe"
  bytes: Uint8Array;
}

export interface ExportResult {
  written: string[];
  failed: { file: string; reason: string }[];
}

type Fs = Pick<typeof nodeFs.promises, "mkdir" | "writeFile" | "rename" | "rm">;

/** <source folder>/bin/<base><ext>: "C:\work\LAB1.ASM" + ".exe" -> "C:\work\bin\LAB1.exe" */
export const exportTarget = (sourcePath: string, ext: string): string => {
  const dir = path.join(path.dirname(sourcePath), "bin");
  const base = path.basename(sourcePath).replace(/\.asm$/i, "");
  return path.join(dir, base + ext);
};

export async function exportBinaries(
  sourcePath: string,
  files: ExportFile[],
  fsp: Fs = nodeFs.promises,
): Promise<ExportResult> {
  const result: ExportResult = { written: [], failed: [] };
  for (const f of files) {
    if (!/^\.(obj|exe)$/i.test(f.ext)) continue;
    const target = exportTarget(sourcePath, f.ext.toLowerCase());
    const temp = target + ".tmp-" + randomBytes(4).toString("hex");
    try {
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(temp, f.bytes);
      await fsp.rename(temp, target);
      result.written.push(target);
    } catch (e) {
      await fsp.rm(temp, { force: true }).catch(() => undefined);
      // Node's message starts with the code: "EPERM: operation not permitted, rename ..."
      result.failed.push({
        file: target,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return result;
}
