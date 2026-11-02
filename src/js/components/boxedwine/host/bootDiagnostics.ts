import { BwEvents } from "./protocol.js";

export interface BootSample {
  frame: string | null;
  canvas: string | null;
  screen: string | null;
  fills: boolean | null;
  lit: number | null;
  progress: number | null;
  visibility: string;
  panel: string;
}

export interface BootProbe {
  sample(): BootSample;
  countFrames(ms: number): Promise<number>;
}

export const SLOW_BOOT_STAGE = /taking longer/;

export function watchSlowBoot(
  target: EventTarget,
  probe: BootProbe,
  log: (message: string) => void,
): void {
  const seen = new Set<string>();
  const record = (label: string) => {
    if (seen.has(label)) return;
    seen.add(label);
    let first: BootSample;
    try {
      first = probe.sample();
    } catch (e) {
      log(
        "[host] " +
          label +
          "; the boot watchdog's view could not be read: " +
          e,
      );
      return;
    }
    void probe.countFrames(1000).then((framesIn1s) => {
      let after: BootSample | null = null;
      try {
        after = probe.sample();
      } catch (e) {
        // reported below as null
      }
      const progressIn1s =
        after && first.progress !== null && after.progress !== null
          ? after.progress - first.progress
          : null;
      log(
        "[host] " +
          label +
          "; the boot watchdog sees: " +
          JSON.stringify({ ...first, progressIn1s, framesIn1s, after }),
      );
    });
  };
  target.addEventListener("bw-boot-stage", (e) => {
    if (SLOW_BOOT_STAGE.test(String((e as CustomEvent).detail || "")))
      record("the cold boot is taking longer");
  });
  target.addEventListener("bw-host-post", (e) => {
    const d = (e as CustomEvent).detail || {};
    if (d.eventName === BwEvents.emulatorSlow && d.data && d.data.reason)
      record("the start failed (" + String(d.data.reason) + ")");
  });
}

export function pageBootProbe(w: any): BootProbe {
  const size = (o: { width?: number; height?: number } | null | undefined) =>
    o && o.width && o.height ? o.width + "x" + o.height : null;
  const call = <T>(f: () => T): T | null => {
    try {
      return f();
    } catch (e) {
      return null;
    }
  };
  return {
    sample: () => {
      const M = w.Module;
      return {
        frame: call(() => size(w.bwConsoleFrame())),
        canvas: call(() => size(w.document.getElementById("canvas"))),
        screen: call(() => String(M.bwGetScreenSize())),
        fills: call(() => !!w.bwConsoleFillsScreen()),
        lit: call(() => Number(w.bwConsoleLit())),
        progress: call(() => Number(M.bwGetGuestProgress())),
        visibility: String(w.document.visibilityState),
        panel: w.innerWidth + "x" + w.innerHeight,
      };
    },
    countFrames: (ms) =>
      new Promise((resolve) => {
        let frames = 0,
          counting = true;
        const tick = () => {
          if (!counting) return;
          frames++;
          w.requestAnimationFrame(tick);
        };
        w.requestAnimationFrame(tick);
        setTimeout(() => {
          counting = false;
          resolve(frames);
        }, ms);
      }),
  };
}
