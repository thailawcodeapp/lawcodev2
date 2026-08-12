import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import TabBar from '../components/TabBar';
import VoiceSettings from '../components/VoiceSettings';
import CloudSyncCard from '../components/CloudSyncCard';
import AudioStorageRow from '../components/AudioStorageRow';
import { buyPro, restorePurchases, getPlanPrice } from '../lib/iap';
import { getRemaining, getBonus, addReward, DAILY_FREE, REWARD_AMOUNT } from '../lib/quota';
import { showRewarded } from '../lib/admob';
import { openExternal } from '../lib/openExternal';
import {
  ENABLE_AUTH_GATE, PRIVACY_POLICY_URL, TERMS_OF_USE_URL,
  APP_VERSION_NAME, APP_VERSION_CODE,
} from '../config';

const isIOS = () =>
  typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'ios';

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
      style={{ borderTop: '1px dotted var(--rule-hair)' }}
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

// Consecutive taps on the version label must land this close together to count.
const TAP_WINDOW_MS = 2000;

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

  // Hidden shortcut for ad testing: tap the version label 5× in quick
  // succession to force Free mode. Taps more than TAP_WINDOW_MS apart restart
  // the count, so a user idly tapping the colophon never trips it.
  //
  // The old 10-tap "unlock Pro" shortcut was removed (v49): it let anyone turn
  // Pro on locally — ad-free, bookmarks, folders, highlights — and the counter
  // it shared meant a paying user tapping five times lost Pro on the way there.
  const lastTapAt = useRef(0);

  const handleVersionTap = () => {
    const now = Date.now();
    const restart = now - lastTapAt.current > TAP_WINDOW_MS;
    lastTapAt.current = now;
    setVersionTaps(prev => {
      const next = restart ? 1 : prev + 1;
      if (next >= 5) {
        setSettings(s => ({ ...s, isPro: false }));
        setDevMsg('🔓 โหมดฟรี (ทดสอบ)');
        setTimeout(() => setDevMsg(''), 3000);
        return 0;
      }
      return next;
    });
  };

  const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));
  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

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

          {/* Pro subscription card — monthly / quarterly / yearly plans */}
          {!settings.isPro && (
            <div className="my-3 border border-rule dark:border-ink-soft rounded-lg p-3.5">
              <div className="font-display text-[15px] font-medium italic">Pro · สมาชิก</div>
              <div className="font-serif text-[12px] italic text-ink-soft dark:text-rule-soft mt-0.5 leading-snug">
                • ลบโฆษณาทั้งหมด<br />
                • ฟังตัวบทไม่จำกัด<br />
                • ปลดล็อกคลังบุ๊กมาร์ก<br />
                • สร้างโฟลเดอร์จัดหมวดมาตรา<br />
                • ไฮไลท์และบันทึกโน้ตในตัวบท<br />
                • ซิงก์ข้อมูลข้ามเครื่อง
              </div>

              {/* Plan choice — three pill buttons side by side. While a purchase
                  is opening, say so: the buttons used to only dim, and on a slow
                  connection that reads as nothing having happened. */}
              {busy === 'buy' && (
                <div className="mt-2 font-ui text-[11px] font-bold text-accent">
                  กำลังเปิด {isIOS() ? 'App Store' : 'Google Play'}…
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5 mt-3">
                <button
                  disabled={!!busy}
                  onClick={() => handleBuy('monthly')}
                  className="tap-btn rounded-lg border border-rule dark:border-ink-soft p-2 text-left bg-paper dark:bg-dark-bg hover:bg-paper-dk/40 dark:hover:bg-dark-card/40 disabled:opacity-40"
                >
                  <div className="font-display text-[12px] font-medium">รายเดือน</div>
                  <div className="font-ui text-[13px] font-bold text-accent mt-0.5 tabular-nums">
                    {getPlanPrice('monthly') || '฿79'}
                  </div>
                  <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft mt-0.5">/ เดือน</div>
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => handleBuy('quarterly')}
                  className="tap-btn rounded-lg border border-rule dark:border-ink-soft p-2 text-left bg-paper dark:bg-dark-bg hover:bg-paper-dk/40 dark:hover:bg-dark-card/40 disabled:opacity-40"
                >
                  <div className="font-display text-[12px] font-medium">ราย 3 เดือน</div>
                  <div className="font-ui text-[13px] font-bold text-accent mt-0.5 tabular-nums">
                    {getPlanPrice('quarterly') || '฿199'}
                  </div>
                  <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft mt-0.5">/ 3 เดือน</div>
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => handleBuy('yearly')}
                  className="tap-btn rounded-lg border-2 border-accent p-2 text-left bg-accent/5 hover:bg-accent/10 disabled:opacity-40 relative"
                >
                  <span className="absolute -top-2 right-1 font-ui text-[8px] font-bold bg-accent text-paper px-1 py-0.5 rounded-full">คุ้มกว่า</span>
                  <div className="font-display text-[12px] font-medium">รายปี</div>
                  <div className="font-ui text-[13px] font-bold text-accent mt-0.5 tabular-nums">
                    {getPlanPrice('yearly') || '฿349'}
                  </div>
                  <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft mt-0.5">/ ปี</div>
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
              {/* 10px at full opacity, not 9px at /70: this is the auto-renewal
                  disclosure both stores require the buyer to be able to read,
                  and it was the faintest, smallest text in the whole app. */}
              <div className="mt-2 font-ui text-[10px] text-ink-soft dark:text-rule-soft leading-snug">
                การสมัครจะต่ออายุอัตโนมัติ เว้นแต่ผู้ใช้ยกเลิกล่วงหน้าอย่างน้อย 24 ชม.
                ก่อนรอบบิลถัดไป · จัดการการสมัครได้ที่ {isIOS() ? 'App Store' : 'Google Play Store'}
              </div>
              <div className="mt-1.5 font-ui text-[10px] text-ink-soft dark:text-rule-soft">
                <button className="underline" onClick={() => openExternal(PRIVACY_POLICY_URL)}>
                  นโยบายความเป็นส่วนตัว
                </button>
                {' · '}
                <button className="underline" onClick={() => openExternal(TERMS_OF_USE_URL)}>
                  ข้อตกลงการใช้งาน
                </button>
              </div>
            </div>
          )}
          {/* For a Pro user the status card is moved to the very bottom (see
              below). It depends on async auth/device state, so it renders null
              while loading and then pops in — at the top that pushed the whole
              settings list down every time the page opened. A subscriber does
              not need to be sold Pro; the free user's promo above does, and
              stays at the top. */}

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
                    className="tap-btn font-ui text-[11px] font-bold px-3 py-2 rounded-lg bg-ink dark:bg-paper text-paper dark:text-ink disabled:opacity-50"
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
            <div style={{ borderTop: '1px dotted var(--rule-hair)' }}>
              <button
                onClick={() => setShowHowTo(v => !v)}
                className="tap-row w-full flex items-center justify-between py-2.5 pl-4"
              >
                <span className="font-serif text-[14px] text-ink dark:text-paper">วิธีตั้งค่าเสียงสำรอง</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showHowTo ? 'rotate(90deg)' : 'none' }}>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
              {showHowTo && (
                <div className="pl-4 pr-1 pb-3 font-serif text-[12.5px] text-ink-soft dark:text-rule-soft leading-relaxed">
                  {isIOS() ? (
                    <>
                      <p className="mb-1.5">iPhone มีเสียงไทยติดเครื่องอยู่แล้ว แต่เสียงเริ่มต้นเป็นแบบมาตรฐาน หากต้องการเสียงที่เป็นธรรมชาติขึ้น ให้ดาวน์โหลดเสียงคุณภาพสูง:</p>
                      <ol className="space-y-1.5" style={{ paddingLeft: 16, listStyle: 'decimal' }}>
                        <li>เปิดแอป "การตั้งค่า" (Settings) ของ iPhone</li>
                        <li>ไปที่ "การช่วยการเข้าถึง" (Accessibility)</li>
                        <li>เลือก "เนื้อหาที่พูด" (Spoken Content) — บางรุ่นใช้ชื่อ "อ่านและพูด" (Read & Speak)</li>
                        <li>เลือก "เสียง" (Voices) → "ไทย" (Thai)</li>
                        <li>แตะเสียง "กัญญา" (Kanya) แล้วดาวน์โหลดแบบ "ปรับปรุงแล้ว" (Enhanced) หรือ "พรีเมียม" (Premium)</li>
                        <li>กลับมาที่แอปนี้ — แอปจะใช้เสียงคุณภาพสูงสุดที่มีให้อัตโนมัติ</li>
                      </ol>
                      <p className="mt-2 italic">ดาวน์โหลดแล้ว สามารถเลือกเสียงพากย์เองได้ในหัวข้อด้านบน (เสียงที่มีป้าย "พรีเมียม" หรือ "คุณภาพสูง" จะฟังเป็นธรรมชาติกว่า)</p>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              )}
            </div>
            <AudioStorageRow />
          </Group>

          <Group title="การอ่าน">
            <Row label="แบบอักษร" value="Trirong + Sarabun" />
            {/* Body Size picker */}
            <div
              className="flex items-center justify-between py-2.5 pl-4"
              style={{ borderTop: '1px dotted var(--rule-hair)' }}
            >
              <div className="font-serif text-[14px] text-ink dark:text-paper">ขนาดตัวอักษร</div>
              <div className="flex gap-1">
                {FONT_SCALES.map(scale => (
                  <button
                    key={scale}
                    className={`tap-btn font-ui text-[11px] font-bold w-8 h-7 rounded-sm border transition-colors ${
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
            {/* "จัดข้อความชิดขอบ" was removed in v49: nothing ever read the
                setting (the reader has been left-aligned since v21 for the
                hanging indent), and Thai has no inter-word spaces, so browser
                justification stretches character spacing instead of word gaps
                and pulls vowel marks away from their consonants. */}
            <Row label="โหมดมืด" toggle={settings.isDarkMode} onToggle={() => toggle('isDarkMode')} />
            {/* Restore Purchase — always visible so paid users can recover
                their entitlement after reinstall or device change */}
            <div
              className="flex items-center justify-between py-2.5 pl-4"
              style={{ borderTop: '1px dotted var(--rule-hair)' }}
            >
              <div className="font-serif text-[14px] text-ink dark:text-paper">กู้คืนการซื้อ</div>
              <button
                disabled={busy === 'restore'}
                className="tap-btn font-ui text-[11px] font-bold tracking-wide uppercase px-3 py-1 border border-rule dark:border-ink-soft rounded-sm text-ink-soft dark:text-rule-soft hover:opacity-70 transition-opacity disabled:opacity-30"
                onClick={handleRestore}
              >
                {busy === 'restore' ? '…' : 'กู้คืน'}
              </button>
            </div>
          </Group>

          {/* Pro-active status card — at the bottom so its async pop-in never
              shifts the settings above it. Legacy simple card when the
              cloud-sync flag is off; CloudSyncCard (four states) when on. */}
          {settings.isPro && !ENABLE_AUTH_GATE && (
            <div className="my-3 border border-ochre rounded p-3 flex items-center gap-2">
              <div className="font-display text-[13px] italic text-ochre">Pro · ใช้งานอยู่</div>
              <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">ปิดโฆษณา</div>
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

          {/* Colophon */}
          <div className="border-t border-rule dark:border-ink-soft pt-3.5 pb-6 text-center">
            <div
              className="font-display text-[12px] italic text-ink-soft dark:text-rule-soft select-none"
              onClick={handleVersionTap}
            >
              Law Code TH · v{APP_VERSION_NAME} · build {APP_VERSION_CODE}
            </div>
            <div className="font-serif text-[11px] italic text-ink-soft dark:text-rule-soft mt-2">
              เสียงอ่านประมวลกฎหมายไทย ฉบับสมบูรณ์<br />
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
