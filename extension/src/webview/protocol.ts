export const ToWebview = {
  compileAndRun: "compile-and-run",
  syncFiles: "sync-files",
  syncLargeFile: "sync-large-file",
  cancelLargeFile: "cancel-large-file",
  prepareReload: "prepare-reload",
  factoryReset: "factory-reset",
  editorSelected: "editor-selected",
} as const;

export const FromWebview = {
  bwEvent: "bw-event",
  reloadWebview: "reload-webview",
  reloadReady: "reload-ready",
  factoryResetDone: "factory-reset-done",
  exportBinaries: "export-binaries",
  fileSyncFailed: "file-sync-failed",
  largeFileAck: "large-file-ack",
  pushMessageToVscode: "push-message-to-vscode",
  terminalLog: "terminal-log",
} as const;

export const BwEvents = {
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
} as const;

export type BwEventName = (typeof BwEvents)[keyof typeof BwEvents];

/** `data`: the text, or the bytes in base64 when `isBinary` */
export interface SyncFile {
  dPath: string; // "/"-separated, relative to D:\
  isBinary: boolean;
  data: string;
}

export interface CompileAndRunPayload {
  requestId: string;
  dPath: string;
  text: string;
}

export interface SyncFilesPayload {
  files: SyncFile[];
}

export interface FactoryResetPayload {
  deleteFiles: boolean;
}

export interface LargeFileChunk {
  id: string;
  dPath: string;
  size: number; // the bytes the page receives in all, after any line-end conversion
  offset: number;
  chunk: ArrayBuffer;
  last: boolean;
}

export interface CancelLargeFilePayload {
  id: string;
}

export interface BwEventMessage {
  command: typeof FromWebview.bwEvent;
  eventName: string;
  data: unknown;
}

export interface ReloadWebviewMessage {
  command: typeof FromWebview.reloadWebview;
  reason: string;
}

export interface ReloadReadyMessage {
  command: typeof FromWebview.reloadReady;
}

export interface FactoryResetDoneMessage {
  command: typeof FromWebview.factoryResetDone;
  deleteFiles: boolean;
  blocked: string[]; // databases another window still held open when the reset finished
}

export interface ExportedFile {
  ext: ".obj" | ".exe";
  base64: string;
}

export interface ExportBinariesMessage {
  command: typeof FromWebview.exportBinaries;
  requestId: string;
  ok: boolean; // the build produced an .exe
  files: ExportedFile[];
}

export interface FileSyncFailure {
  dPath: string;
  reason: string;
}

export interface FileSyncFailedMessage {
  command: typeof FromWebview.fileSyncFailed;
  files: FileSyncFailure[];
}

export interface PushMessageToVscodeMessage {
  command: typeof FromWebview.pushMessageToVscode;
  message: string;
}

export interface LargeFileAckMessage {
  command: typeof FromWebview.largeFileAck;
  id: string;
  received: number;
  error?: string;
}

export type WebviewMessage =
  | BwEventMessage
  | ReloadWebviewMessage
  | ReloadReadyMessage
  | FactoryResetDoneMessage
  | ExportBinariesMessage
  | FileSyncFailedMessage
  | LargeFileAckMessage
  | PushMessageToVscodeMessage;
