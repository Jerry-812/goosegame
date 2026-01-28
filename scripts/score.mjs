export function score(m) {
  return m.fps * 2 - m.load_ms / 200 - m.bundle_kb / 50 - m.console_errors * 1000;
}

export function betterThan(newM, baseM) {
  if (newM.console_errors > 0) return false;
  if (newM.smoke_ok === false) return false;
  if (newM.load_ms > baseM.load_ms * 1.1) return false;
  if (newM.bundle_kb > baseM.bundle_kb * 1.05) return false;
  return score(newM) > score(baseM) + 1.0;
}
