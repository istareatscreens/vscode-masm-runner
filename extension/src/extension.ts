import * as vscode from "vscode";
import { basename, dirname, extname, join } from "path";
import { platform } from "os";
import fs = require("fs");
import { isBinaryFile } from "isbinaryfile";

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
        state: any
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
          await MasmRunnerPanel.currentPanel.sendFile(files);
        } else {
          vscode.window.showInformationMessage("Webview not open");
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "masmRunner.resetCMD",
      (fileUri: vscode.Uri) => {
        if (MasmRunnerPanel.currentPanel) {
          MasmRunnerPanel.currentPanel.resetCMD();
        }
      }
    )
  );
}

function getWebviewOptions(extensionUri: vscode.Uri): any {
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

  const isWindows = platform() !== "win32";
  const webViewRunning = MasmRunnerPanel.isRunning();

  if (isWindows && !webViewRunning) {
    //runCodeNatively(document);
    vscode.window.showInformationMessage("To be implemented");
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

async function runCodeNatively(document: vscode.TextDocument) {
  const terminal = vscode.window.createTerminal();
  terminal.sendText("echo 'Sent text immediately after creating'");
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

async function readFile(filePath: string) {
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

  public async sendFile(...files: any[]) {
    const [, fileList] = files[0];

    if (fileList.length == 0) {
      vscode.window.showInformationMessage("No files selected");
      return;
    }

    Promise.all(
      fileList
        .filter((file) => file.scheme === "file")
        .map((file) => readFile(file.fsPath))
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
      .catch((e) => {
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

  private compileCode(document) {
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

  private _postMessage(eventName: string, data: any = {}) {
    this._panel.webview.postMessage(
      JSON.stringify({ eventName: eventName, data: { data: data } })
    );
  }

  // Layer div applies a layer so that the panel can be clicked again to allow typing in it
  public updateChangedView() {
    this._postMessage("editor-selected", {});
  }

  public doRefactor() {
    // Send a message to the webview webview.
    // You can send any JSON serializable data.
    this._panel.webview.postMessage({ command: "refactor" });
  }

  public static isRunning() {
    return MasmRunnerPanel.currentPanel !== undefined;
  }

  public dispose() {
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

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = "Masm x86 Runner CMD";
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Local path to main script run in the webview

    const stylesPathMainPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "style.css"
    );

    const boxedwineIndexPathOnDisk = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "index-bw.js"
    );

    const boxedwinePathOnDisk = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "boxedwine.js"
    );
    const baseUriPathOnDisk = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "/"
    );

    // And the uri we use to load this script in the webview
    const boxedwineUri = webview.asWebviewUri(boxedwinePathOnDisk);
    const indexBoxedWineUri = webview.asWebviewUri(boxedwineIndexPathOnDisk);
    const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
    const baseUri = webview.asWebviewUri(baseUriPathOnDisk);

    // Uri to load styles into webview

    // Use a nonce to only allow specific scripts to be run

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

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
