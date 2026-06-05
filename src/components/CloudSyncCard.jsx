// Settings card for the cloud sync feature. Renders one of four states:
//
//   • Free user (!playStoreActive)          → not rendered at all (caller skips)
//   • Pro, not signed in                    → "Sign in with Google" CTA
//   • Pro, signed in, device limit reached  → device list + revoke buttons
//   • Pro, signed in, allowed               → "PRO active" + device count + sign-out
//
// All behind ENABLE_AUTH_GATE — caller already checks the flag before rendering.

import { useState } from 'react';
import { useEffectivePro } from '../hooks/useEffectivePro';
import { signInWithGoogle, signOut } from '../services/sync/auth';
import { forcePush, pullAndMerge } from '../services/sync/orchestrator';
import { DEVICE_LIMIT } from '../config';

function relativeTime(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'เมื่อสักครู่';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + ' นาทีที่แล้ว';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + ' ชั่วโมงที่แล้ว';
  return Math.floor(diff / 86_400_000) + ' วันที่แล้ว';
}

export default function CloudSyncCard() {
  const { state, user, devices, myDeviceId, revokeDevice } = useEffectivePro();
  const [busy, setBusy] = useState(null); // 'signin' | 'signout' | 'sync' | 'revoke'
  const [msg, setMsg]   = useState('');

  const handleSignIn = async () => {
    setBusy('signin'); setMsg('');
    const r = await signInWithGoogle();
    setBusy(null);
    if (!r.ok) setMsg(r.error || 'เข้าสู่ระบบไม่สำเร็จ');
  };

  const handleSignOut = async () => {
    setBusy('signout');
    await signOut();
    setBusy(null);
  };

  const handleSync = async () => {
    if (!user?.uid) return;
    setBusy('sync'); setMsg('');
    await pullAndMerge(user.uid, user);
    const r = await forcePush(user.uid);
    setBusy(null);
    setMsg(r.ok ? 'ซิงก์เรียบร้อย' : (r.error || 'ซิงก์ไม่สำเร็จ'));
    setTimeout(() => setMsg(''), 3000);
  };

  const handleRevoke = async (deviceId) => {
    if (deviceId === myDeviceId) return;
    if (!confirm('ยกเลิกการใช้งานอุปกรณ์นี้?')) return;
    setBusy('revoke');
    await revokeDevice(deviceId);
    setBusy(null);
  };

  // STATE 1: Pro purchased, not signed in
  if (state === 'needs-signin') {
    return (
      <div className="my-3 border border-rule dark:border-ink-soft rounded-lg p-3.5">
        <div className="font-display text-[15px] font-medium italic">Pro รอเปิดใช้งาน</div>
        <div className="font-serif text-[12px] italic text-ink-soft dark:text-rule-soft mt-0.5 leading-snug">
          เข้าสู่ระบบ Google เพื่อเปิดใช้ฟีเจอร์ Pro และซิงก์ข้อมูลข้ามเครื่อง
        </div>
        <button
          disabled={busy === 'signin'}
          onClick={handleSignIn}
          className="mt-3 w-full font-ui text-[12px] font-bold py-2.5 rounded-lg bg-accent text-paper disabled:opacity-50"
        >
          {busy === 'signin' ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบด้วย Google'}
        </button>
        {msg && <div className="mt-2 font-ui text-[10px] text-accent">{msg}</div>}
      </div>
    );
  }

  // STATE 2: Pro purchased + signed in but over device limit
  if (state === 'needs-device-slot') {
    return (
      <div className="my-3 border-2 border-accent rounded-lg p-3.5">
        <div className="font-display text-[15px] font-medium italic text-accent">
          เกินจำนวนเครื่อง {devices.length}/{DEVICE_LIMIT}
        </div>
        <div className="font-serif text-[12px] italic text-ink-soft dark:text-rule-soft mt-0.5 leading-snug">
          Pro จำกัด {DEVICE_LIMIT} เครื่องต่อบัญชี — เลือกยกเลิกเครื่องเก่าเพื่อใช้บนเครื่องนี้
        </div>
        <div className="mt-3 space-y-1.5">
          {devices.map(d => (
            <div key={d.id} className="flex items-center gap-2 py-2 px-2 rounded border border-rule-soft dark:border-ink-soft">
              <div className="flex-1 min-w-0">
                <div className="font-display text-[13px] truncate">
                  {d.name || 'อุปกรณ์'} {d.id === myDeviceId && <span className="text-accent text-[10px]">· เครื่องนี้</span>}
                </div>
                <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">
                  ใช้ล่าสุด {relativeTime(d.lastSeen)}
                </div>
              </div>
              {d.id !== myDeviceId && (
                <button
                  disabled={busy === 'revoke'}
                  onClick={() => handleRevoke(d.id)}
                  className="font-ui text-[10px] font-bold text-accent disabled:opacity-50"
                >
                  ยกเลิก
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // STATE 3: Pro active (all checks passed)
  if (state === 'pro') {
    return (
      <div className="my-3 border border-ochre rounded-lg p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-display text-[13px] italic text-ochre">Pro · ใช้งานอยู่</div>
            <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">
              {user?.email || ''} · {devices.length}/{DEVICE_LIMIT} เครื่อง
            </div>
          </div>
          <button
            disabled={busy === 'sync'}
            onClick={handleSync}
            className="font-ui text-[10px] font-bold px-2.5 py-1.5 rounded-md border border-ochre text-ochre disabled:opacity-50"
          >
            {busy === 'sync' ? '…' : 'ซิงก์'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {devices.map(d => (
            <div key={d.id} className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">
              {d.name}{d.id === myDeviceId ? ' (เครื่องนี้)' : ''}
              {d.id !== myDeviceId && (
                <button onClick={() => handleRevoke(d.id)} className="ml-1 text-accent underline">ยกเลิก</button>
              )}
            </div>
          ))}
        </div>
        <button
          disabled={busy === 'signout'}
          onClick={handleSignOut}
          className="mt-2 font-ui text-[10px] text-ink-soft dark:text-rule-soft underline disabled:opacity-50"
        >
          ออกจากระบบ
        </button>
        {msg && <div className="mt-1.5 font-ui text-[10px] text-accent">{msg}</div>}
      </div>
    );
  }

  return null;
}
