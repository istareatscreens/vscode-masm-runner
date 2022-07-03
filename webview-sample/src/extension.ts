import * as vscode from "vscode";
import { basename, dirname, extname, join } from "path";

const cats = {
  "Coding Cat": "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
  "Compiling Cat": "https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif",
  "Testing Cat": "https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif",
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("catCoding.start", () => {
      CatCodingPanel.createOrShow(context.extensionUri);
    })
  );

  if (vscode.window.registerWebviewPanelSerializer) {
    // Make sure we register a serializer in activation event
    vscode.window.registerWebviewPanelSerializer(CatCodingPanel.viewType, {
      async deserializeWebviewPanel(
        webviewPanel: vscode.WebviewPanel,
        state: any
      ) {
        console.log(`Got state: ${state}`);
        // Reset the webview options so we use latest uri for `localResourceRoots`.
        webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
        CatCodingPanel.revive(webviewPanel, context.extensionUri);
      },
    });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "catCoding.runCode",
      (fileUri: vscode.Uri) => {
        if (CatCodingPanel.currentPanel) {
          CatCodingPanel.currentPanel.runCode(fileUri);
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

/**
 * Manages cat coding webview panels
 */
class CatCodingPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  public static currentPanel: CatCodingPanel | undefined;

  public static readonly viewType = "catCoding";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (CatCodingPanel.currentPanel) {
      CatCodingPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      CatCodingPanel.viewType,
      "Cat Coding",
      column || vscode.ViewColumn.One,
      getWebviewOptions(extensionUri)
    );

    CatCodingPanel.currentPanel = new CatCodingPanel(panel, extensionUri);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    CatCodingPanel.currentPanel = new CatCodingPanel(panel, extensionUri);
  }
  private _runFromExplorer: boolean | undefined;
  private _document: vscode.TextDocument | undefined;

  public async runCode(fileUri: vscode.Uri) {
    this._runFromExplorer = this.checkIsRunFromExplorer(fileUri);
    if (this._runFromExplorer) {
      this._document = await vscode.workspace.openTextDocument(fileUri);
    } else {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        this._document = editor.document;
      } else {
        vscode.window.showInformationMessage("No code found or selected.");
        return;
      }
    }

    // Add check for extension
    if (!this._document) {
      vscode.window.showInformationMessage("File not found");
      return;
    }

    const filename = basename(this._document.fileName);
    const fileExtension = extname(this._document.fileName);
    if (fileExtension != ".asm") {
      vscode.window.showInformationMessage(
        "Please make sure file has extension .asm"
      );
      return;
    }

    const text = this._document.getText();
    this._postMessage("compile-and-run", {
      data: {
        filename: filename,
        text: text,
        time: new Date().getTime(),
      },
    });
  }

  private createFile(filename: string) {
    this._writeCommandToCMD(`echo.>${filename}`);
  }

  private compileCode() {
    const filename = this._document?.fileName;
    if (!filename) {
      return;
    }

    this._writeCommandToCMD(
      `assemble ${filename.substring(0, filename.length - 4)}`
    );
  }

  private checkIsRunFromExplorer(fileUri: vscode.Uri): boolean {
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
          case "alert":
            vscode.window.showErrorMessage(message.text);
            return;
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
      data: commandArray,
    });
  }

  private _postMessage(eventName: string, data: any) {
    this._panel.webview.postMessage(
      JSON.stringify({ eventName: eventName, data: data })
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

  public dispose() {
    CatCodingPanel.currentPanel = undefined;

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
    this._updateForCat(webview, "Coding Cat");
  }

  private _updateForCat(webview: vscode.Webview, catName: keyof typeof cats) {
    this._panel.title = catName;
    this._panel.webview.html = this._getHtmlForWebview(webview, cats[catName]);
  }

  private _getHtmlForWebview(webview: vscode.Webview, catGifPath: string) {
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
        <div class="emscripten" id="status">Downloading...</div>
        <div class="emscripten">
          <progress value="0" max="100" id="progress"></progress>
        </div>
    </div>
    <div id="bw-root"></div>
    <noscript> You need to enable JavaScript to run this app. </noscript>
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
