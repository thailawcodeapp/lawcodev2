import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInWithApple = vi.fn();
const signInWithGoogle = vi.fn();
vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithApple, signInWithGoogle },
}));
vi.mock('./firebase', () => ({ syncEnabledOnPlatform: () => true }));

// Fake @capacitor/app: records listeners so tests can fire pause/resume.
const appListeners = new Map(); // event -> Set<fn>
const removeListener = vi.fn();
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event, fn) => {
      if (!appListeners.has(event)) appListeners.set(event, new Set());
      appListeners.get(event).add(fn);
      return Promise.resolve({
        remove: () => { removeListener(event); appListeners.get(event).delete(fn); },
      });
    },
  },
}));
const fireApp = (event) => appListeners.get(event)?.forEach((fn) => fn());
const liveListenerCount = () =>
  [...appListeners.values()].reduce((n, s) => n + s.size, 0);

const {
  signInWithApple: signIn,
  signInWithGoogle: signInGoogle,
  SIGN_IN_STALL_MS,
  SIGN_IN_STALLED,
} = await import('./auth');

beforeEach(() => {
  signInWithApple.mockReset();
  signInWithGoogle.mockReset();
  removeListener.mockReset();
  appListeners.clear();
  vi.useRealTimers();
});

describe('signInWithGoogle', () => {
  it('uses Credential Manager and returns the user when it succeeds', async () => {
    signInWithGoogle.mockResolvedValue({ user: { uid: 'g1' } });
    const r = await signInGoogle();
    expect(r).toEqual({ ok: true, user: { uid: 'g1' } });
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(signInWithGoogle).toHaveBeenCalledWith();
  });

  it('falls back to the classic picker when Credential Manager has no credentials', async () => {
    signInWithGoogle
      .mockRejectedValueOnce(new Error('No credentials available'))
      .mockResolvedValueOnce({ user: { uid: 'g2' } });
    const r = await signInGoogle();
    expect(r).toEqual({ ok: true, user: { uid: 'g2' } });
    expect(signInWithGoogle).toHaveBeenNthCalledWith(2, { useCredentialManager: false });
  });

  it('does not fall back when the user cancels the sheet', async () => {
    signInWithGoogle.mockRejectedValue(new Error('activity is cancelled by the user.'));
    const r = await signInGoogle();
    expect(r).toEqual({ ok: false, error: 'activity is cancelled by the user.' });
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('reports the fallback error when the classic picker also fails', async () => {
    signInWithGoogle
      .mockRejectedValueOnce(new Error('No credentials available'))
      .mockRejectedValueOnce(new Error('12501: '));
    const r = await signInGoogle();
    expect(r).toEqual({ ok: false, error: '12501: ' });
  });

  it('gives up with SIGN_IN_STALLED when the native call never answers', async () => {
    vi.useFakeTimers();
    signInWithGoogle.mockReturnValue(new Promise(() => {}));
    const p = signInGoogle();
    await vi.advanceTimersByTimeAsync(SIGN_IN_STALL_MS);
    expect(await p).toEqual({ ok: false, error: SIGN_IN_STALLED });
  });

  it('does not time out while Google UI has our app paused', async () => {
    vi.useFakeTimers();
    let answer;
    signInWithGoogle.mockReturnValue(new Promise((res) => { answer = res; }));
    let result = null;
    signInGoogle().then((r) => { result = r; });
    await vi.advanceTimersByTimeAsync(1);
    fireApp('pause'); // Google's sheet / sign-in page opens over us
    await vi.advanceTimersByTimeAsync(SIGN_IN_STALL_MS * 5);
    expect(result).toBeNull();
    fireApp('resume');
    answer({ user: { uid: 'g3' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({ ok: true, user: { uid: 'g3' } });
  });

  it('restarts the clock on resume and times out if nothing follows', async () => {
    vi.useFakeTimers();
    signInWithGoogle.mockReturnValue(new Promise(() => {}));
    let result = null;
    signInGoogle().then((r) => { result = r; });
    await vi.advanceTimersByTimeAsync(1);
    fireApp('pause');
    await vi.advanceTimersByTimeAsync(SIGN_IN_STALL_MS * 2);
    fireApp('resume');
    await vi.advanceTimersByTimeAsync(SIGN_IN_STALL_MS - 1);
    expect(result).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ ok: false, error: SIGN_IN_STALLED });
  });

  it('removes its pause/resume listeners once settled', async () => {
    signInWithGoogle.mockResolvedValue({ user: { uid: 'g4' } });
    await signInGoogle();
    await Promise.resolve();
    expect(liveListenerCount()).toBe(0);
  });
});

describe('signInWithApple', () => {
  it('returns ok + the signed-in user on success', async () => {
    signInWithApple.mockResolvedValue({ user: { uid: 'u1', email: 'a@b.com' } });
    const r = await signIn();
    expect(r).toEqual({ ok: true, user: { uid: 'u1', email: 'a@b.com' } });
  });

  it('returns ok with a null user rather than throwing when the plugin gives none', async () => {
    signInWithApple.mockResolvedValue({});
    const r = await signIn();
    expect(r).toEqual({ ok: true, user: null });
  });

  it('returns ok:false with the error message when the native call rejects', async () => {
    // The most common case in practice: the user cancels the system sheet.
    signInWithApple.mockRejectedValue(new Error('User canceled'));
    const r = await signIn();
    expect(r.ok).toBe(false);
    expect(r.error).toBe('User canceled');
  });
});

describe('signInWithApple when sync is unavailable on this platform', () => {
  it('short-circuits without calling the native plugin', async () => {
    vi.resetModules();
    vi.doMock('./firebase', () => ({ syncEnabledOnPlatform: () => false }));
    const { signInWithApple: signInDisabled } = await import('./auth');
    const r = await signInDisabled();
    expect(r.ok).toBe(false);
    expect(signInWithApple).not.toHaveBeenCalled();
  });
});
