// One decimal below 10 MB, none above. The small end is where the decimal
// earns its place: a first-time user with one cached section has ~200 KB, and
// "0 MB" next to a clear button reads as a bug.
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 MB';
  const mb = n / (1024 * 1024);
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}
