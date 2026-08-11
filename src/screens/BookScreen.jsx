import { useParams, useNavigate, } from 'react-router-dom';
import { useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import Header, { SearchIcon } from '../components/Header';
import AdBanner from '../components/AdBanner';
import TabBar from '../components/TabBar';
import { LAW_BOOKS_META } from '../data/lawMeta';

import { cleanTitle } from '../lib/sectionText';

const TITLE_MAX = 48;
const TITLE_MIN = 20;
// The size the text is measured at. Glyph advance is very close to linear in
// font-size, so one measurement is enough to solve for the fitting size — no
// shrink-until-it-fits loop, and therefore one layout pass rather than thirty.
const TITLE_PROBE = 40;
// Stop a hair short of the edge. Sub-pixel rounding and italic overhang can
// each cost a pixel, and a title touching the boundary looks like a mistake
// even when it technically fits.
const TITLE_SAFETY = 0.97;

/**
 * Sizes a single-line title to the width it actually has.
 *
 * The width it actually has is not a constant, which is what the previous
 * version assumed: it divided a hardcoded 330 by the character count. But
 * .phone-shell is `width: calc(100vw / var(--zoom))` on every scaled path, so
 * picking L on a 360px Android phone leaves the layout 300px wide, not 330 —
 * and "วิธีพิจารณาความอาญา" was sized to fit a screen wider than the one it
 * was on, then clipped to "วิธีพิจารณาความอาญ…".
 *
 * Measuring removes the assumption entirely, and the ResizeObserver means
 * rotation, iPad split-view and a font-size change mid-screen all re-fit
 * without anyone remembering to wire them up.
 */
function useFittedTitle(text) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [size, setSize] = useState(TITLE_MAX);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;

    const fit = () => {
      const avail = box.clientWidth;
      if (!avail) return;
      // Measured on the inner span, which is inline-block and never clipped —
      // scrollWidth on the clipping box itself reports the clamped width, so
      // an already-overflowing title would measure as "fits" and never shrink.
      const prev = el.style.fontSize;
      el.style.fontSize = `${TITLE_PROBE}px`;
      const natural = el.scrollWidth;
      el.style.fontSize = prev;
      if (!natural) return;
      const solved = Math.floor((TITLE_PROBE * avail * TITLE_SAFETY) / natural);
      setSize(Math.max(TITLE_MIN, Math.min(TITLE_MAX, solved)));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text]);

  return { boxRef, textRef, size };
}

export default function BookScreen() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { books, loadingData } = useApp();

  const book = books.find(b => b.id === bookId);
  const meta = LAW_BOOKS_META.find(m => m.id === bookId);

  // Above the early returns below: a hook that runs only on some renders
  // changes the hook count and React tears the screen down. The refs simply
  // stay unattached on the loading and not-found paths.
  const titleFit = useFittedTitle(meta?.shortName);

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

  // Civil has 1869 sections — using 10-step gives 187 buttons. Use 50-step
  // for civil only; other codes (smaller) keep 10-step granularity (#3).
  const STEP = bookId === 'civil' ? 50 : 10;
  const decades = Array.from(
    new Set(
      book.sections
        .map(s => Math.floor(Number(s.number) / STEP) * STEP)
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
        {/* Outer box clips, inner span measures. They cannot be the same
            element: a clipping element reports its own width as scrollWidth,
            so the fit could never see how far past the edge the text ran. */}
        <div ref={titleFit.boxRef} style={{ overflow: 'hidden' }}>
          <span
            ref={titleFit.textRef}
            className="font-display font-medium"
            style={{
              fontSize: titleFit.size,
              color: '#a93225',
              letterSpacing: -0.5,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              display: 'inline-block',
            }}
          >
            {meta.shortName}
          </span>
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
                className="tap-btn font-display text-[12px] italic px-2 py-1 border border-rule-soft dark:border-ink-soft hover:bg-ink hover:text-paper dark:hover:bg-paper dark:hover:text-ink transition-colors rounded-sm"
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
              className="tap-row w-full text-left flex items-baseline gap-3 px-5 py-2.5 hover:bg-paper-dk dark:hover:bg-dark-card transition-colors"
              style={{ borderBottom: '1px solid', borderColor: i % 5 === 4 ? 'var(--rule-hair)' : 'var(--rule-strong)' }}
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
