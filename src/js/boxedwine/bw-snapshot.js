(function () {
  "use strict";

  var DB_NAME = "bw-snapshot";
  var STORE = "snap";
  var SCHEMA = 3; // bump to invalidate all snapshots (e.g. guest zip content change)
  var PAGE = 4096;
  var SEGMENTS = 8;
  var SEG_KEYS = []; for (var sk = 0; sk < SEGMENTS; sk++) SEG_KEYS.push("seg" + sk);

  function supported() {
    return (
      typeof indexedDB !== "undefined" &&
      typeof CompressionStream !== "undefined" &&
      typeof DecompressionStream !== "undefined" &&
      typeof Response !== "undefined" &&
      typeof ReadableStream !== "undefined" &&
      typeof Blob !== "undefined" &&
      typeof Blob.prototype.stream === "function"
    );
  }

  var LATE_TICK_MS = 250;
  var NO_FRAME_MS = 500;
  function captureLock() {
    if (typeof navigator === "undefined" || !navigator.locks || typeof navigator.locks.request !== "function") {
      return Promise.resolve(function () {});
    }
    return new Promise(function (resolve) {
      navigator.locks.request("bw-snapshot-capture", { ifAvailable: true }, function (lock) {
        if (!lock) { resolve(null); return undefined; }
        return new Promise(function (release) { resolve(release); });
      }).catch(function () { resolve(function () {}); });
    });
  }

  // ------------------------------------------------------------ IndexedDB
  // closed on "versionchange" so the app's cache reset (deleteDatabase) is never blocked
  var dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function (e) { e.target.result.createObjectStore(STORE); };
      r.onsuccess = function (e) {
        var db = e.target.result;
        db.onversionchange = function () { try { db.close(); } catch (_) {} dbPromise = null; };
        res(db);
      };
      r.onerror = function () { dbPromise = null; rej(r.error); };
      r.onblocked = function () { dbPromise = null; rej(new Error("IndexedDB open blocked")); };
    });
    return dbPromise;
  }
  function idbGet(k) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, "readonly").objectStore(STORE).get(k);
        t.onsuccess = function () { res(t.result); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  // several keys in ONE readonly transaction (a consistent view of the record)
  function idbGetMany(keys) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, "readonly"), st = tx.objectStore(STORE), out = {};
        keys.forEach(function (k) { var r = st.get(k); r.onsuccess = function () { out[k] = r.result; }; });
        tx.oncomplete = function () { res(out); };
        tx.onerror = function () { rej(tx.error); };
        tx.onabort = function () { rej(tx.error || new Error("aborted")); };
      });
    });
  }
  // replace the whole record atomically: clear + puts in ONE readwrite transaction
  function idbReplaceAll(records) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(STORE, "readwrite"), st = tx.objectStore(STORE);
        st.clear();
        Object.keys(records).forEach(function (k) { st.put(records[k], k); });
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
        tx.onabort = function () { rej(tx.error || new Error("aborted")); };
      });
    });
  }
  function idbClear() {
    return openDB()
      .then(function (db) {
        return new Promise(function (res) {
          var tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).clear();
          tx.oncomplete = function () { res(); };
          tx.onerror = function () { res(); };
          tx.onabort = function () { res(); };
        });
      })
      .catch(function () {});
  }

  // gzip into an ArrayBuffer, then a Blob. Not `Response(...).blob()`: Chrome spills a
  // stream-built Blob over 5MB to disk and fails when the disk is nearly full.
  function gzipBytes(bytes) {
    return new Response(bwStreamOf(bytes.buffer, bytes.byteOffset, bytes.byteLength).pipeThrough(new CompressionStream("gzip"))).arrayBuffer().then(function (buf) {
      return new Blob([buf]);
    });
  }

  // ------------------------------------------------------------ codec
  // Segment (de)compression, in Web Workers or on the main thread as the fallback. These
  // functions are serialised into the worker's Blob source with toString(), so they must
  // not use anything outside their own bodies and each other.
  function bwStreamOf(buffer, offset, length) {
    var u8 = new Uint8Array(buffer, offset || 0, length === undefined ? buffer.byteLength - (offset || 0) : length), off = 0, CH = 1048576;
    return new ReadableStream({
      pull: function (c) {
        if (off >= u8.length) { c.close(); return; }
        var end = Math.min(off + CH, u8.length);
        c.enqueue(u8.subarray(off, end));
        off = end;
      },
    });
  }
  // zlib-inflate a Blob into a buffer of EXACTLY `expected` bytes (a truncated,
  // oversized or checksum-failing segment rejects)
  function bwInflateBlob(blob, expected) {
    var out = new Uint8Array(expected), off = 0;
    var reader = blob.stream().pipeThrough(new DecompressionStream("deflate")).getReader();
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) {
          if (off !== expected) throw new Error("segment decoded to " + off + " bytes, expected " + expected);
          return out.buffer;
        }
        var v = r.value;
        if (off + v.length > expected) throw new Error("segment larger than the expected " + expected + " bytes");
        out.set(v, off); off += v.length;
        return pump();
      });
    }
    return pump();
  }
  function bwDeflateBuffer(buffer) {
    return new Response(bwStreamOf(buffer).pipeThrough(new CompressionStream("deflate"))).arrayBuffer();
  }
  function bwCodecWorker() {
    self.onmessage = function (e) {
      var m = e.data, p;
      try { p = m.op === "inflate" ? bwInflateBlob(m.blob, m.expected) : bwDeflateBuffer(m.buf); }
      catch (err) { p = Promise.reject(err); }
      p.then(function (out) { self.postMessage({ id: m.id, ok: true, buf: out }, [out]); },
             function (err) { self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) }); });
    };
    self.postMessage({ ready: true });
  }
  var WORKER_SRC = [bwStreamOf, bwInflateBlob, bwDeflateBuffer]
    .map(function (f) { return f.toString(); }).join("\n") + "\n(" + bwCodecWorker.toString() + ")();\n";

  // Worker pool. An inflate job carries a Blob (cloned, so it can be re-run elsewhere); a
  // deflate job transfers its buffer, so it only goes to a worker that reported "ready".
  // No Worker, a failing worker or none ready within READY_MS: the main thread runs the jobs.
  var READY_MS = 10000;
  var DECODE_TIMEOUT_MS = 60000; // a restore whose decode takes longer cold-boots instead
  var PREFAULT_SLICE = 4096; // pages per prefault step
  var pool = null;
  function codecInline(job) {
    BW._inlineJobs++; BW._inlineRuns++;
    var p;
    try { p = job.op === "inflate" ? bwInflateBlob(job.blob, job.expected) : bwDeflateBuffer(job.buf); }
    catch (e) { p = Promise.reject(e); }
    p.then(function (b) { BW._inlineJobs--; job.resolve(b); }, function (e) { BW._inlineJobs--; job.reject(e); });
  }
  function codecPool() {
    if (pool) return pool;
    pool = { workers: [], queue: [], next: 1, broken: false, url: null, size: 0, readyTimer: null };
    var n = Math.max(1, Math.min(4, ((navigator.hardwareConcurrency | 0) || 2) - 1));
    try {
      if (typeof Worker === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") throw new Error("Worker unavailable");
      pool.url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
      for (var i = 0; i < n; i++) addWorker();
      pool.size = n;
      pool.readyTimer = setTimeout(function () {
        if (!pool) return;
        pool.readyTimer = null;
        pool.workers.filter(function (r) { return !r.ready; }).forEach(function (r) { dropWorker(r, "not ready after " + READY_MS + "ms"); });
      }, READY_MS);
    } catch (e) {
      pool.workers.forEach(function (r) { try { r.w.terminate(); } catch (_) {} });
      pool.workers = [];
      pool.broken = true;
      console.log("[bw-snapshot] codec workers unavailable (" + ((e && e.message) || e) + ") - using the main thread");
    }
    return pool;
  }
  function addWorker() {
    var w = new Worker(pool.url);
    var rec = { w: w, ready: false, job: null };
    w.onmessage = function (e) {
      var m = e.data;
      if (m && m.ready) {
        rec.ready = true;
        if (pool && pool.readyTimer && pool.workers.every(function (r) { return r.ready; })) { clearTimeout(pool.readyTimer); pool.readyTimer = null; }
        pump();
        return;
      }
      var job = rec.job; rec.job = null;
      if (job) { if (m.ok) job.resolve(m.buf); else job.reject(new Error(m.error)); }
      pump();
    };
    w.onerror = function (ev) {
      try { if (ev && ev.preventDefault) ev.preventDefault(); } catch (_) {}
      dropWorker(rec, "worker error " + ((ev && ev.message) || ""));
    };
    pool.workers.push(rec);
  }
  // Its job goes back to the queue if it can still run; with no worker left, the queue
  // runs on the main thread.
  function dropWorker(rec, why) {
    if (!pool || pool.workers.indexOf(rec) < 0) return;
    pool.workers.splice(pool.workers.indexOf(rec), 1);
    try { rec.w.terminate(); } catch (_) {}
    var job = rec.job; rec.job = null;
    if (job) {
      if (job.op === "inflate" || (job.buf && job.buf.byteLength)) pool.queue.unshift(job);
      else job.reject(new Error("codec worker failed after taking the buffer (" + why + ")"));
    }
    if (!pool.workers.length) {
      console.log("[bw-snapshot] codec workers failed (" + why + ") - using the main thread");
      pool.broken = true;
      if (pool.readyTimer) { clearTimeout(pool.readyTimer); pool.readyTimer = null; }
      pool.queue.splice(0).forEach(codecInline);
      return;
    }
    pump();
  }
  function pump() {
    if (!pool) return;
    for (var i = 0; i < pool.workers.length && pool.queue.length; i++) {
      var rec = pool.workers[i];
      if (rec.job) continue;
      // a transferring job waits for a worker that is known to be running
      var qi = -1;
      for (var k = 0; k < pool.queue.length; k++) {
        if (pool.queue[k].op === "inflate" || rec.ready) { qi = k; break; }
      }
      if (qi < 0) continue;
      var job = pool.queue.splice(qi, 1)[0];
      rec.job = job;
      try {
        if (job.op === "inflate") rec.w.postMessage({ op: "inflate", id: job.id, blob: job.blob, expected: job.expected });
        else rec.w.postMessage({ op: "deflate", id: job.id, buf: job.buf }, [job.buf]);
      } catch (e) {
        rec.job = null;
        if (job.op === "inflate" || (job.buf && job.buf.byteLength)) codecInline(job);
        else job.reject(e);
      }
    }
  }
  function codecRun(op, payload, expected) {
    return new Promise(function (resolve, reject) {
      var p = codecPool();
      var job = { op: op, resolve: resolve, reject: reject, id: p.next++, expected: expected };
      if (op === "inflate") job.blob = payload; else job.buf = payload;
      if (p.broken || !p.workers.length) { codecInline(job); return; }
      p.queue.push(job);
      pump();
    });
  }
  function codecShutdown() {
    if (!pool) return;
    if (pool.queue.length || pool.workers.some(function (r) { return r.job; })) return; // still busy
    if (pool.readyTimer) clearTimeout(pool.readyTimer);
    pool.workers.forEach(function (r) { try { r.w.terminate(); } catch (_) {} });
    try { if (pool.url) URL.revokeObjectURL(pool.url); } catch (_) {}
    pool = null;
  }

  // ------------------------------------------------------------ pages
  // Bitmap of the non-zero 4KB pages and their bytes packed into SEGMENTS buffers
  // (address order, balanced by page count). Synchronous: runs in the capture's atomic window.
  function packHeap(heap) {
    var nPages = heap.length / PAGE, words = PAGE >> 2;
    var w32 = new Uint32Array(heap.buffer, heap.byteOffset, heap.length >> 2);
    var bitmap = new Uint8Array(Math.ceil(nPages / 8)), count = 0;
    for (var p = 0; p < nPages; p++) {
      for (var i = p * words, end = i + words; i < end; i++) {
        if (w32[i] !== 0) { bitmap[p >> 3] |= 1 << (p & 7); count++; break; }
      }
    }
    var per = Math.ceil(count / SEGMENTS), segPages = [], segs = [];
    for (var s = 0; s < SEGMENTS; s++) {
      var n = Math.max(0, Math.min(per, count - s * per));
      segPages.push(n); segs.push(new Uint8Array(n * PAGE));
    }
    var seg = 0, inSeg = 0;
    for (var q = 0; q < nPages; q++) {
      if (!(bitmap[q >> 3] & (1 << (q & 7)))) continue;
      while (inSeg >= segPages[seg]) { seg++; inSeg = 0; }
      segs[seg].set(heap.subarray(q * PAGE, q * PAGE + PAGE), inSeg * PAGE);
      inSeg++;
    }
    return { bitmap: bitmap, pages: count, segPages: segPages, segs: segs };
  }
  function popcount8(bitmap) {
    var n = 0;
    for (var i = 0; i < bitmap.length; i++) { var b = bitmap[i]; while (b) { b &= b - 1; n++; } }
    return n;
  }
  // Make the live heap exactly the captured image: zero runs are filled, non-zero runs
  // copied from the segments. From page untouchedFrom on (above the program break of a
  // fresh instance; -1 = unknown) the heap is still zero and zero runs are skipped.
  function applyPages(heap, meta, segs, untouchedFrom) {
    var nPages = meta.heapLen / PAGE, bitmap = meta.bitmap, segPages = meta.segments.map(function (s) { return s.pages; });
    var seg = 0, inSeg = 0, src = new Uint8Array(segs[0]), runs = 0, filled = 0;
    var limit = (typeof untouchedFrom === "number" && untouchedFrom >= 0 && untouchedFrom < nPages) ? untouchedFrom : nPages;
    var bit = function (p) { return (bitmap[p >> 3] >> (p & 7)) & 1; };
    var p = 0;
    while (p < nPages) {
      runs++;
      var nz = bit(p), q = p + 1;
      while (q < nPages && bit(q) === nz) q++;
      if (!nz) {
        var fe = Math.min(q, limit);
        if (p < fe) { heap.fill(0, p * PAGE, fe * PAGE); filled += fe - p; }
      } else {
        var need = q - p, dst = p * PAGE;
        while (need > 0) {
          while (inSeg >= segPages[seg]) { seg++; inSeg = 0; src = new Uint8Array(segs[seg]); }
          var take = Math.min(need, segPages[seg] - inSeg);
          heap.set(src.subarray(inSeg * PAGE, (inSeg + take) * PAGE), dst);
          inSeg += take; need -= take; dst += take * PAGE;
        }
      }
      p = q;
    }
    return { runs: runs, filled: filled };
  }
  // Fault in the fresh heap's pages while the guest zip loads, so the restore's writes do
  // not pay the first-touch page faults. Atomics.add(..., 0) writes without changing a
  // value (a plain x[i] = x[i] may be optimised away); slices yield via MessageChannel.
  // Phase 1: the image's non-zero pages. Phase 2 (all other pages) only when the wasm has
  // no bwHeapTop, i.e. the restore will write every page; it waits for embind (sendText).
  function prefaultHeap(heap, state, bitmap, Module) {
    if (typeof Atomics === "undefined" || typeof MessageChannel === "undefined") { state.done = true; return; }
    var i32 = new Int32Array(heap.buffer, heap.byteOffset, heap.length >> 2);
    var words = PAGE >> 2, nPages = heap.length / PAGE, p = 0, phase = 1, ch = new MessageChannel();
    var nz = function (q) { return (bitmap[q >> 3] >> (q & 7)) & 1; };
    var finish = function () { state.done = true; state.ms = Math.round(performance.now() - state.t0); try { ch.port1.close(); } catch (_) {} };
    var next = function (delay) { if (delay) setTimeout(function () { try { ch.port2.postMessage(0); } catch (_) {} }, delay); else ch.port2.postMessage(0); };
    ch.port1.onmessage = function () {
      if (state.cancel) return finish();
      if (phase === 2) {
        if (typeof Module.bwHeapTop === "function") return finish();
        if (typeof Module.sendText !== "function") return next(10); // runtime not initialised yet
      }
      try {
        var budget = PREFAULT_SLICE;
        for (; p < nPages && budget > 0; p++) {
          if ((phase === 1) === !!nz(p)) { Atomics.add(i32, p * words, 0); budget--; state.pages++; }
        }
      } catch (e) { return finish(); }
      if (p < nPages) return next(0);
      if (phase === 1) { phase = 2; p = 0; return next(0); }
      finish();
    };
    state.t0 = performance.now();
    next(0);
  }
  // the emulator's program break in bytes, or null (not exported: write every page)
  function heapTop(Module, heapLen) {
    try {
      if (typeof Module.bwHeapTop !== "function") return null;
      var t = Module.bwHeapTop();
      return (typeof t === "number" && isFinite(t) && t === Math.floor(t) && t > 0 && t <= heapLen) ? t : null;
    } catch (e) { return null; }
  }
  function metaProblem(meta, version) {
    if (!meta) return "no meta";
    if (meta.schema !== SCHEMA || meta.version !== version) return "different build/config";
    if (meta.pageSize !== PAGE || !meta.heapLen || meta.heapLen % PAGE) return "bad page size or heap length";
    if (!(meta.bitmap instanceof Uint8Array) || meta.bitmap.length !== Math.ceil(meta.heapLen / PAGE / 8)) return "bad bitmap";
    if (!Array.isArray(meta.segments) || meta.segments.length !== SEGMENTS) return "bad segment list";
    var sum = 0; meta.segments.forEach(function (s) { sum += s.pages | 0; });
    if (sum !== meta.pages || popcount8(meta.bitmap) !== meta.pages) return "page count mismatch";
    return null;
  }

  var BW = {
    mode: "cold", // "cold" | "restore"
    version: null,
    // read by Boxedwine.jsx: the freeze detector and the drawer import pause while set
    get busy() { return this._atomic || this._restoring || this._inlineJobs > 0; },
    _atomic: false,
    _restoring: false,
    _inlineJobs: 0,
    _inlineRuns: 0,
    _decode: null,
    _meta: null,
    _heapLen: 0,
    _ready: null,
    _didColdBoot: false,

    // cfg: { wasmUrl, identity, markerKey, captureAllowed, buildId, runtime }. Resolves
    // (never rejects) once mode is decided; a restore's segments are then already decoding.
    begin: function (cfg) {
      var self = this;
      // markerKey: localStorage flag boxedwine.html reads synchronously to set noInitialRun
      this._markerKey = (cfg && cfg.markerKey) || null;
      this._captureAllowed = !cfg || cfg.captureAllowed !== false;
      this._buildId = (cfg && cfg.buildId) || "dev";
      this._runtime = (cfg && cfg.runtime) || null;
      // a build whose restore failed twice stops capturing (cold boot every visit)
      try {
        var f = JSON.parse(localStorage.getItem("bw-snapshot-fail") || "null");
        if (f && f.buildId === this._buildId && f.count >= 2) {
          this._captureAllowed = false;
          console.warn("[bw-snapshot] restore failed " + f.count + "x under this build — snapshot disabled, cold boot every visit");
        }
      } catch (e) {}
      // a restore is likely: start the codec workers while IndexedDB is read
      try { if (supported() && typeof Module !== "undefined" && Module.noInitialRun) codecPool(); } catch (e) {}
      this._ready = (async function () {
        try {
          if (!supported()) {
            console.log("[bw-snapshot] browser lacks IndexedDB/CompressionStream — cold boot only");
            return;
          }
          self.version = "v" + SCHEMA + "|" + self._buildId + "|" + ((cfg && cfg.identity) || "");
          console.log("[bw-snapshot] version key:", self.version);

          var meta = await idbGet("meta").catch(function () { return null; });
          var problem = metaProblem(meta, self.version);
          if (problem) {
            if (meta) {
              console.log("[bw-snapshot] stored snapshot is unusable (" + problem + ") — discarding");
              await self.discard();
            } else {
              console.log("[bw-snapshot] no snapshot yet — cold boot, will capture");
            }
            return;
          }
          var recs = await idbGetMany(SEG_KEYS.concat(["overlay"])).catch(function () { return null; });
          var missing = !recs || !recs.overlay || SEG_KEYS.some(function (k) { return !(recs[k] instanceof Blob); });
          if (missing) { console.log("[bw-snapshot] snapshot record incomplete — discarding"); await self.discard(); return; }
          var overlayBlob = recs.overlay;
          self._overlayRaw = new Response(overlayBlob.stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
            .then(function (b) { return new Uint8Array(b); });
          self._overlayRaw.catch(function () {}); // reported by doRestore
          self._meta = meta;
          self._heapLen = meta.heapLen;
          self.mode = "restore";
          // decode every segment now, while the wasm and zips load
          var dec = { t0: performance.now(), t1: 0, workers: 0, inline: 0, error: null };
          var p = codecPool(), inline0 = self._inlineRuns;
          dec.workers = p.broken ? 0 : p.size;
          dec.done = Promise.all(SEG_KEYS.map(function (k, i) { return codecRun("inflate", recs[k], meta.segments[i].pages * PAGE); }))
            .then(function (bufs) { dec.t1 = performance.now(); dec.inline = self._inlineRuns - inline0; return bufs; });
          dec.done.catch(function (e) { dec.error = e; }); // reported by doRestore
          self._decode = dec;
          var total = 0; SEG_KEYS.forEach(function (k) { total += recs[k].size; });
          console.log("[bw-snapshot] snapshot found (" + meta.pages + " pages, " + total + " bytes in " + SEGMENTS + " segments) — decoding in " +
                      (dec.workers ? dec.workers + " workers" : "the main thread"));
        } catch (e) {
          console.log("[bw-snapshot] detection failed — cold boot", e);
          self.mode = "cold";
          self._decode = null;
        }
      })();
      return this._ready;
    },

    willRestore: function () {
      return this.mode === "restore" && !!this._decode;
    },

    // Called by the shell once HEAPU8 exists; does nothing unless a restore is coming.
    prefault: function (Module) {
      var self = this;
      if (this._prefault || !this._ready) return;
      var state = this._prefault = { pages: 0, done: false, cancel: false, t0: 0, ms: 0 };
      this._ready.then(function () {
        var heap = Module && Module.HEAPU8;
        if (state.cancel || !self.willRestore() || !heap || heap.length % PAGE) { state.done = true; return; }
        prefaultHeap(heap, state, self._meta.bitmap, Module);
      });
    },

    // In-place restore, once the runtime is initialised (static constructors would
    // overwrite restored globals) and the shell has mounted the same zips as a cold boot.
    // Resolves true; on any failure it counts the failure, discards the snapshot and
    // reloads into a cold boot.
    doRestore: function (Module) {
      var self = this, dec = this._decode, meta = this._meta, timer = null;
      self._restoring = true;
      return (async function () {
        if (!dec || !meta) throw new Error("no snapshot to restore");
        if (!Module.HEAPU8) throw new Error("HEAPU8 unavailable");
        if (Module.HEAPU8.length !== self._heapLen) {
          throw new Error("heap size mismatch: live " + Module.HEAPU8.length + " vs snapshot " + self._heapLen);
        }
        if (typeof Module.bwResumeFromSnapshot !== "function") throw new Error("bwResumeFromSnapshot not exported");
        var t0 = performance.now();
        // /root must equal the captured overlay BEFORE the heap (with its cached
        // directory listings and open file descriptors) is resumed
        if (!self._overlayRaw) throw new Error("no overlay record");
        var ovStats = self._writeOverlay(Module, await self._overlayRaw);
        self._overlayRaw = null;
        var tWait = performance.now();
        // normally decoded already; the timeout turns a hung decode into a cold boot
        var segs = await Promise.race([dec.done, new Promise(function (_, reject) {
          timer = setTimeout(function () { reject(new Error("segment decode did not finish within " + DECODE_TIMEOUT_MS + "ms")); }, DECODE_TIMEOUT_MS);
        })]);
        clearTimeout(timer);
        var pf = self._prefault;
        if (pf) pf.cancel = true;
        // read the break right before the apply: code that ran during the awaits may have allocated
        var top = heapTop(Module, meta.heapLen);
        var t1 = performance.now();
        var res = applyPages(Module.HEAPU8, meta, segs, top === null ? -1 : Math.ceil(top / PAGE));
        var t2 = performance.now();
        segs = null; dec.done = null;
        codecShutdown();
        try {
          Module.bwResumeFromSnapshot();
        } catch (u) {
          /* emscripten simulate_infinite_loop 'unwind' — expected, not an error */
        }
        console.log("[bw-snapshot] restored + resumed in " + Math.round(performance.now() - t0) + "ms (overlay " + ovStats.files +
                    " files/" + ovStats.bytes + " B in " + ovStats.ms + "ms; decode wait " + Math.round(t1 - tWait) + "ms; heap apply " +
                    Math.round(t2 - t1) + "ms, " + res.runs + " runs, " + (pf ? pf.pages + "/" + (meta.heapLen / PAGE) + " pages prefaulted" + (pf.done ? " in " + pf.ms + "ms" : "") : "no prefault") +
                    "; decode total " + Math.round(dec.t1 - dec.t0) + "ms, " + (dec.workers || "no") + " workers, " + dec.inline + " of " + SEGMENTS + " segments on the main thread; " +
                    res.filled + " zero pages filled" + (top === null ? " (no program break: every zero page)" : " below the program break at " + (top / 1048576).toFixed(1) + " MB") + ")");
        self._decode = null;
        self._restoring = false;
        return true;
      })().catch(function (e) {
        clearTimeout(timer);
        var n = self._bumpFailCount("bw-snapshot-fail");
        console.error("[bw-snapshot] RESTORE FAILED — discarding snapshot and cold-booting (failure " + n + " for this build)", e);
        try { window.bwHost.post("restore-fallback", { count: n }); } catch (_) {}
        self._decode = null;
        self._restoring = false;
        self.discard().then(function () {
          try { window.bwHost.reload("restore-failed"); } catch (_) {}
        });
        return false;
      });
    },

    // ------------------------------------------------------------ overlay
    // The guest's writable /root (MEMFS) as one Uint8Array: [u32 manifest length]
    // [manifest JSON][file bytes in manifest order]. Taken at the same instant as the heap.
    _serializeOverlay: function (Module) {
      var FS = Module.FS, entries = [], chunks = [], total = 0;
      var walk = function (dir) {
        var names; try { names = FS.readdir(dir); } catch (e) { return; }
        for (var i = 0; i < names.length; i++) {
          var n = names[i]; if (n === "." || n === "..") continue;
          var p = dir + "/" + n, st; try { st = FS.lstat(p); } catch (e) { continue; }
          if (FS.isLink(st.mode)) { entries.push({ p: p, t: "l", m: st.mode, target: FS.readlink(p) }); }
          else if (FS.isDir(st.mode)) { entries.push({ p: p, t: "d", m: st.mode }); walk(p); }
          else if (FS.isFile(st.mode)) { var b = FS.readFile(p); entries.push({ p: p, t: "f", m: st.mode, s: b.length }); chunks.push(b); total += b.length; }
        }
      };
      walk("/root");
      var manifest = new TextEncoder().encode(JSON.stringify({ root: "/root", entries: entries }));
      var out = new Uint8Array(4 + manifest.length + total), dv = new DataView(out.buffer);
      dv.setUint32(0, manifest.length, true); out.set(manifest, 4);
      var off = 4 + manifest.length;
      for (var k = 0; k < chunks.length; k++) { out.set(chunks[k], off); off += chunks[k].length; }
      return { bytes: out, files: chunks.length, entries: entries.length, dataBytes: total };
    },
    _clearTree: function (FS, dir) {
      var names; try { names = FS.readdir(dir); } catch (e) { return; }
      for (var i = 0; i < names.length; i++) {
        var n = names[i]; if (n === "." || n === "..") continue;
        var p = dir + "/" + n, st; try { st = FS.lstat(p); } catch (e) { continue; }
        try {
          if (FS.isDir(st.mode) && !FS.isLink(st.mode)) { this._clearTree(FS, p); FS.rmdir(p); } else { FS.unlink(p); }
        } catch (e) {}
      }
    },
    // Replace /root with the captured overlay (synchronously).
    _writeOverlay: function (Module, raw) {
      var t0 = performance.now(), FS = Module.FS;
      var mlen = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(0, true);
      var manifest = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + mlen)));
      var off = 4 + mlen, files = 0, bytes = 0;
      this._clearTree(FS, "/root");
      try { FS.mkdirTree("/root"); } catch (e) {}
      for (var i = 0; i < manifest.entries.length; i++) {
        var e = manifest.entries[i];
        if (e.t === "d") { try { FS.mkdirTree(e.p); } catch (_) {} }
        else if (e.t === "f") { FS.writeFile(e.p, raw.subarray(off, off + e.s)); off += e.s; files++; bytes += e.s; }
        else if (e.t === "l") { try { FS.symlink(e.target, e.p); } catch (_) {} }
      }
      return { files: files, bytes: bytes, entries: manifest.entries.length, ms: Math.round(performance.now() - t0) };
    },

    // The emulator's decompressed zip-entry copies are zeroed and freed before the heap
    // is packed, so the snapshot does not carry them.
    _dropEmulatorCaches: function (Module) {
      try {
        if (typeof Module.bwZipCacheDrop === "function") {
          var bytes = Module.bwZipCacheDrop();
          if (bytes > 0) console.log("[bw-snapshot] released " + (bytes / 1048576).toFixed(1) + " MB of decompressed zip entries before the capture");
        }
      } catch (e) {}
    },
    // Capture the factory state (cold boot, console idle, input gate still closed):
    //   1. atomic: pack the non-zero heap pages and the /root overlay at the same instant;
    //      the returned promise resolves here, so the terminal can open at once;
    //   2. persist (background, Workers): compress, store, set the marker. Any error is
    //      non-fatal: the next visit cold-boots and captures again.
    // Resolves { copied, persisted } (persisted = the phase-2 promise).
    capture: async function (Module, info) {
      var self = this, packed = null, overlay = null, heap = null, t0 = performance.now();
      if (!supported() || !this.version || !this._didColdBoot) return { copied: false, reason: "not-cold" };
      if (!this._captureAllowed) { console.log("[bw-snapshot] capture not allowed for this runtime/build — skipping"); return { copied: false, reason: "not-allowed" }; }
      heap = Module && Module.HEAPU8;
      if (!heap) return { copied: false, reason: "no-heap" };
      if (heap.length % PAGE) return { copied: false, reason: "heap not page-aligned" };
      // one capture at a time across VS Code windows (they share the database), held until the record is stored
      var releaseCaptureLock = await captureLock();
      if (!releaseCaptureLock) {
        console.log("[bw-snapshot] another window is capturing the instant-start state — skipping");
        return { copied: false, reason: "capture-locked" };
      }
      var copiedForPersist = false;
      codecPool(); // workers start up while the heap is packed
      this._atomic = true;
      try {
        console.log("[bw-snapshot] capturing factory state: " + heap.length + " bytes...");
        // The read must be atomic w.r.t. the guest, or the image tears. ST: one synchronous
        // task is atomic. MT: other pthreads write the shared heap in parallel, so the guest
        // is stopped (bwBeginSnapshotPause) while the pages are packed into private buffers.
        var isShared = (typeof SharedArrayBuffer !== "undefined") &&
                       heap.buffer instanceof SharedArrayBuffer;
        if (isShared) {
          var mtPaused = window.BW_USE_MT && Module.bwBeginSnapshotPause
                         ? Module.bwBeginSnapshotPause() : false;
          if (!mtPaused) {
            console.log("[bw-snapshot] MT: could not stop the world; skipping capture");
            return { copied: false, reason: "mt-pause-failed" };
          }
          try {
            this._dropEmulatorCaches(Module);
            packed = packHeap(heap);                  // atomic: the guest is frozen
            overlay = this._serializeOverlay(Module); // same instant
          } finally {
            Module.bwEndSnapshotPause();
          }
        } else {
          this._dropEmulatorCaches(Module);
          packed = packHeap(heap);
          overlay = this._serializeOverlay(Module);
        }
        copiedForPersist = true;
      } catch (e) {
        console.log("[bw-snapshot] capture failed (non-fatal, will cold boot next time)", e);
        return { copied: false, reason: String(e) };
      } finally {
        this._atomic = false;
        if (!copiedForPersist) releaseCaptureLock();
      }
      var copyMs = Math.round(performance.now() - t0);
      console.log("[bw-snapshot] factory state copied in " + copyMs + "ms (" + packed.pages + " non-zero pages; overlay " + overlay.files + " files, " + overlay.dataBytes + " B)");
      var inline0 = self._inlineRuns;
      var persisted = (async function () {
        try {
          var segs = packed.segs; packed.segs = null;
          var compressed = await Promise.all(segs.map(function (u8) { return codecRun("deflate", u8.buffer); }));
          segs = null;
          var records = {}, total = 0;
          compressed.forEach(function (buf, i) { records[SEG_KEYS[i]] = new Blob([buf]); total += buf.byteLength; });
          var ovBlob = await gzipBytes(overlay.bytes);
          records.overlay = ovBlob;
          records.meta = {
            version: self.version,
            schema: SCHEMA,
            heapLen: heap.length,
            pageSize: PAGE,
            pages: packed.pages,
            bitmap: packed.bitmap,
            segments: compressed.map(function (buf, i) { return { pages: packed.segPages[i], bytes: buf.byteLength }; }),
            compressed: total,
            overlayCompressed: ovBlob.size,
            overlayFiles: overlay.files,
            copyMs: copyMs,
            info: info || null, // shell-provided: when the copy happened relative to the console, input state
            ts: Date.now(),
          };
          compressed = null;
          await idbReplaceAll(records); // one transaction: complete record or nothing
          // the marker makes the next load take the restore path (noInitialRun)
          try { if (self._markerKey) localStorage.setItem(self._markerKey, "1"); } catch (_) {}
          console.log(
            "[bw-snapshot] captured " + heap.length + " -> " + total + " bytes deflate in " + SEGMENTS + " segments (+ overlay " + ovBlob.size +
            " bytes) in " + Math.round(performance.now() - t0) + "ms (" + (self._inlineRuns - inline0) + " of " + SEGMENTS + " segments compressed on the main thread)"
          );
          return true;
        } catch (e) {
          // typically the IndexedDB write (disk nearly full): tell the app why every start is cold
          console.warn("[bw-snapshot] the instant-start state could not be saved (non-fatal, will cold boot next time)", e);
          try { await self.discard(); } catch (_) {}
          try { window.bwHost.post("snapshot-not-saved", { reason: String((e && e.message) || e) }); } catch (_) {}
          return false;
        } finally {
          codecShutdown();
          releaseCaptureLock();
        }
      })();
      return { copied: true, copyMs: copyMs, overlayFiles: overlay.files, persisted: persisted };
    },

    markColdBoot: function () { this._didColdBoot = true; },

    // Resolve { idle: true, waitedMs } once IDLE_WINDOWS consecutive windows (the first
    // ends settleMs after the call) show no queued input and < 2M guest instructions per
    // second (an idle prompt runs well under 1M/s), or { idle: false } after maxWaitMs.
    waitIdle: function (Module, settleMs, maxWaitMs) {
      var IDLE_WINDOW_MS = 250, IDLE_WINDOWS = 3;
      var t0 = performance.now(), lastP = null, quietWindows = 0;
      var progress = function () {
        try { if (typeof Module.bwGetGuestProgress === "function") return Module.bwGetGuestProgress(); } catch (e) {}
        return null;
      };
      var pending = function () { try { return Module.getPendingInputCount ? Module.getPendingInputCount() : 0; } catch (e) { return 0; } };
      lastP = progress(); // first window starts now, not at the first poll
      var lastAt = performance.now();
      return new Promise(function (resolve) {
        setTimeout(function poll() {
          var p = progress(), now = performance.now(), dt = Math.max(now - lastAt, 1);
          var idle = pending() === 0 && (p === null || (lastP !== null && (p - lastP) < 2000000 * (dt / 1000)));
          lastP = p; lastAt = now;
          quietWindows = idle ? quietWindows + 1 : 0;
          if (quietWindows >= IDLE_WINDOWS) { resolve({ idle: true, waitedMs: Math.round(performance.now() - t0) }); return; }
          if (performance.now() - t0 > maxWaitMs) { console.log("[bw-snapshot] guest never idle — skipping capture this visit"); resolve({ idle: false, waitedMs: Math.round(performance.now() - t0) }); return; }
          setTimeout(poll, IDLE_WINDOW_MS);
        }, settleMs);
      });
    },
    captureWhenIdle: async function (Module, settleMs, maxWaitMs, info) {
      var w = await this.waitIdle(Module, settleMs, maxWaitMs);
      if (!w.idle) return { copied: false, reason: "never-idle", waitedMs: w.waitedMs };
      var lit = window.BW_CONSOLE_VISIBLE_AT || 0;
      var r = await this.capture(Module, Object.assign({ idleAfterMs: w.waitedMs, sinceLitMs: lit ? Math.round(performance.now() - lit) : null }, info || {}));
      r.waitedMs = w.waitedMs;
      return r;
    },

    // ------------------------------------------------------------------ watchdog
    // "Usable console" = the console is visibly rendered AND the guest is executing
    // (bwGetGuestProgress, else getMips; the host loop's heartbeat does not count).
    _progress: function (Module) {
      try {
        if (Module && typeof Module.bwGetGuestProgress === "function") return { kind: "progress", v: Module.bwGetGuestProgress() };
        if (Module && typeof Module.getMips === "function") return { kind: "mips", v: Module.getMips() };
      } catch (e) {}
      return null;
    },
    _lit: function () {
      try { return typeof window.bwConsoleLit === "function" ? window.bwConsoleLit() : -1; } catch (e) { return -1; }
    },
    // Resolve true when usable (two consecutive lit samples and guest progress since the
    // first sample), false after maxMs of visible time: a hidden page stops the emulator
    // loop (requestAnimationFrame), so hidden time is not counted. Samples at once, then
    // every intervalMs (default 50).
    _waitUsable: function (Module, maxMs, intervalMs) {
      var self = this;
      return new Promise(function (resolve) {
        var t0 = performance.now(), last = t0, hiddenMs = 0, blockedMs = 0, litHits = 0, firstP = null;
        var timer = null, settled = false;
        // a background VS Code tab gets no animation frames while visibilityState stays "visible": hidden time too
        var lastFrame = t0;
        var onFrame = function () { lastFrame = performance.now(); if (!settled) requestAnimationFrame(onFrame); };
        requestAnimationFrame(onFrame);
        var tick = function () {
          var now = performance.now();
          if (document.visibilityState === "hidden" || now - lastFrame > NO_FRAME_MS) { hiddenMs += now - last; t0 += now - last; last = now; return; }
          // a tick held up by another window's terminal (one shared thread) counts at most LATE_TICK_MS
          var gap = now - last;
          if (gap > LATE_TICK_MS) { blockedMs += gap - LATE_TICK_MS; t0 += gap - LATE_TICK_MS; }
          last = now;
          litHits = self._lit() > 20 ? litHits + 1 : 0;
          var p = self._progress(Module), progressOk;
          if (!p) progressOk = true; // no progress signal exported: lit alone
          else if (p.kind === "progress") { if (firstP === null) firstP = p.v; progressOk = p.v !== firstP; }
          else progressOk = p.v > 0;
          if (litHits >= 2 && progressOk) { settled = true; clearInterval(timer); resolve(true); }
          else if (now - t0 > maxMs) {
            settled = true; clearInterval(timer);
            if (hiddenMs > 0) console.log("[bw-watchdog] " + Math.round(hiddenMs) + "ms of hidden-page time were not counted");
            if (blockedMs > 0) console.log("[bw-watchdog] " + Math.round(blockedMs) + "ms of blocked main-thread time were not counted");
            resolve(false);
          }
        };
        tick();
        if (!settled) timer = setInterval(tick, intervalMs || 50);
      });
    },
    _bumpFailCount: function (key) {
      var n = 1;
      try {
        var f = JSON.parse(localStorage.getItem(key) || "null");
        if (f && f.buildId === this._buildId) n = (f.count || 0) + 1;
        localStorage.setItem(key, JSON.stringify({ buildId: this._buildId, count: n, ts: Date.now() }));
      } catch (e) {}
      return n;
    },
    // "mt"|"st": begin()'s cfg, else the page flag (?bwnosnap=1 skips begin())
    _rt: function () { return this._runtime || (window.BW_USE_MT === true ? "mt" : "st"); },
    recordRuntimeFailure: function (reason) {
      try {
        localStorage.setItem("bw-runtime-fail", JSON.stringify({ runtime: this._rt(), reason: reason, buildId: this._buildId, ts: Date.now() }));
      } catch (e) {}
    },
    _reloadWithoutOverride: function () {
      try { window.bwHost.reload("runtime-fallback"); } catch (_) {}
    },
    // the wasm could not be instantiated (boxedwine.html's instantiateWasm hook)
    onWasmFailed: function (reason) {
      if (this._wasmFailed) return;
      this._wasmFailed = true;
      if (this._rt() === "mt") {
        console.error("[bw-watchdog] MT wasm failed to load (" + reason + ") — recording failure for this build and falling back to ST");
        this.recordRuntimeFailure("wasm-load");
        this._reloadWithoutOverride();
      } else {
        console.error("[bw-watchdog] ST wasm failed to load (" + reason + ") — the terminal cannot start");
        try { window.bwHost.post("emulator-slow", { runtime: "st", reason: reason }); } catch (e) {}
      }
    },
    // A wasm that never instantiates never arms watchBoot: fail it after 45s. Tracked by
    // BW_WASM_INSTANTIATED, not HEAPU8 (pthread builds create it before the wasm loads).
    watchWasmLoad: function () {
      var self = this;
      setTimeout(function () {
        if (window.BW_WASM_INSTANTIATED === true) return;
        if (self._wasmFailed) return; // already handled by onWasmFailed
        self.onWasmFailed("not instantiated after 45s");
      }, 45000);
    },
    // After a restore: a usable console within 8s, else discard the snapshot and reload
    // into a cold boot. Resolves true when verified.
    watchRestore: function (Module) {
      var self = this;
      return this._waitUsable(Module, 8000, 8).then(function (ok) {
        if (ok) { console.log("[bw-watchdog] restore verified: console usable"); return true; }
        var n = self._bumpFailCount("bw-snapshot-fail");
        console.error("[bw-watchdog] restore produced NO usable console in 8s (guest not executing) — discarding snapshot and cold-booting (failure " + n + " for this build)");
        try { window.bwHost.post("restore-fallback", { count: n }); } catch (e) {}
        self.discard().then(function () { try { window.bwHost.reload("restore-unusable"); } catch (_) {} });
        return false;
      });
    },
    // After a cold boot starts: MT without a usable console in 150s records a failure and
    // reloads into ST. ST keeps waiting (a slow machine still gets its terminal): the
    // loading screen's text changes at 60s, and the parent is told after 4 minutes.
    // Resolves true when the console is usable.
    watchBoot: function (Module) {
      var self = this, isMT = this._rt() === "mt";
      return this._waitUsable(Module, isMT ? 150000 : 60000).then(function (ok) {
        if (ok) { console.log("[bw-watchdog] cold boot verified: console usable"); return true; }
        if (isMT) {
          console.error("[bw-watchdog] MT did not reach a usable console in 150s — recording failure for this build and falling back to ST");
          self.recordRuntimeFailure("boot-timeout");
          self._reloadWithoutOverride();
          return new Promise(function () {}); // reloading
        }
        console.warn("[bw-watchdog] ST has not reached a usable console in 60s — still waiting (slow machine?)");
        if (window.bwBootStage) window.bwBootStage("Booting Windows console (first visit) — this is taking longer on this machine, please wait");
        return (async function () {
          var extra = 0;
          while (!(await self._waitUsable(Module, 30000))) {
            if (++extra === 6) {
              console.error("[bw-watchdog] the console has not started after 4 minutes");
              try { window.bwHost.post("emulator-slow", { runtime: "st", reason: "the Windows console did not start within 4 minutes" }); } catch (e) {}
            }
          }
          return true;
        })();
      });
    },
    canCapture: function () {
      return supported() && !!this.version && this._captureAllowed && this._didColdBoot && this.mode === "cold";
    },

    discard: function () {
      this._decode = null;
      this._meta = null;
      // without the marker the next load cold-boots
      try { if (this._markerKey) localStorage.removeItem(this._markerKey); } catch (_) {}
      this._overlayRaw = null;
      return idbClear(); // the whole store: every schema's records (heap, seg*, overlay, meta)
    },

    // a restored terminal froze or crashed before any input: handled as a failed restore (see watchRestore)
    restoreUnhealthy: function (reason) {
      if (this._unhealthyHandled) return;
      this._unhealthyHandled = true;
      var n = this._bumpFailCount("bw-snapshot-fail");
      console.error("[bw-snapshot] restored terminal unhealthy before any input (" + reason + ") — discarding snapshot and cold-booting (failure " + n + " for this build)");
      try { window.bwHost.post("restore-fallback", { count: n, reason: String(reason) }); } catch (e) {}
      this.discard().then(function () { try { window.bwHost.reload("restore-unhealthy"); } catch (_) {} });
    },
  };

  window.BWSnapshot = BW;
})();
