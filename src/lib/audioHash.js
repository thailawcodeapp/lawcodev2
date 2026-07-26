// Audio files are named after their content, not their position, so that
// editing one section's text invalidates exactly one file: the hash stops
// matching, the app finds nothing, and falls back to on-device speech for
// that paragraph alone while every other file stays valid and cached.
//
// 16 hex characters is 64 bits. Across ~6,800 paragraphs the chance of any
// collision is around one in 10^11 — far below the chance of a bug
// elsewhere in this pipeline — and it keeps the shipped manifest near
// 250 KB instead of 550 KB.
//
// This started as `createHash('sha256')` from node:crypto, but Rollup
// cannot resolve that import in Vite's browser build ("createHash" is not
// exported by "__vite-browser-external"), so it's a pure-JS FNV-1a instead.
// Two independent 32-bit FNV-1a passes over the UTF-8 bytes (different
// offset basis each) are concatenated into a 64-bit hex string, keeping
// the same signature and output shape the sha256 version had.

const FNV_PRIME = 0x01000193;

function fnv1a32(bytes, offsetBasis) {
  let hash = offsetBasis >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

function toHex8(n) {
  return n.toString(16).padStart(8, '0');
}

export function audioHash(normalizedText) {
  const bytes = new TextEncoder().encode(String(normalizedText));
  const high = fnv1a32(bytes, 0x811c9dc5);
  const low = fnv1a32(bytes, 0x9e3779b9);
  return toHex8(high) + toHex8(low);
}
