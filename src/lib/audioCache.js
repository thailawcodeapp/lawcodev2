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
import { NativeAudio } from '@capgo/native-audio';
import { audioUrl, objectPath, DEFAULT_VOICE } from './audioManifest';
import { recordAudioIssue } from './audioLog';

const DIR = Directory.Cache;
const FOLDER = 'audio';

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

// The same key R2 stores the file under, which is what keeps the two voices
// apart on disk. It has to: 5,048 of the 6,712 paragraphs have no "(n)" label
// and so hash identically for both voices, and a cache keyed on hash alone
// would hand back whichever voice happened to be downloaded first — silently,
// and for the life of the install.
const pathFor = (hash, voice = DEFAULT_VOICE) => objectPath(hash, voice);

// Below this, a "download" is not audio. R2's error responses (missing
// object, expired signed URL, bad range) are a few hundred bytes of XML, and
// Filesystem.downloadFile has no way to tell that from a real clip -- it
// writes whatever the server sent. Every genuine clip in this corpus is far
// larger: the shortest paragraph is five characters of text and still runs
// to several kilobytes of MP3, so nothing real can trip this floor.
const MIN_DOWNLOAD_BYTES = 1024;

export async function cachedUri(hash, voice = DEFAULT_VOICE) {
  if (!isNative() || !hash) return null;
  try {
    const path = pathFor(hash, voice);
    const st = await Filesystem.stat({ directory: DIR, path });
    if (!st || !st.size) return null;
    const { uri } = await Filesystem.getUri({ directory: DIR, path });
    return uri;
  } catch {
    return null;
  }
}

export async function download(hash, voice = DEFAULT_VOICE) {
  if (!isNative() || !hash) return null;
  const url = audioUrl(hash, voice);
  if (!url) return null;

  const path = pathFor(hash, voice);
  await Filesystem.mkdir({
    directory: DIR,
    path: path.slice(0, path.lastIndexOf('/')),
    recursive: true,
  }).catch(() => {});
  const part = `${path}.part`;

  // Filesystem.downloadFile runs in native code, so it is not subject to the
  // WebView's CORS enforcement the way fetch() is, and it streams straight to
  // disk instead of carrying the file through JS as base64.
  await Filesystem.downloadFile({ url, directory: DIR, path: part, recursive: true });

  const st = await Filesystem.stat({ directory: DIR, path: part });
  if (!st || st.size < MIN_DOWNLOAD_BYTES) {
    await Filesystem.deleteFile({ directory: DIR, path: part }).catch(() => {});
    throw new Error(`audio download failed: response too small (${st?.size ?? 0} bytes)`);
  }

  await Filesystem.rename({ directory: DIR, from: part, to: path, toDirectory: DIR });

  const { uri } = await Filesystem.getUri({ directory: DIR, path });
  return uri;
}

// Keyed by hash, so a paragraph prefetched ahead of playback and then
// requested again by the player itself share one download instead of two
// racing writers landing on the same .part path. Cleared in the finally
// below so a failed attempt doesn't permanently poison later retries.
const inFlight = new Map();

// The caller's fallback is the device voice, so a failure here is a normal
// outcome rather than an error: it returns null and says nothing.
export async function ensure(hash, voice = DEFAULT_VOICE) {
  const have = await cachedUri(hash, voice);
  if (have) return have;

  // Keyed by the storage path rather than the hash: the two voices share a
  // hash for most paragraphs, and keying on it alone would let a male-voice
  // request join an in-flight female-voice download and receive its URI.
  const key = pathFor(hash, voice);
  let promise = inFlight.get(key);
  if (!promise) {
    promise = download(hash, voice).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
  }

  try {
    return await promise;
  } catch (err) {
    // The error dies here — the caller's contract is "null means speak it
    // instead" — so this is the only place the reason still exists. Whether a
    // download failed because the OS cut this process off from the network or
    // because the object is genuinely missing are two completely different
    // bugs, and without this line they look identical from the outside.
    recordAudioIssue({ phase: 'download', hash, voice, error: err?.message || String(err) });
    return null;
  }
}

// Drop one cached file. The caller is the player, after a file that passed
// cachedUri()'s size check still failed to decode: cachedUri() cannot tell a
// truncated or corrupt MP3 from a good one, so without this the paragraph
// would read in the device voice for the life of the install. Deleting it is
// the whole self-heal — the next attempt finds nothing cached and downloads
// again. A delete that itself fails is no worse than not trying.
export async function removeCached(hash, voice = DEFAULT_VOICE) {
  if (!isNative() || !hash) return;
  await Filesystem.deleteFile({ directory: DIR, path: pathFor(hash, voice) }).catch(() => {});
}

// readdir does not recurse, and the per-voice audio lives one level down.
// Walking whatever subdirectories are actually there — rather than a hardcoded
// list of voices — means a third voice added later is swept without anyone
// remembering to update this file. Without the recursion, Settings would
// report a cache size that ignores most of the cache and "clear cache" would
// leave most of it on disk.
async function cachedFiles(folder = FOLDER, depth = 1) {
  let out = [];
  let entries;
  try {
    ({ files: entries } = await Filesystem.readdir({ directory: DIR, path: folder }));
  } catch {
    return out; // nothing cached yet
  }
  for (const f of entries) {
    const path = `${folder}/${f.name}`;
    if (f.type === 'directory') {
      if (depth > 0) out = out.concat(await cachedFiles(path, depth - 1));
    } else {
      out.push({ path, size: f.size || 0 });
    }
  }
  return out;
}

// Which voice a cached file belongs to, read from where it sits rather than
// from a list of known voices — the same reason cachedFiles walks the tree
// instead of naming the subdirectories. objectPath puts the female voice at
// the root of the folder and every other voice in a subdirectory named after
// its code, so the first segment under FOLDER is either a hash (female) or a
// voice code. A third voice added later is counted and cleared correctly
// without this file changing.
function voiceOf(path) {
  const rest = path.slice(FOLDER.length + 1);
  const slash = rest.indexOf('/');
  return slash < 0 ? 'f' : rest.slice(0, slash);
}

export async function cacheBytes() {
  if (!isNative()) return 0;
  return (await cachedFiles()).reduce((total, f) => total + f.size, 0);
}

// { f: 12345, m: 67890 } — voices with nothing cached are absent rather than
// zero, so Settings can show a row per voice that actually has files without
// deciding which voices exist.
export async function cacheBytesByVoice() {
  if (!isNative()) return {};
  const out = {};
  for (const f of await cachedFiles()) {
    const v = voiceOf(f.path);
    out[v] = (out[v] || 0) + f.size;
  }
  return out;
}

// What the plugin's own ExoPlayer cache holds. The native queue fetches
// straight into it, so audio downloaded while the app was backgrounded is
// invisible to the folder this module manages — reporting only that folder
// would tell the listener their audio takes less room than it does.
export async function mediaCacheBytes() {
  if (!isNative()) return 0;
  try {
    const { bytes } = await NativeAudio.getMediaCacheBytes();
    return typeof bytes === 'number' ? bytes : 0;
  } catch {
    return 0;
  }
}

// Passing a voice clears only that voice's files. Someone who tried the other
// voice once and went back should be able to reclaim its megabytes without
// throwing away the hundreds of sections they actually listen to.
export async function clearCache(voice = null) {
  if (!isNative()) return;
  for (const f of await cachedFiles()) {
    if (voice && voiceOf(f.path) !== voice) continue;
    await Filesystem.deleteFile({ directory: DIR, path: f.path }).catch(() => {});
  }
  if (voice === null) {
    await Promise.resolve(NativeAudio.clearCache()).catch(() => {});
  }
}
