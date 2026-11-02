// received as JSON.stringify({ eventName, data: { data: payload } }), except syncLargeFile
export const ToWebview = Object.freeze({
  compileAndRun: "compile-and-run",
  syncFiles: "sync-files",
  syncLargeFile: "sync-large-file",
  cancelLargeFile: "cancel-large-file",
  prepareReload: "prepare-reload",
  factoryReset: "factory-reset",
  editorSelected: "editor-selected",
});

export const FromWebview = Object.freeze({
  bwEvent: "bw-event",
  reloadWebview: "reload-webview",
  reloadReady: "reload-ready",
  factoryResetDone: "factory-reset-done",
  exportBinaries: "export-binaries",
  fileSyncFailed: "file-sync-failed",
  largeFileAck: "large-file-ack",
  pushMessageToVscode: "push-message-to-vscode",
  terminalLog: "terminal-log",
});

export const BwEvents = Object.freeze({
  emulatorReady: "emulator-ready",
  reconciled: "reconciled",
  emulatorFrozen: "emulator-frozen",
  emulatorRecovered: "emulator-recovered",
  programCrashed: "program-crashed",
  emulatorCrashed: "emulator-crashed",
  webglContextLost: "webgl-context-lost",
  snapshotNotSaved: "snapshot-not-saved",
  restoreFallback: "restore-fallback",
  runtimeDowngraded: "runtime-downgraded",
  emulatorSlow: "emulator-slow",
  containerReadOnly: "container-read-only",
  buildBlocked: "build-blocked",
  fileTooLarge: "file-too-large",
});
