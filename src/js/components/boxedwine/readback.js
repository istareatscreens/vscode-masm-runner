export const readbackStep = ({ exeSize, exeStable, exeComplete, lineDone, tries, maxTries }) => {
  if (exeStable && exeComplete) return { finished: true, ok: true };
  if (lineDone) return { finished: true, ok: exeSize > 0 && exeComplete };
  if (tries >= maxTries) return { finished: true, ok: false };
  return { finished: false, ok: false };
};
