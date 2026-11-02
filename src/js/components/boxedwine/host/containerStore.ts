export const DRIVE_DB_PREFIX = "masm-runner-drive:";
export const LOCK_WAIT_MS = 3000;
const DB_VERSION = 1;
const FILES = "files";
const FOLDERS = "folders";
const META = "meta";

export interface FileMeta {
  size: number;
  mtime: number;
}

export interface StoredFile extends FileMeta {
  path: string;
  data: ArrayBuffer;
}

export interface FilePut {
  path: string;
  bytes: Uint8Array;
  mtime: number;
}

export interface ContainerChanges {
  putFiles?: FilePut[];
  deleteFiles?: string[];
  putFolders?: string[];
  deleteFolders?: string[];
}

export type LockState = "held" | "unavailable" | "unsupported";

export interface ContainerDeps {
  indexedDB: IDBFactory;
  locks: LockManager | null | undefined;
  lockWaitMs?: number;
  log?: (message: string) => void;
}

const requestPromise = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const transactionDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
  });

// Hold the lock until the page goes away; give up after waitMs.
const acquireLock = (locks: LockManager, name: string, waitMs: number): Promise<LockState> =>
  new Promise((resolve) => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), waitMs);
    locks
      .request(name, { signal: abort.signal }, () => {
        clearTimeout(timer);
        resolve("held");
        return new Promise<never>(() => {}); // never released by this page
      })
      .catch(() => {
        clearTimeout(timer);
        resolve("unavailable");
      });
  });

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer
    ? bytes.buffer
    : bytes.slice().buffer;

export class ContainerStore {
  private db: IDBDatabase | null;
  private readonly fileIndex = new Map<string, FileMeta>();
  private readonly folderIndex = new Set<string>();
  private closedNoted = false;

  private constructor(
    readonly id: string,
    readonly lockState: LockState,
    db: IDBDatabase,
    private readonly log: (message: string) => void,
  ) {
    this.db = db;
    db.onversionchange = () => {
      // another page deletes or upgrades this database (a factory reset): let it proceed
      db.close();
      this.db = null;
      this.log("[container] " + this.id + " was deleted or upgraded by another page; nothing more is stored in this session");
    };
  }

  static databaseName(id: string): string {
    return DRIVE_DB_PREFIX + id;
  }

  static async open(id: string, deps: ContainerDeps): Promise<ContainerStore> {
    const log = deps.log || ((m: string) => console.warn(m));
    const name = ContainerStore.databaseName(id);
    const lockState: LockState = deps.locks
      ? await acquireLock(deps.locks, name, deps.lockWaitMs ?? LOCK_WAIT_MS)
      : "unsupported";
    if (lockState === "unsupported") log("[container] Web Locks are unavailable: " + name + " is opened without a writer lock");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = deps.indexedDB.open(name, DB_VERSION);
      req.onupgradeneeded = () => {
        const upgrade = req.result;
        if (!upgrade.objectStoreNames.contains(FILES)) upgrade.createObjectStore(FILES, { keyPath: "path" });
        if (!upgrade.objectStoreNames.contains(FOLDERS)) upgrade.createObjectStore(FOLDERS, { keyPath: "path" });
        if (!upgrade.objectStoreNames.contains(META)) upgrade.createObjectStore(META);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const store = new ContainerStore(id, lockState, db, log);
    await store.loadIndex();
    return store;
  }

  /** true when another page holds the container: nothing is written in this session */
  get readOnly(): boolean {
    return this.lockState === "unavailable";
  }

  get isOpen(): boolean {
    return this.db !== null;
  }

  private async loadIndex(): Promise<void> {
    const db = this.requireDb();
    const tx = db.transaction([FILES, FOLDERS], "readonly");
    const files = (await requestPromise(tx.objectStore(FILES).getAll())) as StoredFile[];
    const folders = (await requestPromise(tx.objectStore(FOLDERS).getAllKeys())) as string[];
    for (const f of files) this.fileIndex.set(f.path, { size: f.size, mtime: f.mtime });
    for (const p of folders) this.folderIndex.add(p);
  }

  private requireDb(): IDBDatabase {
    if (!this.db) throw new Error("container " + this.id + " is closed");
    return this.db;
  }

  get index(): ReadonlyMap<string, FileMeta> {
    return this.fileIndex;
  }

  get folders(): ReadonlySet<string> {
    return this.folderIndex;
  }

  async readAllFiles(): Promise<StoredFile[]> {
    const tx = this.requireDb().transaction(FILES, "readonly");
    return (await requestPromise(tx.objectStore(FILES).getAll())) as StoredFile[];
  }

  async readFile(path: string): Promise<StoredFile | undefined> {
    const tx = this.requireDb().transaction(FILES, "readonly");
    return (await requestPromise(tx.objectStore(FILES).get(path))) as StoredFile | undefined;
  }

  /** One transaction; false, with nothing written, when read-only or the database is gone. */
  async apply(changes: ContainerChanges): Promise<boolean> {
    if (this.readOnly) return false;
    if (!this.db) {
      if (!this.closedNoted) {
        this.closedNoted = true;
        this.log("[container] " + this.id + " is closed: changes are not stored");
      }
      return false;
    }
    const putFiles = changes.putFiles || [];
    const deleteFiles = changes.deleteFiles || [];
    const putFolders = changes.putFolders || [];
    const deleteFolders = changes.deleteFolders || [];
    if (!putFiles.length && !deleteFiles.length && !putFolders.length && !deleteFolders.length) return true;
    const tx = this.db.transaction([FILES, FOLDERS], "readwrite");
    const done = transactionDone(tx);
    const files = tx.objectStore(FILES);
    const folders = tx.objectStore(FOLDERS);
    for (const p of deleteFiles) files.delete(p);
    for (const p of deleteFolders) folders.delete(p);
    for (const p of putFolders) folders.put({ path: p });
    for (const f of putFiles) files.put({ path: f.path, data: toArrayBuffer(f.bytes), size: f.bytes.byteLength, mtime: f.mtime });
    await done;
    for (const p of deleteFiles) this.fileIndex.delete(p);
    for (const p of deleteFolders) this.folderIndex.delete(p);
    for (const p of putFolders) this.folderIndex.add(p);
    for (const f of putFiles) this.fileIndex.set(f.path, { size: f.bytes.byteLength, mtime: f.mtime });
    return true;
  }

  putFile(path: string, bytes: Uint8Array, mtime: number): Promise<boolean> {
    return this.apply({ putFiles: [{ path, bytes, mtime }] });
  }

  deleteFiles(paths: string[]): Promise<boolean> {
    return this.apply({ deleteFiles: paths });
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const tx = this.requireDb().transaction(META, "readonly");
    return (await requestPromise(tx.objectStore(META).get(key))) as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<boolean> {
    if (this.readOnly || !this.db) return false;
    const tx = this.db.transaction(META, "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(META).put(value, key);
    await done;
    return true;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
