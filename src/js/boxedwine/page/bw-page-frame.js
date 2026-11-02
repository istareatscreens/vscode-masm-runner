(function () {
  window.bwConsoleFrame = function () {
    try {
      var c = document.getElementById("canvas");
      var sdl = typeof Module !== "undefined" && Module.SDL2,
        frame = sdl && sdl.image;
      if (
        c &&
        sdl.ctxCanvas === c &&
        frame &&
        frame.width > 0 &&
        frame.height > 0 &&
        frame.width === c.width &&
        frame.height === c.height &&
        frame.data &&
        frame.data.length === frame.width * frame.height * 4
      )
        return frame;
    } catch (e) {}
    return null;
  };
  window.bwConsoleFillsScreen = function () {
    var frame = window.bwConsoleFrame();
    if (!frame || frame.width < 2 || frame.height < 2) return false;
    var d = frame.data;
    var isFrame = function (x, y) {
      var i = (y * frame.width + x) * 4;
      return (
        d[i + 3] === 255 &&
        ((d[i] === 212 && d[i + 1] === 208 && d[i + 2] === 200) ||
          (d[i] === 128 && d[i + 1] === 128 && d[i + 2] === 128) ||
          (d[i] === 64 && d[i + 1] === 64 && d[i + 2] === 64))
      );
    };
    return (
      isFrame(frame.width - 2, (frame.height / 2) | 0) &&
      isFrame((frame.width / 2) | 0, frame.height - 2)
    );
  };
  // Shared by the console-lit milestone and boot/restore watchdog. Require
  // the console border first: Wine's startup dialog is lit but not ready.
  window.bwConsoleLit = function () {
    var frame = window.bwConsoleFrame();
    if (!frame) return -1;
    if (!window.bwConsoleFillsScreen()) return 0;
    var d = frame.data,
      lit = 0;
    for (var y = 0; y < 48; y++) {
      for (var x = 0; x < 64; x++) {
        var i =
          (Math.floor((y * frame.height) / 48) * frame.width +
            Math.floor((x * frame.width) / 64)) *
          4;
        if (d[i + 3] && d[i] + d[i + 1] + d[i + 2] > 20) lit++;
      }
    }
    return lit;
  };
})();
// Presentation: the canvas fills the iframe (1:1, the screen is the panel's size). Inline
// !important styles win over anything SDL sets; SDL maps the pointer through the CSS box.
(function () {
  var canvas = document.getElementById("canvas");
  window.bwFitCanvas = function () {
    canvas.style.setProperty("width", "100vw", "important");
    canvas.style.setProperty("height", "100vh", "important");
    canvas.style.setProperty("left", "0px", "important");
    canvas.style.setProperty("top", "0px", "important");
  };
  window.addEventListener("resize", window.bwFitCanvas);
  // the emulator sets canvas.width/height when SDL creates its window
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(function () {
      window.bwFitCanvas();
    }).observe(canvas, {
      attributes: true,
      attributeFilter: ["width", "height", "style"],
    });
  }
  window.bwFitCanvas();
})();
// "boxedwine-console-lit": the console first renders (2 consecutive lit samples).
(function () {
  var t0 = performance.now(),
    hits = 0;
  var timer = setInterval(function () {
    if (window.bwConsoleLit() > 20) {
      if (++hits >= 2) {
        clearInterval(timer);
        var t = performance.now();
        window.BW_CONSOLE_VISIBLE_AT = t;
        window.dispatchEvent(
          new CustomEvent("boxedwine-console-lit", {
            detail: { timestamp: t, totalLoadTime: t - t0 },
          }),
        );
      }
    } else hits = 0;
  }, 400);
})();
