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

// Below this, a "download" is not audio. R2's error responses (missing
// object, expired signed URL, bad range) are a few hundred bytes of XML, and
// Filesystem.downloadFile has no way to tell that from a real clip -- it
// writes whatever the server sent. Every genuine clip in this corpus is far
// larger: the shortest paragraph is five characters of text and still runs
// to several kilobytes of MP3, so nothing real can trip this floor.
const MIN_DOWNLOAD_BYTES = 1024;

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

  await Filesystem.mkdir({ directory: DIR, path: FOLDER, recursive: true }).catch(() => {});
  const part = `${pathFor(hash)}.part`;

  // Filesystem.downloadFile runs in native code, so it is not subject to the
  // WebView's CORS enforcement the way fetch() is, and it streams straight to
  // disk instead of carrying the file through JS as base64.
  await Filesystem.downloadFile({ url, directory: DIR, path: part, recursive: true });

  const st = await Filesystem.stat({ directory: DIR, path: part });
  if (!st || st.size < MIN_DOWNLOAD_BYTES) {
    await Filesystem.deleteFile({ directory: DIR, path: part }).catch(() => {});
    throw new Error(`audio download failed: response too small (${st?.size ?? 0} bytes)`);
  }

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

// Drop one cached file. The caller is the player, after a file that passed
// cachedUri()'s size check still failed to decode: cachedUri() cannot tell a
// truncated or corrupt MP3 from a good one, so without this the paragraph
// would read in the device voice for the life of the install. Deleting it is
// the whole self-heal — the next attempt finds nothing cached and downloads
// again. A delete that itself fails is no worse than not trying.
export async function removeCached(hash) {
  if (!isNative() || !hash) return;
  await Filesystem.deleteFile({ directory: DIR, path: pathFor(hash) }).catch(() => {});
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
