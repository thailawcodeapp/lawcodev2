import { useState } from 'react';
import { useApp } from '../context/AppContext';
import TabBar from '../components/TabBar';
import { buyPro, restorePurchases, getPriceString } from '../lib/iap';

function Toggle({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex-shrink-0"
      aria-label={on ? 'Turn off' : 'Turn on'}
    >
      <div
        className="w-10 h-6 rounded-full p-0.5 flex transition-colors duration-200"
        style={{
          background: on ? '#a93225' : '#bdb19a',
          justifyContent: on ? 'flex-end' : 'flex-start',
        }}
      >
        <div className="w-5 h-5 rounded-full bg-paper dark:bg-dark-bg shadow-sm" />
      </div>
    </button>
  );
}

function Group({ title, children }) {
  return (
    <div className="mb-2 border-t border-rule dark:border-ink-soft">
      <div className="flex items-baseline gap-3 pt-3 pb-1.5">
        <div className="font-display text-[17px] font-medium" style={{ letterSpacing: -0.2 }}>
          {title}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, value, toggle, onToggle }) {
  return (
    <div
      className="flex items-center justify-between py-2.5 pl-4"
      style={{ borderTop: '1px dotted #bdb19a' }}
    >
      <div className="font-serif text-[14px] text-ink dark:text-paper">{label}</div>
      {toggle !== undefined ? (
        <Toggle on={toggle} onToggle={onToggle} />
      ) : (
        <div className="font-display text-[13px] italic text-ink-soft dark:text-rule-soft">{value}</div>
      )}
    </div>
  );
}

const FONT_SCALES = ['S', 'M', 'L', 'XL'];

