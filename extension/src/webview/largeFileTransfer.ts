import { createHash, randomBytes } from "crypto";
import { isBinaryFile } from "isbinaryfile";
import type { LargeFileChunk } from "./protocol";
import type { LinkRecord } from "../project/links";

export const CHUNK_BYTES = 8 * 1024 * 1024;
export const WINDOW = 2;
export const ACK_TIMEOUT_MS = 60000;
// isBinaryFile decides by the first 512 bytes (and the size)
export const HEAD_BYTES = 512;

export const JSON_MAX_BYTES = 100 * 1024 * 1024;
export const STORED_MAX_BYTES = 4 * 1024 * 1024;
export const CHUNKED_MAX_BYTES = 1024 * 1024 * 1024;

// must match the page's textPreprocess.ts isAssemblySource
const ASSEMBLY_SOURCE = /\.asm$/i;

const mb = (bytes: number): string => (bytes / 1048576).toFixed(1);

export class TooLargeToSend extends Error {
  constructor(size: number, limit: number, what = "files", detail = "") {
    super(
      "it is " +
        mb(size) +
        " MB" +
        detail +
        ", and " +
        what +
        " up to " +
        limit / 1048576 +
        " MB can be placed on the terminal's D: drive",
    );
  }
}
export class TerminalRestarted extends Error {}
export class TransferCancelled extends Error {}
export class PageDropped extends Error {}
export class FileChanged extends Error {
  constructor() {
    super("the file changed while it was being sent");
  }
}

export type TransferPlan =
  | { kind: "json" }
  | { kind: "chunks" }
  | { kind: "too-large"; limit: number; what: string };

/** includes synced for a build go as JSON: they must be on D: before the build request */
export function planTransfer(
  fileName: string,
  size: number,
  forBuild: boolean,
): TransferPlan {
  if (forBuild || ASSEMBLY_SOURCE.test(fileName))
    return size <= JSON_MAX_BYTES
      ? { kind: "json" }
      : {
          kind: "too-large",
          limit: JSON_MAX_BYTES,
          what: forBuild ? "include files" : "assembly sources",
        };
  if (size <= STORED_MAX_BYTES) return { kind: "json" };
  return size <= CHUNKED_MAX_BYTES
    ? { kind: "chunks" }
    : { kind: "too-large", limit: CHUNKED_MAX_BYTES, what: "files" };
}

export async function convertsLineEnds(
  head: Uint8Array,
  size: number,
): Promise<boolean> {
  const b = Buffer.from(head.buffer, head.byteOffset, head.byteLength);
  if (await isBinaryFile(b, size)) return false;
  const starts = (...bytes: number[]): boolean =>
    bytes.every((x, i) => b[i] === x);
  return !(
    starts(0xff, 0xfe) ||
    starts(0xfe, 0xff) ||
    starts(0x00, 0x00, 0xfe, 0xff)
  );
}

export interface CrlfState {
  pendingCR: boolean; // the previous chunk ended with \r (written as \r\n): a \n next is dropped
}

const CR = 0x0d;
const LF = 0x0a;

/** the length crlfChunk gives `input`; the state advances the same way */
export function crlfLength(input: Uint8Array, state: CrlfState): number {
  // each \r and \n adds a byte, and each \r\n pair takes two back
  let crs = 0;
  let lfs = 0;
  let pairs = 0;
  for (let i = input.indexOf(CR); i !== -1; i = input.indexOf(CR, i + 1)) crs++;
  for (let i = input.indexOf(LF); i !== -1; i = input.indexOf(LF, i + 1)) {
    lfs++;
    if (i > 0 ? input[i - 1] === CR : state.pendingCR) pairs++;
  }
  if (input.length) state.pendingCR = input[input.length - 1] === CR;
  return input.length + crs + lfs - 2 * pairs;
}

