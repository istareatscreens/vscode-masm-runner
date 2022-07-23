import React, { useRef, useEffect, useState } from "react";
import { createMessageListner } from "../../utility/utilityFunctions";
import { keyCodes } from "./keypress.js";
import FileSystem from "./FileSystem";
import { crlf } from "eol";
import LoadingScreen from "./LoadingScreen.jsx";

function Boxedwine() {
  const canvas = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createEventListeners();
    const init = async () => {
      await FileSystem.init();
    };
    init();
    return () => {
      removeEventListeners();
    };
  }, []);

  const createEventListeners = () => {
    createZipListener();
    //creates message listener to intercept messages from parent document and rethrow messages as events
    createMessageListner();
    //creates a click listener to allow selection and operator of terminal when clicked on
    createClickListener();
    createCommandWriteListener();
    createCommandRunListener();
    createResetListener();
    compileAndRun();
    sendFiles();
    boxwineLoaded();
  };

  const removeEventListeners = () => {
    window.removeEventListener("editor-selected");
    window.removeEventListener("build-code");
    window.removeEventListener("reset");
    window.removeEventListener("write-command");
    window.removeEventListener("run-command");
    window.removeEventListener("zip-files");
    window.removeEventListener("compile-and-run");
    window.removeEventListener("send-files");
    window.removeEventListener("boxwine-loaded");
  };

  const boxwineLoaded = () => {
    window.addEventListener("boxwine-loaded", (e) => {
      setLoading(false);
    });
  };

  const sendFiles = () => {
    window.addEventListener("send-files", ({ detail: data }) => {
      const createFileCommand = FileSystem.createDataFiles(
        data.map(
          ({ filename, fileExtension, fileData, fileMetaData, isBinary }) => {
            const formatFileData = () => {
              if (!isBinary) {
                return fileExtension === ".asm"
                  ? crlf(convertIrvineImports(fileData))
                  : crlf(fileData);
              }
              return fileData;
            };

            const transformedFileData = formatFileData();

            return {
              filename,
              fileData: transformedFileData,
              lastModified: new Date(fileMetaData.mtime).getTime(),
              fileSize: isBinary
                ? fileMetaData.size
                : transformedFileData.length,
              isBinary,
            };
          }
        )
      );
      if (createFileCommand != "") {
        convertStringToConsoleCommand(createFileCommand);
        return;
      }
    });
  };

  const compileAndRun = () => {
    window.addEventListener("compile-and-run", ({ detail: data }) => {
      const { filename, time, filePath, exportBinaries } = data;
      const text = convertIrvineImports(data.text);
      FileSystem.createFile(filename, text, time);
      // TODO: Remove substring by changing bat to not add .asm
      const baseName = filename.substring(0, filename.length - 4);
      convertStringToConsoleCommand(
        `echo.>${filename} && assemble ${baseName}`
      );

      if (!exportBinaries) {
        return;
      }

      outputBuildFiles(baseName, filePath);
    });
  };

  const outputBuildFiles = (fileBaseName, filePath) => {
    const getFileFromLocalStorage = (fileBaseName, extension) =>
      sleepUntil(() => {
        const filename = `${fileBaseName}.${extension}`;
        const fileData = FileSystem.getFile(filename);
        return fileData !== null
          ? {
              command: "save-file-to-disk",
              filename: filename,
              filePath: filePath,
              fileData: fileData,
            }
          : false;
      }, 60000);
    const sendFileToExtension = (result) => window.vscode.postMessage(result);
    getFileFromLocalStorage(fileBaseName, "obj")
      .then((result) => sendFileToExtension(result))
      .catch((e) => {
        console.log(e);
      });

    getFileFromLocalStorage(fileBaseName, "exe")
      .then((result) => sendFileToExtension(result))
      .catch((e) => {
        console.log(e);
      });
  };

  const sleepUntil = (callback, timeout) => {
    return new Promise((resolve, reject) => {
      const timeWas = new Date();
      const wait = setInterval(function () {
        const result = callback();
        if (result) {
          clearInterval(wait);
          resolve(result);
        } else if (new Date() - timeWas > timeout) {
          // Timeout
          clearInterval(wait);
          return reject();
        }
      }, 300);
    });
  };

  const convertIrvineImports = (text) => {
    const irvineLib32Match = /include.+irvine32(\.inc|)/im;
    const irvineLib64Match = /include.+irvine64(\.inc|)/im;
    return text
      .replace(irvineLib32Match, "INCLUDE D:/irvine/Irvine32.inc")
      .replace(irvineLib64Match, "INCLUDE D:/irvine/Irvine64.inc");
  };

  //Send commands to console
  const convertStringToConsoleCommand = (command) => {
    const commandArray = [];
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
        case "_":
          commandArray.push("shift");
          commandArray.push("dash");
          commandArray.push("/shift");
          break;
        case "&":
          commandArray.push("shift");
          commandArray.push("7");
          commandArray.push("/shift");

        default:
          commandArray.push(char);
      }
    }
    commandArray.push("enter");
    writeToConsole(commandArray);
  };

  const createZipListener = () => {
    window.addEventListener("zip-files", ({ detail: data }) => {
      const { fileList, filename } = data;
      const zip = new window.JSZip();
      fileList.map(({ filename, key }) => {
        return zip.file(filename, window.localStorage.getItem(key), {
          base64: true,
        });
      });

      zip
        .generateAsync({ type: "base64" })
        .then((content) => window.localStorage.setItem(filename, content)); //save to local storage
    });
  };

  const reset = (command = "cmd.bat") => {
    const callMain = () => {
      Module.pauseMainLoop();
      Module.restartBW();
      window.callMain([
        "-root",
        "/root/base",
        "-mount_drive",
        "/root/files/",
        "d",
        "-nozip",
        "-w",
        "/home/username/.wine/dosdevices/d:",
        "/bin/wine",
        "cmd",
        "/c",
        command,
        //`start build.bat ${filename} 1`,
      ]);
    };
    //TODO generify this structure
    if (Module.restartBW == undefined) {
      const timeout = () =>
        setTimeout(() => {
          if (Module.restartBW == undefined) {
            clearTimeout();
            timeout();
          }
          callMain();
        }, 100);
    } else {
      callMain();
    }
  };

  //TODO: refactor this to remove repeated code
  const writeToConsole = (data) => {
    let press = "keydown";
    data.forEach((key) => {
      //check to see if you need symbols could be improved by making symbol list
      if (key == "/shift") {
        press = "keyup";
        key = "shift";
      } else if (press == "keyup") {
        press = "keydown";
      }
      //Check if upper case letter if so push down shift key and release it
      if (key.toLowerCase() != key.toUpperCase() && key == key.toUpperCase()) {
        {
          let event = new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            char: "shift",
            key: "shift",
            shiftKey: true,
            keyCode: keyCodes["shift"],
          });
          window.dispatchEvent(event);

          event = new KeyboardEvent(press, {
            bubbles: true,
            cancelable: true,
            char: key,
            key: key.toLowerCase(),
            shiftKey: true,
            keyCode: keyCodes[key.toLowerCase()],
          });
          window.dispatchEvent(event);

          event = new KeyboardEvent("keyup", {
            bubbles: true,
            cancelable: true,
            char: "shift",
            key: "shift",
            shiftKey: true,
            keyCode: keyCodes["shift"],
          });
          window.dispatchEvent(event);
        }
      } else {
        //source: https://stackoverflow.com/questions/35143695/how-can-i-simulate-a-keypress-in-javascript
        let event = new KeyboardEvent(press, {
          bubbles: true,
          cancelable: true,
          char: key.toUpperCase(),
          key: key,
          shiftKey: true,
          keyCode: keyCodes[key],
        });
        window.dispatchEvent(event);
      }
    });
  };

  //TODO Fix this in boxedwine as it is extremely buggy (causes memory out of bounds bug hard crash)
  const createCommandRunListener = () => {
    window.addEventListener("run-command", (event) => {
      if (Module.ProcessRun == undefined) {
        const timeout = () =>
          setTimeout(() => {
            if (Module.ProcessRun == undefined) {
              clearTimeout();
              timeout();
            } else {
              Module.ProcessRun.runCommand(event.detail);
            }
          });
        timeout();
      } else {
        Module.ProcessRun.runCommand(event.detail);
      }
    });
  };

  const createCommandWriteListener = () => {
    window.addEventListener("write-command", (event) => {
      writeToConsole(event.detail);
    });
  };

  const createResetListener = () => {
    window.addEventListener("reset", (event) => {
      if (!event.detail) {
        reset();
      } else {
        reset(event.detail);
      }
    });
  };

  const createClickListener = () => {
    window.addEventListener("editor-selected", (event) => {
      event.preventDefault();
      document.getElementById("emscripten-overlay").style.pointerEvents =
        "unset";
    });
  };

  //doesnt work
  // source https://stackoverflow.com/questions/433919/javascript-simulate-right-click-through-code?rq=1
  function contextMenuClick(element) {
    //console.log(element.ownerDocument);
    var evt = element.ownerDocument.createEvent("MouseEvents");

    //console.log(evt);
    var RIGHT_CLICK_BUTTON_CODE = 2; // the same for FF and IE

    evt.initMouseEvent(
      "contextmenu",
      true,
      true,
      element.ownerDocument.defaultView,
      1,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      RIGHT_CLICK_BUTTON_CODE,
      null
    );

    if (document.createEventObject) {
      // dispatch for IE
      return element.fireEvent("onclick", evt);
    } else {
      // dispatch for firefox + others
      return !element.dispatchEvent(evt);
    }
  }

  //handle div click
  const handleClick = (event) => {
    event.preventDefault();
    if (event.type == "contextmenu") {
      contextMenuClick(document.getElementById("canvas")); //doesnt work impossible to simulate right click in browser?
    } else {
      canvas.current.click();
    }
    event.target.style.pointerEvents = "none";
  };

  /*
  useEffect(() => {
    console.log(Module);
    console.log(window.FS.readFile("/etc/hosts", { encoding: "utf8" }));
  });
  */

  return (
    <>
      {loading && <LoadingScreen />}
      <canvas
        onContextMenu={(event) => event.preventDefault()}
        className={"emscripten"}
        id={"canvas"}
        ref={canvas}
      />
      <div
        onClick={(event) => handleClick(event)}
        onContextMenu={(event) => handleClick(event)}
        id={"emscripten-overlay"}
        className={"emscripten-overlay"}
      />
    </>
  );
}

export default Boxedwine;
