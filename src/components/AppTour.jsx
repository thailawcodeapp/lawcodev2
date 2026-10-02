import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  TOUR_STEPS, placeCard, toLocalRect, clipRect, shouldAutoShow, hasSeen,
  startTour, closeTour, isTourOpen, subscribeTour, nextRecall,
} from '../lib/tour';

const PAD = 6;
const GREEN = '#2d8c4a';
const ORANGE = '#e8821e';
const AUTO_DELAY_MS = 900;
const DIM = 'rgba(16,17,15,0.62)';

const sameRect = (a, b) =>
  a === b || (!!a && !!b &&
    Math.round(a.top) === Math.round(b.top) && Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height));

// Every modal in the app is a `fixed inset-0` layer; the tour must not open over one.
const blockingOverlayOpen = () =>
  !!document.querySelector('.fixed.inset-0:not([data-tour-root])');

function MockBar() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none mb-3 rounded-lg border border-rule-soft dark:border-ink-soft bg-paper dark:bg-dark-bg px-2.5 py-2 flex items-center gap-1.5"
    >
      <span className="font-ui text-[11px] font-bold">เลือก 3</span>
      <span className="font-ui text-[10px] text-ink-soft dark:text-rule-soft underline">ล้าง</span>
      <span className="flex-1" />
      <span className="font-ui text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-rule dark:border-ink-soft">
        + เพิ่มใน
      </span>
      <span className="font-ui text-[11px] font-bold px-3 py-1.5 rounded-lg bg-accent text-paper flex items-center gap-1 ring-2 ring-accent/40 ring-offset-1 ring-offset-paper dark:ring-offset-dark-bg">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        ฟังเลย
      </span>
    </div>
  );
}

