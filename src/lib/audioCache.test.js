import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The plugin is a native bridge with no web implementation worth exercising,
// so it is mocked. What these tests pin is this module's decisions — when it
// writes, when it refuses, and what it returns — not Capacitor's behaviour.
const fs = {
  stat: vi.fn(),
  getUri: vi.fn(),
  downloadFile: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
  deleteFile: vi.fn(),
  readdir: vi.fn(),
};
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: fs,
  Directory: { Cache: 'CACHE' },
}));

// audioUrl() returns null while AUDIO_BASE_URL is '', which it is and must
// remain until the release task sets it. download() checks that URL and
// returns early when there is none — correct behaviour, and it means the real
// module would never reach downloadFile() here. Mocking it is what lets these
// tests exercise the download path at all.
//
// objectPath and DEFAULT_VOICE are reproduced rather than stubbed loosely,
// because the per-voice prefix is the thing most of these tests are about:
// the two voices share a hash for three quarters of the corpus, so a cache
// that ignored the prefix would return the wrong voice's file.
vi.mock('./audioManifest', () => {
  const objectPath = (hash, voice = 'm') =>
    (voice === 'f' ? `audio/${hash}.mp3` : `audio/${voice}/${hash}.mp3`);
  return {
    DEFAULT_VOICE: 'm',
    objectPath,
    audioUrl: (hash, voice = 'm') =>
      (hash ? `https://cdn.example/${objectPath(hash, voice)}` : null),
  };
});

const { cachedUri, download, ensure, cacheBytes, cacheBytesByVoice, clearCache, removeCached } = await import('./audioCache');

const goNative = () => { global.window = { Capacitor: { isNativePlatform: () => true } }; };
const goWeb = () => { global.window = { Capacitor: { isNativePlatform: () => false } }; };

// download() calls Filesystem.stat twice in a full ensure() flow: once via
// cachedUri() on the real name (which must miss, or download would never be
// attempted), and once on the .part file after downloadFile() to size-check
// it. This gives each call the right answer based on which path it asked
// about, instead of relying on call order.
const statImpl = (partSize = 2048) => (opts) =>
  opts.path.endsWith('.part') ? Promise.resolve({ size: partSize }) : Promise.reject(new Error('missing'));

beforeEach(() => {
  for (const fn of Object.values(fs)) fn.mockReset();
  fs.mkdir.mockResolvedValue(undefined);
  fs.rename.mockResolvedValue(undefined);
  fs.deleteFile.mockResolvedValue(undefined);
  fs.getUri.mockResolvedValue({ uri: 'file:///data/audio/abc.mp3' });
  goNative();
});
afterEach(() => { delete global.window; vi.unstubAllGlobals(); });

describe('cachedUri', () => {
  it('returns the uri when the file is there', async () => {
    fs.stat.mockResolvedValue({ size: 1234 });
    expect(await cachedUri('abc', 'f')).toBe('file:///data/audio/abc.mp3');
  });

  it('returns null when the file is absent', async () => {
    fs.stat.mockRejectedValue(new Error('File does not exist'));
    expect(await cachedUri('abc', 'f')).toBe(null);
  });

  it('treats a zero-byte file as absent', async () => {
    // A write interrupted at the wrong moment leaves one of these. Handing it
    // to the player produces silence, and silence is the one outcome the
    // fallback chain exists to prevent.
    fs.stat.mockResolvedValue({ size: 0 });
    expect(await cachedUri('abc', 'f')).toBe(null);
  });

  it('returns null on web without touching the filesystem', async () => {
    goWeb();
    expect(await cachedUri('abc', 'f')).toBe(null);
    expect(fs.stat).not.toHaveBeenCalled();
  });
});

