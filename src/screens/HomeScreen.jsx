import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import TabBar from '../components/TabBar';
import AdBanner from '../components/AdBanner';

const CODE_NUMERALS = ['01', '02', '03', '04'];

export default function HomeScreen() {
  const navigate = useNavigate();
  const { books, history, loadingData } = useApp();

  const lastRead = history[0];
  const lastReadBook = lastRead ? books.find(b => b.id === lastRead.bookId) : null;

  const handleCodePress = (book) => {
    if (!book.available) return;
    navigate(`/code/${book.id}`);
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">

      {/* Ad banner — top */}
      <AdBanner />

      {/* Logo / wordmark */}
      <div className="px-5 pt-2 pb-2.5 border-b-2 border-rule dark:border-paper flex-shrink-0 relative">
        <div className="absolute top-2 right-5 font-display text-[11px] italic text-ink-soft dark:text-rule-soft">
          ฉบับปรับปรุง ๒๕๖๙
        </div>
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

        {/* Hero — last read / featured */}
        <div className="px-5 py-3.5 border-b border-rule dark:border-ink-soft">
          <div className="flex justify-between items-baseline mb-2">
            <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-accent">
              มาตรา
            </div>
            <div className="font-display text-[11px] italic text-ink-soft dark:text-rule-soft">
              {lastRead ? 'อ่านต่อ…' : 'เริ่มอ่าน'}
            </div>
          </div>

          {lastRead && lastReadBook ? (
            <button
              className="w-full text-left"
              onClick={() => navigate(`/code/${lastRead.bookId}/section/${encodeURIComponent(lastRead.sectionId)}`)}
            >
              <div className="flex items-end gap-3.5">
                <div
                  className="font-display font-light leading-none"
                  style={{ fontSize: 82, letterSpacing: -3, color: '#a93225', lineHeight: 0.85 }}
                >
                  {lastRead.number}
                </div>
                <div className="flex-1 pb-2">
                  <div className="font-display text-[16px] font-medium leading-snug">
                    {lastRead.title.replace(/^มาตรา\s+[\d/]+\s*/i, '').trim()}
                  </div>
                  <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft mt-1 tracking-wide">
                    {lastReadBook.shortName}
                  </div>
                </div>
              </div>
            </button>
          ) : (
            <div className="flex items-end gap-3.5">
              <div
                className="font-display font-light leading-none opacity-20"
                style={{ fontSize: 82, letterSpacing: -3, color: '#a93225', lineHeight: 0.85 }}
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
