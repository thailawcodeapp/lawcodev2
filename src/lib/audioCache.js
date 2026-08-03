// Keeps played audio on the device so a paragraph heard once needs no network
// the next time, and so playback survives going offline mid-section.
//
// Directory.Cache is Library/Caches on iOS, which the system excludes from
// iCloud backup without any native code — audio is regenerable and has no
// business in someone's 5 GB. The price is that iOS may purge it under
// storage pressure, and that price is already paid: ensure() treats a missing
// file as an ordinary outcome and re-downloads, or the caller speaks instead.
// A "downloaded for offline" feature could not accept purging; that is why
// bulk download needs Directory.Data plus a native exclusion flag, and its
// own plan.
import { Filesystem, Directory } from '@capacitor/filesystem';
import { audioUrl } from './audioManifest';

const DIR = Directory.Cache;
const FOLDER = 'audio';

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

const pathFor = (hash) => `${FOLDER}/${hash}.mp3`;

// String.fromCharCode.apply blows the argument limit somewhere around 100k
// characters, and these files run to 200 KB. Chunking keeps it inside it.
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function cachedUri(hash) {
  if (!isNative() || !hash) return null;
  try {
    const st = await Filesystem.stat({ directory: DIR, path: pathFor(hash) });
    if (!st || !st.size) return null;
    const { uri } = await Filesystem.getUri({ directory: DIR, path: pathFor(hash) });
    return uri;
  } catch {
    return null;
  }
}

export async function download(hash) {
  if (!isNative() || !hash) return null;
  const url = audioUrl(hash);
  if (!url) return null;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`audio download failed: http ${res.status}`);
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) throw new Error('audio download failed: empty body');

  await Filesystem.mkdir({ directory: DIR, path: FOLDER, recursive: true }).catch(() => {});
  const part = `${pathFor(hash)}.part`;
  await Filesystem.writeFile({ directory: DIR, path: part, data: toBase64(buf), recursive: true });
  await Filesystem.rename({ directory: DIR, from: part, to: pathFor(hash), toDirectory: DIR });

  const { uri } = await Filesystem.getUri({ directory: DIR, path: pathFor(hash) });
  return uri;
}

// Keyed by hash, so a paragraph prefetched ahead of playback and then
// requested again by the player itself share one download instead of two
// racing writers landing on the same .part path. Cleared in the finally
// below so a failed attempt doesn't permanently poison later retries.
const inFlight = new Map();

// The caller's fallback is the device voice, so a failure here is a normal
// outcome rather than an error: it returns null and says nothing.
export async function ensure(hash) {
  const have = await cachedUri(hash);
  if (have) return have;

  let promise = inFlight.get(hash);
  if (!promise) {
    promise = download(hash).finally(() => inFlight.delete(hash));
    inFlight.set(hash, promise);
  }

  try {
    return await promise;
  } catch {
    return null;
  }
}

export async function cacheBytes() {
  if (!isNative()) return 0;
  try {
    const { files } = await Filesystem.readdir({ directory: DIR, path: FOLDER });
    return files.reduce((total, f) => total + (f.size || 0), 0);
  } catch {
    return 0;
  }
}

export async function clearCache() {
  if (!isNative()) return;
  try {
    const { files } = await Filesystem.readdir({ directory: DIR, path: FOLDER });
    for (const f of files) {
      await Filesystem.deleteFile({ directory: DIR, path: `${FOLDER}/${f.name}` }).catch(() => {});
    }
  } catch {
    // Nothing cached yet.
  }
}