describe('download', () => {
  it('writes to a temporary name and renames only after the download completes', async () => {
    // A half-written file under the real name is indistinguishable from a
    // good one, and cachedUri would hand it to the player forever. Renaming
    // last means the real name only ever appears on a finished file.
    fs.downloadFile.mockResolvedValue({ path: 'audio/abc.mp3.part' });
    fs.stat.mockImplementation(statImpl());

    await download('abc', 'f');

    expect(fs.downloadFile).toHaveBeenCalledTimes(1);
    expect(fs.downloadFile.mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'audio/abc.mp3.part', url: 'https://cdn.example/audio/abc.mp3' }),
    );
    expect(fs.rename).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'audio/abc.mp3.part', to: 'audio/abc.mp3' }),
    );
  });

  it('returns the uri on success', async () => {
    fs.downloadFile.mockResolvedValue({ path: 'audio/abc.mp3.part' });
    fs.stat.mockImplementation(statImpl());
    expect(await download('abc', 'f')).toBe('file:///data/audio/abc.mp3');
  });

  it('throws when the underlying download fails, and renames nothing', async () => {
    fs.downloadFile.mockRejectedValue(new Error('network error'));
    await expect(download('abc', 'f')).rejects.toThrow(/network error/);
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('rejects a .part file under 1024 bytes, deletes it, and does not rename', async () => {
    // R2's error response for a missing object or an expired signed URL is a
    // small XML document, not audio, and downloadFile has no way to tell
    // that from a real clip -- it writes whatever the server sent. Every
    // real clip in this corpus is far larger: the shortest paragraph is five
    // characters of text and still runs to several kilobytes of MP3, so this
    // floor cannot reject a genuine download.
    fs.downloadFile.mockResolvedValue({ path: 'audio/abc.mp3.part' });
    fs.stat.mockImplementation(statImpl(200));

    await expect(download('abc', 'f')).rejects.toThrow(/too small/);
    expect(fs.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'audio/abc.mp3.part' }),
    );
    expect(fs.rename).not.toHaveBeenCalled();
  });
});

describe('ensure', () => {
  it('does not download what is already cached', async () => {
    fs.stat.mockResolvedValue({ size: 1234 });
    expect(await ensure('abc', 'f')).toBe('file:///data/audio/abc.mp3');
    expect(fs.downloadFile).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when the download fails', async () => {
    // The caller's next move is the device voice. An exception here would
    // reach the play loop, which treats a rejection as "canceled" and stops.
    fs.stat.mockRejectedValue(new Error('missing'));
    fs.downloadFile.mockRejectedValue(new Error('offline'));
    expect(await ensure('abc', 'f')).toBe(null);
  });

  it('shares one download between concurrent calls for the same hash', async () => {
    // Prefetching the next paragraph while the current one plays means
    // playback can call ensure() for a hash whose prefetch is still in
    // flight. Without sharing, both writers target the same .part path and
    // one rename can land the other's partial bytes under the real name.
    fs.stat.mockImplementation(statImpl());
    fs.downloadFile.mockResolvedValue({ path: 'audio/same.mp3.part' });

    const [a, b] = await Promise.all([ensure('same', 'f'), ensure('same', 'f')]);

    expect(fs.downloadFile).toHaveBeenCalledTimes(1);
    expect(fs.rename).toHaveBeenCalledTimes(1);
    expect(a).toBe('file:///data/audio/abc.mp3');
    expect(b).toBe('file:///data/audio/abc.mp3');
  });

  it('retries on a later call after a shared download fails', async () => {
    // The in-flight entry must be removed when the download settles, success
    // or failure, or one bad attempt would permanently poison every retry.
    fs.stat.mockRejectedValue(new Error('missing'));
    fs.downloadFile.mockRejectedValue(new Error('offline'));

    const [a, b] = await Promise.all([ensure('retry', 'f'), ensure('retry', 'f')]);
    expect(a).toBe(null);
    expect(b).toBe(null);
    expect(fs.rename).not.toHaveBeenCalled();

    fs.stat.mockImplementation(statImpl());
    fs.downloadFile.mockResolvedValue({ path: 'audio/retry.mp3.part' });
    const result = await ensure('retry', 'f');
    expect(result).toBe('file:///data/audio/abc.mp3');
    expect(fs.rename).toHaveBeenCalledTimes(1);
  });

  it('runs concurrent downloads for different hashes independently', async () => {
    fs.stat.mockImplementation(statImpl());
    fs.downloadFile.mockResolvedValue({ path: 'audio/ignored.part' });

    const [a, b] = await Promise.all([ensure('one', 'f'), ensure('two', 'f')]);

    expect(fs.downloadFile).toHaveBeenCalledTimes(2);
    expect(fs.rename).toHaveBeenCalledTimes(2);
    expect(a).toBe('file:///data/audio/abc.mp3');
    expect(b).toBe('file:///data/audio/abc.mp3');
  });
});

