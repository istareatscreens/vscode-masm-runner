import { ToWebview, FromWebview, BwEvents } from "./protocol.js";
import { ContainerStore } from "./containerStore";
import type { StoredFile } from "./containerStore";
import { migrateLegacy } from "./legacyMigration";
import { preProcessText } from "./textPreprocess";
import { Mirror, MAX_STORED_BYTES } from "./mirror";
import type { GuestFs } from "./mirror";
import { BuildCoordinator } from "./buildCoordinator";
import type { BuildResult } from "./buildCoordinator";
import { factoryReset } from "./factoryReset";
import { AckPacer, LargeFileReceiver } from "./largeFiles";
import { pageBootProbe, watchSlowBoot } from "./bootDiagnostics";

const FLUSH_LIMIT_MS = 1500; // the extension waits at most 2 s for "reload-ready"

export interface HostBwApp {
  reconcile(files: { filename: string; content: Uint8Array; isBinary: boolean }[], folders: string[]): void;
  syncFile(filename: string, content: Uint8Array, isBinary: boolean): void;
  makeDir(path: string): void;
  build(filename: string, content: Uint8Array, isBase64: boolean, opts: { requestId: string; doneSentinel: string }): void;
  writeCommand(command: string): void;
  interrupt(): void;
  attachHost(): void;
  guestFs: GuestFs & { remove(path: string): void };
}

export interface HostEnv {
  containerId: string | null;
  bwHost: { post(eventName: string, data?: unknown): boolean };
  postToExtension(message: { command: string; [field: string]: unknown }): void;
  getBwApp(): HostBwApp | undefined;
  snapshot(): { restoreUnhealthy(reason: string): void } | undefined;
  indexedDB: IDBFactory;
  locks: LockManager | null;
  localStorage: Storage;
  target: EventTarget; // the page's window: events in and out
  bootStage(text: string): void;
  now(): number;
  log(message: string): void;
  guestProgress?(): number | null;
}

interface WireFile {
  dPath: string;
  isBinary: boolean;
  data: string;
}

const encoder = new TextEncoder();

