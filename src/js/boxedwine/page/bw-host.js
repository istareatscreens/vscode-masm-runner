(function () {
  var api = null;
  try {
    api = acquireVsCodeApi();
  } catch (e) {
    console.error("[bw-host] the VS Code webview API is unavailable", e);
  }
  window.vscode = api;

  var send = function (message) {
    if (!api) {
      console.warn("[bw-host] no VS Code webview API: dropped " + message.command);
      return false;
    }
    try {
      api.postMessage(message);
      return true;
    } catch (e) {
      console.error("[bw-host] could not post " + message.command, e);
      return false;
    }
  };

  // lines with these tags go to the terminal's log; `forwarding` keeps send()'s own from looping
  var LOG_PREFIX = /^\[(bw|bw-snapshot|bw-watchdog|bw-host|host|build|Boxedwine)\]/;
  var LOG_LIMIT = 500;
  var LOG_LINE_MAX = 4000;
  var logged = 0,
    forwarding = false;
  var logText = function (args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (typeof a === "string") parts.push(a);
      else if (Object.prototype.toString.call(a) === "[object Error]") parts.push(String(a.stack || a));
      else {
        try {
          parts.push(JSON.stringify(a));
        } catch (e) {
          parts.push(String(a));
        }
      }
    }
    return parts.join(" ").slice(0, LOG_LINE_MAX);
  };
  ["log", "warn", "error"].forEach(function (level) {
    var original = console[level];
    if (typeof original !== "function") return;
    console[level] = function () {
      var result = original.apply(console, arguments);
      if (!forwarding && logged < LOG_LIMIT && typeof arguments[0] === "string" && LOG_PREFIX.test(arguments[0])) {
        forwarding = true;
        try {
          logged++;
          send({ command: "terminal-log", level: level, text: logText(arguments) });
          if (logged === LOG_LIMIT) send({ command: "terminal-log", level: "warn", text: "[bw-host] " + LOG_LIMIT + " lines logged: later lines of this page are not forwarded" });
        } catch (e) {
        } finally {
          forwarding = false;
        }
      }
      return result;
    };
  });

  var reloadReason = null;
  window.bwHost = {
    // as its JSON value, so it is always cloneable
    post: function (eventName, data) {
      var value = null;
      if (data !== undefined) {
        try {
          value = JSON.parse(JSON.stringify(data));
        } catch (e) {
          value = String(data);
        }
      }
      var name = String(eventName);
      try {
        var local = new CustomEvent("bw-host-post", { cancelable: true, detail: { eventName: name, data: value } });
        if (!window.dispatchEvent(local)) return false; // handled in the page
      } catch (e) {}
      return send({ command: "bw-event", eventName: name, data: value });
    },
    // one request per page: later callers are ignored
    reload: function (reason) {
      if (reloadReason !== null) {
        console.warn("[bw-host] reload already requested (" + reloadReason + "); ignoring " + reason);
        return false;
      }
      reloadReason = String(reason);
      console.warn("[bw-host] asking the extension to reload the terminal: " + reloadReason);
      return send({ command: "reload-webview", reason: reloadReason });
    },
  };
})();
