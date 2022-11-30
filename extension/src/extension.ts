import * as vscode from "vscode";
import { basename, dirname, extname, join } from "path";
import { doubleQuoteSpacedDirectories } from "./helperFunctions";
import { handleIncludes } from "./handleIncludes";
import { platform } from "os";
import fs = require("fs");
import { isBinaryFile } from "isbinaryfile";
import { FileData, FileProfile, Merge, WorkspaceFileList } from "./types";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("masmRunner.start", () => {
      MasmRunnerPanel.createOrShow(context.extensionUri);
    })
  );

  if (vscode.window.registerWebviewPanelSerializer) {
    // Make sure we register a serializer in activation event
    vscode.window.registerWebviewPanelSerializer(MasmRunnerPanel.viewType, {
      async deserializeWebviewPanel(
        webviewPanel: vscode.WebviewPanel,
        _state: any
      ) {
        //console.log(`Got state: ${state}`);
        // Reset the webview options so we use latest uri for `localResourceRoots`.
        webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
        MasmRunnerPanel.revive(webviewPanel, context.extensionUri);
      },
    });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "masmRunner.runCode",
      (fileUri: vscode.Uri) => {
        runCode(fileUri);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "masmRunner.sendToMasmWebview",
      async (...files) => {
        if (MasmRunnerPanel.currentPanel) {
          await MasmRunnerPanel.currentPanel.sendFile(<WorkspaceFileList>files);
        } else {
          vscode.window.showInformationMessage("Webview not open");
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("masmRunner.resetCMD", () => {
      if (MasmRunnerPanel.currentPanel) {
        MasmRunnerPanel.currentPanel.resetCMD();
      }
    })
  );
}

function getWebviewOptions(
  extensionUri: vscode.Uri
): Merge<vscode.WebviewOptions, { retainContextWhenHidden: boolean }> {
  return {
    // Enable javascript in the webview
    enableScripts: true,
    retainContextWhenHidden: true,
    // And restrict the webview to only loading content from our extension's `media` directory.
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
  };
}

async function runCode(fileUri: vscode.Uri): Promise<void> {
  const _runFromExplorer = checkIsRunFromExplorer(fileUri);
  let document: undefined | vscode.TextDocument = undefined;
  if (_runFromExplorer) {
    document = await vscode.workspace.openTextDocument(fileUri);
  } else {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      document = editor.document;
    } else {
      vscode.window.showInformationMessage("No code found or selected.");
      return;
    }
  }

  if (!document) {
    vscode.window.showInformationMessage("File not found");
    return;
  }

  const filename = basename(document.fileName);
  const fileExtension = extname(document.fileName);

  if (fileExtension != ".asm") {
    vscode.window.showInformationMessage(
      "Please make sure file has extension .asm"
    );
    return;
  }

  const isWindows = platform() === "win32";
  const webViewRunning = MasmRunnerPanel.isRunning();

  if (isWindows && !webViewRunning) {
    runCodeNatively(document);
    return;
  }

  if (webViewRunning) {
    MasmRunnerPanel.currentPanel?.runCode(document, filename);
    return;
  }

  vscode.window.showInformationMessage(
    "Please run masmRunner.start command to compile/run code"
  );
}
function checkIsRunFromExplorer(fileUri: vscode.Uri): boolean {
  const editor = vscode.window.activeTextEditor;
  if (!fileUri || !fileUri.fsPath) {
    return false;
  }
  if (!editor) {
    return true;
  }
  if (fileUri.fsPath === editor.document.uri.fsPath) {
    return false;
  }
  return true;
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

  const customCompileArguments = {
    start: vscode.workspace
      .getConfiguration("masmRunner")
      .get("addCustomCompilerArgumentsAtStart"),
    end: vscode.workspace
      .getConfiguration("masmRunner")
      .get("addCustomCompilerArgumentsAtEnd"),
  };

  const customLinkArguments = {
    start: vscode.workspace
      .getConfiguration("masmRunner")
      .get("addCustomLinkArgumentsAtStart"),
    library: vscode.workspace
      .getConfiguration("masmRunner")
      .get("addCustomLinkArgumentsLibrary"),
    end: vscode.workspace
      .getConfiguration("masmRunner")
      .get("addCustomLinkArgumentsAtEnd"),
  };

  //path to the irvine to extension directory
  const pathLink: string = __dirname.slice(0, __dirname.lastIndexOf("\\"));

  const nativeUriPath = "native\\";
  const getPath = getPathBuilder(pathLink + "\\" + nativeUriPath);

  const jwasmExe = doubleQuoteSpacedDirectories(
    getPath(["JWASM", "JWASM.EXE"])
  ).replaceAll("\\", `${isGitBash ? "/" : "\\"}`);

  const jWLinkExe = doubleQuoteSpacedDirectories(
    getPath(["JWLINK", "JWlink.exe"])
  ).replaceAll("\\", `${isGitBash ? "/" : "\\"}`);

  //irvine lib path
  const libPath = getPath(["irvine"]);

  const irvine32Path = getPath(["irvine", "Irvine32.lib"]);

  const irvine32Inc = getPath(["irvine", "Irvine32.inc"]);

  const kernel32Path = getPath(["irvine", "Kernel32.Lib"]);

  const user32Path = getPath(["irvine", "User32.Lib"]);

  //creates a new file based on the document the user is working on
  const newPath = vscode.Uri.file(
    document.fileName.slice(0, document.fileName.length - 4) +
      ".temp." +
      document.fileName.slice(-3)
  );

  await handleIncludes(document, irvine32Inc);
  // replace irvine path library to native one to allow simple Irvine include statment in asm file
  // moved
  const irvineLib32Match = /include.+irvine32(\.inc|)/im;
  let fileData = document.getText();
  fileData = fileData.replace(irvineLib32Match, "INCLUDE " + irvine32Inc);
  // end moved

  const filename = basename(newPath.fsPath).slice(
    0,
    -extname(newPath.fsPath).length
  );

  // create the command variables
  const currentDirectory = newPath.fsPath.slice(
    0,
    -basename(newPath.fsPath).length
  );

  // constructing terminal commands
  const commandDelimiter = getTerminalDelimiter(currentTerminalType ?? "");
  const masmCompilerFlags = "/Zd /coff".replaceAll(
    "/",
    `${isGitBash ? "//" : "/"}`
  );
  const masmCompileCommand = `${jwasmExe} ${
    customCompileArguments.start
  } ${masmCompilerFlags} "${currentDirectory + filename}.asm" ${
    customCompileArguments.end
  }`;
  const masmLibraryLink = `${jWLinkExe} ${
    customLinkArguments.start
  } format windows pe LIBPATH "${libPath}" LIBRARY "${irvine32Path}" LIBRARY "${kernel32Path}" LIBRARY "${user32Path}" ${
    customLinkArguments.library
  } file "${currentDirectory + filename}.obj" ${customLinkArguments.end}`;
  const masmExecutable = `${
    doubleQuoteSpacedDirectories(currentDirectory).replaceAll(
      "\\",
      `${isGitBash ? "/" : "\\"}`
    ) + filename
  }.exe`;
  await fs.promises
    .writeFile(newPath.fsPath, fileData)
    .then(() =>
      terminal.sendText(
        `${masmCompileCommand} ${commandDelimiter} ${masmLibraryLink} ${commandDelimiter} ${masmExecutable}`
      )
    );
  // TODO: Clean up and rename files
}

function getTerminalDelimiter(terminalName: string): string {
  return (
    {
      PowerShell: ";",
    }?.[terminalName] ?? "&&"
  );
}

function getTerminalType(): string | null {
  const defaultTerminalType = <string | undefined | null>(
    vscode.workspace
      .getConfiguration()
      .get("terminal.integrated.defaultProfile.windows")
  );
  return defaultTerminalType ?? "PowerShell";
}

function getPathBuilder(basePath: string) {
  return (params: string[]) =>
    vscode.Uri.joinPath(vscode.Uri.file(basePath), ...params).fsPath;
}

function writeFileToWorkspace(
  filename: string,
  fileData: string,
  filePath: string
) {
  const newPath = vscode.Uri.file(filePath.slice(0, -3) + filename.slice(-3));
  fs.writeFile(newPath.fsPath, fileData, { encoding: "base64" }, (error) => {
    if (error) {
      console.log(
        "Could not write to file: " + newPath.fsPath + ": " + error.message
      );
    }
  });
}

async function readFile(filePath: string): Promise<FileProfile> {
  const filename = basename(filePath);
  const fileExtension = extname(filePath);
  const fileBaseName = filename.substring(
    0,
    filename.length - fileExtension.length
  );
  return Promise.all([
    filename,
    fileExtension,
    fileBaseName,
    filePath,
    fs.promises.readFile(filePath),
    fs.promises.stat(filePath),
    isBinaryFile(filePath),
  ]).then(
    ([
      filename,
      fileExtension,
      fileBaseName,
      filePath,
      fileData,
      fileMetaData,
      isBinary,
    ]) => ({
      filename,
      fileExtension,
      fileBaseName,
      filePath,
      fileData,
      fileMetaData,
      isBinary,
    })
  );
}

/**
 * Manages MASM webview panel
 */
class MasmRunnerPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: MasmRunnerPanel | undefined;

  public static readonly viewType = "masmRunner";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (MasmRunnerPanel.currentPanel) {
      MasmRunnerPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      MasmRunnerPanel.viewType,
      "MASM Runner",
      column || { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
      getWebviewOptions(extensionUri)
    );

    MasmRunnerPanel.currentPanel = new MasmRunnerPanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    MasmRunnerPanel.currentPanel = new MasmRunnerPanel(panel, extensionUri);
  }

  public async resetCMD() {
    this._postMessage("reset");
  }

  public async sendFile(files: WorkspaceFileList): Promise<void> {
    const [, fileList] = files;

    if (fileList.length == 0) {
      vscode.window.showInformationMessage("No files selected");
      return;
    }

    Promise.all(
      fileList
        .filter((file: FileData) => file.scheme === "file")
        .map((file: FileData) => readFile(file.fsPath))
    )
      .then((files) => {
        this._postMessage(
          "send-files",
          files.map((file) => {
            const fileData = file.isBinary
              ? file.fileData.toString("base64")
              : file.fileData.toString();

            return Object.assign({}, file, {
              fileData: fileData,
              size: file.isBinary ? file.fileMetaData.size : fileData.length,
            });
          })
        );
      })
      .catch((_e) => {
        vscode.window.showInformationMessage("Could not send file(s)");
      });
  }

  public runCode(document: vscode.TextDocument, filename: string): void {
    const text = document.getText();
    const exportBinaries = vscode.workspace
      .getConfiguration("masmRunner")
      .get("exportBinaries");
    const filePath =
      vscode?.window?.activeTextEditor?.document?.uri?.fsPath ??
      vscode?.workspace?.workspaceFolders?.[0]?.uri?.path ??
      null;
    this._postMessage("compile-and-run", {
      filename: filename,
      text: text,
      filePath: filePath,
      exportBinaries: exportBinaries,
      time: new Date().getTime(),
    });
  }

  private createFile(filename: string) {
    this._writeCommandToCMD(`echo.>${filename}`);
  }

  private compileCode(document: vscode.TextDocument) {
    const filename = document?.fileName;
    if (!filename) {
      return;
    }

    this._writeCommandToCMD(
      `assemble ${filename.substring(0, filename.length - 4)}`
    );
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    vscode.window.onDidChangeTextEditorViewColumn(() =>
      this.updateChangedView()
    );
    vscode.window.onDidChangeWindowState(() => this.updateChangedView());
    this._panel.onDidChangeViewState(() => this.updateChangedView());

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "save-file-to-disk":
            if (!message.filePath) {
              console.log("Invalid path could not save file");
              break;
            }
            writeFileToWorkspace(
              message.filename,
              message.fileData,
              message.filePath
            );
            break;
        }
      },
      null,
      this._disposables
    );
  }

  //Send commands to console
  private _writeCommandToCMD(command: string): void {
    const commandArray: string[] = [];
    for (const char of command) {
      switch (char) {
        case ".":
          commandArray.push("period");
          break;
        case ">":
          commandArray.push("shift");
          commandArray.push("period");
          commandArray.push("/shift");
          break;
        case " ":
          commandArray.push("spacebar"); //check for whitespace
          break;
        case "-":
          commandArray.push("dash");
        // eslint-disable-next-line no-fallthrough
        case "_":
          commandArray.push("shift");
          commandArray.push("dash");
          commandArray.push("/shift");
          break;
        case "&":
          commandArray.push("shift");
          commandArray.push("7");
          commandArray.push("/shift");
        // eslint-disable-next-line no-fallthrough
        default:
          commandArray.push(char);
      }
    }
    commandArray.push("enter");
    this._postMessage("write-command", {
      commandArray,
    });
  }

  private _postMessage(eventName: string, data: any = {}): void {
    this._panel.webview.postMessage(
      JSON.stringify({ eventName: eventName, data: { data: data } })
    );
  }

  // Layer div applies a layer so that the panel can be clicked again to allow typing in it
  public updateChangedView(): void {
    this._postMessage("editor-selected", {});
  }

  public doRefactor(): void {
    // Send a message to the webview webview.
    // You can send any JSON serializable data.
    this._panel.webview.postMessage({ command: "refactor" });
  }

  public static isRunning(): boolean {
    return MasmRunnerPanel.currentPanel !== undefined;
  }

  public dispose(): void {
    MasmRunnerPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update(): void {
    const webview = this._panel.webview;
    this._panel.title = "Masm x86 Runner CMD";
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const getWebviewPath = (pathParameters: string[]) =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, ...pathParameters)
      );

    const boxedwineUri = getWebviewPath(["media", "boxedwine.js"]);
    const indexBoxedWineUri = getWebviewPath(["media", "index-bw.js"]);
    const stylesMainUri = getWebviewPath(["media", "style.css"]);
    const baseUri = getWebviewPath(["media"]);

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="boxedwine authors" content="James Bryant, Kevin O'Dwyer" />
				<link href="${stylesMainUri}" rel="stylesheet">
				<title>Document</title>
			</head>
      <body class="boxedwine-body">
      <!-- if running inline add style="display: none" to id="loading" and id="inline" and remove same from id="run-inline" -->
      <div id="loading">
        <figure id="spinner" style="overflow: visible">
          <div
            class="spinner"
            style="margin-top: 0.5em; margin-left: auto; margin-right: auto"
          ></div>
        </figure>
        <div class="emscripten" id="status">Loading...</div>
        <div class="emscripten">
          <progress value="0" max="100" id="progress"></progress>
        </div>
    </div>
    <div id="bw-root"></div>
    <noscript> You need to enable JavaScript to run this app. </noscript>
    <script>
      window.vscode = acquireVsCodeApi();
    </script>
    <script nounce="${getNonce()}" defer src="${indexBoxedWineUri}"></script>
    <script nounce="${getNonce()}" defer src="${boxedwineUri}"></script>
    <input type="hidden" id="baseUri" value="${baseUri}"> 
		</body>
		</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
