export const SCAN_EVERY_MS = 1000;
export const SCAN_MAX_DEPTH = 16;
export const SCAN_MAX_ENTRIES = 4096;
export const MAX_STORED_BYTES = 4 * 1024 * 1024;

export interface GuestStat {
  size: number;
  mtime: number;
  dir: boolean;
}

// paths are "/"-separated and relative to D:\ ("" is D:\ itself)
export interface GuestFs {
  readdir(path: string): string[];
  stat(path: string): GuestStat | null;
  readFile(path: string): Uint8Array | null;
}

export interface FileStamp {
  size: number;
  mtime: number;
}

export interface Scan {
  files: Map<string, FileStamp>;
  folders: Set<string>;
  truncated: boolean;
}

export interface MirrorPlan {
  putFiles: string[];
  deleteFiles: string[];
  putFolders: string[];
  deleteFolders: string[];
  tooLarge: string[];
}

export interface PlanInput {
  prev: Scan | null;
  cur: Scan;
  synced: ReadonlyMap<string, FileStamp>;
  storeFiles: ReadonlyMap<string, unknown> | ReadonlySet<string>;
  storeFolders: ReadonlySet<string>;
  observed: ReadonlySet<string>;
  inFlight: ReadonlySet<string>;
  /** before a reload: store what changed even if it was seen only once */
  flush?: boolean;
}

export const isSentinelPath = (path: string): boolean => path.split("/").some((seg) => /^__bw_/i.test(seg));

export const isExcluded = (path: string, inFlight: ReadonlySet<string>): boolean =>
  isSentinelPath(path) || inFlight.has(path.toLowerCase());

const sameStamp = (a: FileStamp | undefined, b: FileStamp | undefined): boolean =>
  !!a && !!b && a.size === b.size && a.mtime === b.mtime;

export function planMirror(input: PlanInput): MirrorPlan {
  const { prev, cur, synced, storeFiles, storeFolders, observed, inFlight, flush = false } = input;
  const plan: MirrorPlan = { putFiles: [], deleteFiles: [], putFolders: [], deleteFolders: [], tooLarge: [] };
  if (cur.truncated) return plan;
  for (const [path, stamp] of cur.files) {
    if (isExcluded(path, inFlight)) continue;
    const stable = flush || sameStamp(prev ? prev.files.get(path) : undefined, stamp);
    if (!stable || sameStamp(synced.get(path), stamp)) continue;
    if (stamp.size > MAX_STORED_BYTES) plan.tooLarge.push(path);
    else plan.putFiles.push(path);
  }
  for (const path of cur.folders) {
    if (isExcluded(path, inFlight) || storeFolders.has(path)) continue;
    if (flush || (prev && prev.folders.has(path))) plan.putFolders.push(path);
  }
  if (prev && !prev.truncated) {
    for (const path of storeFiles.keys()) {
      if (isExcluded(path, inFlight) || !observed.has(path)) continue;
      if (!cur.files.has(path) && !prev.files.has(path)) plan.deleteFiles.push(path);
    }
    for (const path of storeFolders) {
      if (isExcluded(path, inFlight) || !observed.has(path)) continue;
      if (!cur.folders.has(path) && !prev.folders.has(path)) plan.deleteFolders.push(path);
    }
  }
  return plan;
}

export function scanGuest(fs: GuestFs, maxDepth = SCAN_MAX_DEPTH, maxEntries = SCAN_MAX_ENTRIES): Scan {
  const scan: Scan = { files: new Map(), folders: new Set(), truncated: false };
  let seen = 0;
  const walk = (dir: string, depth: number): void => {
    let names: string[];
    try {
      names = fs.readdir(dir);
    } catch (e) {
      scan.truncated = true; // an unreadable folder: absence below it is unknown
      return;
    }
    for (const name of names) {
      if (name === "." || name === "..") continue;
      if (++seen > maxEntries) {
        scan.truncated = true;
        return;
      }
      const path = dir ? dir + "/" + name : name;
      const st = fs.stat(path);
      if (!st) continue;
      if (st.dir) {
        scan.folders.add(path);
        if (depth < maxDepth) walk(path, depth + 1);
        else scan.truncated = true;
      } else {
        scan.files.set(path, { size: st.size, mtime: st.mtime });
      }
    }
  };
  walk("", 0);
  return scan;
}

