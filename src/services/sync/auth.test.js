import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInWithApple = vi.fn();
vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithApple },
}));
vi.mock('./firebase', () => ({ syncEnabledOnPlatform: () => true }));

const { signInWithApple: signIn } = await import('./auth');

beforeEach(() => { signInWithApple.mockReset(); });

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
