import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import TabBar from '../components/TabBar';
import { LAW_BOOKS_META } from '../data/lawMeta';
import { getStatsByBook, getTotals, clearStats } from '../lib/stats';
import { getAllMemory, setMemoryStatus } from '../lib/memory';
import { syncForgottenFolder } from '../lib/folders';

const PREVIEW_COUNT = 5; // sections shown before "show more" (#1)

export default function StatsScreen() {
  const navigate = useNavigate();
  const { books } = useApp();
  const [, setTick] = useState(0);
  const force = () => setTick(t => t + 1);
  // per-bookId expanded state (#1)
  const [expanded, setExpanded] = useState({});

  const byBook = getStatsByBook();
  const totals = getTotals();
  const memory = getAllMemory();
  const bookMeta = (id) => LAW_BOOKS_META.find(m => m.id === id);

  const orderedBookIds = LAW_BOOKS_META.map(m => m.id).filter(id => byBook[id]?.length);

  const memCounts = Object.values(memory).reduce(
    (acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; },
    { remembered: 0, forgotten: 0 },
  );

  const handleClear = () => {
    if (confirm('ล้างสถิติการฟังทั้งหมด?')) { clearStats(); force(); }
  };

  // Toggle recall + auto-sync to permanent forgotten folder (#2)
  const togglePill = (sectionId, bookId, number, title, target) => {
    const cur = memory[sectionId] || null;
    const next = cur === target ? null : target;
    setMemoryStatus(sectionId, next);
    // sync to/from permanent folder
    syncForgottenFolder({
      sectionId, bookId, number, title,
      isForgotten: next === 'forgotten',
    });
    force();
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-3.5 pb-3 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-accent">สถิติการฟัง</div>
        <div className="font-display font-light leading-none mt-0.5" style={{ fontSize: 38, letterSpacing: -1, lineHeight: 0.9 }}>
          สถิติ<span className="italic">การฟัง</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Summary — full-width "มาตราที่ฟังแล้ว" + จำได้/จำไม่ได้ row (#4, #5) */}
        <div className="px-5 pt-4 pb-2 space-y-2">
          <div className="border border-rule dark:border-ink-soft rounded-lg px-4 py-3 flex items-baseline justify-between">
            <div className="font-ui text-[12px] text-ink-soft dark:text-rule-soft">มาตราที่ฟังแล้ว</div>
            <div className="font-display font-light text-accent leading-none" style={{ fontSize: 42, fontVariantNumeric: 'lining-nums' }}>
              {totals.sections}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border rounded-lg px-3 py-2.5" style={{ borderColor: '#2d8c4a' }}>
              <div className="font-display font-light leading-none" style={{ fontSize: 30, color: '#2d8c4a', fontVariantNumeric: 'lining-nums' }}>
                {memCounts.remembered || 0}
              </div>
              <div className="font-ui text-[10px] mt-1" style={{ color: '#2d8c4a' }}>จำได้</div>
            </div>
            <div className="border rounded-lg px-3 py-2.5" style={{ borderColor: '#e8821e' }}>
              <div className="font-display font-light leading-none" style={{ fontSize: 30, color: '#e8821e', fontVariantNumeric: 'lining-nums' }}>
                {memCounts.forgotten || 0}
              </div>
              <div className="font-ui text-[10px] mt-1" style={{ color: '#e8821e' }}>จำไม่ได้</div>
            </div>
          </div>
        </div>

        {totals.sections === 0 ? (
          <div className="px-5 pt-10 text-center">
            <div className="font-display font-light italic text-ink-soft dark:text-rule-soft opacity-30 leading-none" style={{ fontSize: 60 }}>♪</div>
            <div className="font-serif text-[14px] italic text-ink-soft dark:text-rule-soft mt-4">ยังไม่มีสถิติการฟัง</div>
            <div className="font-ui text-[11px] text-ink-soft dark:text-rule-soft mt-1">กดฟังมาตราใดก็ได้ แล้วกลับมาดูที่นี่</div>
          </div>
        ) : (
          <div className="px-5 pt-2">
            {orderedBookIds.map(bookId => {
              const list = byBook[bookId];
              const meta = bookMeta(bookId);
              const bookRounds = list.reduce((s, x) => s + x.count, 0);
              const isExp = expanded[bookId];
              const shown = isExp ? list : list.slice(0, PREVIEW_COUNT);
              const hidden = list.length - PREVIEW_COUNT;

              return (
                <div key={bookId} className="border-t border-rule dark:border-ink-soft pt-3 pb-1">
                  {/* Book header */}
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="font-display text-[17px] font-medium" style={{ letterSpacing: -0.3 }}>
                      {meta?.shortName || bookId}
                    </div>
                    <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">
                      {list.length} มาตรา · {bookRounds} รอบ
                    </div>
                  </div>

                  {/* Section rows */}
                  {shown.map(s => {
                    const mem = memory[s.sectionId] || null;
                    return (
                      <div
                        key={s.sectionId}
                        className="flex items-center gap-2 py-2"
                        style={{ borderTop: '1px dotted #bdb19a' }}
                      >
                        <button
                          onClick={() => navigate(`/code/${bookId}/section/${encodeURIComponent(s.sectionId)}`)}
                          className="flex-1 min-w-0 text-left flex items-center gap-2.5"
                        >
                          <span
                            className="font-display font-medium italic flex-shrink-0"
                            style={{
                              fontSize: 15, minWidth: 38, fontVariantNumeric: 'lining-nums',
                              color: mem === 'remembered' ? '#2d8c4a' : mem === 'forgotten' ? '#e8821e' : '#a93225',
                            }}
                          >
                            {s.number}
                          </span>
                          <span
                            className="flex-1 min-w-0 font-serif text-[12.5px] truncate"
                            style={{ color: mem === 'remembered' ? '#2d8c4a' : mem === 'forgotten' ? '#e8821e' : undefined }}
                          >
                            มาตรา {s.number}
                          </span>
                          <span className="flex-shrink-0 font-ui text-[10px] font-bold px-2 py-0.5 rounded-full bg-ochre/20 text-ochre">
                            {s.count} รอบ
                          </span>
                        </button>

                        {/* Recall toggles */}
                        <button
                          onClick={() => togglePill(s.sectionId, bookId, s.number, '', 'remembered')}
                          aria-label="จำได้"
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: mem === 'remembered' ? '#2d8c4a' : 'transparent',
                            border: '1.5px solid #2d8c4a',
                            color: mem === 'remembered' ? '#ece4d4' : '#2d8c4a',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 12l5 5L20 6" />
                          </svg>
                        </button>
                        <button
                          onClick={() => togglePill(s.sectionId, bookId, s.number, '', 'forgotten')}
                          aria-label="จำไม่ได้"
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: mem === 'forgotten' ? '#e8821e' : 'transparent',
                            border: '1.5px solid #e8821e',
                            color: mem === 'forgotten' ? '#ece4d4' : '#e8821e',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}

                  {/* Show more / less (#1) */}
                  {hidden > 0 && !isExp && (
                    <button
                      onClick={() => setExpanded(e => ({ ...e, [bookId]: true }))}
                      className="w-full py-2.5 font-ui text-[11px] font-semibold text-accent flex items-center justify-center gap-1.5"
                      style={{ borderTop: '1px dotted #bdb19a' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                      ดูเพิ่มเติมอีก {hidden} มาตรา
                    </button>
                  )}
                  {isExp && list.length > PREVIEW_COUNT && (
                    <button
                      onClick={() => setExpanded(e => ({ ...e, [bookId]: false }))}
                      className="w-full py-2.5 font-ui text-[11px] font-semibold text-ink-soft dark:text-rule-soft flex items-center justify-center gap-1.5"
                      style={{ borderTop: '1px dotted #bdb19a' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 15 6-6 6 6" /></svg>
                      ย่อกลับ
                    </button>
                  )}
                </div>
              );
            })}

            <div className="border-t border-rule dark:border-ink-soft mt-3 pt-3 pb-6 text-center">
              <button onClick={handleClear} className="font-ui text-[11px] text-accent underline">
                ล้างสถิติทั้งหมด
              </button>
            </div>
          </div>
        )}
      </div>

      <TabBar />
    </div>
  );
}
