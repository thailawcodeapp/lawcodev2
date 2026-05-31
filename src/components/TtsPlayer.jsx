import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTts } from '../context/TtsContext';
import VoiceSettings from './VoiceSettings';
import { showRewarded } from '../lib/admob';
import { addReward, REWARD_AMOUNT, DAILY_FREE } from '../lib/quota';
import { cleanTitle } from '../lib/sectionText';

// Height (px) reserved above the bottom for either the app tab bar (most
// screens) or the floating prev/next bar on the Reader screen (#3 — keeps the
// player above the on-screen prev/next strip and the device navigation bar).
const TAB_BAR_HEIGHT = 56;
const READER_BOTTOM_RESERVE = 56;

function bottomReserveFor(pathname) {
  if (pathname.match(/^\/code\/[^/]+\/section\//)) return READER_BOTTOM_RESERVE;
  return TAB_BAR_HEIGHT;
}

export default function TtsPlayer() {
  const {
    playing, paused, currentItem, itemIndex, itemCount, items,
    pause, resume, stop, next, prev, goToItem,
    quotaBlocked, setQuotaBlocked,
  } = useTts();
  const [showSettings, setShowSettings] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [busy, setBusy] = useState(false);
  const queueListRef = useRef(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const active = playing || paused;
  const bottomOffset = bottomReserveFor(pathname);

  useEffect(() => {
    if (!showQueue) return;
    requestAnimationFrame(() => {
      const el = queueListRef.current?.querySelector('[data-active="true"]');
      el?.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
  }, [showQueue, itemIndex]);

  useEffect(() => { if (!active) { setShowQueue(false); setShowSettings(false); } }, [active]);

  const handleReward = async () => {
    setBusy(true);
    const ok = await showRewarded();
    if (ok) addReward();
    setBusy(false);
    setQuotaBlocked(false);
  };

  // ───────────────────────────────────────────────────────────────────────
  // Quota-exceeded prompt takes over the bar
  // ───────────────────────────────────────────────────────────────────────
  if (quotaBlocked && !active) {
    return (
      <div
        className="fixed left-0 right-0 z-40 px-3"
        style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`, paddingBottom: 8 }}
      >
        <div className="bg-ink dark:bg-paper text-paper dark:text-ink rounded-xl shadow-2xl px-4 py-3">
          <div className="font-display text-[14px] font-medium mb-0.5">โควต้าการฟังหมดแล้ววันนี้</div>
          <div className="font-ui text-[11px] opacity-70 mb-2.5">
            ผู้ใช้ฟรีฟังได้วันละ {DAILY_FREE} มาตรา — ดูโฆษณาเพื่อรับเพิ่มอีก {REWARD_AMOUNT} มาตรา
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

  const handleJump = (i) => {
    goToItem(i);
    setShowQueue(false);
  };

  return (
    <>
      {showQueue && (
        <QueueModal
          items={items}
          itemIndex={itemIndex}
          itemCount={itemCount}
          isPlaying={isPlaying}
          onJump={handleJump}
          onPlayPause={isPlaying ? pause : resume}
          onPrev={prev}
          onNext={next}
          onStop={stop}
          onClose={() => setShowQueue(false)}
          listRef={queueListRef}
          navigate={navigate}
        />
      )}

      {/* Floating mini-player — pushed above tab-bar AND device-nav safe area */}
      <div
        className="fixed left-0 right-0 z-40 px-3 pointer-events-none"
        style={{
          bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 8,
        }}
      >
        {showSettings && (
          <div className="pointer-events-auto bg-paper dark:bg-dark-card border border-rule dark:border-ink-soft rounded-xl shadow-2xl px-4 py-2 mb-2">
            <VoiceSettings compact showTest />
          </div>
        )}

        <div className="pointer-events-auto bg-ink dark:bg-paper text-paper dark:text-ink rounded-xl shadow-2xl flex items-center gap-1.5 px-2 py-2">
          <button
            onClick={() => setShowQueue(true)}
            className="flex-1 min-w-0 text-left pl-1.5 py-1"
            aria-label="ดูคิวมาตรา"
          >
            <div className="font-display text-[14px] font-medium truncate">{label}</div>
            <div className="font-ui text-[10px] opacity-70">
              {itemCount > 1 ? `${itemIndex + 1} / ${itemCount} · แตะเพื่อเลือกมาตรา` : 'แตะเพื่อดูคิว'}
            </div>
          </button>

          {itemCount > 1 && (
            <button onClick={prev} className="p-2 opacity-80 hover:opacity-100 flex-shrink-0" aria-label="ก่อนหน้า">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>
          )}

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

          {itemCount > 1 && (
            <button onClick={next} className="p-2 opacity-80 hover:opacity-100 flex-shrink-0" aria-label="ถัดไป">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setShowSettings(v => !v); }}
            className={`p-2 flex-shrink-0 ${showSettings ? 'opacity-100' : 'opacity-70'} hover:opacity-100`}
            aria-label="ตั้งค่าเสียง"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8 7 17M17 7l2.8-2.8" />
            </svg>
          </button>

          <button onClick={stop} className="p-2 opacity-60 hover:opacity-100 flex-shrink-0" aria-label="ปิด">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Queue modal — supports tap-Backdrop, "ย่อลง" button, AND swipe-down on the
// drag handle / header to minimize back to the mini-player (v8 #7).
// Also reserves bottom space for device navigation via safe-area inset (#7).
// ──────────────────────────────────────────────────────────────────────────────
function QueueModal({
  items, itemIndex, itemCount, isPlaying,
  onJump, onPlayPause, onPrev, onNext, onStop, onClose,
  listRef, navigate,
}) {
  const [drag, setDrag] = useState({ y: 0, active: false });

  // Touch handlers on the handle/header area
  const onTouchStart = (e) => {
    const t = e.touches[0];
    setDrag({ y: 0, active: true, startY: t.clientY });
  };
  const onTouchMove = (e) => {
    if (!drag.active) return;
    const t = e.touches[0];
    const dy = Math.max(0, t.clientY - drag.startY);
    setDrag(d => ({ ...d, y: dy }));
  };
  const onTouchEnd = () => {
    if (!drag.active) return;
    if (drag.y > 100) onClose();
    else setDrag({ y: 0, active: false });
  };

  // Mouse handlers (for browser testing — mirror touch)
  const onMouseDown = (e) => setDrag({ y: 0, active: true, startY: e.clientY });
  const onMouseMove = (e) => {
    if (!drag.active) return;
    const dy = Math.max(0, e.clientY - drag.startY);
    setDrag(d => ({ ...d, y: dy }));
  };
  const onMouseUp = () => {
    if (!drag.active) return;
    if (drag.y > 100) onClose();
    else setDrag({ y: 0, active: false });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={onClose}
      onMouseMove={drag.active ? onMouseMove : undefined}
      onMouseUp={drag.active ? onMouseUp : undefined}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} />

      <div
        className="relative w-full bg-paper dark:bg-dark-bg rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          // v8 #7: keep the bottom edge inside the visible area by reserving
          // device-nav inset, and cap height so it doesn't overflow.
          maxHeight: 'calc(100% - env(safe-area-inset-top, 0px) - 16px)',
          height: '78%',
          transform: `translateY(${drag.y}px)`,
          transition: drag.active ? 'none' : 'transform 200ms',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (swipe-down area, v8 #7) */}
        <div
          className="flex flex-col items-center pt-2 pb-1 cursor-grab select-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
        >
          <div className="w-12 h-1.5 rounded-full bg-rule-soft dark:bg-ink-soft" />
        </div>

        {/* Header (also draggable) */}
        <div
          className="flex items-center justify-between px-5 pt-1 pb-3 border-b border-rule dark:border-ink-soft select-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
        >
          <div>
            <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-accent">
              กำลังเล่น
            </div>
            <div className="font-display text-[18px] font-medium leading-tight mt-0.5">
              คิวฟังตัวบท
            </div>
            <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft mt-0.5">
              {itemCount} มาตรา · กำลังฟังมาตราที่ {itemIndex + 1} · ลากลงหรือกดย่อ
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-ui text-[11px] font-bold px-3 py-2 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper"
            aria-label="ย่อหน้าจอ"
          >
            ย่อลง
          </button>
        </div>

        {/* Section list */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {items.map((it, i) => {
            const isActive = i === itemIndex;
            return (
              <div
                key={`${it.sectionId}_${i}`}
                data-active={isActive ? 'true' : undefined}
                onClick={() => onJump(i)}
                role="button"
                className="w-full text-left flex items-center gap-3 px-5 py-3 cursor-pointer"
                style={{
                  borderBottom: '1px solid #bdb19a',
                  background: isActive ? 'rgba(169,50,37,0.10)' : 'transparent',
                }}
              >
                <div className="w-8 flex-shrink-0 flex items-center justify-center">
                  {isActive ? (
                    isPlaying ? (
                      <span className="flex gap-0.5 items-end h-4">
                        <span className="w-[3px] bg-accent rounded-sm animate-pulse" style={{ height: '60%' }} />
                        <span className="w-[3px] bg-accent rounded-sm animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                        <span className="w-[3px] bg-accent rounded-sm animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
                      </span>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#a93225"><path d="M8 5v14l11-7z" /></svg>
                    )
                  ) : (
                    <span className="font-ui text-[10px] text-ink-soft dark:text-rule-soft tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span
                    className="font-display font-medium italic flex-shrink-0"
                    style={{
                      fontSize: 18,
                      color: isActive ? '#a93225' : undefined,
                      fontVariantNumeric: 'lining-nums',
                    }}
                  >
                    มาตรา {it.number}
                  </span>
                  {it.title && (
                    <div className="font-serif text-[12.5px] text-ink-soft dark:text-rule-soft truncate mt-0.5">
                      {cleanTitle(it.title)}
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (it.bookId && it.sectionId) {
                      navigate(`/code/${it.bookId}/section/${encodeURIComponent(it.sectionId)}`);
                      onClose();
                    }
                  }}
                  className="flex-shrink-0 p-1.5 text-ink-soft dark:text-rule-soft hover:text-accent"
                  aria-label="เปิดอ่าน"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M14 3h7v7M10 14 21 3M5 5h6M5 19V5m0 14h14m0-7v7" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer controls (stays inside the bottom safe area, v8 #7) */}
        <div className="border-t border-rule dark:border-ink-soft px-5 py-3 flex items-center gap-2 bg-paper dark:bg-dark-bg flex-shrink-0">
          <button onClick={onPrev} disabled={itemCount <= 1} className="p-2 text-ink dark:text-paper opacity-70 hover:opacity-100 disabled:opacity-30">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
          </button>
          <button
            onClick={onPlayPause}
            className="w-12 h-12 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0"
          >
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button onClick={onNext} disabled={itemCount <= 1} className="p-2 text-ink dark:text-paper opacity-70 hover:opacity-100 disabled:opacity-30">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
          </button>
          <div className="flex-1" />
          <button onClick={onStop} className="font-ui text-[11px] font-semibold px-3 py-2 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper">
            หยุด
          </button>
        </div>
      </div>
    </div>
  );
}
