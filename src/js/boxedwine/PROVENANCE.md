# Vendored emulator stack — provenance

**Source:** [wasm-masm-x86-editor](https://github.com/istareatscreens/wasm-masm-x86-editor) at commit `2905a233a5c29f80ce5c3d447fc12fe3415417ee`. The machine-readable record is in [`PROVENANCE.json`](PROVENANCE.json): every file's original and vendored SHA-256, plus every adapted hunk. `scripts/vendor-provenance.test.cjs` (`npm test`) verifies four things:
- the identical files still hash to the web originals;
- reversing the recorded hunks gives back each web original byte-for-byte;
- in the adapted toolchain archive, every entry is the web original's, except the overridden ones, whose hunks reverse to the original's size and CRC-32, and the archive holds the current override files;
- the snapshot codec Worker never fetches.

## Byte-identical (do not edit)

| File here | File in the web repository |
|---|---|
| `src/js/boxedwine/boxedwine.js` | `src/js/boxedwine/boxedwine.js` (single-threaded glue) |
| `src/wasm/boxedwine.wasm` | `src/wasm/boxedwine.wasm` |
| `src/js/boxedwine/jszip.min.js` | `src/js/boxedwine/jszip.min.js` |
| `src/assets/TinyCore15Wine6.0-preboot-fw-trim.zip` (LFS) | `src/bw-assets/TinyCore15Wine6.0-preboot-fw-trim.zip` |

**The toolchain archive** `src/assets/assembler-dp0.zip` (LFS) is the web's `src/bw-assets/assembler-dp0.zip` with one entry replaced, `assemble.bat`. The replacement is `src/assets/assembler-dp0-overrides/assemble.bat`, and `scripts/toolchain-zip.mjs` builds the archive: every other entry's header and data are copied byte for byte.

The changes, each measured in the guest (`reference/verification.md`, defects 9 and 10):
- **A failed link stops.** There is now an error-level check after JWlink, as there already was after JWasm. Before, the batch ran `"bin\<name>.exe"` after a failed link, and cmd printed "Can't recognize …". JWlink exits with 1 on undefined references and writes no `.exe`.
- **Echo stays on.** Each hidden line has its own `@` instead of `@echo Off`/`@echo on`. Wine's cmd kept echo off after a batch left through `goto :eof`, so after every failed build the prompt was gone.
- **The error file goes to `bin\`.** JWasm's `/Fw"bin\<name>.err"`. JWasm writes the file only when there are errors, and deletes it at the next good build.

**Not vendored:**
- **`boxedwine-mt.*`:** VS Code webviews are not cross-origin isolated, so `SharedArrayBuffer` is unavailable and pthreads cannot start.
- **`bw-cache.js`:** assets are local extension files; the Cache API layer would only duplicate them.
- **`bw-chunk-sw.js`:** a webview cannot register its own service worker.
- **`iced_x86.*`:** the invalid-opcode decoder is a web-app UI feature.

## Adapted

Two seams, and nothing else:

1. **Host messaging.** Every `window.parent.postMessage(JSON.stringify({eventName, data: {data}}), "/")` becomes `window.bwHost.post(eventName, data)`. VS Code sets `window.parent = window` inside a webview, so the web call would only echo back into the page. `bwHost` (`page/bw-host.js`) forwards to the extension through `acquireVsCodeApi().postMessage`.
2. **Reloads.** Every `location.reload()`/`location.replace()` becomes `window.bwHost.reload(reason)`. In a webview the content document is written by VS Code's host page, so reloading it loads that host page and blanks the panel. The extension re-renders the webview instead.

| File | Adaptation | Reason |
|---|---|---|
| `boxedwine-shell.js` | `ALLOW_PARAM_OVERRIDE_FROM_URL = false` | The webview URL is VS Code's host page. Every getter checks `allowParameterOverride()`, so no URL value is used. |
| `boxedwine-shell.js` | seam 1 for `emulator-slow`, `program-crashed`, `emulator-crashed` | — |
| `boxedwine-shell.js` | seam 2 for the stale-snapshot-marker reload | — |
| `boxedwine-shell.js` | the WebGL context-lost `alert()` becomes `bwHost.post("webgl-context-lost")` | `alert()` is blocked in the sandboxed webview; the extension shows a notification. |
| `boxedwine-shell.js` | A failed asset load says "Loading X failed … use Reset terminal in the notification", where the web says "Download of X failed … check your connection and reload". | The assets are local extension files, and a webview cannot be reloaded by the user. The VS Code notice offers "Reset terminal". |
| `boxedwine-shell.js` | D: is `-mount /d_drive /home/username/.wine/drive_d` (`Config.d_drive_guest`), and `initBrowserFilesystem` writes the link file `dosdevices/d(_colon_).link` into the native root, in the form the image uses for `c:`. The web uses `-mount_drive /d_drive d`. `scripts/d-drive-mount.test.cjs` checks that the shell and the adapter agree. | Boxedwine reports a file as writable to a guest user other than root only under `/home`, `/tmp` or `/var` (`FsFileNode::getMode`), and Wine refuses to delete a file it sees as read-only. With `-mount_drive`, D: is `/mnt/drive_d`. There, `del` printed "Access denied" for every file on D:, including files the guest had just created, so a deletion in the console never reached the project's container. 0.9.1, which ran Boxedwine as root, deleted them. Measured after the change: `del` and `rmdir` work on a cold boot and after a restore, and `vol D:` reports the drive as before. |
| `boxedwine-shell.js` | `getEmulatorParams` passes `-uid 0 -euid 0`: every guest program runs as root. `scripts/d-drive-mount.test.cjs` checks it. | The owner's rule (2026-10-31): every command and program runs with full privilege. 0.9.1 passed these two arguments ("Add admin/root privileges"). The web version added them in `bb308d7` and dropped them in `26da643`, when it moved to the new Boxedwine stack. For a user other than root, Boxedwine makes only `/tmp`, `/var` and `/home` writable (`FsFileNode::getMode`, `io/fsfilenode.cpp`), and its `stat` reports every file as owned by the calling user (`KSystem::writeStat`; only `/etc/sudoers` and `/tmp/.X11-unix` are reported as root's), so Wine's ownership checks pass as root too. Ported to the web version in its change `port-console-fixes-and-grammar-from-masm-runner`. |
| `bw-snapshot.js` | seam 1 for `restore-fallback` ×2, `snapshot-not-saved`, `emulator-slow` ×2 | — |
| `bw-snapshot.js` | seam 2 in `doRestore`, `watchRestore` and `_reloadWithoutOverride` | `_reloadWithoutOverride` has no `?bw=` override to strip in a webview. |
| `bw-snapshot.js` | `captureLock()`: a Web Lock `bw-snapshot-capture` (`ifAvailable`) held from before the heap pack until the record is stored or abandoned | The snapshot database is shared by the extension's webviews in every VS Code window (verified on VS Code 1.144), so only one window captures at a time. |
| `bw-snapshot.js` | `LATE_TICK_MS` in `_waitUsable`: a watchdog tick that arrives late counts at most 250 ms | Same-origin webviews in different windows share one renderer thread (verified: a 1.5 s busy loop in one delayed the other's timers by 1.49 s), so another window's busy terminal must not fail this window's restore or boot watchdog. |
| `bw-snapshot.js` | `NO_FRAME_MS` in `_waitUsable`: time without an animation frame for 500 ms is not counted, like hidden-page time. `scripts/snapshot-watchdog.test.cjs` runs the shipped `_waitUsable` in a VM with a fake clock and fake frames. Its background-tab and thread-block cases fail against the web original and pass here. | VS Code hides a webview whose tab is in the background with `visibility: hidden`. Its `document.visibilityState` stays `"visible"`, but it gets no animation frames, and the emulator's main loop (`requestAnimationFrame`) cannot start or resume without them. Measured on VS Code 1.144: 0 frames per second in a hidden tab. A restore started there made no progress, and this watchdog discarded the snapshot after 8 s. |
| `bw-snapshot.js` | `restoreUnhealthy(reason)` | The host layer calls this when a restored terminal freezes or crashes before any user input. It uses the same failure count, notice and cold-boot path as `watchRestore`. |

## Page scripts ported from `boxedwine.html` (design D2)

The web page's inline scripts are nonce-loaded files in `page/`, in the web page's order (`src/html/webview.html`). `PROVENANCE.json` records each file's web line range and its hunks. `bw-page-input.js`, `bw-page-frame.js` and `bw-page-loader.js` were reformatted on 2026-11-01, so their recorded hunks cover nearly every line; the table lists what they change.

| File | Web lines | Changes |
|---|---|---|
| `bw-page-input.js` | 99–385 | the canvas `oncontextmenu` attribute becomes a listener (the CSP blocks inline handlers); `BW_DEBUG_LOG` comes from the config; a press on the console window's frame (its caption and borders, from `BW_CLIENT_ORIGIN`) is cancelled at `pointerdown`, so SDL gets no mouse events for it. Measured before: a drag on the caption moved the console off the screen's edges, and a drag from its top-left border resized it and left it taking no input, so no build ran afterwards. The web version has the same handler without this guard. A drag whose release the page never receives (no `pointerup`, measured for a drag released outside the panel) ends at the next pointer move without the button, or when the capture is lost: SDL gets the missing `mouseup` at the drag's last position. Before, the guest's button stayed down, and the next move over the console extended the selection to it. Ctrl+Shift+C is taken like Cmd+Shift+C (`isCtrlCopyKey`), so VS Code's webview host never forwards it to the workbench, whose default opens an external terminal (measured: the console copied and an external `cmd.exe` opened). Both chords now reach the guest whole through `typeCopyChord`: Control, Shift, C and their releases. The emulator applies direct input after the browser's key events of the same pass, so a C sent alone came after the modifiers' releases in a quick press (measured: the selection ended uncopied, or a "c" was typed into the next command); the web's Cmd+Shift+C relied on the browser's Shift the same way. |
| `bw-page-boot.js` | 387–908 | `BW_BUILD_ID` and the debug switches come from `bw-page-config.js`; `canMT` is always false, with no `?bw=` override; glue, wasm and zip URLs are absolute (`BW_ASSET_BASE`, `BW_ZIP_BASE`), with no `?v=` query; `BW_EXTRA_ENV` gains `WINEPATH=C:\files` (design D9); `?bwmtsnap`/`?bwnosnap` become config; notes on `BW_GUEST_CHUNKS` and `BWCache`, which are unused here; `bwPatchGuestConsole` and `bwSyncScreenToPanel` measure the panel on an animation frame. That last change is needed because a webview in a background tab reads as 300×150 between frames. Measured: a boot started there wrote a 25×5-cell console into the registry and the captured snapshot, and a fit from a timer shrank the screen to 300×150. The display SDL sees is 8192×8192 (`screen.width` and `screen.height` defined on the page), and `bwGeometryFor` asks for at most 8000×8000 (`BW_MAX_SCREEN`, the limit of `Module.bwResizeScreen`). SDL's Emscripten driver takes its desktop mode from `screen.width` × `screen.height`, and Boxedwine makes a screen that does not fit inside it, or equals it, a scaled full-screen window of the display's size (`KNativeScreenSDL::recreateMainWindow`). Measured with VS Code at `window.zoomLevel` −1 on a 1920×1080 display: a 1926×1177 panel got 1920×1080 frames, and the cold boot never reached a usable console. The web version has the same code; a browser zoomed out below 100% gives the same panel. |
| `bw-page-frame.js` | 911–1015 | none |
| `bw-page-loader.js` | 1019–1151 | the MT fallback URLs are absolute; `runtime-downgraded` goes through `bwHost.post` |

**Not ported:**
- **Lines 23–77,** the chunk-assembly service-worker registration: a webview cannot register one.
- **Lines 84–97,** the URL debug switches: replaced by `bw-page-config.js`, and `?bwtrace=1` by `BW_CONFIG.debugTrace` in `bw-page-boot.js`.

**New files:**
- `page/bw-host.js` is the bridge. Each post is first a cancelable `bw-host-post` event on the page, so the host layer sees the emulator's events and can handle one itself.
- `page/bw-page-config.js` reads the configuration that the extension and the build write into `webview.html`. It never reads the URL. Without a build identity it turns instant start off.

## The adapter (`src/js/components/boxedwine/`)

`Boxedwine.jsx`, `LoadingScreen.jsx` and `index-bw.jsx` are ported from the web version's `src/js/components/boxedwine/`. `PROVENANCE.json` records their hunks.

| File | Adaptation | Reason |
|---|---|---|
| `Boxedwine.jsx` | Events (`postToParent`, `file-synced`, the freeze events) become a `bw-adapter-event` on the page's own window. | `window.parent` is the page itself. The host layer (`host/controller.ts`) handles some events and forwards the rest through `bwHost`. |
| `Boxedwine.jsx` | Reset is `bwHost.reload("adapter-reset")`. | Design D4. |
| `Boxedwine.jsx` | `bwApp.guestFs`: `readdir`/`stat`/`readFile` on the native D: path, and `remove` for sentinels. | The host layer's mirror and build coordinator need them. |
| `Boxedwine.jsx` | `bwApp.attachHost()`, so the no-parent fallback never opens input before D: is rebuilt. | The host layer reconciles once the container is open, which can take over the web's 5 s (a Web Lock wait). |
| `Boxedwine.jsx` | Readback ceiling of 60 s (the web uses 22 s). | Terminals in other windows share this thread. |
| `Boxedwine.jsx` | The readback polls every 100 ms (the web polls every 500 ms). The `.exe` counts as ready once its size is stable and its PE image is complete (`peImage.js`). | The web's interval added 0.4–0.9 s to every build, measured from a final `.exe` to its export, which made builds slower than 0.9.1's. With 100 ms polls the export median is 0.80 s (0.9.1: 1.09 s). The PE check keeps a short interval safe when another window holds up the linker. |
| `Boxedwine.jsx` | The readback also ends when the build's command line has finished, which is when its done sentinel exists (`readback.js`). | Before, a build that produced no `.exe` waited for the 60 s ceiling, and the next build waited behind it. Measured: a failed link reported after 60.0 s, and 0.82 s with this change. |
| `Boxedwine.jsx` | `build(…, opts)`: `requestId` is passed through to `build-outputs`, and an optional done sentinel ends the command line. | Design D9. |
| `Boxedwine.jsx` | The build line is typed onto an empty input line: End, then Ctrl+Home, clears what is there first. | A VS Code shortcut pressed while the terminal has keyboard focus also reaches the console: Ctrl+Shift+P and Ctrl+P type `^P`, and Ctrl+B types `^B`. 0.9.1 does the same. A half-typed command is the other case. Either one was prefixed to `pushd`, giving `ppushd D:\ & call …` (observed), so a nested source was built in the wrong folder.<br>Verified in Wine 6.0's console:<ul><li>Escape inserts `^[` instead of clearing.</li><li>End then Ctrl+Home clears leftover text, a leftover `^P`, a line with the cursor moved left, and an empty line.</li><li>The clear keys and the text that follows are processed in order when sent in one task (10 of 10, long lines included).</li></ul> |
| `Boxedwine.jsx` | File content may be a `Uint8Array`. | The container stores bytes. |
| `Boxedwine.jsx` | The guest → drawer import scan and the legacy IDBFS offer are removed. | `host/mirror.ts` and `host/legacyMigration.ts` replace them. |
| `Boxedwine.jsx` | `outputPath` comes from `outputPath.js`, a port of the web's `paths.ts` rule, which the build coordinator also uses. | — |
| `Boxedwine.jsx` | `D_DRIVE`, the guest path of D: for `bwWriteFile` and the other file calls, is `/home/username/.wine/drive_d/`. | It follows the shell's D: mount (above). |
| `LoadingScreen.jsx` | The label reads "VSCode", as in 0.9.x. | — |
| `index-bw.jsx` | Starts the host layer before the adapter mounts. | — |

## Syncing a newer web version
1. Check out the web repository at the commit to adopt, with a clean tree.
2. Copy the byte-identical files over (zips go to `src/assets/`). The toolchain archive is not copied: run `node scripts/toolchain-zip.mjs <web-repo>`, which builds it from the web's archive and the override files. If the web's `assemble.bat` changed, carry its changes into the override first.
3. Copy `boxedwine-shell.js`, `bw-snapshot.js` and the adapter files, then re-apply the adaptations above. `PROVENANCE.json` holds each changed hunk of the old copies.
4. Diff the web `boxedwine.html` against the old commit. Carry every change in the ported inline scripts into the matching `page/` file, and update the line ranges in `scripts/vendor-provenance.mjs`.
5. Run `node scripts/vendor-provenance.mjs <web-repo>`, then `npm test`. Every hunk listed must be one of the adaptations above.
6. Rebuild. The build identity (`BW_BUILD_ID`) changes, so every user gets one cold boot and a fresh instant-start capture.

**Two adaptations are in the web version too.** On 2026-10-31 they were ported to the web version, in its change `port-console-fixes-and-grammar-from-masm-runner` (in the working tree, not yet committed there):
- the display SDL sees and `BW_MAX_SCREEN` (`bw-page-boot.js`);
- `isCtrlCopyKey` and `typeCopyChord` (`bw-page-input.js`).

Their code is the same apart from the comments. Once a web commit carries them, a sync from that commit adopts them as web code, and their rows above go. The one exception is the VS Code reason for taking Ctrl+Shift+C (the workbench's external terminal), which stays as a comment.
