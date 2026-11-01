// Wave Home's dark stage (spec 3.1): a word of encouragement and the brand, Lady Justice as the
// play button, what is playing or waiting to be resumed, and a wave with one
// bar per section of the queue. On this screen it replaces the player bar.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTts } from '../../context/TtsContext';
import ThemisButton from './ThemisButton';
import { buildItemsFromRefs, cleanTitle } from '../../lib/sectionText';
import { queueBars } from '../../lib/wave';
import { cheer } from '../../lib/cheer';
import { deviceReducesMotion } from '../../lib/theme';
import { showToast } from '../../lib/toast';
import { LAW_BOOKS_META } from '../../data/lawMeta';

const labelOf = (bookId) => LAW_BOOKS_META.find(m => m.id === bookId)?.shortLabel ?? '';

export default function WaveHero() {
  const navigate = useNavigate();
  const { books, history, loadingData } = useApp();
  const {
    playing, paused, pause, resume, next, prev, items, itemIndex, currentItem, current,
    playSections, playResume, resumeQueue,
  } = useTts();
  const still = deviceReducesMotion();

  // The hero redraws on every spoken chunk and a queue can hold a whole folder
  // of thousands of sections, so look sections up by id, not by scanning.
  const sectionIndex = useMemo(() => {
    const m = new Map();
    for (const b of books) for (const s of b.sections || []) m.set(`${b.id}::${s.id}`, s);
    return m;
  }, [books]);
  const sectionOf = (ref) => sectionIndex.get(`${ref.bookId}::${ref.sectionId}`);
  const short = (ref) => {
    const s = sectionOf(ref);
    return s ? `${labelOf(ref.bookId)} ม.${s.number}` : '';
  };

  // spec 3.1, the hero's states
  const active = playing && !paused;
  let mode;
  let queue = []; // refs
  let index = 0;
  if (playing || paused) {
    mode = active ? 'playing' : 'paused';
    queue = items.map(i => ({ bookId: i.bookId, sectionId: i.sectionId }));
    index = Math.max(0, itemIndex);
  } else if (resumeQueue) {
    mode = resumeQueue.done ? 'done' : 'resume';
    queue = resumeQueue.refs;
    index = resumeQueue.index;
  } else if (history[0]) {
    mode = 'last';
  } else {
    mode = 'empty';
  }

  const lastRead = history[0];
  const playLastRead = () => {
    const got = buildItemsFromRefs(books, [{ sectionId: lastRead.sectionId, bookId: lastRead.bookId }]);
    if (got.length) playSections(got, 0);
    else showToast('เปิดมาตรานี้ไม่ได้');
  };

  const n = queue.length;
  const view = {
    playing: { kicker: 'กำลังฟัง', aria: 'หยุดชั่วคราว', press: pause },
    paused: { kicker: 'หยุดชั่วคราว', aria: 'ฟังต่อ', press: resume },
    resume: {
      kicker: 'ฟังต่อ',
      aria: 'ฟังต่อ',
      press: () => {
        if (playResume()) return;
        if (lastRead) { playLastRead(); return; }
        showToast('มาตราในคิวที่ค้างไว้ไม่มีแล้ว');
      },
    },
    done: {
      kicker: 'ฟังจบแล้ว',
      aria: 'ฟังคิวนี้อีกครั้ง',
      press: () => {
        const got = buildItemsFromRefs(books, resumeQueue.refs);
        if (got.length) playSections(got, 0, { label: resumeQueue.label });
      },
    },
    last: {
      kicker: 'อ่านล่าสุด',
      aria: 'ฟังมาตราที่อ่านล่าสุด',
      press: playLastRead,
    },
    empty: { kicker: 'เริ่มฟัง', aria: 'เลือกมาตราที่จะฟัง', press: () => navigate('/select') },
  }[mode];

  // What the panel shows: the section in hand, large, then its title, then
  // the queue it belongs to.
  const hereRef = (playing || paused) && currentItem
    ? { bookId: currentItem.bookId, sectionId: currentItem.sectionId }
    : n ? queue[Math.min(index, n - 1)] : lastRead ? { bookId: lastRead.bookId, sectionId: lastRead.sectionId } : null;
  const here = hereRef ? sectionOf(hereRef) : null;
  const sectionName = cleanTitle(here?.title) || (mode === 'last' ? cleanTitle(lastRead.title) : '');
  const queueName = n ? resumeQueue?.label ?? '' : '';

  const lengths = queue.map(r => (sectionOf(r)?.text || '').length);
  const bars = queueBars(lengths, index, mode === 'done');
  // How far into the current section, from the chunk being spoken.
  const chunkCount = currentItem?.chunks?.length || 1;
  const nowFill = active || paused ? Math.min(1, Math.max(0, current.chunkIndex) / chunkCount) : 0;
  const left = mode === 'done' ? 0 : n - index;

  return (
    <section className={`wv-hero${active ? ' on' : ''}${still ? ' is-still' : ''}`} aria-label="ฟังต่อ">
      <div className="wv-hero-top">
        <div>
          <div className="wv-hello">{cheer()}</div>
          <div className="wv-brand">Juris <b>Voice</b></div>
        </div>
        <button type="button" className="wv-hero-icon tap-btn" onClick={() => navigate('/search')} aria-label="ค้นหา">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        </button>
      </div>

      <div className="wv-hero-main">
        <ThemisButton playing={active} still={still} disabled={loadingData} label={view.aria} onPress={view.press} />
        <div className="wv-hero-info">
          <div className="wv-status">
            <span className="wv-kicker">{view.kicker}</span>
            {n > 0 && <span className="wv-pos"><b>{Math.min(index + 1, n)}</b>/{n}</span>}
          </div>
          {loadingData ? (
            <div className="wv-qsub">กำลังโหลด…</div>
          ) : here ? (
            <>
              <div className="wv-now"><b>ม.{here.number}</b><span>{labelOf(hereRef.bookId)}</span></div>
              {sectionName && <div className="wv-qsub">{sectionName}</div>}
            </>
          ) : (
            <div className="wv-qname">เลือกกฎหมายที่จะฟัง</div>
          )}
          {queueName && <div className="wv-qlabel">{queueName}</div>}
          {(playing || paused) && (
            <div className="wv-hero-ctl">
              <button type="button" className="tap-btn" onClick={prev} aria-label="มาตราก่อนหน้า">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 6.5v11L10 12z" /><path d="M5 6v12" fill="none" /></svg>
              </button>
              <i aria-hidden="true" />
              <button type="button" className="tap-btn" onClick={next} aria-label="มาตราถัดไป">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 6.5v11l9-5.5z" /><path d="M19 6v12" fill="none" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {n > 0 && (
        <>
          <div className="wv-qwave" aria-hidden="true">
            {bars.map((b, k) => (
              <b key={k} className={b.state ? `is-${b.state}` : ''} style={{ height: `${(b.height * 100).toFixed(0)}%` }}>
                {b.state === 'now' && <i style={{ width: `${(nowFill * 100).toFixed(0)}%` }} />}
              </b>
            ))}
          </div>
          <div className="wv-qfoot">
            <span>{short(queue[0])}</span>
            <span className="wv-left">{left ? `คงเหลือ ${left.toLocaleString()} มาตรา` : 'จบคิวแล้ว'}</span>
            <span>{short(queue[n - 1])}</span>
          </div>
        </>
      )}
    </section>
  );
}
