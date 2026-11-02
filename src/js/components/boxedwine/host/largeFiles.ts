export const MAX_LARGE_FILE_BYTES = 1024 * 1024 * 1024;

export type LargeFileEvent =
  | { kind: "ack"; id: string; received: number }
  | { kind: "complete"; id: string; dPath: string; bytes: Uint8Array }
  | { kind: "failed"; id: string; dPath: string; reason: string };

interface Transfer {
  dPath: string;
  size: number;
  buf: Uint8Array;
  received: number;
}

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

const chunkBytes = (c: unknown): Uint8Array | null =>
  c instanceof ArrayBuffer ? new Uint8Array(c) : ArrayBuffer.isView(c) ? new Uint8Array(c.buffer, c.byteOffset, c.byteLength) : null;

export class LargeFileReceiver {
  private readonly transfers = new Map<string, Transfer>();

  chunk(m: any): LargeFileEvent[] {
    const id = m && typeof m.id === "string" ? m.id : "";
    const dPath = m && typeof m.dPath === "string" ? m.dPath : "";
    const fail = (reason: string): LargeFileEvent[] => {
      this.transfers.delete(id);
      return [{ kind: "failed", id, dPath, reason }];
    };
    const bytes = m ? chunkBytes(m.chunk) : null;
    if (!id || !dPath || !isCount(m.size) || !isCount(m.offset) || !bytes || typeof m.last !== "boolean") return fail("an invalid chunk");
    if (m.size > MAX_LARGE_FILE_BYTES) return fail("it is larger than " + MAX_LARGE_FILE_BYTES / 1048576 + " MB");
    let t = this.transfers.get(id);
    if (m.offset === 0) {
      for (const [other, x] of this.transfers) if (x.dPath === dPath) this.transfers.delete(other);
      let buf: Uint8Array;
      try {
        buf = new Uint8Array(m.size);
      } catch (e) {
        return fail("there is not enough memory for " + (m.size / 1048576).toFixed(1) + " MB");
      }
      t = { dPath, size: m.size, buf, received: 0 };
      this.transfers.set(id, t);
    }
    if (!t || t.dPath !== dPath || t.size !== m.size) return fail("a chunk arrived for no transfer in progress");
    if (m.offset !== t.received) return fail("a chunk arrived out of order");
    if (m.offset + bytes.length > t.size) return fail("more bytes arrived than announced");
    t.buf.set(bytes, m.offset);
    t.received += bytes.length;
    if (!m.last) return [{ kind: "ack", id, received: t.received }];
    this.transfers.delete(id);
    if (t.received !== t.size) return fail("the transfer ended " + (t.size - t.received) + " bytes short");
    return [{ kind: "ack", id, received: t.received }, { kind: "complete", id, dPath, bytes: t.buf }];
  }

  cancel(id: unknown): void {
    if (typeof id === "string") this.transfers.delete(id);
  }

  get inProgress(): number {
    return this.transfers.size;
  }

  clear(): void {
    this.transfers.clear();
  }
}

// receiving chunks takes the main thread from the emulator: acks are spaced while a guest program runs
export const BUSY_INSTRUCTIONS_PER_SEC = 5000000;
export const BUSY_CHUNK_MS = 250;

export class AckPacer {
  private lastAck = -Infinity;
  private last: { t: number; progress: number } | null = null;

  constructor(private readonly now: () => number, private readonly progress: () => number | null) {}

  delay(): number {
    const t = this.now();
    const p = this.progress();
    const prev = this.last;
    const busy = p !== null && prev !== null && t > prev.t && ((p - prev.progress) * 1000) / (t - prev.t) >= BUSY_INSTRUCTIONS_PER_SEC;
    if (p !== null) this.last = { t, progress: p };
    const at = busy ? Math.max(t, this.lastAck + BUSY_CHUNK_MS) : t;
    this.lastAck = at;
    return at - t;
  }
}