export default function SettingsScreen() {
  const { settings, setSettings } = useApp();
  const [busy, setBusy] = useState(null); // 'buy' | 'restore' | null
  const [iapMsg, setIapMsg] = useState('');
  const [versionTaps, setVersionTaps] = useState(0);
  const [devMsg, setDevMsg] = useState('');

  // Hidden shortcuts for review / testing:
  //   Tap version label 5×  → force Free mode (for ad testing)
  //   Tap version label 10× → unlock Pro  (for reviewer / QA)
  const handleVersionTap = () => {
    setVersionTaps(prev => {
      const next = prev + 1;
      if (next >= 10) {
        setSettings(s => ({ ...s, isPro: true }));
        setDevMsg('✅ Pro ปลดล็อกแล้ว (ทดสอบ)');
        setTimeout(() => setDevMsg(''), 3000);
        return 0;
      }
      if (next >= 5) {
        setSettings(s => ({ ...s, isPro: false }));
        setDevMsg('🔓 โหมดฟรี (ทดสอบ)');
        setTimeout(() => setDevMsg(''), 3000);
        return next; // continue counting toward 10
      }
      return next;
    });
  };

  const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));
  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const price = getPriceString();

  const handleBuy = async () => {
    if (busy) return;
    setBusy('buy');
    setIapMsg('');
    const res = await buyPro();
    setBusy(null);
    if (res.ok && res.dev) {
      // Web dev fallback — flip the flag locally
      update('isPro', true);
    } else if (!res.ok && res.error) {
      setIapMsg(res.error);
    }
    // Real purchases flip isPro via the IAP listener in App.jsx
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy('restore');
    setIapMsg('');
    const res = await restorePurchases();
    setBusy(null);
    if (!res.ok && res.error) setIapMsg(res.error);
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-3.5 pb-3 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-accent">
          ตั้งค่า
        </div>
        <div
          className="font-display font-light leading-none mt-1"
          style={{ fontSize: 38, letterSpacing: -1, lineHeight: 0.9 }}
        >
          ปรับ<span className="italic">แต่ง</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5">

          {/* Pro upgrade banner */}
          {!settings.isPro && (
            <div className="my-3 border border-rule dark:border-ink-soft rounded p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-display text-[15px] font-medium italic">ปลดล็อก Pro · ตลอดชีพ</div>
                  <div className="font-serif text-[12px] italic text-ink-soft dark:text-rule-soft mt-0.5 leading-snug">
                    • ลบโฆษณาทั้งหมด ตลอดไป<br />
                    • ปลดล็อกคลังบุ๊กมาร์ก<br />
                    • จ่ายครั้งเดียว ไม่มีค่าสมาชิก
                  </div>
                </div>
                <button
                  disabled={busy === 'buy'}
                  className="font-ui text-[11px] font-bold tracking-wide uppercase px-3 py-1.5 bg-ink dark:bg-paper text-paper dark:text-ink rounded-sm flex-shrink-0 hover:opacity-80 transition-opacity disabled:opacity-40"
                  onClick={handleBuy}
                >
                  {busy === 'buy' ? '...' : 'ซื้อ'}
                </button>
              </div>
              <button
                disabled={busy === 'restore'}
                className="mt-2 font-ui text-[10px] text-ink-soft dark:text-rule-soft underline disabled:opacity-40"
                onClick={handleRestore}
              >
                {busy === 'restore' ? 'กำลังกู้คืน…' : 'กู้คืนการซื้อเดิม'}
              </button>
              {iapMsg && (
                <div className="mt-1.5 font-ui text-[10px] text-accent">{iapMsg}</div>
              )}
            </div>
          )}
          {settings.isPro && (
            <div className="my-3 border border-ochre rounded p-3 flex items-center gap-2">
              <div className="font-display text-[13px] italic text-ochre">Pro · ใช้งานอยู่</div>
              <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">ปิดโฆษณา · บุ๊กมาร์กปลดล็อกแล้ว</div>
              <button
                disabled={busy === 'restore'}
                className="ml-auto font-ui text-[10px] text-ink-soft dark:text-rule-soft underline disabled:opacity-40"
                onClick={handleRestore}
              >
                กู้คืน
              </button>
            </div>
          )}

          <Group title="การอ่าน">
            <Row label="แบบอักษร" value="Trirong + Sarabun" />
            {/* Body Size picker */}
            <div
              className="flex items-center justify-between py-2.5 pl-4"
              style={{ borderTop: '1px dotted #bdb19a' }}
            >
              <div className="font-serif text-[14px] text-ink dark:text-paper">ขนาดตัวอักษร</div>
              <div className="flex gap-1">
                {FONT_SCALES.map(scale => (
                  <button
                    key={scale}
                    className={`font-ui text-[11px] font-bold w-8 h-7 rounded-sm border transition-colors ${
                      settings.fontScale === scale
                        ? 'bg-ink dark:bg-paper text-paper dark:text-ink border-ink dark:border-paper'
                        : 'border-rule-soft dark:border-ink-soft text-ink-soft dark:text-rule-soft hover:border-ink dark:hover:border-paper'
                    }`}
                    onClick={() => update('fontScale', scale)}
                  >
                    {scale}
                  </button>
                ))}
              </div>
            </div>
            <Row label="จัดข้อความชิดขอบ" toggle={settings.justified} onToggle={() => toggle('justified')} />
            <Row label="โหมดมืด" toggle={settings.isDarkMode} onToggle={() => toggle('isDarkMode')} />
            {/* Restore Purchase — always visible so paid users can recover
                their entitlement after reinstall or device change */}
            <div
              className="flex items-center justify-between py-2.5 pl-4"
              style={{ borderTop: '1px dotted #bdb19a' }}
            >
              <div className="font-serif text-[14px] text-ink dark:text-paper">กู้คืนการซื้อ</div>
              <button
                disabled={busy === 'restore'}
                className="font-ui text-[11px] font-bold tracking-wide uppercase px-3 py-1 border border-rule dark:border-ink-soft rounded-sm text-ink-soft dark:text-rule-soft hover:opacity-70 transition-opacity disabled:opacity-30"
                onClick={handleRestore}
              >
                {busy === 'restore' ? '…' : 'กู้คืน'}
              </button>
            </div>
          </Group>

          {/* Colophon */}
          <div className="border-t border-rule dark:border-ink-soft pt-3.5 pb-6 text-center">
            <div
              className="font-display text-[12px] italic text-ink-soft dark:text-rule-soft select-none"
              onClick={handleVersionTap}
            >
              Law Code TH · v1.0
            </div>
            <div className="font-ui text-[9px] tracking-[2px] uppercase text-ink-soft dark:text-rule-soft mt-1 opacity-60">
              เกี่ยวกับ
            </div>
            <div className="font-serif text-[11px] italic text-ink-soft dark:text-rule-soft mt-2 opacity-60">
              ประมวลกฎหมายไทย ฉบับสมบูรณ์<br />
              ใช้อ้างอิงเท่านั้น — ไม่ใช่คำแนะนำทางกฎหมาย
            </div>
            {devMsg && (
              <div className="mt-2 font-ui text-[10px] text-accent">{devMsg}</div>
            )}
          </div>
        </div>
      </div>

      <TabBar />
    </div>
  );
}
