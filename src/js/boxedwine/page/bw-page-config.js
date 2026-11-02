(function () {
  var problems = [];
  var raw = {};
  var el = document.getElementById("bw-config");
  try {
    raw = JSON.parse(el ? el.textContent : "null");
    if (!raw || typeof raw !== "object") throw new Error("not an object");
  } catch (e) {
    problems.push(
      "the page configuration is not valid JSON (" + e.message + ")",
    );
    raw = {};
  }
  var url = function (name) {
    var v = raw[name];
    if (typeof v === "string" && /^[a-z][a-z0-9+.-]*:\/\/.+\/$/i.test(v))
      return v;
    problems.push(name + " is missing or is not an absolute URL ending in /");
    return null;
  };
  var assetBase = url("assetBase");
  var zipBase = url("zipBase");
  var containerId =
    typeof raw.containerId === "string" &&
    /^(?:[0-9a-f]{64}|no-workspace)$/.test(raw.containerId)
      ? raw.containerId
      : null;
  if (!containerId) problems.push("containerId is missing or invalid");
  var wineDebug =
    typeof raw.wineDebug === "string" &&
    /^[A-Za-z0-9_+\-,]+$/.test(raw.wineDebug)
      ? raw.wineDebug
      : null;

  // a missing build id could match another build's snapshot: instant start is turned off
  var meta = document.querySelector('meta[name="bw-build-id"]');
  var buildId = meta ? meta.getAttribute("content") : null;
  var buildIdOk =
    typeof buildId === "string" &&
    /^[A-Za-z0-9._-]+$/.test(buildId) &&
    buildId.indexOf("__") !== 0;
  if (!buildIdOk)
    console.error(
      "[bw-config] no build identity in webview.html (" +
        buildId +
        "): instant start is off",
    );

  window.BW_CONFIG = Object.freeze({
    buildId: buildIdOk ? buildId : "unbuilt",
    assetBase: assetBase,
    zipBase: zipBase,
    containerId: containerId,
    debugLog: raw.debugLog === true,
    debugTrace: raw.debugTrace === true,
    wineDebug: wineDebug,
    noSnapshot: raw.noSnapshot === true || !buildIdOk,
  });
  window.BW_BUILD_ID = window.BW_CONFIG.buildId;
  window.BW_ASSET_BASE = assetBase;
  window.BW_ZIP_BASE = zipBase;
  window.BW_DEBUG_LOG = window.BW_CONFIG.debugLog;

  if (problems.length) {
    var reason = "invalid page configuration: " + problems.join("; ");
    console.error("[bw-config] " + reason);
    try {
      window.bwHost.post("emulator-slow", { runtime: "st", reason: reason });
    } catch (e) {}
  }
})();
