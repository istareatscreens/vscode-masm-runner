import * as path from "path";

export type NativeShell = "PowerShell" | "Command Prompt" | "Git Bash";

export interface CustomArguments {
  compileStart: string;
  compileEnd: string;
  linkStart: string;
  linkLibrary: string;
  linkEnd: string;
}

export interface NativeBuildPlan {
  binDir: string;
  copyPath: string;
  copyText: string;
  stale: string[];
  command: string;
}

const win = path.win32;

export const rewriteIrvine32 = (text: string, irvine32Inc: string): string =>
  text.replace(/include.+irvine32(\.inc|)/im, "INCLUDE " + irvine32Inc);

export function doubleQuoteSpacedDirectories(p: string): string {
  const [drive, ...folders] = p.split("\\");
  return `${drive}\\${folders.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join("\\")}`;
}

export function planNativeBuild(o: {
  shell: NativeShell;
  nativeDir: string;
  sourcePath: string;
  sourceText: string;
  custom: CustomArguments;
}): NativeBuildPlan {
  const gitBash = o.shell === "Git Bash";
  const exe = (p: string) =>
    doubleQuoteSpacedDirectories(p).replaceAll("\\", gitBash ? "/" : "\\");
  const lib = win.join(o.nativeDir, "irvine");
  const dir = win.dirname(o.sourcePath);
  const base = win.basename(o.sourcePath).replace(/\.asm$/i, "");
  const binDir = win.join(dir, "bin");
  const copyPath = win.join(binDir, base + ".asm");
  const obj = win.join(binDir, base + ".obj");
  const program = win.join(binDir, base + ".exe");
  // a drive root ("C:\") would end the quoted argument with \" ; "C:\." is the same folder
  const sourceDir = dir.endsWith("\\") ? dir + "." : dir;

  const flags =
    `/Zd /coff /I"${sourceDir}" /I"${lib}" /Fo"${obj}" /Fw"${win.join(binDir, base + ".err")}" `.replaceAll(
      "/",
      gitBash ? "//" : "/",
    );
  const compile = `${exe(win.join(o.nativeDir, "JWASM", "JWASM.EXE"))} ${o.custom.compileStart} ${flags} "${copyPath}" ${o.custom.compileEnd}`;
  const link = `${exe(win.join(o.nativeDir, "JWLINK", "JWlink.exe"))} ${o.custom.linkStart} format windows pe LIBPATH "${lib}" LIBRARY "${win.join(lib, "Irvine32.lib")}" LIBRARY "${win.join(lib, "Kernel32.lib")}" LIBRARY "${win.join(lib, "User32.lib")}" ${o.custom.linkLibrary} file "${obj}" name "${program}" ${o.custom.linkEnd}`;
  const run =
    doubleQuoteSpacedDirectories(binDir + "\\").replaceAll(
      "\\",
      gitBash ? "/" : "\\",
    ) +
    base +
    ".exe";
  const command =
    o.shell === "PowerShell"
      ? `${compile}; if ($?) { ${link}; if ($?) { ${run} } }`
      : `${compile} && ${link} && ${run}`;

  return {
    binDir,
    copyPath,
    copyText: rewriteIrvine32(o.sourceText, win.join(lib, "Irvine32.inc")),
    stale: [obj, program],
    command,
  };
}
