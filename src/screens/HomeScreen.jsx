import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTts } from '../context/TtsContext';
import TabBar from '../components/TabBar';
import AdBanner from '../components/AdBanner';
import VoiceNewsCard from '../components/VoiceNewsCard';
import { buildItemsFromRefs, cleanTitle } from '../lib/sectionText';
import { showToast } from '../lib/toast';
import { CODE_BOOK_IDS } from '../data/lawMeta';

export default function HomeScreen() {
  const navigate = useNavigate();
  const { books, history, loadingData } = useApp();
  const { playSections } = useTts();

  const codes = books.filter(b => CODE_BOOK_IDS.includes(b.id));
  const acts  = books.filter(b => !CODE_BOOK_IDS.includes(b.id));

  const lastRead = history[0];
  const lastReadBook = lastRead ? books.find(b => b.id === lastRead.bookId) : null;

  const handleCodePress = (book) => {
    if (!book.available) return;
    navigate(`/code/${book.id}`);
  };

  const listenLastRead = () => {
    if (!lastRead) return;
    const items = buildItemsFromRefs(books, [{ sectionId: lastRead.sectionId, bookId: lastRead.bookId }]);
    if (items.length) playSections(items, 0);
    else showToast('เปิดมาตรานี้ไม่ได้');
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">

      {/* Ad banner — top */}
      <AdBanner />

      {/* Logo / wordmark */}
      <div className="px-5 pt-2 pb-2.5 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="text-center">
          <div
            className="font-display font-light leading-none tracking-tight"
            style={{ fontSize: 46, letterSpacing: -1, lineHeight: 0.9 }}
          >
            ประมวลกฎหมาย
          </div>
          <div className="font-display text-[13px] italic mt-1.5" style={{ letterSpacing: 0.4 }}>
            แห่งราชอาณาจักรไทย
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        <VoiceNewsCard />

        {/* Hero — last read / featured (#1 distinctive type, #2 listen button) */}
        <div className="px-5 py-3.5 border-b border-rule dark:border-ink-soft">
          <div className="flex justify-between items-center mb-2">
            <div className="font-ui text-[9px] tracking-[2.5px] uppercase font-bold text-accent">
              {lastRead ? 'อ่านล่าสุด' : 'เริ่มอ่าน'}
            </div>
            {lastRead && lastReadBook && (
              <button
                onClick={listenLastRead}
                className="tap-btn flex items-center gap-1.5 font-ui text-[11px] font-bold px-3 py-1.5 rounded-full bg-accent text-paper hover:opacity-90 transition-opacity"
                aria-label="ฟังมาตรานี้"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                ฟัง
              </button>
            )}
          </div>

          {lastRead && lastReadBook ? (
            <button
              className="tap-row w-full text-left flex items-stretch gap-4"
              onClick={() => navigate(`/code/${lastRead.bookId}/section/${encodeURIComponent(lastRead.sectionId)}`)}
            >
              {/* Distinctive number block with vertical kicker */}
              <div className="flex-shrink-0 flex items-stretch gap-2">
                <div className="w-[3px] bg-accent rounded-full" />
                <div>
                  <div className="font-ui text-[8px] tracking-[3px] uppercase font-bold text-ochre mb-0.5">
                    มาตรา
                  </div>
                  <div
                    className="font-display leading-none"
                    style={{
                      fontSize: 76, fontWeight: 500, fontStyle: 'italic',
                      letterSpacing: -2, color: '#a93225', lineHeight: 0.8,
                      fontVariantNumeric: 'lining-nums',
                    }}
                  >
                    {lastRead.number}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="font-display text-[17px] font-medium italic leading-snug" style={{ letterSpacing: -0.2 }}>
                  {cleanTitle(lastRead.title).trim() || `มาตรา ${lastRead.number}`}
                </div>
                <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft mt-1.5 tracking-[1px] uppercase">
                  {lastReadBook.shortName}
                </div>
              </div>
            </button>
          ) : (
            <div className="flex items-end gap-3.5">
              <div
                className="font-display font-light leading-none opacity-20"
                style={{ fontSize: 76, letterSpacing: -3, color: '#a93225', lineHeight: 0.85 }}
              >
                —
              </div>
              <div className="flex-1 pb-2">
                <div className="font-display text-[15px] italic text-ink-soft dark:text-rule-soft leading-snug">
                  ยังไม่มีประวัติการอ่าน เลือกกฎหมายด้านล่าง
                </div>
              </div>
            </div>
          )}
        </div>

        {/* The codes, then the acts — one numbering runs through both */}
        {[
          { label: 'ประมวลกฎหมาย', list: codes, offset: 0 },
          { label: 'รัฐธรรมนูญและพระราชบัญญัติ', list: acts, offset: codes.length },
        ].filter(g => g.list.length || loadingData).map((group, gi) => (
        <div key={group.label} className={gi === 0 ? 'px-5 pt-3.5 pb-2' : 'px-5 pt-5 pb-2'}>
          <div className="flex items-baseline justify-between mb-2.5">
            <div className="font-display text-[21px] font-medium" style={{ letterSpacing: -0.4 }}>
              {group.label}
            </div>
            <div className="font-ui text-[9px] tracking-[2px] uppercase text-ink-soft dark:text-rule-soft">
              {loadingData ? 'กำลังโหลด…' : `${group.list.filter(b => b.available).length} ฉบับ`}
            </div>
          </div>

          {group.list.map((book, i) => (
            <div
              key={book.id}
              className={[
                'flex items-start gap-3.5 py-3',
                'border-t border-rule dark:border-ink-soft',
                i === group.list.length - 1 ? 'border-b border-rule dark:border-ink-soft' : '',
                book.available ? 'tap-row cursor-pointer' : 'opacity-50 cursor-not-allowed',
              ].join(' ')}
              onClick={() => handleCodePress(book)}
              role={book.available ? 'button' : undefined}
            >
              <div
                className="font-display font-normal text-accent"
                style={{ fontSize: 26, lineHeight: 0.9, minWidth: 38, fontStyle: 'italic' }}
              >
                {String(group.offset + i + 1).padStart(2, '0')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-[16px] font-medium leading-snug" style={{ letterSpacing: -0.2 }}>
                  {book.displayName ?? book.shortName}
                </div>
                <div className="font-serif text-[11.5px] italic text-ink-soft dark:text-rule-soft leading-snug mt-0.5">
                  {book.available ? book.blurb : 'เร็ว ๆ นี้'}
                </div>
              </div>
              <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft tabular-nums whitespace-nowrap pt-1">
                {/* The last section's number, not the count: an act whose
                    repealed sections are gone ends at 107 with 158 sections. */}
                {book.available
                  ? `§ 1–${parseInt(book.sections?.at(-1)?.number, 10) || book.totalSections}`
                  : book.totalSections.toLocaleString() + ' §'}
              </div>
            </div>
          ))}
        </div>
        ))}

        <div className="h-4" />
      </div>

      <TabBar />
    </div>
  );
}
