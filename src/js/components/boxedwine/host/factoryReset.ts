import { isLegacyKey } from "./legacyMigration";

export const EMULATOR_DATABASES = ["bw-snapshot", "/root", "/d_drive"];
export const BLOCKED_WAIT_MS = 10000;
export const isEmulatorKey = (key: string): boolean => /^bw-/.test(key) || /^bwsnapmark\|/.test(key);

export interface ResetStorage {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

export interface FactoryResetDeps {
  deleteFiles: boolean;
  storage: ResetStorage;
  indexedDB: IDBFactory;
  containerDatabase: string;
  /** this page's own connection would block the delete */
  closeContainer(): void;
  waitMs?: number;
  log?: (message: string) => void;
}

export interface DatabaseResult {
  name: string;
  ok: boolean;
  blocked?: boolean;
  why?: string;
}

export interface FactoryResetReport {
  deleteFiles: boolean;
  keysRemoved: string[];
  databases: DatabaseResult[];
  blocked: string[];
}

const deleteDatabase = (idb: IDBFactory, name: string, waitMs: number): Promise<DatabaseResult> =>
  new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const done = (r: DatabaseResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(r);
    };
    try {
      const req = idb.deleteDatabase(name);
      req.onsuccess = () => done({ name, ok: true });
      req.onerror = () => done({ name, ok: false, why: String(req.error) });
      // another window holds it open: give it waitMs to let go, then report it
      req.onblocked = () => {
        if (!timer) timer = setTimeout(() => done({ name, ok: false, blocked: true }), waitMs);
      };
    } catch (e) {
      done({ name, ok: false, why: String(e) });
    }
  });

export const factoryReset = async (deps: FactoryResetDeps): Promise<FactoryResetReport> => {
  const log = deps.log || ((m: string) => console.warn(m));
  const report: FactoryResetReport = { deleteFiles: deps.deleteFiles, keysRemoved: [], databases: [], blocked: [] };
  try {
    const keys: string[] = [];
    for (let i = 0; i < deps.storage.length; i++) {
      const k = deps.storage.key(i);
      if (k !== null) keys.push(k);
    }
    for (const k of keys) {
      if (isEmulatorKey(k) || (deps.deleteFiles && isLegacyKey(k))) {
        deps.storage.removeItem(k);
        report.keysRemoved.push(k);
      }
    }
  } catch (e) {
    log("[factoryReset] localStorage: " + e);
  }
  const names = deps.deleteFiles ? EMULATOR_DATABASES.concat([deps.containerDatabase]) : EMULATOR_DATABASES;
  if (deps.deleteFiles) deps.closeContainer();
  report.databases = await Promise.all(names.map((name) => deleteDatabase(deps.indexedDB, name, deps.waitMs ?? BLOCKED_WAIT_MS)));
  report.blocked = report.databases.filter((d) => d.blocked).map((d) => d.name);
  log("[factoryReset] " + (deps.deleteFiles ? "environment + files" : "environment") + " reset: " + JSON.stringify({
    keysRemoved: report.keysRemoved.length,
    databases: report.databases,
  }));
  return report;
};
