import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTts } from '../context/TtsContext';
import TabBar from '../components/TabBar';
import AdBanner from '../components/AdBanner';
import { buildItemsFromRefs, cleanTitle } from '../lib/sectionText';

const CODE_NUMERALS = ['01', '02', '03', '04'];

export default function HomeScreen() {
  const navigate = useNavigate();
  const { books, history, loadingData } = useApp();
  const { playSections } = useTts();

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

        {/* Hero — last read / featured (#1 distinctive type, #2 listen button) */}
        <div className="px-5 py-3.5 border-b border-rule dark:border-ink-soft">
          <div className="flex justify-between items-center mb-2">
            <div className="font-ui text-[9px] tracking-[2.5px] uppercase font-bold text-accent">
              {lastRead ? 'อ่านล่าสุด' : 'เริ่มอ่าน'}
            </div>
            {lastRead && lastReadBook && (
              <button
                onClick={listenLastRead}
                className="flex items-center gap-1.5 font-ui text-[11px] font-bold px-3 py-1.5 rounded-full bg-accent text-paper hover:opacity-90 transition-opacity"
                aria-label="ฟังมาตรานี้"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                ฟัง
              </button>
            )}
          </div>

          {lastRead && lastReadBook ? (
            <button
              className="w-full text-left flex items-stretch gap-4"
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
                  ยังไม่มีประวัติการอ่าน เลือกประมวลกฎหมายด้านล่าง
                </div>
              </div>
            </div>
          )}
        </div>

        {/* The four codes */}
        <div className="px-5 pt-3.5 pb-2">
          <div className="flex items-baseline justify-between mb-2.5">
            <div className="font-display text-[21px] font-medium" style={{ letterSpacing: -0.4 }}>
              ประมวลกฎหมาย
            </div>
            <div className="font-ui text-[9px] tracking-[2px] uppercase text-ink-soft dark:text-rule-soft">
              {loadingData ? 'กำลังโหลด…' : `${books.filter(b => b.available).length} เล่ม`}
            </div>
          </div>

          {books.map((book, i) => (
            <div
              key={book.id}
              className={[
                'flex items-start gap-3.5 py-3',
                'border-t border-rule dark:border-ink-soft',
                i === books.length - 1 ? 'border-b border-rule dark:border-ink-soft' : '',
                book.available ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed',
              ].join(' ')}
              onClick={() => handleCodePress(book)}
              role={book.available ? 'button' : undefined}
            >
              <div
                className="font-display font-normal text-accent"
                style={{ fontSize: 26, lineHeight: 0.9, minWidth: 38, fontStyle: 'italic' }}
              >
                {CODE_NUMERALS[i]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-[16px] font-medium leading-snug" style={{ letterSpacing: -0.2 }}>
                  {book.shortName}
                </div>
                <div className="font-serif text-[11.5px] italic text-ink-soft dark:text-rule-soft leading-snug mt-0.5">
                  {book.available ? book.blurb : 'เร็ว ๆ นี้'}
                </div>
              </div>
              <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft tabular-nums whitespace-nowrap pt-1">
                {book.available
                  ? `§ 1–${book.totalSections.toLocaleString()}`
                  : book.totalSections.toLocaleString() + ' §'}
              </div>
            </div>
          ))}
        </div>

        <div className="h-4" />
      </div>

      <TabBar />
    </div>
  );
}
