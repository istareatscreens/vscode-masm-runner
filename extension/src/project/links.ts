import * as vscode from "vscode";
import { createHash } from "crypto";

export const LINKS_KEY = "masmRunner.links";
export const DEBOUNCE_MS = 300;

export interface LinkRecord {
  dPath: string;
  size: number;
  mtime: number;
  sha256: string;
  // linked only by the automatic sync: unlinked when its type is no longer tracked
  auto?: boolean;
}

export type LinkTable = Record<string, LinkRecord>; // key: uri.toString()

export interface FileStat {
  size: number;
  mtime: number;
}

export const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export function staleLinks(
  table: LinkTable,
  stats: ReadonlyMap<string, FileStat | null>,
): { changed: string[]; missing: string[] } {
  const changed: string[] = [];
  const missing: string[] = [];
  for (const [uri, rec] of Object.entries(table)) {
    const st = stats.get(uri);
    if (st === undefined) continue; // not checked
    if (st === null) missing.push(uri);
    else if (st.size !== rec.size || st.mtime !== rec.mtime) changed.push(uri);
  }
  return { changed, missing };
}

export const needsSync = (
  rec: LinkRecord | undefined,
  contentSha: string,
): boolean => !rec || rec.sha256 !== contentSha;

export function foldersToWatch(
  table: LinkTable,
  folderOf: (uri: string) => string | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const uri of Object.keys(table)) {
    const f = folderOf(uri);
    if (f) out.add(f);
  }
  return out;
}

interface Memento {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void>;
}

export class LinkStore {
  constructor(private readonly memento: Memento) {}

  all(): LinkTable {
    return { ...this.memento.get<LinkTable>(LINKS_KEY, {}) };
  }

  get(uri: string): LinkRecord | undefined {
    return this.all()[uri];
  }

  async set(uri: string, rec: LinkRecord): Promise<void> {
    await this.setMany([[uri, rec]]);
  }

  async setMany(entries: [string, LinkRecord][]): Promise<void> {
    if (!entries.length) return;
    const t = this.all();
    for (const [uri, rec] of entries) t[uri] = rec;
    await this.memento.update(LINKS_KEY, t);
  }

  async remove(uri: string): Promise<void> {
    await this.removeMany([uri]);
  }

  async removeMany(uris: string[]): Promise<void> {
    const t = this.all();
    const gone = uris.filter((u) => u in t);
    if (!gone.length) return;
    for (const u of gone) delete t[u];
    await this.memento.update(LINKS_KEY, t);
  }

  async invalidate(dPath: string): Promise<void> {
    const t = this.all();
    let changed = false;
    for (const rec of Object.values(t)) {
      if (rec.dPath === dPath && rec.sha256) {
        rec.sha256 = "";
        changed = true;
      }
    }
    if (changed) await this.memento.update(LINKS_KEY, t);
  }

  async clear(): Promise<void> {
    await this.memento.update(LINKS_KEY, {});
  }
}

export class Debouncer {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly ms: number) {}

  run(key: string, fn: () => void): void {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        fn();
      }, this.ms),
    );
  }

  dispose(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
}

export interface TrackedSync {
  tracked(uri: vscode.Uri): boolean;
  sync(uri: string): void;
}

export class LinkWatcher implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private watchers = new Map<string, vscode.Disposable>(); // folder uri -> watcher
  private readonly debouncer = new Debouncer(DEBOUNCE_MS);

  constructor(
    private readonly links: LinkStore,
    private readonly resync: (uri: string) => void,
    private readonly auto?: TrackedSync,
  ) {
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => this.changed(doc.uri)),
      vscode.workspace.onDidDeleteFiles((e) =>
        e.files.forEach((u) => void this.links.remove(u.toString())),
      ),
      vscode.workspace.onDidRenameFiles((e) =>
        e.files.forEach((f) => void this.links.remove(f.oldUri.toString())),
      ),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh()),
    );
    this.refresh();
  }

  private enabled(): boolean {
    return vscode.workspace
      .getConfiguration("masmRunner")
      .get<boolean>("autoSyncProjectFiles", true);
  }

  private changed(uri: vscode.Uri): void {
    const key = uri.toString();
    if (!this.enabled()) return;
    const auto = this.auto;
    if (this.links.get(key)) this.debouncer.run(key, () => this.resync(key));
    else if (auto && auto.tracked(uri))
      this.debouncer.run(key, () => auto.sync(key));
  }

  refresh(): void {
    const want = foldersToWatch(this.links.all(), (uri) => {
      const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(uri));
      return folder ? folder.uri.toString() : undefined;
    });
    if (this.auto)
      for (const f of vscode.workspace.workspaceFolders || [])
        if (f.uri.scheme === "file") want.add(f.uri.toString());
    for (const [folder, w] of this.watchers) {
      if (!want.has(folder)) {
        w.dispose();
        this.watchers.delete(folder);
      }
    }
    if (!this.enabled()) return;
    for (const folder of want) {
      if (this.watchers.has(folder)) continue;
      const ws = vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(folder));
      if (!ws) continue;
      const w = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(ws, "**/*"),
      );
      // checked like a change: an atomic save (delete + create) keeps its link; resync() unlinks a deleted file
      const subs = [
        w.onDidChange((u) => this.changed(u)),
        w.onDidCreate((u) => this.changed(u)),
        w.onDidDelete((u) => this.changed(u)),
      ];
      this.watchers.set(folder, {
        dispose: () => {
          subs.forEach((s) => s.dispose());
          w.dispose();
        },
      });
    }
  }

  dispose(): void {
    this.debouncer.dispose();
    for (const w of this.watchers.values()) w.dispose();
    this.watchers.clear();
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
  }
}
