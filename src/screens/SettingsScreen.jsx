import { useState } from 'react';
import { useApp } from '../context/AppContext';
import TabBar from '../components/TabBar';
import VoiceSettings from '../components/VoiceSettings';
import CloudSyncCard from '../components/CloudSyncCard';
import { buyPro, restorePurchases, getPriceString, getPlanPrice } from '../lib/iap';
import { getRemaining, getBonus, addReward, DAILY_FREE, REWARD_AMOUNT } from '../lib/quota';
import { showRewarded } from '../lib/admob';
import { ENABLE_AUTH_GATE } from '../config';

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
  const [showHowTo, setShowHowTo] = useState(false);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [, setQuotaTick] = useState(0);

  const remaining = getRemaining();
  const bonus = getBonus();

  const handleWatchReward = async () => {
    if (rewardBusy) return;
    setRewardBusy(true);
    const ok = await showRewarded();
    if (ok) addReward();
    setRewardBusy(false);
    setQuotaTick(t => t + 1);
  };

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

  const handleBuy = async (plan) => {
    if (busy) return;
    setBusy('buy');
    setIapMsg('');
    const res = await buyPro(plan);
    setBusy(null);
    if (res.ok && res.dev) {
      update('isPro', true);
    } else if (!res.ok && res.error) {
      setIapMsg(res.error);
    }
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

          {/* Pro subscription card (v16 #5 — both yearly + quarterly plans) */}
          {!settings.isPro && (
            <div className="my-3 border border-rule dark:border-ink-soft rounded-lg p-3.5">
              <div className="font-display text-[15px] font-medium italic">Pro · สมาชิก</div>
              <div className="font-serif text-[12px] italic text-ink-soft dark:text-rule-soft mt-0.5 leading-snug">
                • ลบโฆษณาทั้งหมด<br />
                • ฟังตัวบทไม่จำกัด<br />
                • ปลดล็อกคลังบุ๊กมาร์ก
              </div>

              {/* Plan choice — two pill buttons side by side */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  disabled={busy === 'buy'}
                  onClick={() => handleBuy('quarterly')}
                  className="rounded-lg border border-rule dark:border-ink-soft p-2.5 text-left bg-paper dark:bg-dark-bg hover:bg-paper-dk/40 dark:hover:bg-dark-card/40 disabled:opacity-40"
                >
                  <div className="font-display text-[13px] font-medium">ราย 3 เดือน</div>
                  <div className="font-ui text-[14px] font-bold text-accent mt-0.5 tabular-nums">
                    {getPlanPrice('quarterly') || '฿199'}
                  </div>
                  <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft mt-0.5">/ 3 เดือน</div>
                </button>
                <button
                  disabled={busy === 'buy'}
                  onClick={() => handleBuy('yearly')}
                  className="rounded-lg border-2 border-accent p-2.5 text-left bg-accent/5 hover:bg-accent/10 disabled:opacity-40 relative"
                >
                  <span className="absolute -top-2 right-2 font-ui text-[9px] font-bold bg-accent text-paper px-1.5 py-0.5 rounded-full">คุ้มกว่า</span>
                  <div className="font-display text-[13px] font-medium">รายปี</div>
                  <div className="font-ui text-[14px] font-bold text-accent mt-0.5 tabular-nums">
                    {getPlanPrice('yearly') || '฿499'}
                  </div>
                  <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft mt-0.5">/ ปี · ทดลอง 7 วันฟรี</div>
                </button>
              </div>

              <button
                disabled={busy === 'restore'}
                className="mt-2.5 font-ui text-[10px] text-ink-soft dark:text-rule-soft underline disabled:opacity-40"
                onClick={handleRestore}
              >
                {busy === 'restore' ? 'กำลังกู้คืน…' : 'กู้คืนการสมัครสมาชิก'}
              </button>
              {iapMsg && (
                <div className="mt-1.5 font-ui text-[10px] text-accent">{iapMsg}</div>
              )}
              <div className="mt-2 font-ui text-[9px] text-ink-soft/70 dark:text-rule-soft/70 leading-snug">
                การสมัครจะต่ออายุอัตโนมัติ เว้นแต่ผู้ใช้ยกเลิกล่วงหน้าอย่างน้อย 24 ชม.
                ก่อนรอบบิลถัดไป · จัดการการสมัครได้ที่ Google Play Store
              </div>
            </div>
          )}
          {/* Pro-active status banner.
              When cloud-sync flag is OFF: keep the simple legacy card.
              When ON: CloudSyncCard handles all four Pro-related states
              (needs-signin / needs-device-slot / pro / fallback). */}
          {settings.isPro && !ENABLE_AUTH_GATE && (
            <div className="my-3 border border-ochre rounded p-3 flex items-center gap-2">
              <div className="font-display text-[13px] italic text-ochre">Pro · ใช้งานอยู่</div>
              <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">สมาชิกรายปี · ปิดโฆษณา</div>
              <button
                disabled={busy === 'restore'}
                className="ml-auto font-ui text-[10px] text-ink-soft dark:text-rule-soft underline disabled:opacity-40"
                onClick={handleRestore}
              >
                กู้คืน
              </button>
            </div>
          )}
          {settings.isPro && ENABLE_AUTH_GATE && <CloudSyncCard />}

          {/* Listening quota (#11) — free users only */}
          {!settings.isPro && (
            <Group title="โควต้าการฟัง">
              <div className="py-2.5 pl-1">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="font-display font-light text-accent leading-none" style={{ fontSize: 34, fontVariantNumeric: 'lining-nums' }}>
                      {remaining}
                    </div>
                    <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft mt-1">
                      มาตราที่ฟังได้ (ฟรีวันละ {DAILY_FREE}{bonus > 0 ? ` + สะสม ${bonus}` : ''})
                    </div>
                  </div>
                  <button
                    onClick={handleWatchReward}
                    disabled={rewardBusy}
                    className="font-ui text-[11px] font-bold px-3 py-2 rounded-lg bg-ink dark:bg-paper text-paper dark:text-ink disabled:opacity-50"
                  >
                    {rewardBusy ? 'กำลังโหลด…' : `ดูโฆษณา +${REWARD_AMOUNT}`}
                  </button>
                </div>
                <div className="font-serif text-[11px] italic text-ink-soft dark:text-rule-soft mt-2 leading-snug">
                  ดูโฆษณาเพื่อสะสมโควต้าล่วงหน้าได้ — เครดิตที่สะสมไม่หมดอายุรายวัน
                </div>
              </div>
            </Group>
          )}

          {/* Voice settings (#8) + how-to (#10) + test button (v7 #1) */}
          <Group title="เสียงอ่าน">
            <div className="pl-1">
              <VoiceSettings showTest />
            </div>
            <div style={{ borderTop: '1px dotted #bdb19a' }}>
              <button
                onClick={() => setShowHowTo(v => !v)}
                className="w-full flex items-center justify-between py-2.5 pl-4"
              >
                <span className="font-serif text-[14px] text-ink dark:text-paper">วิธีตั้งค่าให้มีเสียงอ่าน</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showHowTo ? 'rotate(90deg)' : 'none' }}>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              {showHowTo && (
                <div className="pl-4 pr-1 pb-3 font-serif text-[12.5px] text-ink-soft dark:text-rule-soft leading-relaxed">
                  <p className="mb-1.5">หากกดปุ่มลำโพงแล้วไม่มีเสียง ให้ติดตั้งเสียงภาษาไทยของเครื่อง:</p>
                  <ol className="space-y-1.5" style={{ paddingLeft: 16, listStyle: 'decimal' }}>
                    <li>เปิดแอป "การตั้งค่า" (Settings) ของโทรศัพท์</li>
                    <li>ไปที่ "การช่วยเหลือพิเศษ" (Accessibility)</li>
                    <li>เลือก "เอาต์พุตการอ่านออกเสียง" (Text-to-speech)</li>
                    <li>ตั้งเอนจินเป็น "Google Text-to-Speech"</li>
                    <li>แตะไอคอนตั้งค่า → "ติดตั้งข้อมูลเสียง" → เลือก "ไทย" แล้วดาวน์โหลด</li>
                    <li>กลับมาที่แอปนี้ แล้วกดปุ่มลำโพงอีกครั้ง</li>
                  </ol>
                  <p className="mt-2 italic">เมื่อติดตั้งเสียงไทยแล้ว สามารถเลือกเสียงพากย์ได้ในหัวข้อด้านบน</p>
                </div>
              )}
            </div>
          </Group>

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