// A pretend listened section, styled like a StatsScreen row. Tappable on
// purpose so the user can see the colour change, but it is local state only
// and never touches real memory marks or the real "จำไม่ได้" folder.
function MockRecall() {
  const [mem, setMem] = useState(null);
  const tint = mem === 'remembered' ? GREEN : mem === 'forgotten' ? ORANGE : undefined;
  const inFolder = mem === 'forgotten';

  const pill = (target, color, label, icon) => {
    const on = mem === target;
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={on}
        onClick={() => setMem(m => nextRecall(m, target))}
        className="tap-btn w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: on ? color : 'transparent',
          border: `1.5px solid ${color}`,
          color: on ? '#ece4d4' : color,
          boxShadow: target === 'forgotten' && !inFolder ? `0 0 0 4px ${color}40` : 'none',
        }}
      >
        {icon}
      </button>
    );
  };

  return (
    <div className="mb-3">
      <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-ink-soft dark:text-rule-soft mb-1">
        ตัวอย่าง · ลองกดได้
      </div>
      <div className="rounded-lg border border-rule-soft dark:border-ink-soft bg-paper dark:bg-dark-bg px-2.5 py-2 flex items-center gap-2">
        <span
          className="font-display font-medium italic flex-shrink-0 transition-colors"
          style={{ fontSize: 15, fontVariantNumeric: 'lining-nums', color: tint ?? '#a93225' }}
        >
          7
        </span>
        <span className="flex-1 min-w-0 font-serif text-[12px] truncate transition-colors" style={{ color: tint }}>
          อัตราดอกเบี้ยกรณีไม่ได้กำหนดไว้
        </span>
        {pill('remembered', GREEN, 'จำได้',
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 6" /></svg>)}
        {pill('forgotten', ORANGE, 'จำไม่ได้',
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>)}
      </div>
      <div
        className="mt-2 rounded-lg px-2.5 py-1.5 flex items-center gap-2 font-ui text-[11.5px] transition-colors"
        style={{
          border: `1px ${inFolder ? 'solid' : 'dashed'} ${inFolder ? ORANGE : '#bdb19a'}`,
          background: inFolder ? 'rgba(232,130,30,0.10)' : 'transparent',
          color: inFolder ? ORANGE : undefined,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
        <span className="font-semibold">โฟลเดอร์ “จำไม่ได้”</span>
        <span className="ml-auto tabular-nums">{inFolder ? '1 มาตรา ✓' : '0 มาตรา'}</span>
      </div>
    </div>
  );
}

export default function AppTour() {
  const open = useSyncExternalStore(subscribeTour, isTourOpen);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { loadingData } = useApp();

  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const autoTried = useRef(false);

  // autoTried is set inside the timer, not before it: StrictMode runs this
  // effect twice and the first timer is cleared, so setting it early would
  // swallow the only chance to open.
  useEffect(() => {
    if (loadingData || autoTried.current) return;
    const t = setTimeout(() => {
      autoTried.current = true;
      if (shouldAutoShow({
        seen: hasSeen(), pathname: pathRef.current, dataReady: true, blocking: blockingOverlayOpen(),
      })) startTour();
    }, AUTO_DELAY_MS);
    return () => clearTimeout(t);
  }, [loadingData]);

  const [idx, setIdx] = useState(0);
  const step = TOUR_STEPS[idx];
  const last = idx === TOUR_STEPS.length - 1;

  useEffect(() => { if (!open) setIdx(0); }, [open]);

  useEffect(() => {
    if (open && pathRef.current !== step.path) navigate(step.path);
  }, [open, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const rootRef = useRef(null);
  const cardRef = useRef(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [spot, setSpot] = useState(null);
  const [cardSize, setCardSize] = useState({ width: 300, height: 180 });

  // Re-measured on a short interval rather than on one event: the target can
  // appear late (screen still loading after navigate) or shift (fonts, the
  // top ad banner resizing the shell), and polling covers all of it.
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const root = rootRef.current;
      if (!root) return;
      const fr = root.getBoundingClientRect();
      const zoom = root.offsetWidth ? fr.width / root.offsetWidth : 1;
      const w = root.offsetWidth, h = root.offsetHeight;
      setFrame(f => (f.w === w && f.h === h ? f : { w, h }));

      const el = document.querySelector(`[data-tour="${step.target}"]`);
      let next = null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) next = clipRect(toLocalRect(r, fr, zoom), step.clipHeight);
      }
      setSpot(prev => (sameRect(prev, next) ? prev : next));

      const c = cardRef.current;
      if (c) {
        setCardSize(prev =>
          prev.width === c.offsetWidth && prev.height === c.offsetHeight
            ? prev : { width: c.offsetWidth, height: c.offsetHeight });
      }
    };
    measure();
    const iv = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    return () => { clearInterval(iv); window.removeEventListener('resize', measure); };
  }, [open, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') closeTour(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => { if (open) cardRef.current?.focus(); }, [open, idx]);

  if (!open) return null;

  const next = () => (last ? closeTour() : setIdx(i => i + 1));

  const vp = { width: frame.w || 360, height: frame.h || 640 };
  const hole = spot && {
    top: spot.top - PAD, left: spot.left - PAD,
    width: spot.width + PAD * 2, height: spot.height + PAD * 2,
  };
  const pos = hole
    ? placeCard(hole, cardSize, vp)
    : { top: Math.max(12, (vp.height - cardSize.height) / 2), left: Math.max(12, (vp.width - cardSize.width) / 2) };
  const cardWidth = Math.min(300, vp.width - 24);

  return (
    <div
      ref={rootRef}
      data-tour-root
      className="fixed inset-0 z-[55] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="แนะนำการใช้งานแอป"
    >
      {/* Swallows taps so the app underneath can't be used mid-tour; the
          spotlight's box-shadow is visual only and would let them through. */}
      <div className="absolute inset-0" style={{ background: hole ? 'transparent' : DIM }} />

      {hole && (
        <>
          <div
            className="absolute rounded-xl pointer-events-none transition-all duration-200"
            style={{ ...hole, boxShadow: `0 0 0 9999px ${DIM}`, outline: '2px solid rgba(236,228,212,0.9)' }}
          />
          <button
            type="button"
            aria-label={last ? 'เริ่มใช้งาน' : 'ถัดไป'}
            onClick={next}
            className="absolute rounded-xl"
            style={hole}
          />
        </>
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        className="absolute outline-none bg-card dark:bg-dark-card text-ink dark:text-paper border border-rule dark:border-ink-soft rounded-xl shadow-2xl px-4 pt-3.5 pb-3 transition-[top,left] duration-200"
        style={{ top: pos.top, left: pos.left, width: cardWidth }}
      >
        {step.mock === 'bar' && <MockBar />}
        {step.mock === 'recall' && <MockRecall />}
        <div className="font-display text-[17px] font-medium leading-snug mb-1" style={{ letterSpacing: -0.2 }}>
          {step.title}
        </div>
        <p className="font-ui text-[13.5px] leading-relaxed text-ink-soft dark:text-rule-soft mb-3">
          {step.text}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-auto" aria-label={`ขั้นที่ ${idx + 1} จาก ${TOUR_STEPS.length}`}>
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className="h-1.5 rounded-full"
                style={{ width: i === idx ? 16 : 6, background: i === idx ? '#a93225' : '#bdb19a' }}
              />
            ))}
          </div>
          {!last && (
            <button
              type="button"
              onClick={closeTour}
              className="tap-btn font-ui text-[13px] text-ink-soft dark:text-rule-soft px-2 py-1.5"
            >
              ข้าม
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className="tap-btn font-ui text-[13px] font-bold px-4 py-2 rounded-lg bg-accent text-paper"
          >
            {last ? 'เริ่มใช้งาน' : 'ถัดไป'}
          </button>
        </div>
      </div>
    </div>
  );
}
