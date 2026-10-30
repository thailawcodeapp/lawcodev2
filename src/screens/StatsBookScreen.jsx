// One law's listened sections, reached from a card on Stats: filter by mark,
// then ✓ or ✗ each one. A mark also fills or empties the "จำไม่ได้" folder.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import TabBar from '../components/TabBar';
import { getStatsByBook } from '../lib/stats';
import { getAllMemory, setMemoryStatus } from '../lib/memory';
import { syncForgottenFolder } from '../lib/folders';
import { cleanTitle } from '../lib/sectionText';

const GREEN = '#2d8c4a';
const ORANGE = '#e8821e';
const PAGE = 60; // rows drawn before "ดูเพิ่ม": a code has over a thousand

const memColor = (mem) => (mem === 'remembered' ? GREEN : mem === 'forgotten' ? ORANGE : undefined);

export default function StatsBookScreen() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { books } = useApp();
  const [, setTick] = useState(0);
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(PAGE);

  const book = books.find(b => b.id === bookId);
  const list = getStatsByBook()[bookId] || [];
  const memory = getAllMemory();
  const titles = new Map((book?.sections || []).map(s => [s.id, s.title]));
  const counts = { all: list.length, remembered: 0, forgotten: 0, unrated: 0 };
  for (const s of list) counts[memory[s.sectionId] || 'unrated']++;
  const filtered = filter === 'all' ? list : list.filter(s => (memory[s.sectionId] || 'unrated') === filter);

  const mark = (s, target) => {
    const next = memory[s.sectionId] === target ? null : target;
    setMemoryStatus(s.sectionId, next);
    syncForgottenFolder({
      sectionId: s.sectionId, bookId, number: s.number, title: titles.get(s.sectionId) || '',
      isForgotten: next === 'forgotten',
    });
    setTick(t => t + 1);
  };

  const pick = (id) => { setFilter(id); setShown(PAGE); };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-ui overflow-hidden" style={{ '--lc': book?.waveColor }}>
      <div className="flex items-center gap-1 px-2 pt-2.5 pb-1 flex-shrink-0">
        <button onClick={() => navigate('/stats')} className="hit-44 tap-btn w-10 h-10 grid place-items-center text-accent text-[24px] leading-none" aria-label="กลับไปหน้าสถิติ">‹</button>
        <div className="font-display text-[20px] font-bold truncate">{book?.displayName ?? book?.fullName ?? ''}</div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-4 py-2 flex-shrink-0">
        {[['all', 'ทั้งหมด'], ['forgotten', 'จำไม่ได้'], ['unrated', 'ยังไม่ประเมิน'], ['remembered', 'จำได้']].map(([id, label]) => (
          <button key={id} type="button" className="tap-btn st-chip" aria-pressed={filter === id} onClick={() => pick(id)}>
            {label} {counts[id].toLocaleString()}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filtered.length === 0 && (
          <div className="py-10 text-center text-[13px] text-ink-soft dark:text-rule-soft">ไม่มีมาตราในหมวดนี้</div>
        )}
        {filtered.slice(0, shown).map(s => {
          const mem = memory[s.sectionId] || null;
          // gap-3 and w-8 (not gap-2/w-7): จำได้ and จำไม่ได้ sit next to each
          // other and do opposite things, so they can't use .hit-44 — the
          // invisible boxes would overlap and a tap meant for one would land
          // on the other.
          return (
            <div key={s.sectionId} className="st-row flex items-center gap-3 py-2">
              <button
                onClick={() => navigate(`/code/${bookId}/section/${encodeURIComponent(s.sectionId)}`)}
                className="tap-row flex-1 min-w-0 text-left flex items-center gap-2.5"
              >
                <span className="font-display font-bold text-[15px] flex-shrink-0 tabular-nums" style={{ minWidth: 38, color: memColor(mem) ?? 'rgb(var(--c-accent))' }}>
                  {s.number}
                </span>
                <span className="flex-1 min-w-0 min-h-[18px]">
                  <span className="block text-[13px] truncate" style={{ color: memColor(mem) }}>
                    {cleanTitle(titles.get(s.sectionId)) || `มาตรา ${s.number}`}
                  </span>
                  <span className="block text-[10.5px] text-ink-soft dark:text-rule-soft">ฟัง {s.count} รอบ</span>
                </span>
              </button>
              {[['remembered', GREEN, 'จำได้', 'M5 12l5 5L20 6', 3], ['forgotten', ORANGE, 'จำไม่ได้', 'M18 6 6 18M6 6l12 12', 2.5]].map(([target, color, label, d, sw]) => (
                <button
                  key={target}
                  onClick={() => mark(s, target)}
                  aria-label={label}
                  aria-pressed={mem === target}
                  className="tap-btn w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: mem === target ? color : 'transparent', border: `1.5px solid ${color}`, color: mem === target ? '#fff' : color }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}><path d={d} /></svg>
                </button>
              ))}
            </div>
          );
        })}
        {filtered.length > shown && (
          <button onClick={() => setShown(n => n + PAGE)} className="tap-btn w-full py-3 text-[12px] font-semibold text-accent">
            ดูเพิ่มอีก {(filtered.length - shown).toLocaleString()} มาตรา
          </button>
        )}
      </div>

      <TabBar />
    </div>
  );
}
