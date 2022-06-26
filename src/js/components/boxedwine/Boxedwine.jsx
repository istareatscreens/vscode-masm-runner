import React, { useRef, useEffect } from "react";
import { createMessageListner } from "../../utility/utilityFunctions.ts";
import { keyCodes } from "./keypress.js";

function Boxedwine() {
  const canvas = useRef(null);

  useEffect(() => {
    createEventListeners();
    return () => {
      removeEventListeners();
    };
  }, []);

  const createEventListeners = () => {
    createZipListener();
    createMessageListner(); //creates message listener to intercept messages from parent document and rethrow messages as events
    createClickListener(); //creates a click listener to allow selection and operator of terminal when clicked on
    createCommandWriteListener();
    createCommandRunListener();
    createResetListener();
  };

  const removeEventListeners = () => {
    window.removeEventListener("editor-selected");
    window.removeEventListener("build-code");
    window.removeEventListener("reset");
    window.removeEventListener("write-command");
    window.removeEventListener("run-command");
    window.removeEventListener("zip-files");
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
    //console.log(data);
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
          const event = new KeyboardEvent("keydown", {
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
        const event = new KeyboardEvent(press, {
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
      //console.log(event);
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
        //console.log(event.detail);
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
