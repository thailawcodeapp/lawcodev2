import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { searchSections, getSnippet } from '../data/lawMeta';
import TabBar from '../components/TabBar';
import AdBanner from '../components/AdBanner';

function highlight(text, query) {
  if (!query || query.length < 2) return text;
  const terms = query.trim().split(/\s+/).filter(t => t.length >= 2);
  const re = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part) ? (
      <mark
        key={i}
        className="bg-transparent border-b-2 border-accent text-ink dark:text-paper font-semibold px-px"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export default function SearchScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { books } = useApp();
  const inputRef = useRef(null);

  const initialQuery = searchParams.get('q') || '';
  const initialBook = searchParams.get('bookId') || 'all';

  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState(initialBook);
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(!!initialQuery);

  const availableBooks = books.filter(b => b.available);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const booksToSearch = activeFilter === 'all'
      ? availableBooks
      : availableBooks.filter(b => b.id === activeFilter);
    const r = searchSections(booksToSearch, query);
    setResults(r);
    setHasSearched(true);
  }, [query, activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterTabs = [
    { id: 'all', label: 'ทั้งหมด', count: results.length },
    ...availableBooks.map(b => ({
      id: b.id,
      label: b.abbr || b.shortName,
      count: activeFilter === 'all'
        ? results.filter(r => r.book.id === b.id).length
        : (activeFilter === b.id ? results.length : 0),
    })),
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    inputRef.current?.blur();
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">

      {/* Ad banner — top */}
      <AdBanner />

      {/* Header */}
      <div className="px-5 pt-2.5 pb-1 flex items-center gap-2.5 border-b border-rule dark:border-ink-soft flex-shrink-0">
        <button onClick={() => navigate(-1)} className="-ml-1 p-1 text-ink dark:text-paper">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold">ค้นหา</div>
      </div>

      {/* Search bar + query display */}
      <div className="px-5 pt-2 pb-2 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-accent mb-1">
          กำลังค้นหา…
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder=""
            className={[
              'w-full bg-transparent outline-none border-none font-display font-normal italic',
              'placeholder:text-ink-soft dark:placeholder:text-rule-soft placeholder:font-display placeholder:italic',
              'text-ink dark:text-paper',
            ].join(' ')}
            style={{ fontSize: 38, letterSpacing: -1.5, lineHeight: 1 }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-ink-soft dark:text-rule-soft"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </form>

        {hasSearched && (
          <div className="flex justify-between mt-1.5 font-ui text-[10px] text-ink-soft dark:text-rule-soft tracking-wide">
            <span>
              {results.length} มาตรา
              {availableBooks.length > 1 ? `, ${availableBooks.length} ฉบับ` : ''}
            </span>
            <span className="text-accent font-semibold">ตรงกันมากสุด ↓</span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      {availableBooks.length > 0 && (
        <div
          className="flex px-5 gap-4 border-b border-rule dark:border-ink-soft overflow-x-auto flex-shrink-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {filterTabs.map((tab, i) => {
            const active = tab.id === activeFilter;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className="flex items-baseline gap-1 whitespace-nowrap py-2 font-ui text-[11px] font-medium flex-shrink-0"
                style={{
                  color: active ? '#a93225' : undefined,
                  borderBottom: active ? '2px solid #a93225' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                <span style={{ fontWeight: 600 }}>{tab.label}</span>
                <span className="font-display text-[10px] italic text-ink-soft dark:text-rule-soft">
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched && (
          <div className="px-5 pt-10 text-center">
            <div className="font-display text-[48px] font-light italic text-ink-soft dark:text-rule-soft opacity-30 leading-none">
              §
            </div>
            <div className="font-serif text-[14px] italic text-ink-soft dark:text-rule-soft mt-3">
              ค้นหาด้วยคำสำคัญ เลขมาตรา<br />หรือหลักกฎหมาย
            </div>
          </div>
        )}

        {hasSearched && results.length === 0 && (
          <div className="px-5 pt-8 text-center">
            <div className="font-display text-[14px] italic text-ink-soft dark:text-rule-soft">
              ไม่พบมาตราสำหรับ "{query}"
            </div>
            <div className="font-ui text-[11px] text-ink-soft dark:text-rule-soft mt-2">
              ลองใช้คำอื่น หรือตรวจสอบตัวสะกด
            </div>
          </div>
        )}

        <div className="px-5">
          {results
            .filter(r => activeFilter === 'all' || r.book.id === activeFilter)
            .map(({ section, book }, i) => {
              const cleanTitle = section.title.replace(/^มาตรา\s+[\d/]+\s*/i, '');
              const snippet = getSnippet(section.text, query.trim().split(/\s+/)[0]);
              return (
                <button
                  key={section.id}
                  className="w-full text-left py-3.5"
                  style={{ borderBottom: '1px solid #bdb19a' }}
                  onClick={() => navigate(`/code/${book.id}/section/${encodeURIComponent(section.id)}`)}
                >
                  <div className="flex items-baseline gap-3.5">
                    <div
                      className="font-display font-light text-ink dark:text-paper tabular-nums"
                      style={{ fontSize: 30, fontVariantNumeric: 'lining-nums', lineHeight: 0.9, minWidth: 64 }}
                    >
                      {section.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-accent">
                        {book.abbr || book.shortName}
                      </div>
                      <div className="font-display text-[15px] italic font-medium leading-snug mt-0.5">
                        {cleanTitle || section.title}
                      </div>
                    </div>
                  </div>
                  <div className="font-serif text-[12.5px] leading-relaxed text-ink-soft dark:text-rule-soft mt-2">
                    {highlight(snippet, query)}
                  </div>
                </button>
              );
            })}
        </div>

        <div className="h-6" />
      </div>

      <TabBar />
    </div>
  );
}
