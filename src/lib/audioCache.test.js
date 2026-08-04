import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The plugin is a native bridge with no web implementation worth exercising,
// so it is mocked. What these tests pin is this module's decisions — when it
// writes, when it refuses, and what it returns — not Capacitor's behaviour.
const fs = {
  stat: vi.fn(),
  getUri: vi.fn(),
  writeFile: vi.fn(),
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
// module would never reach fetch() here. Mocking it is what lets these tests
// exercise the download path at all.
vi.mock('./audioManifest', () => ({
  audioUrl: (hash) => (hash ? `https://cdn.example/audio/${hash}.mp3` : null),
}));

const { cachedUri, download, ensure, cacheBytes, clearCache, removeCached } = await import('./audioCache');

const goNative = () => { global.window = { Capacitor: { isNativePlatform: () => true } }; };
const goWeb = () => { global.window = { Capacitor: { isNativePlatform: () => false } }; };

beforeEach(() => {
  for (const fn of Object.values(fs)) fn.mockReset();
  fs.mkdir.mockResolvedValue(undefined);
  fs.rename.mockResolvedValue(undefined);
  fs.getUri.mockResolvedValue({ uri: 'file:///data/audio/abc.mp3' });
  goNative();
});
afterEach(() => { delete global.window; vi.unstubAllGlobals(); });

describe('cachedUri', () => {
  it('returns the uri when the file is there', async () => {
    fs.stat.mockResolvedValue({ size: 1234 });
    expect(await cachedUri('abc')).toBe('file:///data/audio/abc.mp3');
  });

  it('returns null when the file is absent', async () => {
    fs.stat.mockRejectedValue(new Error('File does not exist'));
    expect(await cachedUri('abc')).toBe(null);
  });

  it('treats a zero-byte file as absent', async () => {
    // A write interrupted at the wrong moment leaves one of these. Handing it
    // to the player produces silence, and silence is the one outcome the
    // fallback chain exists to prevent.
    fs.stat.mockResolvedValue({ size: 0 });
    expect(await cachedUri('abc')).toBe(null);
  });

  it('returns null on web without touching the filesystem', async () => {
    goWeb();
    expect(await cachedUri('abc')).toBe(null);
    expect(fs.stat).not.toHaveBeenCalled();
  });
});

describe('download', () => {
  it('writes to a temporary name and renames only after the body is complete', async () => {
    // A half-written file under the real name is indistinguishable from a
    // good one, and cachedUri would hand it to the player forever. Renaming
    // last means the real name only ever appears on a finished file.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) })));
    await download('abc');
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile.mock.calls[0][0].path).toBe('audio/abc.mp3.part');
    expect(fs.rename).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'audio/abc.mp3.part', to: 'audio/abc.mp3' }),
    );
  });

  it('throws and writes nothing when the server says no', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(download('abc')).rejects.toThrow(/404/);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('refuses an empty body rather than caching silence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })));
    await expect(download('abc')).rejects.toThrow(/empty/);
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('reconstructs bytes across a chunk boundary without corruption', async () => {
    // The real rename test above uses 64 all-zero bytes, which never crosses
    // the 0x8000-byte chunk boundary in toBase64() and would hide an
    // off-by-one in the chunk loop even if one existed. Real MP3s run to
    // ~200 KB, well past that boundary, so this builds a buffer bigger than
    // one chunk with a non-repeating pattern and decodes writeFile's base64
    // argument back to bytes to prove the round trip is exact.
    const size = 0x8000 * 2 + 137; // multiple chunks plus a partial tail
    const buf = new ArrayBuffer(size);
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < size; i++) bytes[i] = (i * 7 + 13) & 0xff;

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => buf })));
    await download('abc');

    const written = fs.writeFile.mock.calls[0][0].data;
    const decoded = Buffer.from(written, 'base64');
    expect(decoded.length).toBe(size);
    expect(new Uint8Array(decoded)).toEqual(bytes);
  });
});

describe('ensure', () => {
  it('does not download what is already cached', async () => {
    fs.stat.mockResolvedValue({ size: 1234 });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await ensure('abc')).toBe('file:///data/audio/abc.mp3');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when the download fails', async () => {
    // The caller's next move is the device voice. An exception here would
    // reach the play loop, which treats a rejection as "canceled" and stops.
    fs.stat.mockRejectedValue(new Error('missing'));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await ensure('abc')).toBe(null);
  });

  it('shares one download between concurrent calls for the same hash', async () => {
    // Prefetching the next paragraph while the current one plays means
    // playback can call ensure() for a hash whose prefetch is still in
    // flight. Without sharing, both writers target the same .part path and
    // one rename can land the other's partial bytes under the real name.
    fs.stat.mockRejectedValue(new Error('missing'));
    const fetchSpy = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) }));
    vi.stubGlobal('fetch', fetchSpy);

    const [a, b] = await Promise.all([ensure('same'), ensure('same')]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(a).toBe('file:///data/audio/abc.mp3');
    expect(b).toBe('file:///data/audio/abc.mp3');
  });

  it('retries on a later call after a shared download fails', async () => {
    // The in-flight entry must be removed when the download settles, success
    // or failure, or one bad attempt would permanently poison every retry.
    fs.stat.mockRejectedValue(new Error('missing'));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    const [a, b] = await Promise.all([ensure('retry'), ensure('retry')]);
    expect(a).toBe(null);
    expect(b).toBe(null);
    expect(fs.writeFile).not.toHaveBeenCalled();

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) })));
    const result = await ensure('retry');
    expect(result).toBe('file:///data/audio/abc.mp3');
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });

  it('runs concurrent downloads for different hashes independently', async () => {
    fs.stat.mockRejectedValue(new Error('missing'));
    const fetchSpy = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) }));
    vi.stubGlobal('fetch', fetchSpy);

    const [a, b] = await Promise.all([ensure('one'), ensure('two')]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(a).toBe('file:///data/audio/abc.mp3');
    expect(b).toBe('file:///data/audio/abc.mp3');
  });
});

describe('removeCached', () => {
  it('deletes exactly the one file, so the next ensure() re-downloads it', async () => {
    // The self-heal for a file that passed the size check and still would not
    // decode. Without it that paragraph is stuck on the device voice forever.
    fs.deleteFile.mockResolvedValue(undefined);
    await removeCached('abc');
    expect(fs.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'audio/abc.mp3' }),
    );
    expect(fs.deleteFile).toHaveBeenCalledTimes(1);
  });

  it('does not reject when the file is already gone', async () => {
    // The caller is mid-fallback and about to start speaking. A rejection here
    // would surface as a play-loop error, which the loop reads as a stop.
    fs.deleteFile.mockRejectedValue(new Error('File does not exist'));
    await expect(removeCached('abc')).resolves.toBeUndefined();
  });

  it('does nothing on web and with no hash', async () => {
    goWeb();
    await removeCached('abc');
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
