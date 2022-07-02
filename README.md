[![Netlify Status](https://api.netlify.com/api/v1/badges/0c76358f-a3f9-45c4-b16c-d4ad4017ad5c/deploy-status)](https://app.netlify.com/sites/wasm-masm-x86-editor/deploys)

# WASM MASM x86 Editor

WASM MASM x86 Editor is a portable x86 Microsoft Assembly Language (MASM) code compiler, linker, runner and editor packaged with the [Irvine Library](http://asmirvine.com/)

This app is made possible through the use of [JWlink and JWasm](https://github.com/JWasm) to compile x86/x64 MASM and a 32-bit wine terminal to execute x86 executable binaries using [Boxedwine](http://www.boxedwine.org/) emscripten port. The text editor functionality is provided by [CodeMirror](https://codemirror.net/)

![preview gif](https://i.imgur.com/Ct41UUK.gif)

**WARNING the web version is ~50mb in size**.  
The web version can be viewed [HERE](https://wasm-masm-x86-editor.netlify.app/).

## Download

You can download a client version for Mac, Windows and Linux [HERE](https://github.com/istareatscreens/wasm-masm-x86-editor/releases)

## TODO

- Add alt text to elements
- Implement INCLUDE Irvine32.inc as a replacement to current INCLUDE statement
- Add Project save and load (save local storage states)
- Add multiple file addition in createfile window
- Implement workers to improve performance
- Improve syntax highlighting
- Refactor code
- Add resizable components
- Implement vim (issue in dependency)
- shrink boxedwine.zip for web version

## Bugs

- Add escape key to exit modals (about)
- create/delete/rename file can crash and dysnc boxedwines file system
- Check asm files for correct irivine import before compile/link to prevent hard crash
- Add throttling to buttons
- deal with hard and soft crashes in a more graceful way (refresh iframe)
- remove javascript exception printout executed by boxedwine on iframe
- windows dont move to the front on click
