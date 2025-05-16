# MASM Runner

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/istareatscreens)
[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.me/istareatscreens/5CAD)

MASM Runner is x86/x64 MASM (Microsoft Macro Assembly Language) code compiler, linker, runner extension for vscode that comes packaged with the [Irvine Library](http://asmirvine.com/) and runs on all OS.

This app is made possible through the use of [JWlink and JWasm](https://github.com/JWasm) to compile x86/x64 MASM and a 32-bit wine terminal to execute x86 executable binaries on mac and linux (webview) using [Boxedwine](http://www.boxedwine.org/) emscripten port.

This will also compile/link and execute MASM code (x86/x64) natively on windows through the vscode terminal (powershell/cmd) out of the box when the webview is not open on all windows systems.

Please note that this extension is far from perfect, contributions are appreciated.

# How To Use

Current commands can be accessed by pressing Ctrl+Shift+p on windows or Command ⌘+shift+p on mac

## Starting and Running Code

### MASM Runner Webview (CMD terminal) Start

- Command: masm runner start
- Description: Starts MASM CMD to allow compilation and running of code
- Start Webview Via Hotkey:
  - Windows/Linux: `Ctrl + Alt + m`
  - Mac: `⌘ Command + alt + m`

<figure><figcaption align = "center"><b>Starting Webview Via Command</b></figcaption><img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/start.gif"></figure>
&nbsp;

<figure><figcaption align = "center"><b>Starting Webview Via Button</b></figcaption><img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/start-masm-via-button.gif"></figure>
&nbsp;

### Compile and Run

- Command: masm runner compile
- Description: Runs code in current file and exports .obj and .exe files to file or workspace directory. Runs code in current file and exports .obj and .exe files to file or workspace directory. When executed this command will either compile/link and run the code:
  - In the native vscode terminal (Windows Only) running PowerShell, Command Prompt or Git Bash. Note if the webview is open native compiling will NOT occur - supports running x86/x64 (32-bit and 64-bit) MASM.
  - In the webview - supports running x86 (32-bit) MASM.
    Please note if the webview is running (you ran masm runner start) it will compile/link and run in the webview.
- Settings (via vscode options):
  - masmRunner.exportBinaries
    - Description: Export .exe and .obj from boxedwine webview on compile?
    - Default Value: True
- Running Code via Hotkey:
  - Windows/Linux: `Ctrl + alt + n`
  - Mac: `⌘ Command + Alt + n`

<figure><figcaption align ="center"><b>Running Code Via Context Menu</b></figcaption><img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/run-code-via-context-menu.jpg"></figure>
&nbsp;

<figure><figcaption align ="center"><b>Running/Compiling/Linking x86 MASM Code in Webview Via Command</b></figcaption><img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/compile-and-run.gif"></figure>
&nbsp;

<figure><figcaption align ="center"><b>Running/Compiling/Linking x86 MASM Code in Webview Via Button</b></figcaption><img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/start-masm-webview-run-code-via-button.gif"></figure>
&nbsp;

<figure><figcaption align ="center"><b>Running/Compiling/Linking x86 MASM Code in Native VSCode Terminal Via Command</b></figcaption><img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/native-compile-and-run.gif"></figure>
&nbsp;

<figure><figcaption align ="center"><b>Running/Compiling/Linking x86 MASM Code in Native VSCode Terminal Via Button</b></figcaption><img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/start-masm-native-run-code-via-button.gif"></figure>
&nbsp;

### Other Commands and Features

### MASM Runner restart

- Command: masm runner restart
- Description: restarts MASM Runner webview (If this does not work click the terminal and type ctrl+r or Command ⌘+r)
- Button is available in Menu next to run code and launch MASM webview button <img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/restart-button.jpg">

### Send File(s) to Webview

- Command: masm send file(s) to webview
- Description: Send file(s) to MASM Runner Webview
- Context Menu: In File explorer you can right click files to send to webview
- Settings (via vscode options):
  - masmRunner.enableContextMenus
    - Description: Enables context menu in Explorer (used to send files to boxedwine webview (cmd) - Default Value: True)
    - Default Value: True

<figure><figcaption align = "center"><b>Sending files to webview using context menu</b></figcaption><img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/send-files-preview.png"></figure>
&nbsp;

### Snippets

Current snippets include:

- masm-template - Generates standard template to write MASM x86 using Irvine32 library

<figure><figcaption align = "center"><b>masm-template Snippet Preview</b></figcaption><img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/snippet.gif"></figure>
&nbsp;

# Contributing

For development and contributing see [HERE](https://github.com/istareatscreens/vscode-masm-runner/blob/master/docs/CONTRIBUTING.md)

# Preview outside vscode:

**WARNING the web version is ~50mb in size**.  
The web version can be viewed [HERE](https://wasm-masm-x86-editor.netlify.app/) or see the repo to download the client version [HERE](https://github.com/istareatscreens/wasm-masm-x86-editor/releases)

# Troubleshooting

## Webview

If you have issues with the MASM webview please reset cache by doing the following:

### Manual

1. Open the MASM Webview
2. By pressing Ctrl+Shift+p on windows or Command ⌘+shift+p on mac open the command box
3. Type the following into the command box: ">Developer: Open Webview Developer Tools
4. Navigate to Application tab in 'Develop Tools' window
5. Go to Local Storage on the left menu verticle menu and expand it
6. Delete all key value pairs from the list from one of the sub menu items for Local Storage
7. Close the MASM WebView and reopen it

### Command

Alternatively:

1. Open MASM Webview
2. By pressing Ctrl+Shift+p on windows or Command ⌘+shift+p on mac open the command box
3. Type the following into the command box: ">masmRunner.resetCMDCache"
4. Close the MASM Webview
5. Reopen the MASM Webview, Cache should be cleared and everything should work

<figure><figcaption align = "center"><b>MasmRunner.resetCMDCache example use</b></figcaption><img src="https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/masm-webview-clear-cache.gif"></figure>
&nbsp;