/** \r\n, \r and \n each become \r\n, across chunk boundaries (the native indexOf finds them) */
export function crlfChunk(input: Uint8Array, state: CrlfState): Uint8Array {
  const leadingLF = state.pendingCR && input.length > 0 && input[0] === LF;
  const size = crlfLength(input, { ...state });
  // already CRLF throughout: nothing changes
  if (size === input.length && !leadingLF) {
    if (input.length) state.pendingCR = false;
    return input;
  }
  const src = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const out = new Uint8Array(size);
  let o = 0;
  let from = leadingLF ? 1 : 0;
  let nextCR = input.indexOf(CR, from);
  let nextLF = input.indexOf(LF, from);
  while (nextCR !== -1 || nextLF !== -1) {
    const isCR = nextCR !== -1 && (nextLF === -1 || nextCR < nextLF);
    const i = isCR ? nextCR : nextLF;
    o += src.copy(out, o, from, i);
    out[o++] = CR;
    out[o++] = LF;
    from = i + 1;
    if (isCR) {
      if (from < input.length && input[from] === LF)
        nextLF = input.indexOf(LF, ++from);
      nextCR = input.indexOf(CR, i + 1);
    } else nextLF = input.indexOf(LF, from);
  }
  src.copy(out, o, from, input.length);
  if (input.length) state.pendingCR = input[input.length - 1] === CR;
  return out;
}

export interface LargeFileSource {
  size: number;
  /** the bytes at `position`; fewer than `length` only at the end of the file */
  read(position: number, length: number): Promise<Uint8Array>;
}

export interface LargeFileTransport {
  /** false when the page is gone */
  post(chunk: LargeFileChunk): boolean | PromiseLike<boolean>;
  acked(id: string, received: number): Promise<void>;
}

const readExactly = async (
  src: LargeFileSource,
  position: number,
  length: number,
): Promise<Uint8Array> => {
  const bytes = await src.read(position, length);
  if (bytes.length !== length) throw new FileChanged();
  return bytes;
};

/** a chunk posts its whole ArrayBuffer, and a Buffer's can be larger than the Buffer: copy */
const ownBuffer = (u8: Uint8Array): ArrayBuffer =>
  u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
    ? (u8.buffer as ArrayBuffer)
    : (new Uint8Array(u8).buffer as ArrayBuffer);

export async function scanLargeFile(
  src: LargeFileSource,
  text: boolean,
  chunkBytes = CHUNK_BYTES,
  check: () => void = () => undefined,
): Promise<{ sha256: string; size: number }> {
  const hash = createHash("sha256");
  const state: CrlfState = { pendingCR: false };
  let size = 0;
  for (let pos = 0; pos < src.size; pos += chunkBytes) {
    check();
    const raw = await readExactly(
      src,
      pos,
      Math.min(chunkBytes, src.size - pos),
    );
    hash.update(raw);
    size += text ? crlfLength(raw, state) : raw.length;
  }
  return { sha256: hash.digest("hex"), size };
}

export async function sendLargeFile(
  src: LargeFileSource,
  transport: LargeFileTransport,
  o: {
    id: string;
    dPath: string;
    text: boolean;
    size: number;
    chunkBytes?: number;
    window?: number;
    onProgress?: (sent: number, total: number) => void;
  },
): Promise<{ sha256: string }> {
  const chunkBytes = o.chunkBytes || CHUNK_BYTES;
  const window = o.window || WINDOW;
  const hash = createHash("sha256");
  const state: CrlfState = { pendingCR: false };
  const ends: number[] = []; // the count of bytes received that acknowledges each chunk
  let offset = 0;
  const post = async (bytes: Uint8Array, last: boolean): Promise<void> => {
    if (ends.length >= window)
      await transport.acked(o.id, ends[ends.length - window]);
    if (offset + bytes.length > o.size) throw new FileChanged();
    if (
      !(await transport.post({
        id: o.id,
        dPath: o.dPath,
        size: o.size,
        offset,
        chunk: ownBuffer(bytes),
        last,
      }))
    )
      throw new Error("the terminal is not open");
    offset += bytes.length;
    ends.push(offset);
  };
  if (src.size === 0) await post(new Uint8Array(0), true);
  for (let pos = 0; pos < src.size; pos += chunkBytes) {
    const raw = await readExactly(
      src,
      pos,
      Math.min(chunkBytes, src.size - pos),
    );
    hash.update(raw);
    await post(
      o.text ? crlfChunk(raw, state) : raw,
      pos + raw.length >= src.size,
    );
    if (o.onProgress) o.onProgress(pos + raw.length, src.size);
  }
  if (offset !== o.size) throw new FileChanged();
  await transport.acked(o.id, o.size);
  return { sha256: hash.digest("hex") };
}