describe('removeCached', () => {
  it('deletes exactly the one file, so the next ensure() re-downloads it', async () => {
    // The self-heal for a file that passed the size check and still would not
    // decode. Without it that paragraph is stuck on the device voice forever.
    fs.deleteFile.mockResolvedValue(undefined);
    await removeCached('abc', 'f');
    expect(fs.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'audio/abc.mp3' }),
    );
    expect(fs.deleteFile).toHaveBeenCalledTimes(1);
  });

  it('does not reject when the file is already gone', async () => {
    // The caller is mid-fallback and about to start speaking. A rejection here
    // would surface as a play-loop error, which the loop reads as a stop.
    fs.deleteFile.mockRejectedValue(new Error('File does not exist'));
    await expect(removeCached('abc', 'f')).resolves.toBeUndefined();
  });

  it('does nothing on web and with no hash', async () => {
    goWeb();
    await removeCached('abc', 'f');
    goNative();
    await removeCached(null);
    expect(fs.deleteFile).not.toHaveBeenCalled();
  });
});

describe('cacheBytes and clearCache', () => {
  it('adds up what is stored', async () => {
    fs.readdir.mockResolvedValue({ files: [{ name: 'a.mp3', size: 100 }, { name: 'b.mp3', size: 250 }] });
    expect(await cacheBytes()).toBe(350);
  });

  it('reports zero when nothing has been cached yet', async () => {
    fs.readdir.mockRejectedValue(new Error('does not exist'));
    expect(await cacheBytes()).toBe(0);
  });

  it('deletes every cached file', async () => {
    fs.readdir.mockResolvedValue({ files: [{ name: 'a.mp3', size: 1 }, { name: 'b.mp3', size: 1 }] });
    fs.deleteFile.mockResolvedValue(undefined);
    await clearCache();
    expect(fs.deleteFile).toHaveBeenCalledTimes(2);
  });
});

// The female voice's files sit at the root of the folder and every other
// voice's in a subdirectory named after its code, so which voice a file
// belongs to is read from its path rather than from a list. These pin that,
// because getting it wrong shows the wrong megabytes against a voice and —
// worse — deletes the wrong voice's audio.
describe('per-voice storage', () => {
  const twoVoices = (path) => (path === 'audio'
    ? { files: [{ name: 'a.mp3', size: 100 }, { name: 'm', type: 'directory' }] }
    : { files: [{ name: 'c.mp3', size: 30 }, { name: 'd.mp3', size: 70 }] });

  beforeEach(() => {
    fs.readdir.mockImplementation(({ path }) => Promise.resolve(twoVoices(path)));
    fs.deleteFile.mockResolvedValue(undefined);
  });

  it('attributes a root file to the female voice and a subdirectory to its code', async () => {
    expect(await cacheBytesByVoice()).toEqual({ f: 100, m: 100 });
  });

  it('leaves a voice out entirely rather than reporting it as zero', async () => {
    fs.readdir.mockResolvedValue({ files: [{ name: 'a.mp3', size: 100 }] });
    expect(await cacheBytesByVoice()).toEqual({ f: 100 });
  });

  it('clears only the named voice', async () => {
    await clearCache('m');
    expect(fs.deleteFile).toHaveBeenCalledTimes(2);
    for (const call of fs.deleteFile.mock.calls) {
      expect(call[0].path).toMatch(/^audio\/m\//);
    }
  });

  it('still clears everything when no voice is named', async () => {
    await clearCache();
    expect(fs.deleteFile).toHaveBeenCalledTimes(3);
  });
});
