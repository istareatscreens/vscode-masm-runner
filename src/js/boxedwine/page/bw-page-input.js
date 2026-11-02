window.bwBootStage = function (text) {
  window.BW_BOOT_STAGE = text;
  try {
    window.dispatchEvent(new CustomEvent("bw-boot-stage", { detail: text }));
  } catch (e) {}
};
window.bwBootStage("Loading emulator");

// Input gate: keyboard events are dropped until the environment is ready. These capture
// listeners on window are registered before the glue loads, so they run ahead of SDL's.
// Direct-API input (bwApp.*) is queued by Boxedwine.jsx until the gate opens.
window.BW_INPUT_OPEN = false;
(function () {
  var block = function (e) {
    if (window.BW_INPUT_OPEN) return;
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  ["keydown", "keypress", "keyup"].forEach(function (t) {
    window.addEventListener(t, block, true);
  });
})();
(function () {
  var pendingImport = null,
    lastExported = null,
    lastExportAt = 0,
    lastPasteAt = 0;
  function pasteText(text, how) {
    if (!text) return;
    lastPasteAt = performance.now();
    pendingImport = text;
    var typed = text.replace(/\r\n?/g, "\r").replace(/\n/g, "\r"); // a line end is one Enter for the console
    try {
      Module.bwSetClipboardText(typed);
    } catch (e) {}
    try {
      (Module.bwPasteText || Module.sendText)(typed);
    } catch (e) {} // bwPasteText releases the chord's modifiers in the guest first
    console.log(
      "[bw] pasted " +
        text.length +
        " chars into the console (" +
        how +
        "): " +
        JSON.stringify(text.slice(0, 24)),
    );
  }
  var isPasteKey = function (e) {
    var mod = e.ctrlKey || e.metaKey;
    return mod && !e.altKey && !e.shiftKey && e.code === "KeyV";
  };
  // chords whose paste command not every browser runs on a non-editable page: the paste
  // event is used when it comes, else the clipboard is read directly
  var isPasteReadKey = function (e) {
    var mod = e.ctrlKey || e.metaKey;
    return (
      (mod && e.shiftKey && !e.altKey && e.code === "KeyV") ||
      (e.shiftKey && !mod && !e.altKey && e.code === "Insert")
    );
  };
  var isCmdCopyKey = function (e) {
    return (
      e.metaKey && !e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyC"
    );
  };
  // VS Code's webview passes unhandled keys to the workbench, whose Ctrl+Shift+C opens an external terminal
  var isCtrlCopyKey = function (e) {
    return (
      e.ctrlKey && !e.metaKey && e.shiftKey && !e.altKey && e.code === "KeyC"
    );
  };
  // the whole chord through direct input: a C sent alone could arrive after the modifiers' releases
  var typeCopyChord = function () {
    try {
      Module.sendKey(0xffe3, true); // Control_L
      Module.sendKey(0xffe1, true); // Shift_L
      Module.sendKey(0x63, true); // c
      Module.sendKey(0x63, false);
      Module.sendKey(0xffe1, false);
      Module.sendKey(0xffe3, false);
    } catch (err) {}
  };
  window.addEventListener(
    "keydown",
    function (e) {
      if (!window.BW_INPUT_OPEN) return;
      if (isPasteKey(e)) {
        e.stopImmediatePropagation();
        return;
      } // the browser's paste command still runs -> "paste"
      if (isPasteReadKey(e)) {
        // Ctrl/Cmd+Shift+V, Shift+Insert: the browser's paste command fires "paste" where it
        // runs for this chord; otherwise read the clipboard directly (a user activation is current)
        e.stopImmediatePropagation();
        var at = performance.now();
        setTimeout(function () {
          if (lastPasteAt >= at) return;
          if (!(navigator.clipboard && navigator.clipboard.readText)) return;
          navigator.clipboard.readText().then(
            function (t) {
              if (lastPasteAt < at) pasteText(t, "readText");
            },
            function (err) {
              console.log(
                "[bw] clipboard read refused: " + (err && err.message),
              );
            },
          );
        }, 150);
        return;
      }
      if (isCmdCopyKey(e) || isCtrlCopyKey(e)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        typeCopyChord();
      }
    },
    true,
  );
  window.addEventListener(
    "keyup",
    function (e) {
      if (!window.BW_INPUT_OPEN) return;
      if (
        isPasteKey(e) ||
        isPasteReadKey(e) ||
        isCmdCopyKey(e) ||
        isCtrlCopyKey(e)
      )
        e.stopImmediatePropagation();
    },
    true,
  );
  window.addEventListener("paste", function (e) {
    if (!window.BW_INPUT_OPEN) return;
    var text = e.clipboardData && e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    pasteText(text, "paste event");
  });
  Module.bwOnClipboardText = function () {
    var text = "";
    try {
      text = String(Module.bwGetClipboardText() || "");
    } catch (e) {
      return;
    }
    if (!text) return;
    if (text === pendingImport) {
      pendingImport = null;
      return;
    } // the emulator reporting the page's own import
    if (text === lastExported && performance.now() - lastExportAt < 2000)
      return; // one copy reported twice (focus loss)
    lastExported = text;
    lastExportAt = performance.now();
    if (!(navigator.clipboard && navigator.clipboard.writeText)) return;
    navigator.clipboard.writeText(text).then(
      function () {
        console.log(
          "[bw] console selection copied (" + text.length + " chars)",
        );
      },
      function (err) {
        console.log("[bw] clipboard write refused: " + (err && err.message));
      },
    );
  };
})();
// Text in any language: a key that types a character the US keymap does not give for that
// key (another keyboard layout, AltGr, Caps Lock, a dead-key composition) is typed as text
// through the console's text channel (Module.bwTypeText); every other key reaches SDL
// unchanged. US maps each key code to its unshifted and shifted US characters.
(function () {
  var US = {
    Backquote: "`~",
    Digit1: "1!",
    Digit2: "2@",
    Digit3: "3#",
    Digit4: "4$",
    Digit5: "5%",
    Digit6: "6^",
    Digit7: "7&",
    Digit8: "8*",
    Digit9: "9(",
    Digit0: "0)",
    Minus: "-_",
    Equal: "=+",
    BracketLeft: "[{",
    BracketRight: "]}",
    Backslash: "\\|",
    IntlBackslash: "\\|",
    Semicolon: ";:",
    Quote: "'\"",
    Comma: ",<",
    Period: ".>",
    Slash: "/?",
    Space: "  ",
  };
  for (var c = 65; c <= 90; c++) {
    var letter = String.fromCharCode(c);
    US["Key" + letter] = letter.toLowerCase() + letter;
  }
  var typed = {}; // keys whose keydown was typed as text: their keyup is not SDL's either
  window.addEventListener(
    "keydown",
    function (e) {
      if (!window.BW_INPUT_OPEN || e.isComposing) return;
      if (
        typeof Module === "undefined" ||
        typeof Module.bwTypeText !== "function"
      )
        return;
      var altGr = e.getModifierState && e.getModifierState("AltGraph");
      if ((e.ctrlKey || e.altKey || e.metaKey) && !altGr) return;
      if (e.key === "Dead") {
        // the next key brings the composed character
        e.preventDefault();
        e.stopImmediatePropagation();
        typed[e.code] = true;
        return;
      }
      var chars = Array.from(e.key || "");
      if (chars.length !== 1) return; // a named key: Enter, F1, ArrowUp, ...
      var us = US[e.code];
      if (
        chars[0].charCodeAt(0) < 0x7f &&
        (!us || us.charAt(e.shiftKey ? 1 : 0) === e.key)
      )
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      typed[e.code] = true;
      Module.bwTypeText(e.key);
    },
    true,
  );
  window.addEventListener(
    "keyup",
    function (e) {
      if (!typed[e.code]) return;
      delete typed[e.code];
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
})();
(function () {
  var canvas = document.getElementById("canvas");
  if (canvas)
    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
})();
// Drag selection beyond the console: the canvas takes pointer capture for a primary-button
// drag, so the drag's mouse events keep reaching SDL (and conhost, which scrolls the window
// to the selection) after the pointer leaves the canvas, the iframe or the browser window.
(function () {
  var canvas = document.getElementById("canvas");
  if (!canvas || !canvas.setPointerCapture) return;
  // the console window's caption and borders take no press: a drag there would move or resize the console
  var onConsoleFrame = function (e) {
    var o = window.BW_CLIENT_ORIGIN;
    if (!o) return false;
    var r = canvas.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    return y < o.y || x < o.x || x >= r.width - o.x || y >= r.height - o.x;
  };
  // a drag released outside the panel ends at the next move without the button, or when the capture is lost
  var drag = null; // the primary-button drag in progress: { id, x, y } (its last position)
  canvas.addEventListener("pointerdown", function (e) {
    // a click on the terminal gives it the keyboard: SDL cancels the mouse-down's default
    // action, which is also the focus change, so keys typed after a click on the terminal
    // kept going to whatever had the focus in the page
    try {
      window.focus();
    } catch (err) {}
    if (onConsoleFrame(e)) {
      // a canceled pointerdown gets no mouse events for SDL until the button is released
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (
      e.button !== 0 ||
      (e.pointerType !== "mouse" && e.pointerType !== "pen")
    )
      return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  var endDrag = function (how) {
    var d = drag;
    drag = null;
    if (!d || how === "released") return;
    try {
      canvas.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: d.x,
          clientY: d.y,
          button: 0,
          buttons: 0,
        }),
      );
    } catch (err) {}
  };
  window.addEventListener(
    "pointermove",
    function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (e.buttons & 1) {
        drag.x = e.clientX;
        drag.y = e.clientY;
      } else endDrag("lost");
    },
    true,
  );
  window.addEventListener(
    "pointerup",
    function (e) {
      if (drag && e.pointerId === drag.id) endDrag("released");
    },
    true,
  );
  canvas.addEventListener("lostpointercapture", function (e) {
    if (drag && e.pointerId === drag.id) endDrag("lost");
  });
})();
window.bwOpenInput = function (why) {
  if (window.BW_INPUT_OPEN) return;
  window.BW_INPUT_OPEN = true;
  window.BW_INPUT_OPEN_AT = performance.now();
  console.log("[bw] terminal ready for input (" + why + ")"); // boot milestone
  try {
    window.dispatchEvent(
      new CustomEvent("boxedwine-input-open", { detail: { why: why } }),
    );
  } catch (e) {}
};
// "boxedwine-fully-loaded": the environment is ready (fired by the shell after the
// factory capture on a cold boot, or after the verified restore).
window.bwFireReady = function (how, info) {
  if (window.BW_READY_AT) return;
  var t = performance.now();
  window.BW_READY_AT = t;
  window.BW_READY_HOW = how;
  console.log(
    "[bw] environment ready (" + how + ") after " + Math.round(t) + "ms",
  ); // boot milestone
  try {
    window.dispatchEvent(
      new CustomEvent("boxedwine-fully-loaded", {
        detail: {
          timestamp: t,
          totalLoadTime: t,
          how: how,
          info: info || null,
        },
      }),
    );
  } catch (e) {}
};

// Without ?bwlog=1, drop the stock shell's config-echo lines from the console.
if (!window.BW_DEBUG_LOG) {
  var _bwRawLog = console.log.bind(console);
  var _bwNoisy =
    /^(not )?setting |must be in quoted string|^setting EMSCRIPTEN|ENV propert|ddrawOverride|^Pointer lock|^Unable to lock pointer|^Use Storage mode|unable to sync folder/;
  console.log = function () {
    if (
      arguments.length &&
      typeof arguments[0] === "string" &&
      _bwNoisy.test(arguments[0])
    )
      return;
    return _bwRawLog.apply(null, arguments);
  };
}
