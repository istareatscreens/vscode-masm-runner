import { BwEvents } from "./protocol";

export const RESET_TERMINAL = "Reset terminal";

export type Severity = "info" | "warning" | "error";

export interface NotifierUi {
  show(
    severity: Severity,
    message: string,
    actions: string[],
  ): Thenable<string | undefined>;
}

interface Notice {
  key: string;
  severity: Severity;
  message: string;
  reset: boolean;
}

export const CRASH_HINTS: Record<string, string> = {
  fault:
    "It touched an address it does not own (the .lst file shows where each instruction lives).",
  stack:
    "It ran out of stack: a PROC calling itself with no exit, or PUSH/CALL without a matching POP/RET.",
  divzero:
    "DIV/IDIV by zero, or a quotient too big for the register: check the divisor and clear EDX (CDQ) first.",
  illegal:
    "The CPU refused an instruction: execution probably ran past the end of the code (missing exit/RET) into data.",
  privileged:
    "Programs may not run privileged instructions (HLT, CLI, STI, IN, OUT, LGDT, ...): Windows ends them, as it does here.",
  other: "Fix the code and run it again.",
};

const FILES_SAFE = "Your files are safe: resetting only restarts the terminal.";

// "Unhandled page fault on write access to 00000000 at address 0040100C (thread 011c)"
// -> "page fault on write access to 00000000 at address 0040100C"
export const crashReason = (reason: unknown): string =>
  String(reason || "unhandled exception")
    .replace(/^Unhandled /, "")
    .replace(/\s*\(thread [0-9a-f]+\)/i, "");

export function noticeFor(eventName: string, data: any): Notice | null {
  const d = data && typeof data === "object" ? data : {};
  switch (eventName) {
    case BwEvents.emulatorFrozen:
      // only a confirmed freeze of a terminal that accepted input
      if (!(d.confirmedPolls > 0)) return null;
      return {
        key: eventName,
        severity: "warning",
        reset: true,
        message:
          "MASM Runner: the terminal has stopped responding (a program may be stuck, or the emulator crashed). " +
          FILES_SAFE,
      };
    case BwEvents.programCrashed: {
      const reason = crashReason(d.reason);
      return {
        key: eventName + ":" + reason,
        severity: "warning",
        reset: false,
        message:
          "MASM Runner: program stopped: " +
          reason +
          ". " +
          (CRASH_HINTS[d.kind] || CRASH_HINTS.other) +
          " The terminal is fine.",
      };
    }
    case BwEvents.emulatorCrashed:
      return {
        key: eventName,
        severity: "error",
        reset: true,
        message:
          "MASM Runner: the terminal stopped: emulator error (" +
          String(d.message || "unknown").slice(0, 120) +
          "). A bug in the emulator, not in your program: please report it, then reset the terminal. " +
          FILES_SAFE,
      };
    case BwEvents.webglContextLost:
      return {
        key: eventName,
        severity: "warning",
        reset: true,
        message:
          "MASM Runner: the terminal's display was lost (WebGL context lost). Reset the terminal to restore it. " +
          FILES_SAFE,
      };
    case BwEvents.snapshotNotSaved:
      return {
        key: eventName,
        severity: "warning",
        reset: false,
        message:
          "MASM Runner: instant start could not be saved. The terminal is ready, but its instant-start state could not be stored (" +
          String(d.reason || "storage error") +
          "), so the next start will boot from scratch again. This usually means the disk is nearly full.",
      };
    case BwEvents.restoreFallback:
      return {
        key: eventName,
        severity: "info",
        reset: false,
        message:
          "MASM Runner: the terminal restarted from scratch. The saved instant-start state could not be resumed, so the terminal started from scratch (that is why it took longer). " +
          (d.count >= 2
            ? "Instant start has been disabled for this version; a factory reset turns it back on."
            : "It has been re-saved automatically."),
      };
    case BwEvents.runtimeDowngraded:
      return {
        key: eventName,
        severity: "info",
        reset: false,
        message:
          "MASM Runner: the terminal is running in compatibility mode (" +
          String(d.reason || "watchdog") +
          "). Everything works the same.",
      };
    case BwEvents.emulatorSlow:
      // a merely slow start is shown by the loading screen; only a failed one has a reason
      if (!d.reason) return null;
      return {
        key: eventName,
        severity: "error",
        reset: true,
        message:
          "MASM Runner: the terminal could not start (" +
          String(d.reason) +
          '). Reset the terminal; if it keeps happening, run "Factory reset MASM Command Prompt" (you can keep your files).',
      };
    case BwEvents.containerReadOnly:
      return {
        key: eventName,
        severity: "warning",
        reset: false,
        message:
          "MASM Runner: this project's terminal is already open in another VS Code window. This window shows the project's files, but changes made here are not saved. Close the other window's terminal, then reset this one to save changes again.",
      };
    case BwEvents.buildBlocked: {
      const files: string[] = Array.isArray(d.files) ? d.files : [];
      return {
        key: eventName + ":" + files.join("|"),
        severity: "warning",
        reset: true,
        message:
          "MASM Runner: a program is still running in the terminal and did not stop on Ctrl+C, so " +
          (files.length ? files.join(", ") : "the file") +
          " was not built. Stop the program, or reset the terminal, then run it again.",
      };
    }
    case BwEvents.fileTooLarge:
      return {
        key: eventName + ":" + String(d.path),
        severity: "warning",
        reset: false,
        message:
          "MASM Runner: " +
          String(d.path) +
          " is larger than 4 MB: it is on D: for this session only and is not saved.",
      };
    default:
      return null;
  }
}

const DEFERRED = new Set<string>([
  BwEvents.restoreFallback,
  BwEvents.runtimeDowngraded,
]);

export class TerminalNotifier {
  private shown = new Set<string>();
  private deferred: Notice[] = [];
  private ready = false;

  constructor(
    private readonly ui: NotifierUi,
    private readonly resetTerminal: () => void,
  ) {}

  newStart(): void {
    this.shown = new Set();
    this.ready = false;
  }

  terminalReady(): void {
    this.ready = true;
    const waiting = this.deferred.splice(0);
    for (const n of waiting) this.show(n);
  }

  onEvent(eventName: string, data: unknown): void {
    const notice = noticeFor(eventName, data);
    if (!notice) return;
    if (DEFERRED.has(eventName) && !this.ready) {
      if (!this.deferred.some((n) => n.key === notice.key))
        this.deferred.push(notice);
      return;
    }
    this.show(notice);
  }

  private show(n: Notice): void {
    if (this.shown.has(n.key)) return;
    this.shown.add(n.key);
    this.ui.show(n.severity, n.message, n.reset ? [RESET_TERMINAL] : []).then(
      (choice) => {
        if (choice === RESET_TERMINAL) this.resetTerminal();
      },
      () => undefined,
    );
  }
}
