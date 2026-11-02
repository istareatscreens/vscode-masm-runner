import * as vscode from "vscode";

let channel: vscode.LogOutputChannel | undefined;

export function terminalLog(): vscode.LogOutputChannel {
  if (!channel)
    channel = vscode.window.createOutputChannel("MASM Runner", { log: true });
  return channel;
}

const LINE_MAX = 4000;

export function logFromPage(level: unknown, text: unknown): void {
  const line = typeof text === "string" ? text.slice(0, LINE_MAX) : "";
  if (!line) return;
  const log = terminalLog();
  if (level === "error") log.error(line);
  else if (level === "warn") log.warn(line);
  else log.info(line);
}

export function disposeTerminalLog(): void {
  if (channel) channel.dispose();
  channel = undefined;
}