export interface MirrorStore {
  readonly readOnly: boolean;
  readonly index: ReadonlyMap<string, unknown>;
  readonly folders: ReadonlySet<string>;
  apply(changes: {
    putFiles?: { path: string; bytes: Uint8Array; mtime: number }[];
    deleteFiles?: string[];
    putFolders?: string[];
    deleteFolders?: string[];
  }): Promise<boolean>;
}

export interface MirrorDeps {
  fs: GuestFs;
  store: MirrorStore;
  onTooLarge?: (path: string, size: number) => void;
  onError?: (error: unknown) => void;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
}

export class Mirror {
  private prev: Scan | null = null;
  private readonly synced = new Map<string, FileStamp>();
  private readonly observed = new Set<string>();
  private readonly reported = new Set<string>();
  private inFlight = new Set<string>();
  private timer: unknown = null;
  private running: Promise<void> | null = null;

  constructor(private readonly deps: MirrorDeps) {}

  /** Call right after D: was rebuilt, before input opens: every file present holds its stored content. */
  baseline(): void {
    const scan = scanGuest(this.deps.fs);
    for (const [path, stamp] of scan.files) {
      if (this.deps.store.index.has(path)) this.synced.set(path, stamp);
    }
    this.observe(scan);
    this.prev = scan;
  }

  markSynced(path: string): void {
    const st = this.deps.fs.stat(path);
    if (st && !st.dir) this.synced.set(path, { size: st.size, mtime: st.mtime });
  }

  /** lower-case output paths of a build in flight: neither stored nor deleted */
  setInFlight(paths: Iterable<string>): void {
    this.inFlight = new Set(Array.from(paths, (p) => p.toLowerCase()));
  }

  start(): void {
    if (this.timer || this.deps.store.readOnly) return;
    const every = this.deps.setInterval || ((fn: () => void, ms: number) => setInterval(fn, ms));
    this.timer = every(() => {
      void this.tick();
    }, SCAN_EVERY_MS);
  }

  stop(): void {
    if (!this.timer) return;
    const clear = this.deps.clearInterval || ((h: unknown) => clearInterval(h as ReturnType<typeof setInterval>));
    clear(this.timer);
    this.timer = null;
  }

  /** serialised: a slow store write never overlaps the next scan */
  tick(flush = false): Promise<void> {
    if (this.deps.store.readOnly) return Promise.resolve();
    if (this.running) return flush ? this.running.then(() => this.tick(true)) : this.running;
    this.running = this.run(flush).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  flush(): Promise<void> {
    return this.tick(true);
  }

  private observe(scan: Scan): void {
    for (const p of scan.files.keys()) this.observed.add(p);
    for (const p of scan.folders) this.observed.add(p);
  }

  private async run(flush: boolean): Promise<void> {
    try {
      const cur = scanGuest(this.deps.fs);
      const { store } = this.deps;
      const plan = planMirror({
        prev: this.prev,
        cur,
        synced: this.synced,
        storeFiles: store.index,
        storeFolders: store.folders,
        observed: this.observed,
        inFlight: this.inFlight,
        flush,
      });
      this.observe(cur);
      this.prev = cur;
      for (const path of plan.tooLarge) {
        if (this.reported.has(path)) continue;
        this.reported.add(path);
        if (this.deps.onTooLarge) this.deps.onTooLarge(path, cur.files.get(path)!.size);
      }
      const puts: { path: string; bytes: Uint8Array; mtime: number }[] = [];
      for (const path of plan.putFiles) {
        const stamp = cur.files.get(path)!;
        const bytes = this.deps.fs.readFile(path);
        if (!bytes || bytes.length !== stamp.size) continue; // changed while reading: next scan
        puts.push({ path, bytes, mtime: stamp.mtime });
      }
      if (!puts.length && !plan.deleteFiles.length && !plan.putFolders.length && !plan.deleteFolders.length) return;
      const ok = await store.apply({
        putFiles: puts,
        deleteFiles: plan.deleteFiles,
        putFolders: plan.putFolders,
        deleteFolders: plan.deleteFolders,
      });
      if (!ok) return;
      for (const p of puts) this.synced.set(p.path, { size: p.bytes.length, mtime: p.mtime });
      for (const path of plan.deleteFiles) this.synced.delete(path);
    } catch (e) {
      if (this.deps.onError) this.deps.onError(e);
    }
  }
}
