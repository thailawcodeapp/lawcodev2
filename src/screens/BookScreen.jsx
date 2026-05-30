import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header, { SearchIcon } from '../components/Header';
import AdBanner from '../components/AdBanner';
import TabBar from '../components/TabBar';
import { LAW_BOOKS_META } from '../data/lawMeta';

function cleanTitle(title) {
  return String(title || '').replace(/^มาตรา\s+[\d/]+\s*/i, '');
}

// Pick a font size so even long code names ("วิธีพิจารณาความอาญา") fit on
// one line within the screen width (#4).
function titleFontSize(name) {
  const len = (name || '').length;
  const size = Math.floor(330 / (len * 0.52));
  return Math.max(24, Math.min(48, size));
}

export default function BookScreen() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { books, loadingData } = useApp();

  const book = books.find(b => b.id === bookId);
  const meta = LAW_BOOKS_META.find(m => m.id === bookId);

  if (loadingData && !book) {
    return (
      <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper">
        <Header title={bookId?.toUpperCase() || 'Code'} onBack={() => navigate('/')} />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-display italic text-ink-soft text-[14px]">กำลังโหลด…</p>
        </div>
        <TabBar />
      </div>
    );
  }

  if (!book || !meta) {
    return (
      <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper">
        <Header title="Code" onBack={() => navigate('/')} />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-serif italic text-ink-soft">ไม่พบประมวลกฎหมาย</p>
        </div>
        <TabBar />
      </div>
    );
  }

  const jumpToSection = (sectionNum) => {
    const section = book.sections.find(s => s.number === String(sectionNum));
    if (section) {
      navigate(`/code/${bookId}/section/${encodeURIComponent(section.id)}`);
    } else {
      const nearest = book.sections.reduce((prev, cur) =>
        Math.abs(Number(cur.number) - sectionNum) < Math.abs(Number(prev.number) - sectionNum)
          ? cur : prev,
        book.sections[0],
      );
      if (nearest) navigate(`/code/${bookId}/section/${encodeURIComponent(nearest.id)}`);
    }
  };

  const decades = Array.from(
    new Set(
      book.sections
        .map(s => Math.floor(Number(s.number) / 10) * 10)
        .filter(n => !isNaN(n)),
    ),
  ).sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">
      <AdBanner />
      <Header
        title=""
        onBack={() => navigate('/')}
        rightSlot={
          <SearchIcon onClick={() => navigate(`/search?bookId=${bookId}`)} />
        }
      />

      {/* Book title block — centered, accent red, single line (#3, #4) */}
      <div className="px-5 pt-3 pb-4 border-b-2 border-rule dark:border-paper flex-shrink-0 text-center">
        <div
          className="font-display font-medium"
          style={{
            fontSize: titleFontSize(meta.shortName),
            color: '#a93225',
            letterSpacing: -0.5,
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meta.shortName}
        </div>
      </div>

      {/* Scrollable area — Jump to Section + sections list scroll together */}
      <div className="flex-1 overflow-y-auto">

        {/* Jump to Section — scrolls with content */}
        <div className="px-5 pt-3 pb-2.5 border-b border-rule-soft dark:border-ink-soft">
          <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-ink-soft dark:text-rule-soft mb-2">
            ข้ามไปมาตรา
          </div>
          <div className="flex flex-wrap gap-1.5">
            {decades.map((decade) => (
              <button
                key={decade}
                className="font-display text-[12px] italic px-2 py-1 border border-rule-soft dark:border-ink-soft hover:bg-ink hover:text-paper dark:hover:bg-paper dark:hover:text-ink transition-colors rounded-sm"
                onClick={() => jumpToSection(decade === 0 ? 1 : decade)}
              >
                {decade === 0 ? '1' : decade}
              </button>
            ))}
          </div>
        </div>

        {/* Sections list */}
        {book.sections.map((s, i) => {
          const title = cleanTitle(s.title);
          return (
            <button
              key={`${s.id}_${i}`}
              className="w-full text-left flex items-baseline gap-3 px-5 py-2.5 hover:bg-paper-dk dark:hover:bg-dark-card transition-colors"
              style={{ borderBottom: '1px solid', borderColor: i % 5 === 4 ? '#bdb19a' : '#2a2820' }}
              onClick={() => navigate(`/code/${bookId}/section/${encodeURIComponent(s.id)}`)}
            >
              <div
                className="font-display font-light italic text-accent flex-shrink-0 tabular-nums"
                style={{ fontSize: 23, minWidth: 46, lineHeight: 1 }}
              >
                {s.number}
              </div>
              <div className="flex-1 min-w-0">
                {title ? (
                  <div className="font-serif text-[15px] leading-snug text-ink dark:text-paper truncate">
                    {title}
                  </div>
                ) : (
                  <div className="font-serif text-[15px] italic text-ink-soft dark:text-rule-soft">—</div>
                )}
              </div>
              <svg
                className="flex-shrink-0 text-ink-soft dark:text-rule-soft"
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.7"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          );
        })}
        <div className="h-4" />
      </div>

      <TabBar />
    </div>
  );
}
