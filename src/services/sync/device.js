// Device identification + registration.
//
// We use @capacitor/device's identifier (Android ID on Android, identifierForVendor
// on iOS) as the primary device ID. On the unsupported web fallback we generate
// a UUID and persist it in localStorage so repeat visits look like the same device.

import { Device } from '@capacitor/device';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { DEVICE_LIMIT, DEVICE_INACTIVE_DAYS } from '../../config';
import { syncEnabledOnPlatform } from './firebase';

const LOCAL_ID_KEY = 'lawcode-th-device-id';

let cachedId = null;
let cachedName = null;

function fallbackUuid() {
  // RFC4122 v4 — used only when Capacitor Device can't give us an ID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getDeviceId() {
  if (cachedId) return cachedId;
  try {
    const { identifier } = await Device.getId();
    if (identifier) {
      cachedId = identifier;
      return cachedId;
    }
  } catch {}
  // Web fallback (or rare native failure)
  let stored = null;
  try { stored = localStorage.getItem(LOCAL_ID_KEY); } catch {}
  if (!stored) {
    stored = 'web-' + fallbackUuid();
    try { localStorage.setItem(LOCAL_ID_KEY, stored); } catch {}
  }
  cachedId = stored;
  return cachedId;
}

export async function getDeviceName() {
  if (cachedName) return cachedName;
  try {
    const info = await Device.getInfo();
    cachedName = [info.manufacturer, info.model].filter(Boolean).join(' ') || info.platform || 'Device';
  } catch {
    cachedName = 'Device';
  }
  return cachedName;
}

export async function getDeviceInfo() {
  const [id, name] = await Promise.all([getDeviceId(), getDeviceName()]);
  let platform = 'unknown';
  try {
    const info = await Device.getInfo();
    platform = info.platform || 'unknown';
  } catch {}
  return { id, name, platform };
}

// Register the current device under the signed-in user. Updates lastSeen and,
// for new entries, firstSeen. Safe to call repeatedly.
export async function registerDevice(uid) {
  if (!syncEnabledOnPlatform() || !uid) return { ok: false };
  const { id, name, platform } = await getDeviceInfo();
  try {
    const docPath = `users/${uid}/devices/${id}`;
    // Read existing to preserve firstSeen.
    let firstSeen = Date.now();
    try {
      const got = await FirebaseFirestore.getDocument({ reference: docPath });
      if (got?.snapshot?.data?.firstSeen) {
        firstSeen = got.snapshot.data.firstSeen;
      }
    } catch {}
    await FirebaseFirestore.setDocument({
      reference: docPath,
      data: { name, platform, firstSeen, lastSeen: Date.now() },
      merge: true,
    });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// Cached device count — lets the sync orchestrator decide whether to sync
// at all without spending Firestore reads. Updated on every listDevices().
const DEVICE_COUNT_KEY = 'lawcode-th-sync-device-count';

export function getCachedDeviceCount() {
  try { return Number(localStorage.getItem(DEVICE_COUNT_KEY)) || 0; }
  catch { return 0; }
}

function setCachedDeviceCount(n) {
  try { localStorage.setItem(DEVICE_COUNT_KEY, String(n)); } catch {}
}

// List all devices registered to this user.
export async function listDevices(uid) {
  if (!syncEnabledOnPlatform() || !uid) return [];
  try {
    const res = await FirebaseFirestore.getCollection({
      reference: `users/${uid}/devices`,
    });
    const devices = (res?.snapshots || []).map(s => ({
      id: s.id,
      ...(s.data || {}),
    }));
    setCachedDeviceCount(devices.length);
    return devices;
  } catch {
    return [];
  }
}

// Remove a device from the user's allowlist. Used by the "revoke" button
// in Settings when the user wants to free up a slot.
export async function revokeDevice(uid, deviceId) {
  if (!syncEnabledOnPlatform() || !uid || !deviceId) return { ok: false };
  try {
    await FirebaseFirestore.deleteDocument({
      reference: `users/${uid}/devices/${deviceId}`,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// Decide whether THIS device is currently allowed for Pro access.
// Rule: at most DEVICE_LIMIT devices considered "active" in the last
// DEVICE_INACTIVE_DAYS window. Devices outside that window don't count.
// The current device always counts as itself; other devices are sorted by
// lastSeen and the most recent DEVICE_LIMIT win the slots.
export async function isDeviceAllowed(uid) {
  if (!syncEnabledOnPlatform() || !uid) return false;
  const myId = await getDeviceId();
  const all = await listDevices(uid);
  const cutoff = Date.now() - DEVICE_INACTIVE_DAYS * 24 * 60 * 60 * 1000;

  // Treat the current device as "just seen" even if registerDevice hasn't
  // landed yet, so we don't accidentally lock out a freshly-signed-in user.
  const known = all.map(d => d.id === myId ? { ...d, lastSeen: Date.now() } : d);
  if (!known.some(d => d.id === myId)) {
    known.push({ id: myId, lastSeen: Date.now() });
  }

  const active = known
    .filter(d => (d.lastSeen || 0) >= cutoff)
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

  const allowed = active.slice(0, DEVICE_LIMIT);
  return allowed.some(d => d.id === myId);
}
