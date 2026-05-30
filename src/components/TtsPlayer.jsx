import { useState } from 'react';
import { useTts } from '../context/TtsContext';
import VoiceSettings from './VoiceSettings';
import { showRewarded } from '../lib/admob';
import { addReward, REWARD_AMOUNT } from '../lib/quota';

// Global floating playback bar. Rendered once at app level so playback survives
// navigation (e.g. listening to a whole folder while browsing).
export default function TtsPlayer() {
  const {
    playing, paused, currentItem, itemIndex, itemCount,
    pause, resume, stop, next, prev,
    quotaBlocked, setQuotaBlocked,
  } = useTts();
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);

  const active = playing || paused;

  const handleReward = async () => {
    setBusy(true);
    const ok = await showRewarded();
    if (ok) addReward();
    setBusy(false);
    setQuotaBlocked(false);
  };

  // Quota-exceeded prompt takes over the bar
  if (quotaBlocked && !active) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3">
        <div className="bg-ink dark:bg-paper text-paper dark:text-ink rounded-xl shadow-2xl px-4 py-3">
          <div className="font-display text-[14px] font-medium mb-0.5">โควต้าการฟังหมดแล้ววันนี้</div>
          <div className="font-ui text-[11px] opacity-70 mb-2.5">
            ผู้ใช้ฟรีฟังได้วันละ {30} มาตรา — ดูโฆษณาเพื่อรับเพิ่มอีก {REWARD_AMOUNT} มาตรา
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReward}
              disabled={busy}
              className="flex-1 font-ui text-[12px] font-bold bg-accent text-paper rounded-lg py-2.5 disabled:opacity-50"
            >
              {busy ? 'กำลังโหลด…' : `ดูโฆษณา +${REWARD_AMOUNT} มาตรา`}
            </button>
            <button
              onClick={() => setQuotaBlocked(false)}
              className="font-ui text-[12px] px-4 rounded-lg border border-paper/30 dark:border-ink/30"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!active) return null;

  const label = currentItem?.label || 'กำลังอ่าน…';
  const isPlaying = playing && !paused;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pointer-events-none">
      {showSettings && (
        <div className="pointer-events-auto bg-paper dark:bg-dark-card border border-rule dark:border-ink-soft rounded-xl shadow-2xl px-4 py-2 mb-2">
          <VoiceSettings compact />
        </div>
      )}

      <div className="pointer-events-auto bg-ink dark:bg-paper text-paper dark:text-ink rounded-xl shadow-2xl px-2.5 py-2 flex items-center gap-1.5">
        {/* Label + progress */}
        <div className="flex-1 min-w-0 pl-1.5">
          <div className="font-display text-[14px] font-medium truncate">{label}</div>
          {itemCount > 1 && (
            <div className="font-ui text-[10px] opacity-60">{itemIndex + 1} / {itemCount}</div>
          )}
        </div>

        {/* Prev section (only when multi) */}
        {itemCount > 1 && (
          <button onClick={prev} className="p-2 opacity-80 hover:opacity-100" aria-label="ก่อนหน้า">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>
        )}

        {/* Play / Pause */}
        <button
          onClick={isPlaying ? pause : resume}
          className="w-11 h-11 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0"
          aria-label={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
        >
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Next section (only when multi) */}
        {itemCount > 1 && (
          <button onClick={next} className="p-2 opacity-80 hover:opacity-100" aria-label="ถัดไป">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        )}

        {/* Voice settings */}
        <button
          onClick={() => setShowSettings(v => !v)}
          className={`p-2 ${showSettings ? 'opacity-100' : 'opacity-70'} hover:opacity-100`}
          aria-label="ตั้งค่าเสียง"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8 7 17M17 7l2.8-2.8" />
          </svg>
        </button>

        {/* Close */}
        <button onClick={stop} className="p-2 opacity-60 hover:opacity-100" aria-label="ปิด">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
