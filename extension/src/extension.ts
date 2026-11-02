import * as vscode from "vscode";
import { basename, extname } from "path";
import { platform } from "os";
import * as fs from "fs";
import { setupSyntaxHighlightingControl } from "./syntax/highlightingControl";
import { setupSemanticHighlighting } from "./syntax/semanticTokens";
import { MasmRunnerPanel } from "./webview/MasmRunnerPanel";
import { disposeTerminalLog } from "./webview/terminalLog";
import { planNativeBuild } from "./native/nativeBuild";
import type { NativeShell } from "./native/nativeBuild";

const notOpen = (what: string) =>
  vscode.window.showInformationMessage(
    "The MASM Runner terminal is not open: run \"Start MASM runner CMD\" (Ctrl+Alt+M) first, then " + what + "."
  );

export function activate(context: vscode.ExtensionContext) {
  setupSyntaxHighlightingControl(context);
  setupSemanticHighlighting(context);
  context.subscriptions.push({ dispose: disposeTerminalLog });

  context.subscriptions.push(
    vscode.commands.registerCommand("masmRunner.start", () => {
      MasmRunnerPanel.createOrShow(context);
    })
  );

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(MasmRunnerPanel.viewType, {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
        MasmRunnerPanel.revive(webviewPanel, context);
      },
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "masmRunner.runCode",
      (fileUri?: vscode.Uri) => runCode(fileUri)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "masmRunner.sendToMasmWebview",
      async (clicked?: vscode.Uri, selected?: vscode.Uri[]) => {
        const panel = MasmRunnerPanel.currentPanel;
        if (!panel) {
          vscode.window.showInformationMessage("Webview not open");
          return;
        }
        const uris = selected && selected.length ? selected : clicked ? [clicked] : [];
        if (!uris.length) {
          vscode.window.showInformationMessage(
            "Select the files in the Explorer, then use \"Send file(s) to MASM Runner Webview\" from their context menu."
          );
          return;
        }
        try {
          await panel.sendFiles(uris);
        } catch (e) {
          vscode.window.showErrorMessage(
            "MASM Runner: could not send the file(s): " + (e instanceof Error ? e.message : String(e))
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("masmRunner.resetCMD", async () => {
      const panel = MasmRunnerPanel.currentPanel;
      if (!panel) {
        notOpen("restart it");
        return;
      }
      await panel.resetTerminal();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("masmRunner.resetCMDCache", async () => {
      const panel = MasmRunnerPanel.currentPanel;
      if (!panel) {
        notOpen("reset it");
        return;
      }
      await panel.factoryReset();
    })
  );
}

async function runCode(fileUri?: vscode.Uri): Promise<void> {
  let document: vscode.TextDocument | undefined;
  try {
    document = fileUri
      ? await vscode.workspace.openTextDocument(fileUri)
      : vscode.window.activeTextEditor?.document;
  } catch (e) {
    vscode.window.showErrorMessage(
      "MASM Runner: could not open " + (fileUri ? fileUri.fsPath : "the file") + ": " + (e instanceof Error ? e.message : String(e))
    );
    return;
  }
  if (!document) {
    vscode.window.showInformationMessage("No code found or selected.");
    return;
  }

  if (extname(document.fileName).toLowerCase() !== ".asm") {
    vscode.window.showInformationMessage(
      "Please make sure file has extension .asm"
    );
    return;
  }

  const isWindows = platform() === "win32";
  const panel = MasmRunnerPanel.currentPanel;

  if (isWindows && !panel) {
    runCodeNatively(document);
    return;
  }

  if (panel) {
    try {
      await panel.runCode(document);
    } catch (e) {
      vscode.window.showErrorMessage(
        "MASM Runner: could not compile and run " + basename(document.fileName) + ": " + (e instanceof Error ? e.message : String(e))
      );
    }
    return;
  }

  vscode.window.showInformationMessage(
    "Please run masmRunner.start command to compile/run code"
  );
}

function sleepUntil(callback: () => any, timeout: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeWas = new Date().getTime();
    const wait = setInterval(function () {
      const result = callback();
      if (result) {
        clearInterval(wait);
        resolve(result);
      } else if (new Date().getTime() - timeWas > timeout) {
        // Timeout
        clearInterval(wait);
        return reject();
      }
    }, 300);
  });
}

async function getVscodeTerminal(name = ""): Promise<vscode.Terminal | null> {
  const numberOfTerminals = vscode.window.terminals.length;
  try {
    const terminal = vscode.window.createTerminal(name);
    await sleepUntil(
      () => vscode.window.terminals.length === numberOfTerminals + 1,
      10000
    );
    return terminal;
  } catch (e) {
    vscode.window.showInformationMessage("No vscode terminal found");
    return null;
  }
}

async function runCodeNatively(document: vscode.TextDocument) {
  const currentTerminalType = getTerminalType();
  const isGitBash = currentTerminalType === "Git Bash";
  if (
    !(
      currentTerminalType === "Command Prompt" ||
      currentTerminalType === "PowerShell" ||
      isGitBash
    )
  ) {
    vscode.window.showInformationMessage(
      "Your current default terminal is unsupported please change your default terminal to use MASM Runner extension"
    );
    return;
  }

  const terminalName = "MASM Runner";
  const terminal =
    vscode.window.terminals.find(({ name }) => terminalName === name) ??
    (await getVscodeTerminal(terminalName));

  if (!terminal) {
    vscode.window.showInformationMessage(
      "An error occured unable to acquire terminal"
    );
    return;
  }

  terminal.show();

  const settings = vscode.workspace.getConfiguration("masmRunner");
  //path to the irvine to extension directory
  const pathLink: string = __dirname.slice(0, __dirname.lastIndexOf("\\"));

  const plan = planNativeBuild({
    shell: currentTerminalType as NativeShell,
    nativeDir: vscode.Uri.file(pathLink + "\\native").fsPath,
    sourcePath: document.fileName,
    sourceText: document.getText(),
    custom: {
      compileStart: settings.get<string>("addCustomCompilerArgumentsAtStart", ""),
      compileEnd: settings.get<string>("addCustomCompilerArgumentsAtEnd", ""),
      linkStart: settings.get<string>("addCustomLinkArgumentsAtStart", ""),
      linkLibrary: settings.get<string>("addCustomLinkArgumentsLibrary", ""),
      linkEnd: settings.get<string>("addCustomLinkArgumentsAtEnd", ""),
    },
  });
  try {
    await fs.promises.mkdir(plan.binDir, { recursive: true });
    // a failed build must not leave an old program to run (one still running stays; the linker reports it)
    for (const f of plan.stale) await fs.promises.rm(f, { force: true }).catch(() => undefined);
    await fs.promises.writeFile(plan.copyPath, plan.copyText);
  } catch (e) {
    vscode.window.showErrorMessage(
      "MASM Runner: could not prepare " + plan.binDir + ": " + (e instanceof Error ? e.message : String(e))
    );
    return;
  }
  terminal.sendText(plan.command);
}

function getTerminalType(): string | null {
  const defaultTerminalType = <string | undefined | null>(
    vscode.workspace
      .getConfiguration()
      .get("terminal.integrated.defaultProfile.windows")
  );
  return defaultTerminalType ?? "PowerShell";
}
