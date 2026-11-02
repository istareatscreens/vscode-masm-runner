import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";
import { isBinaryFile } from "isbinaryfile";
import { ToWebview, FromWebview, BwEvents } from "./protocol";
import type {
  SyncFile,
  FactoryResetDoneMessage,
  ExportBinariesMessage,
  FileSyncFailedMessage,
  LargeFileAckMessage,
} from "./protocol";
import {
  renderWebviewHtml,
  createNonce,
  containerIdFor,
  debugSwitches,
  TEMPLATE_FILE,
} from "./webviewHtml";
import { TerminalNotifier, RESET_TERMINAL } from "./notifications";
import type { Severity } from "./notifications";
import { exportBinaries } from "./exportBinaries";
import {
  LargeFileSender,
  TooLargeToSend,
  planTransfer,
} from "./largeFileTransfer";
import { TERMINAL_VIEW_TYPE, terminalTabs } from "./terminalTabs";
import { logFromPage, terminalLog } from "./terminalLog";
import type { LargeFileHandle, LargeFileJob } from "./largeFileTransfer";
import { placeOnDrive, guestPath } from "../project/placement";
import type { WorkspaceFolderInfo } from "../project/placement";
import { LinkStore, LinkWatcher, sha256, needsSync } from "../project/links";
import type { LinkRecord } from "../project/links";
import {
  DEFAULT_EXTRA_TYPES,
  WALK_MAX_DEPTH,
  WALK_MAX_FILES,
  findTracked,
  isTracked,
  trackedTypes,
} from "../project/autoSync";
import { resolveIncludes } from "../project/includes";
import { loadMasmParser } from "../syntax/masmParser";

const PREPARE_RELOAD_MS = 2000;
const FACTORY_RESET_MS = 20000;
const SELF_RELOADS = 3;
const SELF_RELOAD_WINDOW_MS = 60000;
const TITLE = "Masm x86 Runner CMD";
const IN_CHUNKS = "chunks";
const SYNC_BATCH_FILES = 100;
const SYNC_BATCH_BYTES = 8 * 1024 * 1024;

interface PendingRequest {
  sourcePath: string;
  exportBinaries: boolean;
}

interface OutgoingFile {
  uri: vscode.Uri;
  dPath: string;
  bytes: Uint8Array;
  stat: fs.Stats;
  auto?: boolean;
}

const workspaceFolders = (): WorkspaceFolderInfo[] =>
  (vscode.workspace.workspaceFolders || [])
    .filter((f) => f.uri.scheme === "file")
    .map((f) => ({ name: f.name, fsPath: f.uri.fsPath }));

const insideWorkspace = (absPath: string): boolean =>
  workspaceFolders().some((f) => {
    const rel = path.relative(f.fsPath, absPath);
    return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
  });

const autoSyncOn = (): boolean =>
  vscode.workspace
    .getConfiguration("masmRunner")
    .get<boolean>("autoSyncProjectFiles", true);

const autoSyncTypes = (): Set<string> =>
  trackedTypes(
    vscode.workspace
      .getConfiguration("masmRunner")
      .get<unknown>("autoSyncFileTypes", DEFAULT_EXTRA_TYPES),
  );

const isTrackedFile = (uri: vscode.Uri): boolean => {
  const folder =
    uri.scheme === "file"
      ? vscode.workspace.getWorkspaceFolder(uri)
      : undefined;
  if (!folder || folder.uri.scheme !== "file") return false;
  const rel = path.relative(folder.uri.fsPath, uri.fsPath);
  return (
    !!rel &&
    !rel.startsWith("..") &&
    !path.isAbsolute(rel) &&
    isTracked(rel, autoSyncTypes())
  );
};

const setActiveContext = (value: boolean): void => {
  vscode.commands
    .executeCommand("setContext", "masmRunner.webviewActive", value)
    .then(undefined, () => undefined);
};

