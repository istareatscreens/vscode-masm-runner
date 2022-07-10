# MASM Runner

MASM Runner is x86 MASM (Microsoft Macro Assembly Language) code compiler, linker, runner extension for vscode that comes packaged with the [Irvine Library](http://asmirvine.com/) and runs on all OS.

This app is made possible through the use of [JWlink and JWasm](https://github.com/JWasm) to compile x86/x64 MASM and a 32-bit wine terminal to execute x86 executable binaries using [Boxedwine](http://www.boxedwine.org/) emscripten port.

Please note that this is still missing a lot of features and is far from perfect. Contributions are appreciated.

# How To Use

Current commands can be accessed by pressing Ctrl+Shift+p on windows or Command ⌘+shift+p on mac

## Starting

### MASM Runner CMD start

- Command: masm runner start
- Description: Starts MASM CMD to allow compilation and running of code

![start MASM CMD preview](https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/start.gif)

### Compile and Run

- Command: masm runner compile
- Description: Runs code in current file

![compile and run MASM code preview](https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/compile_and_run.gif)

### MASM Runner restart

- Command: masm runner restart
- Description: restarts MASM Runner CMD (If this does not work click the terminal and type ctrl+r or Command ⌘+r)

### Snippets

Current snippets include:

- masm-template - Generates standard template to write MASM x86 using Irvine32 library
  ![masm-template snippet preview](https://raw.githubusercontent.com/istareatscreens/vscode-masm-runner/master/docs/snippet.gif)

# Contributing

For development and contributing see [HERE](https://github.com/istareatscreens/vscode-masm-runner/blob/master/docs/CONTRIBUTING.md)

# Preview outside vscode:

**WARNING the web version is ~50mb in size**.  
The web version can be viewed [HERE](https://wasm-masm-x86-editor.netlify.app/) or see the repo to download the client version [HERE](https://github.com/istareatscreens/wasm-masm-x86-editor/releases)
