import type { GuestFs } from "./mirror";
import { outputPath } from "../outputPath";

export type BuildState = "idle" | "building" | "running";

export const OUTPUT_EXTS = [".obj", ".exe", ".lst", ".map"];
export const EXPORT_EXTS = [".obj", ".exe"];
export const INTERRUPT_SETTLE_MS = 300;
export const READY_WAIT_MS = 5000;
export const SENTINEL_POLL_MS = 250;

export interface BuildRequest {
  requestId: string;
  dPath: string; // "lab1/test.asm", relative to D:\
  bytes: Uint8Array; // the pre-processed source
}

export interface BuildOutput {
  filename: string; // "lab1/bin/test.exe"
  bytes: Uint8Array;
}

export interface BuildResult {
  requestId: string;
  ok: boolean; // an .exe was produced
  outputs: BuildOutput[];
}

export interface BuildApp {
  build(filename: string, content: Uint8Array, opts: { requestId: string; doneSentinel: string }): void;
  writeCommand(command: string): void;
  interrupt(): void;
  guestFs: GuestFs & { remove(path: string): void };
}

export interface BuildStore {
  apply(changes: { putFiles?: { path: string; bytes: Uint8Array; mtime: number }[]; deleteFiles?: string[] }): Promise<boolean>;
}

export interface BuildMirror {
  setInFlight(paths: Iterable<string>): void;
  markSynced(path: string): void;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  now(): number;
}

export interface CoordinatorDeps {
  app: BuildApp;
  store: BuildStore;
  mirror: BuildMirror;
  onResult(result: BuildResult): void;
  /** a program kept running after Ctrl+C */
  onBlocked(dropped: BuildRequest[]): void;
  timers?: Timers;
  log?: (message: string) => void;
}

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  now: () => Date.now(),
};

const key = (dPath: string): string => dPath.toLowerCase();

export const outputPaths = (dPath: string): string[] => OUTPUT_EXTS.map((ext) => outputPath(dPath, ext));

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

interface Current {
  request: BuildRequest;
  id: string;
  outputs: string[];
}

export class BuildCoordinator {
  private stateValue: BuildState = "idle";
  private current: Current | null = null;
  private queue: BuildRequest[] = [];
  private seq = 0;
  private readonly session: string;
  private donePoll: unknown = null;
  private interruptTimer: unknown = null;
  private readyPoll: unknown = null;
  private interrupting = false;
  // a failed build's outputs, per source: not mirrored until it is built again
  private readonly quarantine = new Map<string, string[]>();
  private readonly timers: Timers;
  private readonly log: (message: string) => void;

  constructor(private readonly deps: CoordinatorDeps) {
    this.timers = deps.timers || defaultTimers;
    this.log = deps.log || ((m: string) => console.log(m));
    this.session = this.timers.now().toString(36);
  }

  get state(): BuildState {
    return this.stateValue;
  }

  get pending(): readonly BuildRequest[] {
    return this.queue;
  }

  request(req: BuildRequest): void {
    if (this.stateValue === "idle") {
      void this.start(req);
      return;
    }
    if (this.stateValue === "building" && this.current && key(this.current.request.dPath) === key(req.dPath) && sameBytes(this.current.request.bytes, req.bytes)) {
      this.log("[build] " + req.dPath + " is already being built with this content");
      return;
    }
    const i = this.queue.findIndex((q) => key(q.dPath) === key(req.dPath));
    if (i >= 0) this.queue[i] = req;
    else this.queue.push(req);
    if (this.stateValue === "running") this.interruptRunning();
  }

  private excluded(current: string[]): string[] {
    const all = [...current];
    for (const paths of this.quarantine.values()) all.push(...paths);
    return all;
  }

  private async start(req: BuildRequest): Promise<void> {
    const id = this.session + "_" + ++this.seq;
    const outputs = outputPaths(req.dPath);
    this.current = { request: req, id, outputs };
    this.stateValue = "building";
    this.quarantine.delete(key(req.dPath));
    this.deps.mirror.setInFlight(this.excluded(outputs));
    try {
      await this.deps.store.apply({ deleteFiles: outputs });
    } catch (e) {
      this.log("[build] could not remove the previous outputs of " + req.dPath + " from the container: " + e);
    }
    this.deps.app.build(req.dPath, req.bytes, { requestId: req.requestId, doneSentinel: "__bw_done_" + id });
    this.deps.mirror.markSynced(req.dPath);
  }