const message = (
  severity: Severity,
  text: string,
  actions: string[],
): Thenable<string | undefined> =>
  severity === "error"
    ? vscode.window.showErrorMessage(text, ...actions)
    : severity === "warning"
      ? vscode.window.showWarningMessage(text, ...actions)
      : vscode.window.showInformationMessage(text, ...actions);

async function openForChunks(fsPath: string): Promise<LargeFileHandle> {
  const fh = await fs.promises.open(fsPath, "r");
  try {
    const st = await fh.stat();
    if (!st.isFile()) throw new Error("it is not a file");
    return {
      size: st.size,
      mtime: st.mtimeMs,
      read: async (position, length) => {
        const buf = Buffer.allocUnsafeSlow(length);
        let got = 0;
        while (got < length) {
          const { bytesRead } = await fh.read(
            buf,
            got,
            length - got,
            position + got,
          );
          if (!bytesRead) break;
          got += bytesRead;
        }
        return got === length ? buf : buf.subarray(0, got);
      },
      close: () => fh.close(),
    };
  } catch (e) {
    await fh.close();
    throw e;
  }
}

export class MasmRunnerPanel {
  static currentPanel: MasmRunnerPanel | undefined;
  static readonly viewType = TERMINAL_VIEW_TYPE;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly notifier: TerminalNotifier;
  private readonly links: LinkStore;
  private readonly watcher: LinkWatcher;
  private readonly large: LargeFileSender;
  private readonly requests = new Map<string, PendingRequest>();
  private selfReloads: number[] = [];
  private readonly tooLargeWarned = new Set<string>();
  private readonly warnedOnce = new Set<string>();
  private workspaceSync: Promise<void> = Promise.resolve(); // one sync of the workspace at a time
  private onReloadReady: (() => void) | null = null;
  private onFactoryResetDone:
    | ((m: FactoryResetDoneMessage | null) => void)
    | null = null;
  private disposed = false;
  // the page has rebuilt D: ("reconciled")
  private started = false;

  static options(
    extensionUri: vscode.Uri,
  ): vscode.WebviewOptions & vscode.WebviewPanelOptions {
    return {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
    };
  }

