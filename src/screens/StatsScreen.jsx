import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import TabBar from '../components/TabBar';
import { LAW_BOOKS_META } from '../data/lawMeta';
import { getStatsByBook, getTotals, clearStats } from '../lib/stats';
import { cleanTitle } from '../lib/sectionText';

export default function StatsScreen() {
  const navigate = useNavigate();
  const { books } = useApp();
  const [, setTick] = useState(0);

  const byBook = getStatsByBook();
  const totals = getTotals();
  const bookMeta = (id) => LAW_BOOKS_META.find(m => m.id === id);

  // order books by canonical order
  const orderedBookIds = LAW_BOOKS_META.map(m => m.id).filter(id => byBook[id]?.length);

  const handleClear = () => {
    if (confirm('ล้างสถิติการฟังทั้งหมด?')) { clearStats(); setTick(t => t + 1); }
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
        {/* Summary cards */}
        <div className="flex gap-3 px-5 pt-4 pb-2">
          <div className="flex-1 border border-rule dark:border-ink-soft rounded-lg px-3 py-2.5">
            <div className="font-display font-light text-accent leading-none" style={{ fontSize: 34, fontVariantNumeric: 'lining-nums' }}>
              {totals.sections}
            </div>
            <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft mt-1">มาตราที่ฟังแล้ว</div>
          </div>
          <div className="flex-1 border border-rule dark:border-ink-soft rounded-lg px-3 py-2.5">
            <div className="font-display font-light text-accent leading-none" style={{ fontSize: 34, fontVariantNumeric: 'lining-nums' }}>
              {totals.rounds}
            </div>
            <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft mt-1">จำนวนรอบที่ฟัง</div>
          </div>
        </div>

        {totals.sections === 0 ? (
          <div className="px-5 pt-10 text-center">
            <div className="font-display font-light italic text-ink-soft dark:text-rule-soft opacity-30 leading-none" style={{ fontSize: 60 }}>
              ♪
            </div>
            <div className="font-serif text-[14px] italic text-ink-soft dark:text-rule-soft mt-4">
              ยังไม่มีสถิติการฟัง
            </div>
            <div className="font-ui text-[11px] text-ink-soft dark:text-rule-soft mt-1">
              กดฟังมาตราใดก็ได้ แล้วกลับมาดูที่นี่
            </div>
          </div>
        ) : (
          <div className="px-5 pt-2">
            {orderedBookIds.map(bookId => {
              const list = byBook[bookId];
              const meta = bookMeta(bookId);
              const bookRounds = list.reduce((s, x) => s + x.count, 0);
              return (
                <div key={bookId} className="border-t border-rule dark:border-ink-soft pt-3 pb-1">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="font-display text-[17px] font-medium" style={{ letterSpacing: -0.3 }}>
                      {meta?.shortName || bookId}
                    </div>
                    <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">
                      {list.length} มาตรา · {bookRounds} รอบ
                    </div>
                  </div>
                  {list.map(s => (
                    <button
                      key={s.sectionId}
                      onClick={() => navigate(`/code/${bookId}/section/${encodeURIComponent(s.sectionId)}`)}
                      className="w-full text-left flex items-center gap-3 py-1.5"
                      style={{ borderTop: '1px dotted #bdb19a' }}
                    >
                      <span className="font-display font-medium italic text-accent flex-shrink-0" style={{ fontSize: 15, minWidth: 38, fontVariantNumeric: 'lining-nums' }}>
                        {s.number}
                      </span>
                      <span className="flex-1 min-w-0 font-serif text-[12.5px] text-ink-soft dark:text-rule-soft truncate">
                        {/* title not stored in stats — show number only emphasis */}
                        มาตรา {s.number}
                      </span>
                      <span className="flex-shrink-0 font-ui text-[10px] font-bold px-2 py-0.5 rounded-full bg-ochre/20 text-ochre">
                        {s.count} รอบ
                      </span>
                    </button>
                  ))}
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