interface Progress {
  received: number; // -1 until the first acknowledgement
  failure?: Error;
  wake?: () => void;
}

export class AckTracker {
  private readonly transfers = new Map<string, Progress>();

  constructor(private readonly timeoutMs = ACK_TIMEOUT_MS) {}

  begin(id: string): void {
    this.transfers.set(id, { received: -1 });
  }

  end(id: string): void {
    this.transfers.delete(id);
  }

  onAck(m: { id?: unknown; received?: unknown; error?: unknown }): void {
    const t = typeof m.id === "string" ? this.transfers.get(m.id) : undefined;
    if (!t) return;
    if (typeof m.error === "string")
      t.failure = t.failure || new PageDropped(m.error);
    else if (typeof m.received === "number" && m.received > t.received)
      t.received = m.received;
    if (t.wake) t.wake();
  }

  failAll(error: Error): void {
    for (const t of this.transfers.values()) {
      t.failure = t.failure || error;
      if (t.wake) t.wake();
    }
  }

  assertLive(id: string): void {
    const t = this.transfers.get(id);
    if (!t) throw new TransferCancelled("the transfer is over");
    if (t.failure) throw t.failure;
  }

  /** rejects on failure, or when the bytes do not come within timeoutMs */
  acked(id: string, received: number): Promise<void> {
    const t = this.transfers.get(id);
    if (!t)
      return Promise.reject(new TransferCancelled("the transfer is over"));
    return new Promise<void>((resolve, reject) => {
      const settle = (error?: Error): void => {
        clearTimeout(timer);
        t.wake = undefined;
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(
        () =>
          settle(
            new Error(
              "the terminal did not answer for " + this.timeoutMs / 1000 + " s",
            ),
          ),
        this.timeoutMs,
      );
      t.wake = () => {
        if (t.failure) settle(t.failure);
        else if (t.received >= received) settle();
      };
      t.wake();
    });
  }
}

export interface LargeFileJob {
  uri: string; // the link's key
  fsPath: string;
  dPath: string;
  force: boolean; // sent even when its content is the one last synced ("Send file(s)")
  auto?: boolean;
}

export interface LargeFileHandle extends LargeFileSource {
  mtime: number;
  close(): Promise<void>;
}

export interface LargeFileSenderDeps {
  open(fsPath: string): Promise<LargeFileHandle>;
  post(chunk: LargeFileChunk): boolean | PromiseLike<boolean>;
  cancel(id: string): void;
  links: {
    get(uri: string): LinkRecord | undefined;
    set(uri: string, rec: LinkRecord): Promise<void>;
    remove(uri: string): Promise<void>;
  };
  linked(): void;
  failed(job: LargeFileJob, error: Error): void;
  progress<T>(
    job: LargeFileJob,
    run: (report: (sent: number, total: number) => void) => Promise<T>,
  ): PromiseLike<T>;
  chunkBytes?: number;
  ackTimeoutMs?: number;
}

/** not sent again when already linked with this content (unless forced): the page would hold it twice */
export class LargeFileSender {
  private readonly pending = new Map<string, LargeFileJob>();
  private readonly acks: AckTracker;
  private running = false;
  private open = false;