  static createOrShow(context: vscode.ExtensionContext): void {
    let column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    if (MasmRunnerPanel.currentPanel) {
      MasmRunnerPanel.currentPanel.panel.reveal(column);
      return;
    }
    // a restored terminal tab VS Code has not revived yet is closed, so the window has one terminal
    const restored = terminalTabs();
    if (restored.length) {
      column = restored[0].group.viewColumn;
      vscode.window.tabGroups.close(restored).then(undefined, () => undefined);
    }
    const panel = vscode.window.createWebviewPanel(
      MasmRunnerPanel.viewType,
      TITLE,
      column || { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
      MasmRunnerPanel.options(context.extensionUri),
    );
    MasmRunnerPanel.currentPanel = new MasmRunnerPanel(panel, context);
  }

  static revive(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
  ): void {
    const current = MasmRunnerPanel.currentPanel;
    if (current) {
      // a terminal was started before VS Code revived this tab: one terminal per window
      try {
        panel.dispose();
      } catch (e) {
        // already closed
      }
      current.panel.reveal();
      return;
    }
    panel.webview.options = MasmRunnerPanel.options(context.extensionUri);
    MasmRunnerPanel.currentPanel = new MasmRunnerPanel(panel, context);
  }

  static isRunning(): boolean {
    return MasmRunnerPanel.currentPanel !== undefined;
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
  ) {
    this.panel.title = TITLE;
    this.links = new LinkStore(context.workspaceState);
    this.notifier = new TerminalNotifier(
      { show: message },
      () => void this.resetTerminal(),
    );
    this.watcher = new LinkWatcher(
      this.links,
      (uri) => void this.resyncLink(uri),
      { tracked: isTrackedFile, sync: (uri) => void this.syncTracked(uri) },
    );
    this.large = new LargeFileSender({
      open: openForChunks,
      post: (chunk) => {
        if (this.disposed) return false;
        try {
          // not JSON: the ArrayBuffer travels as binary data
          return this.panel.webview.postMessage({
            eventName: ToWebview.syncLargeFile,
            data: { data: chunk },
          });
        } catch (e) {
          return false;
        }
      },
      cancel: (id) => void this.post(ToWebview.cancelLargeFile, { id }),
      links: this.links,
      linked: () => this.watcher.refresh(),
      failed: (job, e) => this.onLargeFileFailed(job, e),
      progress: (job, run) =>
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: "MASM Runner" },
          (p) =>
            run((sent, total) =>
              p.report({
                message:
                  "sending " +
                  path.basename(job.fsPath) +
                  " to D: " +
                  Math.floor((sent / total) * 100) +
                  "%",
              }),
            ),
        ),
    });
    setActiveContext(true);
    this.disposables.push(
      this.watcher,
      this.panel.onDidDispose(() => this.dispose()),
      this.panel.onDidChangeViewState((e) => {
        setActiveContext(e.webviewPanel.visible);
        this.post(ToWebview.editorSelected, {});
      }),
      this.panel.webview.onDidReceiveMessage((m) => this.onMessage(m)),
      vscode.window.onDidChangeWindowState(() =>
        this.post(ToWebview.editorSelected, {}),
      ),
      vscode.window.onDidChangeTextEditorViewColumn(() =>
        this.post(ToWebview.editorSelected, {}),
      ),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          !e.affectsConfiguration("masmRunner.autoSyncProjectFiles") &&
          !e.affectsConfiguration("masmRunner.autoSyncFileTypes")
        )
          return;
        this.watcher.refresh();
        this.queueWorkspaceSync(false);
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() =>
        this.queueWorkspaceSync(false),
      ),
    );
    void this.render();
  }

  private async render(): Promise<void> {
    if (this.disposed) return;
    const webview = this.panel.webview;
    const media = vscode.Uri.joinPath(this.context.extensionUri, "media");
    try {
      const template = await fs.promises.readFile(
        vscode.Uri.joinPath(this.context.extensionUri, ...TEMPLATE_FILE).fsPath,
        "utf8",
      );
      if (this.disposed) return;
      const assetBase = webview.asWebviewUri(media).toString() + "/";
      const storage = this.context.storageUri
        ? this.context.storageUri.toString()
        : undefined;
      const config = {
        assetBase,
        zipBase: assetBase + "latest26/",
        containerId: containerIdFor(storage),
        ...debugSwitches(process.env.MASM_RUNNER_DEBUG),
      };
      this.started = false;
      this.large.restart();
      webview.html = renderWebviewHtml(template, {
        cspSource: webview.cspSource,
        nonce: createNonce(),
        assetBase,
        config,
      });
    } catch (e) {
      void vscode.window.showErrorMessage(
        "MASM Runner: the terminal page could not be loaded: " +
          (e instanceof Error ? e.message : String(e)),
      );
      return;
    }
    this.notifier.newStart();
    this.requests.clear();
    this.queueWorkspaceSync(true);
  }

  async reload(reason: string, origin: "user" | "page"): Promise<void> {
    if (this.disposed) return;
    if (origin === "page") {
      const now = Date.now();
      this.selfReloads = this.selfReloads.filter(
        (t) => now - t < SELF_RELOAD_WINDOW_MS,
      );
      if (this.selfReloads.length >= SELF_RELOADS) {
        console.warn(
          "[MASM Runner] refused a terminal reload (" +
            reason +
            "): " +
            SELF_RELOADS +
            " in the last minute",
        );
        terminalLog().warn(
          "refused a terminal reload (" +
            reason +
            "): " +
            SELF_RELOADS +
            " in the last minute",
        );
        const choice = await vscode.window.showErrorMessage(
          "MASM Runner: the terminal kept restarting itself, so it was stopped. Use Reset terminal to start it again.",
          RESET_TERMINAL,
        );
        if (choice === RESET_TERMINAL) await this.reload("user-reset", "user");
        return;
      }
      this.selfReloads.push(now);
    } else {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, PREPARE_RELOAD_MS);
        function done() {
          clearTimeout(timer);
          resolve();
        }
        this.onReloadReady = () => {
          this.onReloadReady = null;
          done();
        };
        if (!this.post(ToWebview.prepareReload, {})) done();
      });
      this.onReloadReady = null;
    }
    console.log("[MASM Runner] reloading the terminal (" + reason + ")");
    terminalLog().info("reloading the terminal (" + reason + ")");
    // shown (focus stays): a page that starts in a background tab gets no animation frames
    if (origin === "user") this.panel.reveal(undefined, true);
    await this.render();
  }

  private post(eventName: string, data: unknown): boolean {
    if (this.disposed) return false;
    try {
      this.panel.webview
        .postMessage(JSON.stringify({ eventName, data: { data } }))
        .then(undefined, () => undefined);
      return true;
    } catch (e) {
      return false;
    }
  }

  private onMessage(m: any): void {
    if (!m || typeof m.command !== "string") return;
    switch (m.command) {
      case FromWebview.bwEvent:
        this.onTerminalEvent(String(m.eventName), m.data);
        return;
      case FromWebview.reloadWebview:
        void this.reload(String(m.reason), "page");
        return;
      case FromWebview.reloadReady:
        if (this.onReloadReady) this.onReloadReady();
        return;
      case FromWebview.factoryResetDone:
        if (this.onFactoryResetDone)
          this.onFactoryResetDone(m as FactoryResetDoneMessage);
        return;
      case FromWebview.exportBinaries:
        void this.onExport(m as ExportBinariesMessage);
        return;
      case FromWebview.fileSyncFailed:
        void this.onSyncFailed(m as FileSyncFailedMessage);
        return;
      case FromWebview.largeFileAck:
        this.large.onAck(m as LargeFileAckMessage);
        return;
      case FromWebview.pushMessageToVscode:
        void vscode.window.showErrorMessage(
          String(
            m.message || "MASM Runner: an error occurred in the terminal.",
          ),
        );
        return;
      case FromWebview.terminalLog:
        logFromPage(m.level, m.text);
        return;
    }
  }

  private onTerminalEvent(eventName: string, data: unknown): void {
    if (eventName === BwEvents.reconciled) {
      this.started = true;
      this.notifier.terminalReady();
      void this.resyncStaleLinks();
      this.large.start();
    }
    this.notifier.onEvent(eventName, data);
  }

  private async readForSync(
    uri: vscode.Uri,
    forBuild = false,
  ): Promise<{ bytes: Uint8Array; stat: fs.Stats } | typeof IN_CHUNKS | null> {
    const stat = await fs.promises.stat(uri.fsPath);
    if (!stat.isFile()) return null;
    const plan = planTransfer(path.basename(uri.fsPath), stat.size, forBuild);
    if (plan.kind === "too-large")
      throw new TooLargeToSend(stat.size, plan.limit, plan.what);
    if (plan.kind === "chunks") return IN_CHUNKS;
    return { bytes: await fs.promises.readFile(uri.fsPath), stat };
  }

  private onLargeFileFailed(job: LargeFileJob, e: Error): void {
    const name = path.basename(job.fsPath);
    if (e instanceof TooLargeToSend && !job.force) {
      if (this.tooLargeWarned.has(job.uri)) return;
      this.tooLargeWarned.add(job.uri);
      void vscode.window.showWarningMessage(
        "MASM Runner: " +
          name +
          " is no longer synced to D:: " +
          e.message +
          ".",
      );
      return;
    }
    void vscode.window.showErrorMessage(
      "MASM Runner: could not send " +
        name +
        " to the terminal's D: drive: " +
        e.message +
        ".",
    );
  }

  private async syncOut(files: OutgoingFile[]): Promise<void> {
    if (!files.length) return;
    const wire: SyncFile[] = [];
    for (const f of files) {
      const binary = await isBinaryFile(Buffer.from(f.bytes), f.bytes.length);
      wire.push({
        dPath: f.dPath,
        isBinary: binary,
        data: binary
          ? Buffer.from(f.bytes).toString("base64")
          : Buffer.from(f.bytes).toString("utf8"),
      });
    }
    if (!this.post(ToWebview.syncFiles, { files: wire })) return;
    await this.links.setMany(
      files.map((f) => [
        f.uri.toString(),
        {
          dPath: f.dPath,
          size: f.stat.size,
          mtime: f.stat.mtimeMs,
          sha256: sha256(f.bytes),
          ...(f.auto ? { auto: true } : {}),
        },
      ]),
    );
    this.watcher.refresh();
  }

  async sendFiles(uris: vscode.Uri[]): Promise<void> {
    const out: OutgoingFile[] = [];
    const problems: string[] = [];
    for (const uri of uris) {
      if (uri.scheme !== "file") continue;
      try {
        const read = await this.readForSync(uri);
        if (!read) {
          problems.push(path.basename(uri.fsPath) + " is a folder");
          continue;
        }
        const placed = placeOnDrive(uri.fsPath, workspaceFolders());
        if (!placed.ok) {
          problems.push(path.basename(uri.fsPath) + ": " + placed.reason);
          continue;
        }
        if (read === IN_CHUNKS)
          this.large.add({
            uri: uri.toString(),
            fsPath: uri.fsPath,
            dPath: placed.dPath,
            force: true,
          });
        else
          out.push({
            uri,
            dPath: placed.dPath,
            bytes: read.bytes,
            stat: read.stat,
          });
      } catch (e) {
        problems.push(
          path.basename(uri.fsPath) +
            ": " +
            (e instanceof Error ? e.message : String(e)),
        );
      }
    }
    if (problems.length)
      void vscode.window.showErrorMessage(
        "MASM Runner: could not send " + problems.join("; "),
      );
    await this.syncOut(out);
  }

  private async checkLink(
    uriString: string,
  ): Promise<{ send?: OutgoingFile; restamp?: [string, LinkRecord] }> {
    const rec = this.links.get(uriString);
    if (!rec || this.disposed) return {};
    const uri = vscode.Uri.parse(uriString);
    let read: { bytes: Uint8Array; stat: fs.Stats } | typeof IN_CHUNKS | null;
    try {
      read = await this.readForSync(uri);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        await this.links.remove(uriString);
      else if (
        e instanceof TooLargeToSend &&
        !this.tooLargeWarned.has(uriString)
      ) {
        this.tooLargeWarned.add(uriString);
        void vscode.window.showWarningMessage(
          "MASM Runner: " +
            path.basename(uri.fsPath) +
            " is no longer synced to D:: " +
            e.message +
            ".",
        );
      }
      return {};
    }
    if (!read) return {};
    if (read === IN_CHUNKS) {
      this.large.add({
        uri: uriString,
        fsPath: uri.fsPath,
        dPath: rec.dPath,
        force: false,
        auto: rec.auto,
      });
      return {};
    }
    if (!needsSync(rec, sha256(read.bytes))) {
      if (rec.size === read.stat.size && rec.mtime === read.stat.mtimeMs)
        return {};
      return {
        restamp: [
          uriString,
          { ...rec, size: read.stat.size, mtime: read.stat.mtimeMs },
        ],
      };
    }
    return {
      send: {
        uri,
        dPath: rec.dPath,
        bytes: read.bytes,
        stat: read.stat,
        auto: rec.auto,
      },
    };
  }

  private async resyncLink(uriString: string): Promise<void> {
    const r = await this.checkLink(uriString);
    if (r.restamp) await this.links.setMany([r.restamp]);
    if (r.send) await this.syncOut([r.send]);
  }

  private batcher(): {
    add(f: OutgoingFile): Promise<void>;
    flush(): Promise<void>;
  } {
    let batch: OutgoingFile[] = [];
    let bytes = 0;
    const flush = async (): Promise<void> => {
      const out = batch;
      batch = [];
      bytes = 0;
      await this.syncOut(out);
    };
    return {
      add: async (f) => {
        batch.push(f);
        bytes += f.bytes.length;
        if (batch.length >= SYNC_BATCH_FILES || bytes >= SYNC_BATCH_BYTES)
          await flush();
      },
      flush,
    };
  }

  private async resyncStaleLinks(): Promise<void> {
    if (!autoSyncOn()) return;
    const out = this.batcher();
    const restamps: [string, LinkRecord][] = [];
    const gone: string[] = [];
    for (const [uri, rec] of Object.entries(this.links.all())) {
      try {
        const st = await fs.promises.stat(vscode.Uri.parse(uri).fsPath);
        if (st.size === rec.size && st.mtimeMs === rec.mtime && rec.sha256)
          continue;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") gone.push(uri);
        continue;
      }
      const r = await this.checkLink(uri);
      if (r.restamp) restamps.push(r.restamp);
      if (r.send) await out.add(r.send);
    }
    await this.links.removeMany(gone);
    await this.links.setMany(restamps);
    await out.flush();
  }

  private queueWorkspaceSync(atStart: boolean): void {
    this.workspaceSync = this.workspaceSync
      .then(() => (atStart ? this.resyncStaleLinks() : this.unlinkUntracked()))
      .then(() => this.syncTrackedFiles())
      .catch((e) =>
        console.warn("[MASM Runner] syncing the workspace to D: failed: " + e),
      );
  }

  private async unlinkUntracked(): Promise<void> {
    if (!autoSyncOn()) return;
    await this.links.removeMany(
      Object.entries(this.links.all())
        .filter(
          ([uri, rec]) => rec.auto && !isTrackedFile(vscode.Uri.parse(uri)),
        )
        .map(([uri]) => uri),
    );
    this.watcher.refresh();
  }

  private warnOnce(key: string, text: string): void {
    if (this.warnedOnce.has(key)) return;
    this.warnedOnce.add(key);
    void vscode.window.showWarningMessage(text);
  }

  private async syncTrackedFiles(): Promise<void> {
    if (!autoSyncOn() || this.disposed) return;
    const types = autoSyncTypes();
    const out = this.batcher();
    const linked = this.links.all();
    for (const folder of vscode.workspace.workspaceFolders || []) {
      if (folder.uri.scheme !== "file") continue;
      const found = await findTracked(folder.uri.fsPath, types);
      if (found.truncated)
        this.warnOnce(
          "walk:" + folder.uri.toString(),
          "MASM Runner: " +
            folder.name +
            " holds more files than are synced to D: automatically (up to " +
            WALK_MAX_FILES +
            " MASM files, " +
            WALK_MAX_DEPTH +
            " folders deep). The others go to D: when you compile, include or send them.",
        );
      for (const file of found.files) {
        if (this.disposed) return;
        const uri = vscode.Uri.file(file);
        if (linked[uri.toString()]) continue;
        const placed = placeOnDrive(file, workspaceFolders());
        if (!placed.ok) {
          this.warnOnce(
            "place:" + uri.toString(),
            "MASM Runner: " +
              path.basename(file) +
              " is not synced to D: automatically: " +
              placed.reason +
              ".",
          );
          continue;
        }
        try {
          const read = await this.readForSync(uri);
          if (!read) continue;
          if (read === IN_CHUNKS) {
            this.large.add({
              uri: uri.toString(),
              fsPath: file,
              dPath: placed.dPath,
              force: false,
              auto: true,
            });
            continue;
          }
          await out.add({
            uri,
            dPath: placed.dPath,
            bytes: read.bytes,
            stat: read.stat,
            auto: true,
          });
        } catch (e) {
          if (e instanceof TooLargeToSend)
            this.warnOnce(
              "size:" + uri.toString(),
              "MASM Runner: " +
                path.basename(file) +
                " is not synced to D: automatically: " +
                e.message +
                ".",
            );
          else if ((e as NodeJS.ErrnoException).code !== "ENOENT")
            console.warn("[MASM Runner] " + file + " was not synced: " + e);
        }
      }
    }
    await out.flush();
  }

  private async syncTracked(uriString: string): Promise<void> {
    if (this.disposed || !autoSyncOn()) return;
    if (this.links.get(uriString)) return this.resyncLink(uriString);
    const uri = vscode.Uri.parse(uriString);
    if (!isTrackedFile(uri)) return;
    const placed = placeOnDrive(uri.fsPath, workspaceFolders());
    if (!placed.ok) {
      this.warnOnce(
        "place:" + uriString,
        "MASM Runner: " +
          path.basename(uri.fsPath) +
          " is not synced to D: automatically: " +
          placed.reason +
          ".",
      );
      return;
    }
    let read: { bytes: Uint8Array; stat: fs.Stats } | typeof IN_CHUNKS | null;
    try {
      read = await this.readForSync(uri);
    } catch (e) {
      if (e instanceof TooLargeToSend)
        this.warnOnce(
          "size:" + uriString,
          "MASM Runner: " +
            path.basename(uri.fsPath) +
            " is not synced to D: automatically: " +
            e.message +
            ".",
        );
      return;
    }
    if (!read) return;
    if (read === IN_CHUNKS)
      this.large.add({
        uri: uriString,
        fsPath: uri.fsPath,
        dPath: placed.dPath,
        force: false,
        auto: true,
      });
    else
      await this.syncOut([
        {
          uri,
          dPath: placed.dPath,
          bytes: read.bytes,
          stat: read.stat,
          auto: true,
        },
      ]);
  }

  private async onSyncFailed(m: FileSyncFailedMessage): Promise<void> {
    const files = Array.isArray(m.files) ? m.files : [];
    if (!files.length) return;
    for (const f of files) await this.links.invalidate(f.dPath);
    void vscode.window.showErrorMessage(
      "MASM Runner: could not place " +
        files
          .map((f) => guestPath(f.dPath) + " (" + f.reason + ")")
          .join(", ") +
        " on the terminal's D: drive.",
    );
  }

  async runCode(document: vscode.TextDocument): Promise<void> {
    const placed = placeOnDrive(document.uri.fsPath, workspaceFolders());
    if (!placed.ok) {
      void vscode.window.showErrorMessage(
        "MASM Runner: " +
          path.basename(document.uri.fsPath) +
          " cannot be placed on D: (" +
          placed.reason +
          ")",
      );
      return;
    }
    await this.syncIncludes(document);
    const requestId = randomBytes(8).toString("hex");
    this.requests.set(requestId, {
      sourcePath: document.uri.fsPath,
      exportBinaries: vscode.workspace
        .getConfiguration("masmRunner")
        .get<boolean>("exportBinaries", true),
    });
    const text = document.getText();
    // a terminal still starting in a background tab gets no animation frames: show it
    if (!this.started && !this.panel.visible)
      this.panel.reveal(undefined, true);
    if (
      !this.post(ToWebview.compileAndRun, {
        requestId,
        dPath: placed.dPath,
        text,
      })
    )
      return;
    try {
      const st = await fs.promises.stat(document.uri.fsPath);
      await this.links.set(document.uri.toString(), {
        dPath: placed.dPath,
        size: st.size,
        mtime: st.mtimeMs,
        sha256: sha256(Buffer.from(text, "utf8")),
      });
      this.watcher.refresh();
    } catch (e) {
      // an unsaved document has no file to link
    }
  }

  private async syncIncludes(document: vscode.TextDocument): Promise<void> {
    const parser = loadMasmParser();
    if (!parser || document.uri.scheme !== "file") return;
    try {
      const result = await resolveIncludes(
        document.uri.fsPath,
        document.getText(),
        parser,
        {
          readText: async (p) => {
            try {
              const st = await fs.promises.stat(p);
              return st.isFile() ? await fs.promises.readFile(p, "utf8") : null;
            } catch (e) {
              return null;
            }
          },
          inWorkspace: insideWorkspace,
        },
      );
      const out: OutgoingFile[] = [];
      for (const inc of result.files) {
        const placed = placeOnDrive(inc.path, workspaceFolders());
        if (!placed.ok) continue; // the assembler reports what it cannot open
        // as JSON, so it is on D: before the build request
        const read = await this.readForSync(vscode.Uri.file(inc.path), true);
        if (read && read !== IN_CHUNKS)
          out.push({
            uri: vscode.Uri.file(inc.path),
            dPath: placed.dPath,
            bytes: read.bytes,
            stat: read.stat,
          });
      }
      await this.syncOut(out);
    } catch (e) {
      console.warn(
        "[MASM Runner] include files of " +
          document.uri.fsPath +
          " were not synced: " +
          e,
      );
    }
  }

  private async onExport(m: ExportBinariesMessage): Promise<void> {
    const req = this.requests.get(String(m.requestId));
    if (!req) return;
    this.requests.delete(String(m.requestId));
    if (!req.exportBinaries || !Array.isArray(m.files) || !m.files.length)
      return;
    const result = await exportBinaries(
      req.sourcePath,
      m.files.map((f) => ({
        ext: f.ext,
        bytes: Buffer.from(f.base64, "base64"),
      })),
    );
    if (result.failed.length)
      void vscode.window.showErrorMessage(
        "MASM Runner: could not export " +
          result.failed
            .map((f) => path.basename(f.file) + " (" + f.reason + ")")
            .join(", ") +
          ". The previous file was left as it was.",
      );
  }

  async resetTerminal(): Promise<void> {
    await this.reload("user-reset", "user");
  }

  async factoryReset(): Promise<void> {
    const keep = "Reset, keep files";
    const remove = "Reset and delete this project's files";
    const choice = await vscode.window.showWarningMessage(
      "Factory reset the MASM Command Prompt?",
      {
        modal: true,
        detail:
          "Resets the terminal environment: the instant-start state and the emulator's records are deleted, and the next start boots Windows from scratch and saves a new instant-start state.\n\n" +
          '"' +
          keep +
          "\" keeps every project's files on D:.\n" +
          '"' +
          remove +
          "\" also deletes this project's stored D: files and the files of MASM Runner 0.9. Other projects' files are kept." +
          (autoSyncOn()
            ? " The workspace's MASM files are placed on D: again when the terminal starts (automatic sync)."
            : ""),
      },
      keep,
      remove,
    );
    if (!choice || this.disposed) return;
    const deleteFiles = choice === remove;
    this.large.clear();
    const done = await new Promise<FactoryResetDoneMessage | null>(
      (resolve) => {
        const timer = setTimeout(() => finish(null), FACTORY_RESET_MS);
        const finish = (m: FactoryResetDoneMessage | null) => {
          clearTimeout(timer);
          this.onFactoryResetDone = null;
          resolve(m);
        };
        this.onFactoryResetDone = finish;
        if (!this.post(ToWebview.factoryReset, { deleteFiles })) finish(null);
      },
    );
    if (deleteFiles) await this.links.clear();
    if (!done)
      void vscode.window.showWarningMessage(
        "MASM Runner: the terminal did not confirm the factory reset; it is restarted anyway.",
      );
    else if (done.blocked && done.blocked.length)
      void vscode.window.showWarningMessage(
        "MASM Runner: a terminal in another VS Code window still uses " +
          done.blocked.join(", ") +
          ". The reset finishes when that terminal closes.",
      );
    this.panel.reveal(undefined, true);
    await this.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (MasmRunnerPanel.currentPanel === this) {
      MasmRunnerPanel.currentPanel = undefined;
      setActiveContext(false);
    }
    this.large.clear();
    if (this.onReloadReady) this.onReloadReady();
    if (this.onFactoryResetDone) this.onFactoryResetDone(null);
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }
}