  async outputsReady(result: BuildResult): Promise<void> {
    const cur = this.current;
    if (!cur || this.stateValue !== "building" || result.requestId !== cur.request.requestId) {
      this.log("[build] outputs for " + result.requestId + " arrived for no build in flight");
      return;
    }
    if (result.ok) {
      const now = this.timers.now();
      try {
        await this.deps.store.apply({ putFiles: result.outputs.map((o) => ({ path: o.filename, bytes: o.bytes, mtime: now })) });
      } catch (e) {
        this.log("[build] could not store the outputs of " + cur.request.dPath + ": " + e);
      }
      for (const o of result.outputs) this.deps.mirror.markSynced(o.filename);
    } else {
      this.quarantine.set(key(cur.request.dPath), cur.outputs);
    }
    this.deps.mirror.setInFlight(this.excluded([]));
    this.deps.onResult({
      requestId: result.requestId,
      ok: result.ok,
      outputs: result.ok ? result.outputs.filter((o) => EXPORT_EXTS.some((e) => o.filename.toLowerCase().endsWith(e))) : [],
    });
    this.stateValue = "running";
    this.watchDone();
    if (this.queue.length) this.interruptRunning();
  }

  private sentinelExists(name: string): boolean {
    const st = this.deps.app.guestFs.stat(name);
    return !!st && !st.dir;
  }

  private removeSentinel(name: string): void {
    try {
      this.deps.app.guestFs.remove(name);
    } catch (e) {
      this.log("[build] could not remove " + name + ": " + e);
    }
  }

  // running -> idle when the done sentinel appears (the program exited, the line finished)
  private watchDone(): void {
    this.stopDoneWatch();
    const cur = this.current!;
    const done = "__bw_done_" + cur.id;
    this.donePoll = this.timers.setInterval(() => {
      if (this.stateValue !== "running" || this.current !== cur || this.interrupting) return;
      if (!this.sentinelExists(done)) return;
      this.removeSentinel(done);
      this.finish();
    }, SENTINEL_POLL_MS);
  }

  private stopDoneWatch(): void {
    if (this.donePoll !== null) {
      this.timers.clearInterval(this.donePoll);
      this.donePoll = null;
    }
  }

  private finish(): void {
    this.stopDoneWatch();
    this.current = null;
    this.stateValue = "idle";
    const next = this.queue.shift();
    if (next) void this.start(next);
  }

  private interruptRunning(): void {
    if (this.interrupting || !this.current) return;
    this.interrupting = true;
    const cur = this.current;
    const ready = "__bw_ready_" + cur.id;
    const done = "__bw_done_" + cur.id;
    this.log("[build] interrupting the running program of " + cur.request.dPath);
    this.deps.app.interrupt();
    this.interruptTimer = this.timers.setTimeout(() => {
      this.interruptTimer = null;
      this.deps.app.writeCommand("type nul>D:\\" + ready);
      const t0 = this.timers.now();
      const stopPoll = () => {
        if (this.readyPoll !== null) this.timers.clearInterval(this.readyPoll);
        this.readyPoll = null;
      };
      this.readyPoll = this.timers.setInterval(() => {
        if (this.sentinelExists(ready)) {
          stopPoll();
          this.removeSentinel(ready);
          if (this.sentinelExists(done)) this.removeSentinel(done);
          this.interrupting = false;
          this.finish();
          return;
        }
        if (this.timers.now() - t0 >= READY_WAIT_MS) {
          stopPoll();
          this.interrupting = false;
          const dropped = this.queue.splice(0);
          this.log("[build] the prompt did not come back after Ctrl+C: " + dropped.length + " request(s) dropped");
          this.deps.onBlocked(dropped);
        }
      }, SENTINEL_POLL_MS);
    }, INTERRUPT_SETTLE_MS);
  }

  dispose(): void {
    this.stopDoneWatch();
    if (this.interruptTimer !== null) this.timers.clearTimeout(this.interruptTimer);
    if (this.readyPoll !== null) this.timers.clearInterval(this.readyPoll);
    this.interruptTimer = null;
    this.readyPoll = null;
  }
}
