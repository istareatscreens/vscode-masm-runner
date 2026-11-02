(function () {
  var mt = window.BW_USE_MT === true;
  var GLUE_V = window.BW_GLUE_V;
  var wasmUrl = window.BW_WASM_URL;
  var glueUrl = window.BW_GLUE_URL;
  var cf = function (u) {
    return window.BWCache
      ? window.BWCache.fetch(u, { credentials: "same-origin" })
      : fetch(u, { credentials: "same-origin" });
  };
  try {
    var prev = Module.locateFile;
    Module.locateFile = function (path, prefix) {
      if (/boxedwine\.wasm$/.test(path)) return wasmUrl;
      return prev ? prev(path, prefix) : (prefix || "") + path;
    };
    // main-thread instantiation (MT workers use the module posted by this thread)
    Module.instantiateWasm = function (imports, receiveInstance) {
      window.bwBootStage("Compiling emulator");
      var done = function (r) {
        window.BW_WASM_INSTANTIATED = true;
        receiveInstance(r.instance, r.module);
      };
      var viaBuffer = function (resp) {
        return resp.arrayBuffer().then(function (b) {
          return WebAssembly.instantiate(b, imports);
        });
      };
      cf(wasmUrl)
        .then(function (resp) {
          if (typeof WebAssembly.instantiateStreaming === "function") {
            return WebAssembly.instantiateStreaming(
              resp.clone(),
              imports,
            ).catch(function (e) {
              console.warn(
                "[bw] streaming wasm compile failed (" +
                  e +
                  "); using ArrayBuffer",
              );
              return viaBuffer(resp);
            });
          }
          return viaBuffer(resp);
        })
        .then(done)
        .catch(function (e) {
          console.error("[bw] wasm instantiation failed", e);
          window.BW_WASM_FAILED = String(e);
          // fail over now: MT reloads into ST, ST tells the parent
          if (window.BWSnapshot) window.BWSnapshot.onWasmFailed(String(e));
        });
      return {}; // exports arrive via receiveInstance
    };
  } catch (e) {
    mt = false;
  }

  var loadViaScriptTag = function (src) {
    var s = document.createElement("script");
    s.async = true;
    s.src = src;
    s.onerror = function () {
      if (mt) {
        // MT glue failed -> fall back to ST so the app still runs
        mt = false;
        wasmUrl = window.BW_ASSET_BASE + "boxedwine.wasm" + GLUE_V;
        var f = document.createElement("script");
        f.async = true;
        f.src = window.BW_ASSET_BASE + "boxedwine.js" + GLUE_V;
        document.body.appendChild(f);
      }
    };
    document.body.appendChild(s);
  };
  cf(glueUrl)
    .then(function (resp) {
      if (!resp.ok) throw new Error("glue HTTP " + resp.status);
      return resp.blob();
    })
    .then(function (blob) {
      var jsBlob =
        blob.type === "text/javascript"
          ? blob
          : new Blob([blob], { type: "text/javascript" });
      if (mt) {
        try {
          Module.mainScriptUrlOrBlob = jsBlob;
        } catch (e) {}
      }
      var s = document.createElement("script");
      s.async = true;
      s.src = URL.createObjectURL(jsBlob);
      s.onerror = function () {
        console.warn("[bw] blob glue failed; falling back to <script src>");
        loadViaScriptTag(glueUrl);
      };
      document.body.appendChild(s);
    })
    .catch(function (e) {
      console.warn(
        "[bw] glue fetch failed (" + e + "); falling back to <script src>",
      );
      if (mt) {
        try {
          Module.mainScriptUrlOrBlob = glueUrl;
        } catch (_) {}
      }
      loadViaScriptTag(glueUrl);
    });
  // tell the parent when MT failed under this build and this load fell back to ST
  if (window.BW_RUNTIME_DOWNGRADED) {
    window.addEventListener("load", function () {
      try {
        window.bwHost.post("runtime-downgraded", window.BW_RUNTIME_DOWNGRADED);
      } catch (e) {}
    });
  }
})();
