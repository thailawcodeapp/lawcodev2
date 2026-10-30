// "คลังเสียง": every law as a card. The four codes get full-width cards, the
// Constitution and the acts a two-column grid. The front is the law and how
// much of it has been heard; tapping it flips the card to its waveform, where
// a bar opens Select at the chapter its first section is in. The small book
// in the corner opens the law's text. Flips live in this component, so every
// card is face up again whenever Home is opened.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTts } from '../../context/TtsContext';
import WaveBars from './WaveBars';
import { getAllStats } from '../../lib/stats';
import { showToast } from '../../lib/toast';
import { resolveReduceMotion } from '../../lib/theme';
import { CODE_BOOK_IDS } from '../../data/lawMeta';

const BookIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
  </svg>
);

const FlipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
  </svg>
);

function Ring({ pct, color }) {
  const r = 15, c = 2 * Math.PI * r;
  return (
    <span className="wv-ring" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--w-track)" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 20 20)" />
      </svg>
      <b>{pct}%</b>
    </span>
  );
}

export default function WaveLibrary() {
  const navigate = useNavigate();
  const { books, settings } = useApp();
  const { playing, currentItem } = useTts();
  const [flipped, setFlipped] = useState(() => new Set());
  // Bars are drawn only for cards turned over at least once, and kept, so a
  // card turning back does not show an empty back halfway round.
  const [opened, setOpened] = useState(() => new Set());
  // A section counts as heard once it has started (stats.js), so this is
  // re-read whenever a section starts or playback stops.
  const heard = useMemo(() => new Set(Object.keys(getAllStats())), [playing, currentItem?.sectionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const still = resolveReduceMotion(settings);

  const codes = books.filter(b => CODE_BOOK_IDS.includes(b.id));
  const acts = books.filter(b => !CODE_BOOK_IDS.includes(b.id));

  const pct = (b) => {
    const n = b.sections?.length || 0;
    return n ? Math.round((b.sections.filter(s => heard.has(s.id)).length / n) * 100) : 0;
  };
  const flip = (b) => {
    if (!b.available) { showToast('เร็ว ๆ นี้'); return; }
    setOpened(prev => (prev.has(b.id) ? prev : new Set(prev).add(b.id)));
    setFlipped(prev => {
      const next = new Set(prev);
      if (next.has(b.id)) next.delete(b.id);
      else next.add(b.id);
      return next;
    });
  };
  const openBook = (b) => {
    if (!b.available) { showToast('เร็ว ๆ นี้'); return; }
    navigate(`/code/${b.id}`);
  };
  const openAt = (b, index) => navigate('/select', { state: { bookId: b.id, sectionNumber: b.sections[index].number } });

  const card = (b, wide) => {
    const on = flipped.has(b.id);
    const name = wide ? b.fullName : (b.displayName ?? b.fullName);
    return (
      <div key={b.id} className={`wv-lcard${wide ? ' is-wide' : ''}${on ? ' is-flipped' : ''}${b.available ? '' : ' is-dim'}`}
        style={{ '--lc': b.waveColor }}>
        <div className="wv-lcard-in">
          <div className="wv-lface is-front" aria-hidden={on}>
            <button type="button" className="wv-lflip tap-btn" onClick={() => flip(b)} tabIndex={on ? -1 : 0}
              aria-label={`${name} ฟังแล้ว ${pct(b)}% แตะเพื่อดูแถบเสียง`}>
              <span className="wv-lname">
                <b>{b.shortLabel}</b>
                <small>{name}</small>
              </span>
              <Ring pct={pct(b)} color={b.waveColor} />
            </button>
            <button type="button" className="wv-lbook tap-btn" onClick={() => openBook(b)} tabIndex={on ? -1 : 0}
              aria-label={`เปิดตัวบท ${name}`}>
              <BookIcon />
            </button>
          </div>
          <div className="wv-lface is-back" aria-hidden={!on}>
            <button type="button" className="wv-lback tap-btn" onClick={() => flip(b)} tabIndex={on ? 0 : -1}
              aria-label={`กลับด้านหน้า ${name}`}>
              <b>{b.shortLabel}</b>
              <span>ม.{b.sections?.[0]?.number ?? ''}–{b.sections?.at(-1)?.number ?? ''}</span>
              <FlipIcon />
            </button>
            {opened.has(b.id) && (
              <WaveBars book={b} heard={heard} nBars={wide ? 40 : 18} height={wide ? 44 : 52} onBar={(i) => openAt(b, i)} />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`wv-lib${still ? ' is-still' : ''}`}>
      <div className="wv-sech"><h3>คลังเสียง</h3><span>{books.length} ฉบับ</span></div>
      <div className="wv-lcol">{codes.map(b => card(b, true))}</div>
      <div className="wv-sech is-sub"><h3>รัฐธรรมนูญและพระราชบัญญัติ</h3><span>{acts.length} ฉบับ</span></div>
      <div className="wv-lgrid">{acts.map(b => card(b, false))}</div>
      <div className="wv-legend is-foot">
        <span>แตะการ์ดเพื่อดูแถบเสียง · แตะแท่งคลื่นเพื่อไปที่หมวดนั้น</span>
        <span><i style={{ background: 'var(--w-track)' }} />ยังไม่ฟัง</span>
        <span><i style={{ background: 'rgb(var(--c-ochre))' }} />ฟังแล้ว (สีประจำฉบับ)</span>
        <span>ความสูงแท่ง = ความยาวเสียง</span>
      </div>
    </div>
  );
}