  constructor(private readonly deps: LargeFileSenderDeps) {
    this.acks = new AckTracker(deps.ackTimeoutMs);
  }

  add(job: LargeFileJob): void {
    const waiting = this.pending.get(job.uri);
    // forced if either is; linked by the automatic sync only if both are
    this.pending.set(
      job.uri,
      waiting
        ? {
            ...job,
            force: job.force || waiting.force,
            auto: !!(job.auto && waiting.auto),
          }
        : job,
    );
    void this.pump();
  }

  start(): void {
    this.open = true;
    void this.pump();
  }

  restart(): void {
    this.open = false;
    this.acks.failAll(new TerminalRestarted("the terminal restarted"));
  }

  clear(): void {
    this.open = false;
    this.pending.clear();
    this.acks.failAll(new TransferCancelled("cancelled"));
  }

  onAck(m: { id?: unknown; received?: unknown; error?: unknown }): void {
    this.acks.onAck(m);
  }

  get size(): number {
    return this.pending.size + (this.running ? 1 : 0);
  }

  private async pump(): Promise<void> {
    if (this.running || !this.open) return;
    const next = this.pending.values().next();
    if (next.done) return;
    this.pending.delete(next.value.uri);
    this.running = true;
    try {
      await this.run(next.value);
    } finally {
      this.running = false;
      void this.pump();
    }
  }

  private async run(job: LargeFileJob): Promise<void> {
    const { deps } = this;
    const chunkBytes = deps.chunkBytes || CHUNK_BYTES;
    const id = randomBytes(8).toString("hex");
    this.acks.begin(id);
    let file: LargeFileHandle | undefined;
    let posted = false;
    try {
      const f = (file = await deps.open(job.fsPath));
      if (f.size > CHUNKED_MAX_BYTES)
        throw new TooLargeToSend(f.size, CHUNKED_MAX_BYTES);
      const text = await convertsLineEnds(
        await f.read(0, Math.min(HEAD_BYTES, f.size)),
        f.size,
      );
      const rec = deps.links.get(job.uri);
      const known =
        !job.force && rec && rec.dPath === job.dPath && rec.sha256
          ? rec
          : undefined;
      let size = f.size;
      if (text || known) {
        const scan = await scanLargeFile(f, text, chunkBytes, () =>
          this.acks.assertLive(id),
        );
        if (known && known.sha256 === scan.sha256) {
          if (known.size !== f.size || known.mtime !== f.mtime)
            await deps.links.set(job.uri, {
              ...known,
              size: f.size,
              mtime: f.mtime,
            });
          return;
        }
        size = scan.size;
        if (size > CHUNKED_MAX_BYTES)
          throw new TooLargeToSend(
            size,
            CHUNKED_MAX_BYTES,
            "files",
            " with Windows line ends",
          );
      }
      const transport: LargeFileTransport = {
        post: (chunk) => {
          this.acks.assertLive(id); // nothing goes to a page that restarted
          posted = true;
          return deps.post(chunk);
        },
        acked: (tid, received) => this.acks.acked(tid, received),
      };
      const sent = await deps.progress(job, (report) =>
        sendLargeFile(f, transport, {
          id,
          dPath: job.dPath,
          text,
          size,
          chunkBytes,
          onProgress: report,
        }),
      );
      await deps.links.set(job.uri, {
        dPath: job.dPath,
        size: f.size,
        mtime: f.mtime,
        sha256: sent.sha256,
        ...(job.auto ? { auto: true } : {}),
      });
      deps.linked();
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      if (posted && !(error instanceof PageDropped)) deps.cancel(id); // the page may hold part of it
      if (error instanceof TerminalRestarted) this.add(job);
      else if (error instanceof TransferCancelled) return;
      else if (!job.force && (error as NodeJS.ErrnoException).code === "ENOENT")
        await deps.links.remove(job.uri);
      else deps.failed(job, error);
    } finally {
      this.acks.end(id);
      if (file) await file.close().catch(() => undefined);
    }
  }
}
