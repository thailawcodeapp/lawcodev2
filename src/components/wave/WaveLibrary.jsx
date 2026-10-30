// "ห้องสมุดเสียง" (spec 3.4): every law as a waveform. The four codes get tall
// rows, the Constitution and the acts thin ones. The header opens the law;
// a bar opens Select at the chapter its first section is in.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTts } from '../../context/TtsContext';
import WaveBars from './WaveBars';
import { getAllStats } from '../../lib/stats';
import { showToast } from '../../lib/toast';
import { CODE_BOOK_IDS } from '../../data/lawMeta';

export default function WaveLibrary() {
  const navigate = useNavigate();
  const { books } = useApp();
  const { playing, currentItem } = useTts();
  // A section counts as heard once it has started (stats.js), so this is
  // re-read whenever a section starts or playback stops.
  const heard = useMemo(() => new Set(Object.keys(getAllStats())), [playing, currentItem?.sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const codes = books.filter(b => CODE_BOOK_IDS.includes(b.id));
  const acts = books.filter(b => !CODE_BOOK_IDS.includes(b.id));

  const pct = (b) => {
    const n = b.sections?.length || 0;
    return n ? Math.round((b.sections.filter(s => heard.has(s.id)).length / n) * 100) : 0;
  };
  const openBook = (b) => {
    if (!b.available) { showToast('เร็ว ๆ นี้'); return; }
    navigate(`/code/${b.id}`);
  };
  const openAt = (b, index) => {
    if (!b.available) { showToast('เร็ว ๆ นี้'); return; }
    navigate('/select', { state: { bookId: b.id, sectionNumber: b.sections[index].number } });
  };

  const row = (b, thin) => (
    <div key={b.id} className={`wv-wrow${thin ? ' is-thin' : ''}`}>
      <button type="button" className="wv-whead tap-btn" onClick={() => openBook(b)}>
        <i className="wv-dot" style={{ background: b.waveColor }} />
        <span className="wv-wtitle">{thin ? (b.displayName ?? b.fullName) : b.fullName}</span>
        <span className="wv-wpct">{pct(b)}%</span>
      </button>
      <WaveBars book={b} heard={heard} nBars={thin ? 28 : 40} height={thin ? 18 : 32} onBar={(i) => openAt(b, i)} dim={!b.available} />
    </div>
  );

  return (
    <>
      <div className="wv-sech"><h3>ห้องสมุดเสียง</h3><span>แตะแท่งคลื่นเพื่อไปที่หมวดนั้น</span></div>
      <div className="wv-legend">
        <span><i style={{ background: 'var(--w-track)' }} />ยังไม่ฟัง</span>
        <span><i style={{ background: 'rgb(var(--c-ochre))' }} />ฟังแล้ว (สีประจำฉบับ)</span>
        <span>ความสูง = ความยาวเสียง</span>
      </div>
      {codes.map(b => row(b, false))}
      <div className="wv-sech is-sub"><h3>รัฐธรรมนูญและพระราชบัญญัติ</h3><span>{acts.length} ฉบับ</span></div>
      {acts.map(b => row(b, true))}
    </>
  );
}
