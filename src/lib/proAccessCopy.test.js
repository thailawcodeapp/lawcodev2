import { describe, it, expect } from 'vitest';
import { gateContentFor } from './proAccessCopy';

describe('gateContentFor', () => {
  it('tells a genuinely free user to buy Pro, with feature-specific copy', () => {
    const c = gateContentFor('free', 'folder');
    expect(c.kind).toBe('buy');
    expect(c.title).toContain('โฟลเดอร์');
  });

  it('gives each feature its own buy-Pro copy, not one generic message', () => {
    const folder = gateContentFor('free', 'folder');
    const highlight = gateContentFor('free', 'highlight');
    const bookmark = gateContentFor('free', 'bookmark');
    const listen = gateContentFor('free', 'listen');
    const titles = new Set([folder.title, highlight.title, bookmark.title, listen.title]);
    expect(titles.size).toBe(4);
  });

  it('tells a subscriber who has not signed in to sign in, not to buy Pro again', () => {
    // This is the whole point of the plan: someone who already paid must
    // never be told to buy Pro a second time.
    const c = gateContentFor('needs-signin', 'folder');
    expect(c.kind).toBe('signin');
    expect(c.title).not.toContain('ฟีเจอร์ Pro');
    expect(c.body).not.toMatch(/ซื้อ|สมัคร/); // never says "buy" / "subscribe"
  });

  it('tells a subscriber over the device cap to manage devices, not to sign in again', () => {
    const c = gateContentFor('needs-device-slot', 'listen');
    expect(c.kind).toBe('device-slot');
    expect(c.body).toMatch(/อุปกรณ์/); // mentions devices
  });

  it('is feature-agnostic once the blocker is signin or device-slot', () => {
    const a = gateContentFor('needs-signin', 'folder');
    const b = gateContentFor('needs-signin', 'listen');
    expect(a).toEqual(b);
  });

  it('returns null for pro and loading — nothing should be gated', () => {
    expect(gateContentFor('pro', 'folder')).toBe(null);
    expect(gateContentFor('loading', 'folder')).toBe(null);
  });
});