const base64ToBytes = (value: string): Uint8Array => {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const ancestors = (path: string): string[] => {
  const parts = path.split("/");
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
};

const isDrivePath = (p: unknown): p is string =>
  typeof p === "string" && p.length > 0 && !/^\/|\\|(^|\/)\.{1,2}(\/|$)|\/\//.test(p) && !/\/$/.test(p);

// A container that cannot be opened: D: starts empty and nothing is stored.
class NoContainer {
  readonly readOnly = true;
  readonly index = new Map<string, unknown>();
  readonly folders = new Set<string>();
  async readAllFiles(): Promise<StoredFile[]> {
    return [];
  }
  async apply(): Promise<boolean> {
    return false;
  }
  close(): void {}
}

type Store = ContainerStore | NoContainer;

export class HostController {
  private store: Store | null = null;
  private storeReady: Promise<Store>;
  private storeOpened = false;
  private migrating = false;
  private mirror: Mirror | null = null;
  private coordinator: BuildCoordinator | null = null;
  private ready = false;
  private readonly pending: (() => void)[] = [];
  private restored = false;
  private userInput = false;
  private buildStarted = false;
  private readonly exportBase64 = new Map<string, Map<string, string>>(); // requestId -> filename -> base64
  private readonly largeFiles = new LargeFileReceiver();
  private readonly ackPacer: AckPacer;
  private readonly ackTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly env: HostEnv) {
    this.ackPacer = new AckPacer(() => env.now(), () => (env.guestProgress ? env.guestProgress() : null));
    this.storeReady = this.openStore().finally(() => {
      this.storeOpened = true;
    });
    const t = env.target;
    t.addEventListener("bw-adapter-event", (e) => this.onAdapterEvent((e as CustomEvent).detail));
    t.addEventListener("bw-host-post", (e) => this.onHostPost(e as CustomEvent));
    t.addEventListener("message", (e) => this.onExtensionMessage((e as MessageEvent).data));
    t.addEventListener("boxedwine-input-open", () => this.onInputOpen());
    const markInput = () => {
      if (this.ready) this.userInput = true;
    };
    t.addEventListener("keydown", markInput, true);
    t.addEventListener("paste", markInput, true);
  }

  private async openStore(): Promise<Store> {
    const { env } = this;
    if (!env.containerId) {
      env.log("[host] no container id: D: starts empty and nothing is stored");
      return (this.store = new NoContainer());
    }
    let store: Store;
    try {
      store = await ContainerStore.open(env.containerId, { indexedDB: env.indexedDB, locks: env.locks, log: env.log });
    } catch (e) {
      env.log("[host] the container could not be opened: " + e);
      env.postToExtension({
        command: FromWebview.pushMessageToVscode,
        message: "MASM Runner could not open this project's stored files (" + String((e as Error).message || e) + "). The terminal starts with an empty D:, and changes are not saved.",
      });
      return (this.store = new NoContainer());
    }
    this.store = store;
    if (store.readOnly) env.bwHost.post(BwEvents.containerReadOnly, { containerId: env.containerId });
    this.migrating = true;
    const migration = await migrateLegacy(store, env.localStorage, env.now());
    this.migrating = false;
    if (migration.status === "imported") env.log("[host] imported " + migration.imported.length + " file(s) from the previous version's D:");
    else if (migration.status === "failed") env.log("[host] importing the previous version's D: failed (it is tried again next start): " + migration.error);
    return store;
  }

  private onAdapterEvent(detail: { eventName: string; data: any }): void {
    if (!detail || typeof detail.eventName !== "string") return;
    const { eventName, data } = detail;
    switch (eventName) {
      case "emulator-ready":
        this.restored = !!data && data.how === "restore";
        void this.reconcile();
        this.forward(eventName, data);
        return;
      case "reconciled":
        this.onReconciled(data);
        return;
      case "file-synced":
        this.onFileSynced(data);
        return;
      case "build-outputs":
        void this.onBuildOutputs(data);
        return;
      case "emulator-frozen":
        if (this.restoreUnhealthy("frozen")) return;
        this.forward(eventName, data);
        return;
      default:
        this.forward(eventName, data);
    }
  }

  private forward(eventName: string, data: unknown): void {
    this.env.bwHost.post(eventName, data);
  }

  // a crash right after a restore is a failed restore
  private onHostPost(e: CustomEvent): void {
    const d = e.detail || {};
    if (d.eventName === BwEvents.emulatorCrashed && this.restoreUnhealthy("crashed")) e.preventDefault();
  }

  private restoreUnhealthy(reason: string): boolean {
    if (!this.restored || this.userInput || this.buildStarted) return false;
    const snap = this.env.snapshot();
    if (!snap || typeof snap.restoreUnhealthy !== "function") return false;
    this.env.log("[host] the restored terminal was " + reason + " before any input: discarding the snapshot");
    snap.restoreUnhealthy(reason);
    return true;
  }

  private async reconcile(): Promise<void> {
    const app = this.env.getBwApp();
    if (!app) {
      this.env.log("[host] emulator-ready without bwApp");
      return;
    }
    app.attachHost();
    if (!this.storeOpened) {
      // after the adapter's own "Loading your files" stage, which it sets right after this event
      void Promise.resolve().then(() => {
        if (!this.storeOpened) this.env.bootStage(this.migrating ? "Importing your files from MASM Runner 0.9" : "Opening this project's files");
      });
    }
    let files: { filename: string; content: Uint8Array; isBinary: boolean }[] = [];
    let folders: string[] = [];
    try {
      const store = await this.storeReady;
      const stored = await store.readAllFiles();
      files = stored.map((f) => ({ filename: f.path, content: new Uint8Array(f.data), isBinary: true }));
      folders = Array.from(store.folders);
    } catch (e) {
      this.env.log("[host] reading the container failed; D: starts empty: " + e);
    }
    app.reconcile(files, folders);
  }

  private onReconciled(summary: any): void {
    const app = this.env.getBwApp();
    const store = this.store;
    if (app && store && !this.mirror) {
      this.mirror = new Mirror({
        fs: app.guestFs,
        store,
        onTooLarge: (path, size) => this.env.bwHost.post(BwEvents.fileTooLarge, { path, size }),
        onError: (e) => this.env.log("[host] mirror: " + e),
      });
      this.mirror.baseline(); // before input opens: D: equals the container
      this.mirror.start();
      this.coordinator = new BuildCoordinator({
        app: {
          build: (filename, content, opts) => app.build(filename, content, true, opts),
          writeCommand: (c) => app.writeCommand(c),
          interrupt: () => app.interrupt(),
          guestFs: app.guestFs,
        },
        store,
        mirror: this.mirror,
        onResult: (r) => this.exportResult(r),
        onBlocked: (dropped) => this.env.bwHost.post(BwEvents.buildBlocked, { files: dropped.map((r) => r.dPath) }),
        log: this.env.log,
      });
    }
    const failed: string[] = summary && Array.isArray(summary.failed) ? summary.failed : [];
    if (failed.length)
      this.env.postToExtension({
        command: FromWebview.fileSyncFailed,
        files: failed.map((p) => ({ dPath: p, reason: "could not be written to D: at start" })),
      });
    const { tree, ...small } = summary || ({} as any);
    this.forward("reconciled", small);
  }

  private onInputOpen(): void {
    if (this.ready) return;
    this.ready = true;
    const queued = this.pending.splice(0);
    for (const run of queued) {
      try {
        run();
      } catch (e) {
        this.env.log("[host] a queued request failed: " + e);
      }
    }
  }

  private whenReady(run: () => void): void {
    if (this.ready) run();
    else this.pending.push(run);
  }

  private onFileSynced(r: any): void {
    if (!r || typeof r.op !== "string") return;
    if (r.op === "reconcile" || r.op === "reconcile-mkdir") return; // the "reconciled" summary covers these
    if (r.ok) {
      if (r.op === "write" && this.mirror) this.mirror.markSynced(r.filename);
      return;
    }
    this.env.postToExtension({
      command: FromWebview.fileSyncFailed,
      files: [{ dPath: String(r.filename), reason: "the copy on D: could not be verified (" + r.op + ")" }],
    });
  }

  private async onBuildOutputs(d: any): Promise<void> {
    if (!d || !this.coordinator) return;
    const files: { filename: string; base64: string }[] = Array.isArray(d.outputs) ? d.outputs : [];
    this.exportBase64.set(String(d.requestId), new Map(files.map((f) => [f.filename, f.base64])));
    await this.coordinator.outputsReady({
      requestId: String(d.requestId),
      ok: !!d.ok,
      outputs: files.map((f) => ({ filename: f.filename, bytes: base64ToBytes(f.base64) })),
    });
  }

  private exportResult(r: BuildResult): void {
    const b64 = this.exportBase64.get(r.requestId) || new Map<string, string>();
    this.exportBase64.delete(r.requestId);
    this.env.postToExtension({
      command: FromWebview.exportBinaries,
      requestId: r.requestId,
      ok: r.ok,
      files: r.outputs.map((o) => ({ ext: o.filename.slice(o.filename.lastIndexOf(".")).toLowerCase(), base64: b64.get(o.filename) || "" })),
    });
  }

  private onExtensionMessage(raw: unknown): void {
    // posted as an object, so its chunk arrives as binary data
    if (raw && typeof raw === "object" && (raw as { eventName?: unknown }).eventName === ToWebview.syncLargeFile) {
      const d = (raw as { data?: { data?: unknown } }).data;
      this.onLargeFileChunk(d ? d.data : undefined);
      return;
    }
    if (typeof raw !== "string" || raw.charAt(0) !== "{") return; // the emulator's own messages
    let msg: { eventName?: unknown; data?: { data?: any } };
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }
    const payload = msg && msg.data ? msg.data.data : undefined;
    switch (msg.eventName) {
      case ToWebview.compileAndRun:
        void this.compileAndRun(payload);
        return;
      case ToWebview.syncFiles:
        void this.syncFiles(payload);
        return;
      case ToWebview.cancelLargeFile:
        this.largeFiles.cancel(payload && payload.id);
        return;
      case ToWebview.prepareReload:
        void this.prepareReload();
        return;
      case ToWebview.factoryReset:
        void this.factoryReset(payload);
        return;
      case ToWebview.editorSelected:
        this.env.target.dispatchEvent(new CustomEvent("editor-selected"));
        return;
    }
  }

  private async storeFile(dPath: string, bytes: Uint8Array): Promise<boolean> {
    const store = await this.storeReady;
    if (bytes.length > MAX_STORED_BYTES) {
      this.env.bwHost.post(BwEvents.fileTooLarge, { path: dPath, size: bytes.length });
      return false;
    }
    try {
      return await store.apply({ putFolders: ancestors(dPath), putFiles: [{ path: dPath, bytes, mtime: this.env.now() }] });
    } catch (e) {
      this.env.postToExtension({ command: FromWebview.fileSyncFailed, files: [{ dPath, reason: "could not be stored (" + String((e as Error).message || e) + ")" }] });
      return false;
    }
  }

  private async compileAndRun(p: any): Promise<void> {
    if (!p || !isDrivePath(p.dPath) || typeof p.text !== "string" || typeof p.requestId !== "string") {
      this.env.log("[host] ignored an invalid compile-and-run request");
      return;
    }
    const bytes = encoder.encode(preProcessText(p.dPath, p.text));
    await this.storeFile(p.dPath, bytes);
    this.whenReady(() => {
      const app = this.env.getBwApp();
      if (!app || !this.coordinator) return;
      for (const folder of ancestors(p.dPath)) app.makeDir(folder);
      this.buildStarted = true;
      this.coordinator.request({ requestId: p.requestId, dPath: p.dPath, bytes });
    });
  }

  private async syncFiles(p: any): Promise<void> {
    const files: WireFile[] = p && Array.isArray(p.files) ? p.files : [];
    for (const f of files) {
      if (!f || !isDrivePath(f.dPath) || typeof f.data !== "string") {
        this.env.log("[host] ignored an invalid file in sync-files");
        continue;
      }
      let bytes: Uint8Array;
      try {
        bytes = f.isBinary ? base64ToBytes(f.data) : encoder.encode(preProcessText(f.dPath, f.data));
      } catch (e) {
        this.env.postToExtension({ command: FromWebview.fileSyncFailed, files: [{ dPath: f.dPath, reason: "unreadable content" }] });
        continue;
      }
      await this.placeFile(f.dPath, bytes);
    }
  }

  private async placeFile(dPath: string, bytes: Uint8Array): Promise<void> {
    await this.storeFile(dPath, bytes);
    this.whenReady(() => {
      const app = this.env.getBwApp();
      if (!app) return;
      for (const folder of ancestors(dPath)) app.makeDir(folder);
      app.syncFile(dPath, bytes, true);
    });
  }

  private onLargeFileChunk(m: any): void {
    if (!m || !isDrivePath(m.dPath)) {
      const id = m && typeof m.id === "string" ? m.id : "";
      this.largeFiles.cancel(id);
      this.env.postToExtension({ command: FromWebview.largeFileAck, id, received: 0, error: "an invalid D: path" });
      return;
    }
    for (const e of this.largeFiles.chunk(m)) {
      if (e.kind === "ack") this.ackChunk(e.id, e.received);
      else if (e.kind === "failed") this.env.postToExtension({ command: FromWebview.largeFileAck, id: e.id, received: 0, error: e.reason });
      else void this.placeFile(e.dPath, e.bytes);
    }
  }

  // paced while a guest program runs (AckPacer): the extension sends more chunks only after these
  private ackChunk(id: string, received: number): void {
    const send = () => this.env.postToExtension({ command: FromWebview.largeFileAck, id, received });
    const delay = this.ackPacer.delay();
    if (delay <= 0) return send();
    const timer = setTimeout(() => {
      this.ackTimers.delete(timer);
      send();
    }, delay);
    this.ackTimers.add(timer);
  }

  private async prepareReload(): Promise<void> {
    try {
      if (this.mirror) await Promise.race([this.mirror.flush(), new Promise((r) => setTimeout(r, FLUSH_LIMIT_MS))]);
    } catch (e) {
      this.env.log("[host] flush before reload failed: " + e);
    }
    this.env.postToExtension({ command: FromWebview.reloadReady });
  }

  dispose(): void {
    if (this.mirror) this.mirror.stop();
    if (this.coordinator) this.coordinator.dispose();
    this.largeFiles.clear();
    for (const t of this.ackTimers) clearTimeout(t);
    this.ackTimers.clear();
  }

  private async factoryReset(p: any): Promise<void> {
    const deleteFiles = !!(p && p.deleteFiles);
    this.dispose(); // nothing may be stored while the databases are deleted
    let blocked: string[] = [];
    try {
      const report = await factoryReset({
        deleteFiles,
        storage: this.env.localStorage,
        indexedDB: this.env.indexedDB,
        containerDatabase: ContainerStore.databaseName(this.env.containerId || "no-workspace"),
        closeContainer: () => {
          if (this.store) this.store.close();
        },
        log: this.env.log,
      });
      blocked = report.blocked;
    } catch (e) {
      this.env.log("[host] factory reset failed: " + e);
    }
    this.env.postToExtension({ command: FromWebview.factoryResetDone, deleteFiles, blocked });
  }
}

/** Call before the adapter mounts. */
export const startHostLayer = (): HostController => {
  const w = window as any;
  const cfg = w.BW_CONFIG || {};
  watchSlowBoot(window, pageBootProbe(w), (m) => console.warn(m));
  return new HostController({
    containerId: typeof cfg.containerId === "string" ? cfg.containerId : null,
    bwHost: w.bwHost,
    postToExtension: (message) => {
      if (w.vscode) w.vscode.postMessage(message);
    },
    getBwApp: () => w.bwApp,
    snapshot: () => w.BWSnapshot,
    indexedDB: window.indexedDB,
    locks: navigator.locks || null,
    localStorage: window.localStorage,
    target: window,
    bootStage: (text) => {
      if (typeof w.bwBootStage === "function") w.bwBootStage(text);
    },
    now: () => Date.now(),
    log: (m) => console.log(m),
    guestProgress: () => {
      const M = w.Module;
      try {
        return M && typeof M.bwGetGuestProgress === "function" ? Number(M.bwGetGuestProgress()) : null;
      } catch (e) {
        return null;
      }
    },
  });
};
