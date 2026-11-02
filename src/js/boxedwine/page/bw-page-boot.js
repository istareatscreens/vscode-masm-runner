      if (window.BW_CONFIG && window.BW_CONFIG.debugTrace === true) {
        (Module.preRun = Module.preRun || []).push(function () {
          (Module.postRun = Module.postRun || []).unshift(function () {
            try {
              Module.bwSetPresentTrace(true);
            } catch (e) {}
          });
        });
      }
      // stays null: only bw-cache.js reads it, and it is not shipped
      window.BW_GUEST_CHUNKS = /*__BW_GUEST_CHUNKS__*/ null;

      // Runtime selection: 1. ?bw=mt|st (testing; clears a failure record); 2. ST when MT
      // failed its watchdog under this build; 3. localStorage "bw-runtime-pref"; 4. ST
      // (MT works, but measured slower than ST for this app's workloads).
      (function () {
        var MT_DEFAULT_ENABLED = false;
        // VS Code webviews are not cross-origin isolated, so pthreads (MT) cannot start
        var canMT = false;
        var m = null;
        var pref = null,
          fail = null;
        try {
          pref = localStorage.getItem("bw-runtime-pref");
          fail = JSON.parse(localStorage.getItem("bw-runtime-fail") || "null");
        } catch (e) {}
        var choice, why;
        if (m) {
          choice = m[1];
          why = "override";
          try {
            localStorage.removeItem("bw-runtime-fail");
          } catch (e) {}
        } else if (
          fail &&
          fail.buildId === window.BW_BUILD_ID &&
          fail.runtime === "mt"
        ) {
          choice = "st";
          why = "mt-failed:" + (fail.reason || "watchdog");
        } else if (pref === "mt" || pref === "st") {
          choice = pref;
          why = "pref";
        } else {
          choice = MT_DEFAULT_ENABLED && canMT ? "mt" : "st";
          why = "default";
        }
        if (choice === "mt" && !canMT) {
          choice = "st";
          why += ",not-isolated";
        }
        window.BW_USE_MT = choice === "mt";
        window.BW_RUNTIME_WHY = why;
        window.BW_RUNTIME_DOWNGRADED = /^mt-failed/.test(why) ? fail : null;
        console.log(
          "[bw] runtime " +
            choice +
            " (" +
            why +
            ") build " +
            window.BW_BUILD_ID,
        ); // boot milestone
      })();
      // no ?v= query: VS Code's webview service worker revalidates every resource request
      window.BW_GLUE_V = "";
      window.BW_WASM_URL =
        window.BW_ASSET_BASE +
        (window.BW_USE_MT ? "boxedwine-mt.wasm" : "boxedwine.wasm") +
        window.BW_GLUE_V;
      window.BW_GLUE_URL =
        window.BW_ASSET_BASE +
        (window.BW_USE_MT ? "boxedwine-mt.js" : "boxedwine.js") +
        window.BW_GLUE_V;

      // Guest storage (schema 2): /root and /d_drive are MEMFS; the user's files persist in
      // the parent app and are reconciled into D: on start. BW_STORAGE_KEY marks the one-time
      // import of older builds' IDBFS overlays.
      window.BW_STORAGE_KEY = "bw-storage-v";
      window.BW_STORAGE_VERSION = "2";

      DEFAULT_ROOT_ZIP_FILE = "TinyCore15Wine6.0-preboot-fw-trim.zip";
      Config.locateRootBaseUrl = window.BW_ZIP_BASE;
      Config.locateAppBaseUrl = window.BW_ZIP_BASE;
      Config.locateOverlayBaseUrl = window.BW_ZIP_BASE;
      Config.WorkingDir = "/home/username/.wine/dosdevices/d:"; // start cmd on D:
      getExecutable = function () {
        return "wineconsole";
      };
      getProgramArgs = function () {
        return ["cmd"];
      };
      getAppZipFile = function () {
        return "assembler-dp0.zip";
      };
      getEnvProp = function () {
        return "WINEDLLOVERRIDES=mscoree=d;mshtml=d";
      };
      // Extra guest environment. LC_CTYPE=en_US.UTF-8, the locale the guest image carries
      // (Boxedwine/guest-image/locale-utf8.py): Wine converts native file names as UTF-8,
      // so a name in any language keeps its name on D: (with no locale it read them as
      // 7-bit ASCII). Only the character type is set: the system locale stays en-US, the
      // code pages 1252/437. ?bwwinedebug=<channels> (debug, cold boot) adds WINEDEBUG.
      window.BW_EXTRA_ENV = ["LC_CTYPE=en_US.UTF-8"];
      // so `assemble <name>` works from any prompt
      window.BW_EXTRA_ENV.push("WINEPATH=C:\\files");
      (function () {
        var channels = window.BW_CONFIG && window.BW_CONFIG.wineDebug;
        if (channels) window.BW_EXTRA_ENV.push("WINEDEBUG=" + String(channels));
      })();
      // Screen geometry = the terminal panel in CSS pixels (the canvas is 100vw x 100vh, so
      // 1:1). The console fills it with whole 11x22 px cells (Liberation Mono 22 px, the
      // original console font) inside a 24 px wide / 27 px high frame: bwPatchGuestConsole
      // writes rows/cols into the guest registry before Wine starts, and bwSyncScreenToPanel
      // resizes the screen when the panel changes.
      var BW_CELL_W = 11,
        BW_CELL_H = 22,
        BW_FRAME_W = 8 + 16,
        BW_FRAME_H = 27,
        BW_BUF_ROWS = 500;
      var BW_MIN_COLS = 8,
        BW_MIN_ROWS = 2; // conhost v15 minimum (window.c WM_SIZE)
      // the largest screen Module.bwResizeScreen takes; a larger panel shows it stretched
      var BW_MAX_SCREEN = 8000;
      window.BW_CELL = { w: BW_CELL_W, h: BW_CELL_H };
      window.BW_CLIENT_ORIGIN = { x: 4, y: BW_FRAME_H - 4 }; // the console's first cell: inside the 4 px border and the 19 px caption
      window.bwGeometryFor = function (panelW, panelH) {
        var w = Math.min(BW_MAX_SCREEN, Math.max(1, Math.round(panelW))),
          h = Math.min(BW_MAX_SCREEN, Math.max(1, Math.round(panelH)));
        var cols = Math.floor((w - BW_FRAME_W) / BW_CELL_W),
          rows = Math.floor((h - BW_FRAME_H) / BW_CELL_H);
        if (!isFinite(cols) || cols < BW_MIN_COLS) cols = BW_MIN_COLS;
        if (!isFinite(rows) || rows < BW_MIN_ROWS) rows = BW_MIN_ROWS;
        cols = Math.min(cols, 240);
        rows = Math.min(rows, 100);
        return {
          cols: cols,
          rows: rows,
          bufRows: BW_BUF_ROWS,
          cellW: BW_CELL_W,
          cellH: BW_CELL_H,
          width: w,
          height: h,
        };
      };
      (function () {
        var w = window.innerWidth,
          h = window.innerHeight;
        window.BW_CONSOLE_GEOMETRY =
          w > 100 && h > 100
            ? window.bwGeometryFor(w, h)
            : window.bwGeometryFor(772, 599);
        console.log(
          "[bw] console " +
            window.BW_CONSOLE_GEOMETRY.cols +
            "x" +
            window.BW_CONSOLE_GEOMETRY.rows +
            " cells (" +
            BW_CELL_W +
            "x" +
            BW_CELL_H +
            " px) for a " +
            w +
            "x" +
            h +
            " panel",
        ); // boot milestone
      })();
      getResolution = function () {
        return (
          window.BW_CONSOLE_GEOMETRY.width +
          "x" +
          window.BW_CONSOLE_GEOMETRY.height
        );
      };
      // SDL's desktop mode comes from screen.width x screen.height, and Boxedwine scales a screen
      // that does not fit inside it: report a display larger than any screen the page asks for
      (function () {
        var desktop = BW_MAX_SCREEN + 192;
        try {
          Object.defineProperty(window.screen, "width", {
            configurable: true,
            get: function () {
              return desktop;
            },
          });
          Object.defineProperty(window.screen, "height", {
            configurable: true,
            get: function () {
              return desktop;
            },
          });
        } catch (e) {
          console.warn("[bw] the display size for SDL could not be set: " + e);
        }
      })();
      // Called by the shell before the emulator starts on a cold boot. Patches [Console]
      // FaceName/FontSize/WindowSize/ScreenBufferSize in the overlay's user.reg (Wine's live
      // copy if it exists, else the zip's); any failure leaves the zip's registry (68x26).
      // measured on an animation frame: a background VS Code tab is 300x150 and gets none
      window.bwPatchGuestConsole = function (zipBytes, done) {
        requestAnimationFrame(function () {
          patchGuestConsole(zipBytes, done);
        });
      };
      var patchGuestConsole = function (zipBytes, done) {
        // the panel may have changed since the page started (Electron attaches its menu
        // after load): boot at its current size
        (function () {
          var w = window.innerWidth,
            h = window.innerHeight,
            cur = window.BW_CONSOLE_GEOMETRY;
          if (!(w > 100 && h > 100)) return;
          var now = window.bwGeometryFor(w, h);
          if (now.width === cur.width && now.height === cur.height) return;
          window.BW_CONSOLE_GEOMETRY = now;
          try {
            Config.resolution = getResolution();
          } catch (e) {}
          console.log(
            "[bw] console " +
              now.cols +
              "x" +
              now.rows +
              " cells for a " +
              w +
              "x" +
              h +
              " panel (the panel changed since the page started)",
          ); // boot milestone
        })();
        var g = window.BW_CONSOLE_GEOMETRY,
          REG = "/root/home/username/.wine/user.reg";
        var hex8 = function (v) {
          return ("00000000" + (v >>> 0).toString(16)).slice(-8);
        };
        var finish = function () {
          try {
            done();
          } catch (e) {}
        };
        var setDword = function (text, key, value) {
          var line = '"' + key + '"=dword:' + hex8(value);
          var re = new RegExp('^"' + key + '"=dword:[0-9a-f]{8}', "im");
          if (re.test(text)) return text.replace(re, line);
          return text.replace(
            /^(\[Console\][^\n]*\n(?:#[^\n]*\n)?)/m,
            "$1" + line + "\n",
          );
        };
        var setString = function (text, key, value) {
          var line = '"' + key + '"="' + value + '"';
          var re = new RegExp('^"' + key + '"=[^\n]*', "im");
          if (re.test(text)) return text.replace(re, line);
          return text.replace(
            /^(\[Console\][^\n]*\n(?:#[^\n]*\n)?)/m,
            "$1" + line + "\n",
          );
        };
        var apply = function (text) {
          try {
            if (!text || text.indexOf("[Console]") < 0) return finish();
            var patched = setDword(text, "WindowSize", (g.rows << 16) | g.cols);
            patched = setDword(
              patched,
              "ScreenBufferSize",
              (g.bufRows << 16) | g.cols,
            );
            patched = setDword(
              patched,
              "FontSize",
              (BW_CELL_H << 16) | BW_CELL_W,
            );
            patched = setString(patched, "FaceName", "Liberation Mono");
            if (patched !== text) {
              try {
                FS.mkdirTree("/root/home/username/.wine");
              } catch (e) {}
              FS.writeFile(REG, patched);
              console.log(
                "[bw] console geometry " +
                  g.cols +
                  "x" +
                  g.rows +
                  " (screen " +
                  g.width +
                  "x" +
                  g.height +
                  ") written to the guest registry",
              );
            }
          } catch (e) {
            console.warn("[bw] console geometry patch skipped: " + e);
          }
          finish();
        };
        try {
          var live = null;
          try {
            live = FS.readFile(REG, { encoding: "utf8" });
          } catch (e) {}
          if (live) return apply(live);
          if (typeof JSZip === "undefined") return finish();
          JSZip.loadAsync(zipBytes)
            .then(function (z) {
              var f = z.file("home/username/.wine/user.reg");
              return f ? f.async("string") : null;
            })
            .then(apply, function (e) {
              console.warn("[bw] console geometry patch skipped: " + e);
              finish();
            });
        } catch (e) {
          finish();
        }
      };
      // Live resize: keep the emulated screen equal to the panel (debounced). Until the guest
      // has re-fitted the console, the last frame is shown frozen at its true size (at most
      // HOLD_MAX_MS); a request that was never applied is issued once more.
      (function () {
        var timer = null,
          lastKey =
            window.BW_CONSOLE_GEOMETRY.width +
            "x" +
            window.BW_CONSOLE_GEOMETRY.height; // boot size
        var DEBOUNCE_MS = 100,
          HOLD_MAX_MS = 4000,
          holdTimer = null,
          holdSince = 0,
          pending = null,
          retried = false,
          holdSafety = null;
        // the geometry key the panel asks for ("" for a 0x0 or hidden panel)
        function panelKey() {
          var w = window.innerWidth,
            h = window.innerHeight;
          if (!(w > 100 && h > 100)) return "";
          var g = window.bwGeometryFor(w, h);
          return g.width + "x" + g.height;
        }
        function holdEl() {
          var el = document.getElementById("bw-resize-hold");
          if (!el) {
            el = document.createElement("div");
            el.id = "bw-resize-hold";
            el.style.cssText =
              "display:none;position:absolute;left:0;top:0;width:100vw;height:100vh;background:#000;z-index:5;pointer-events:none;overflow:hidden";
            var copy = document.createElement("canvas");
            copy.style.cssText = "position:absolute;left:0;top:0;display:block";
            el.appendChild(copy);
            document.body.appendChild(el);
          }
          return el;
        }
        function showHold() {
          try {
            var frame = window.bwConsoleFrame();
            if (!frame || !window.BW_INPUT_OPEN) return; // nothing worth freezing before the console is up
            var el = holdEl(),
              copy = el.firstChild;
            if (el.style.display !== "block") {
              copy.width = frame.width;
              copy.height = frame.height;
              // Firefox privacy protection can replace canvas extraction with noise.
              // Paint our own frame bytes without encoding/decoding a PNG.
              copy.getContext("2d").putImageData(frame, 0, 0);
              el.style.display = "block";
              holdSince = Date.now();
            }
            // the frozen frame never outlives HOLD_MAX_MS
            if (holdSafety) clearTimeout(holdSafety);
            holdSafety = setTimeout(hideHold, HOLD_MAX_MS + 500);
          } catch (e) {
            hideHold();
          }
        }
        function hideHold() {
          var el = document.getElementById("bw-resize-hold");
          if (el && el.style.display === "block") {
            window.BW_LAST_HOLD_MS = Date.now() - holdSince;
            window.BW_HOLD_COUNT = (window.BW_HOLD_COUNT || 0) + 1;
          }
          if (el) el.style.display = "none";
          if (holdTimer) {
            clearInterval(holdTimer);
            holdTimer = null;
          }
          if (holdSafety) {
            clearTimeout(holdSafety);
            holdSafety = null;
          }
        }
        function watchHold(key, g) {
          if (holdTimer) clearInterval(holdTimer);
          holdTimer = setInterval(function () {
            var c = document.getElementById("canvas"),
              size = "";
            try {
              size = String(Module.bwGetScreenSize());
            } catch (e) {}
            var elapsed = Date.now() - holdSince;
            if (
              size === key &&
              c &&
              c.width === g.width &&
              c.height === g.height &&
              window.bwConsoleFillsScreen()
            ) {
              hideHold();
              return;
            }
            if (elapsed >= HOLD_MAX_MS) {
              hideHold();
              if (size !== key && !retried) {
                // the request was lost (never applied): once more
                retried = true;
                console.warn(
                  "[bw] screen is " +
                    size +
                    ", expected " +
                    key +
                    " - resizing again",
                );
                lastKey = "";
                window.bwSyncScreenToPanel();
              }
            }
          }, 100);
        }
        // measured on an animation frame: a background VS Code tab reads as 300x150
        window.bwSyncScreenToPanel = function () {
          requestAnimationFrame(syncScreenToPanel);
        };
        var syncScreenToPanel = function () {
          try {
            if (
              typeof Module === "undefined" ||
              typeof Module.bwResizeScreen !== "function"
            ) {
              hideHold();
              return;
            }
            var w = window.innerWidth,
              h = window.innerHeight;
            if (!(w > 100 && h > 100)) {
              hideHold();
              return;
            }
            var g = window.bwGeometryFor(w, h);
            var key = g.width + "x" + g.height;
            if (key === lastKey) {
              hideHold();
              return;
            }
            if (key !== pending) retried = false;
            pending = key;
            lastKey = key;
            window.BW_CONSOLE_GEOMETRY = g;
            showHold();
            Module.bwResizeScreen(g.width, g.height);
            console.log(
              "[bw] screen -> " +
                key +
                " (" +
                g.cols +
                "x" +
                g.rows +
                " cells) for a " +
                w +
                "x" +
                h +
                " panel",
            );
            if (holdSince) watchHold(key, g); // (only when a frame is frozen; before the console is up there is nothing to hide)
          } catch (e) {
            hideHold();
          }
        };
        // Freeze the frame only when the panel asks for a different screen. Before the
        // environment is ready the screen keeps its boot size (a screen shrunk before conhost
        // fitted its window is never filled); the sync after "fully loaded" catches up.
        window.addEventListener("resize", function () {
          if (!window.BW_READY_AT) return;
          var k = panelKey();
          if (k && k !== lastKey) showHold();
          clearTimeout(timer);
          timer = setTimeout(window.bwSyncScreenToPanel, DEBOUNCE_MS);
        });
        // once ready: fit a restored screen (the snapshot's size) or a panel that changed
        window.addEventListener("boxedwine-fully-loaded", function () {
          lastKey = "";
          setTimeout(window.bwSyncScreenToPanel, 300);
        });
      })();
      getDisableHideCursor = function () {
        return true;
      };

      // Start the boot downloads now; the shell and the loader below pick up the responses.
      // bw-cache.js is not shipped: this block does nothing
      if (window.BWCache) {
        window.BWCache.prefetch(
          Config.locateRootBaseUrl + DEFAULT_ROOT_ZIP_FILE,
          { method: "GET" },
        );
        window.BWCache.prefetch(Config.locateAppBaseUrl + getAppZipFile(), {
          method: "GET",
        });
        window.BWCache.prefetch(window.BW_GLUE_URL, {
          credentials: "same-origin",
        });
        window.BWCache.prefetch(window.BW_WASM_URL, {
          credentials: "same-origin",
        });
      }

      // Instant-startup snapshot (ST and MT). The identity covers everything that shapes the
      // booted guest, so a change invalidates the stored snapshot. ?bwmtsnap=0 disables MT restore.
      window.BW_MT_SNAPSHOT_ENABLED = true;
      try {
        if (localStorage.getItem("bw-mtsnap") === "0")
          window.BW_MT_SNAPSHOT_ENABLED = false;
      } catch (e) {}
      if (window.BWSnapshot && !(window.BW_CONFIG && window.BW_CONFIG.noSnapshot === true)) {
        var _bwWasm = window.BW_USE_MT ? "boxedwine-mt.wasm" : "boxedwine.wasm";
        // the screen size is not part of it: a restored screen is resized to the panel
        var _bwId = [
          window.BW_USE_MT ? "mt" : "st",
          DEFAULT_ROOT_ZIP_FILE,
          getAppZipFile(),
          getExecutable(),
          getProgramArgs().join(","),
          "livescreen",
          Config.WorkingDir,
        ].join("|");
        var _bwMarker = "bwsnapmark|" + _bwId;
        var _bwSnapAllowed = !window.BW_USE_MT || window.BW_MT_SNAPSHOT_ENABLED;
        // Suppress emscripten's automatic main() only when a snapshot marker exists, decided
        // synchronously: a cold boot must use auto-main (calling callMain after noInitialRun
        // deadlocks MT under PROXY_TO_PTHREAD). begin() still validates the snapshot; a stale
        // marker makes the shell discard it and reload into a cold boot.
        var _bwHasSnap = false;
        try {
          _bwHasSnap = localStorage.getItem(_bwMarker) === "1";
        } catch (e) {}
        if (_bwHasSnap && !_bwSnapAllowed) {
          // A marker from a build that armed MT restore: never take that path now.
          try {
            localStorage.removeItem(_bwMarker);
          } catch (e) {}
          _bwHasSnap = false;
        }
        if (_bwHasSnap) {
          Module.noInitialRun = true;
        }
        window.BWSnapshot.begin({
          wasmUrl: _bwWasm,
          identity: _bwId,
          markerKey: _bwMarker,
          captureAllowed: _bwSnapAllowed,
          buildId: window.BW_BUILD_ID,
          runtime: window.BW_USE_MT ? "mt" : "st",
        });
        window.BWSnapshot.watchWasmLoad(); // pre-instantiation guard (blocked/failed wasm)
      }
