// Wave Home's dark stage (spec 3.1): greeting and brand, Lady Justice as the
// play button, what is playing or waiting to be resumed, and a wave with one
// bar per section of the queue. On this screen it replaces the player bar.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTts } from '../../context/TtsContext';
import ThemisButton from './ThemisButton';
import { buildItemsFromRefs, cleanTitle } from '../../lib/sectionText';
import { queueBars } from '../../lib/wave';
import { resolveReduceMotion } from '../../lib/theme';
import { showToast } from '../../lib/toast';
import { LAW_BOOKS_META } from '../../data/lawMeta';

const labelOf = (bookId) => LAW_BOOKS_META.find(m => m.id === bookId)?.shortLabel ?? '';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
}

export default function WaveHero() {
  const navigate = useNavigate();
  const { books, history, loadingData, settings } = useApp();
  const {
    playing, paused, pause, resume, next, prev, items, itemIndex, currentItem, current,
    playSections, playResume, resumeQueue,
  } = useTts();
  const still = resolveReduceMotion(settings);

  // The hero redraws on every spoken chunk and a queue can hold a whole folder
  // of thousands of sections, so look sections up by id, not by scanning.
  const sectionIndex = useMemo(() => {
    const m = new Map();
    for (const b of books) for (const s of b.sections || []) m.set(`${b.id}::${s.id}`, s);
    return m;
  }, [books]);
  const sectionOf = (ref) => sectionIndex.get(`${ref.bookId}::${ref.sectionId}`);
  const describe = (ref) => {
    const s = sectionOf(ref);
    return s ? `${labelOf(ref.bookId)} ม.${s.number} ${cleanTitle(s.title)}`.trim() : '';
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
  const pos = n ? `${Math.min(index + 1, n)}/${n}` : '';
  const view = {
    playing: { kicker: `กำลังฟัง · ${pos}`, aria: 'หยุดชั่วคราว', press: pause },
    paused: { kicker: `ฟังต่อ · ${pos}`, aria: 'ฟังต่อ', press: resume },
    resume: {
      kicker: `ฟังต่อ · ${pos}`,
      aria: 'ฟังต่อ',
      press: () => {
        if (playResume()) return;
        if (lastRead) { playLastRead(); return; }
        showToast('มาตราในคิวที่ค้างไว้ไม่มีแล้ว');
      },
    },
    done: {
      kicker: `ฟังจบแล้ว · ${n}/${n}`,
      aria: 'ฟังคิวนี้อีกครั้ง',
      press: () => {
        const got = buildItemsFromRefs(books, resumeQueue.refs);
        if (got.length) playSections(got, 0, { label: resumeQueue.label });
      },
    },
    last: {
      kicker: lastRead ? `ฟัง · ${labelOf(lastRead.bookId)} ม.${lastRead.number}` : '',
      aria: 'ฟังมาตราที่อ่านล่าสุด',
      press: playLastRead,
    },
    empty: { kicker: 'เริ่มฟัง', aria: 'เลือกมาตราที่จะฟัง', press: () => navigate('/select') },
  }[mode];

  const title = mode === 'last' || mode === 'empty'
    ? (mode === 'last' ? cleanTitle(lastRead.title) || `มาตรา ${lastRead.number}` : 'เลือกกฎหมายที่จะฟัง')
    : resumeQueue?.label ?? '';
  const sub = loadingData
    ? 'กำลังโหลด…'
    : (playing || paused) && currentItem
      ? describe({ bookId: currentItem.bookId, sectionId: currentItem.sectionId })
      : n ? describe(queue[Math.min(index, n - 1)]) : '';

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
          <div className="wv-hello">{greeting()}</div>
          <div className="wv-brand">Juris <b>Voice</b></div>
        </div>
        <button type="button" className="wv-hero-icon tap-btn" onClick={() => navigate('/search')} aria-label="ค้นหา">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        </button>
      </div>

      <div className="wv-hero-main">
        <ThemisButton playing={active} still={still} disabled={loadingData} label={view.aria} onPress={view.press} />
        <div className="wv-hero-info">
          <div className="wv-kicker">{view.kicker}</div>
          <div className="wv-qname">{title}</div>
          <div className="wv-qsub">{sub}</div>
          {n > 0 && (
            <div className="wv-hero-ctl">
              {(playing || paused) && (
                <>
                  <button type="button" className="tap-btn" onClick={prev} aria-label="มาตราก่อนหน้า">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
                  </button>
                  <button type="button" className="tap-btn" onClick={next} aria-label="มาตราถัดไป">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>
                  </button>
                </>
              )}
              <span>{left ? `เหลืออีก ${left} มาตรา` : 'จบคิวแล้ว'}</span>
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
            <span>{describe(queue[0]).split(' ').slice(0, 2).join(' ')}</span>
            <span>คิวที่ฟังค้างไว้</span>
            <span>{describe(queue[n - 1]).split(' ').slice(0, 2).join(' ')}</span>
          </div>
        </>
      )}
    </section>
  );
}
