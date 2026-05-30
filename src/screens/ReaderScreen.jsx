import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header, { BookmarkIcon } from '../components/Header';
import AdBanner from '../components/AdBanner';
import { extractSectionRefs } from '../data/lawMeta';
import { loadInterstitial, showInterstitial, refreshBanner } from '../lib/admob';
import { getHighlightsForSection, addHighlight, deleteHighlight, getColorStyle } from '../lib/highlights';
import { getNotesForSection } from '../lib/notes';
import TtsPlayer from '../components/TtsPlayer';
import NoteDrawer from '../components/NoteDrawer';
import HighlightPopup from '../components/HighlightPopup';

function parseBody(text) {
  const cleaned = text
    .replace(/^มาตรา\s+[\d/]+\s+/i, '')
    .trim();
  if (!cleaned) return [];
  const separator = /\n{2,}/.test(cleaned) ? /\n{2,}/ : /\n/;
  return cleaned.split(separator).map(p => p.trim()).filter(Boolean);
}

// Render paragraph text with highlights applied
function renderHighlightedText(text, highlights) {
  if (!highlights || highlights.length === 0) return text;

  // Sort highlights by startOffset
  const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
  const parts = [];
  let cursor = 0;

  for (const hl of sorted) {
    if (hl.startOffset > cursor) {
      parts.push({ text: text.slice(cursor, hl.startOffset), hl: null });
    }
    parts.push({
      text: text.slice(hl.startOffset, hl.endOffset),
      hl,
    });
    cursor = hl.endOffset;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), hl: null });
  }

  return parts.map((part, i) => {
    if (!part.hl) return <span key={i}>{part.text}</span>;
    const style = getColorStyle(part.hl.color);
    return (
      <mark
        key={i}
        style={{ background: style.bg, borderBottom: `2px solid ${style.border}`, borderRadius: 2, padding: '1px 0' }}
        data-highlight-id={part.hl.id}
      >
        {part.text}
      </mark>
    );
  });
}

export default function ReaderScreen() {
  const { bookId, sectionId } = useParams();
  const navigate = useNavigate();
  const { books, loadingData, toggleBookmark, isBookmarked, addHistory, settings, trackSectionOpen } = useApp();
  const scrollRef = useRef(null);
  const paraRefs = useRef([]);

  // Feature states
  const [showTts, setShowTts] = useState(false);
  const [activeTtsPara, setActiveTtsPara] = useState(-1);
  const [showNotes, setShowNotes] = useState(false);
  const [noteCount, setNoteCount] = useState(0);
  const [highlights, setHighlights] = useState([]);
  const [hlPopup, setHlPopup] = useState(null); // { x, y, paraIndex, startOffset, endOffset, text }

  const book = books.find(b => b.id === bookId);
  const decodedSectionId = decodeURIComponent(sectionId);
  const sectionIndex = book?.sections?.findIndex(s => s.id === decodedSectionId) ?? -1;
  const section = sectionIndex >= 0 ? book?.sections?.[sectionIndex] ?? null : null;
  const prevSection = sectionIndex > 0 ? book?.sections?.[sectionIndex - 1] ?? null : null;
  const nextSection = book?.sections?.[sectionIndex + 1] ?? null;

  // Pre-load interstitial on first render
  useEffect(() => { loadInterstitial(settings.isPro); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load highlights + notes count on section change
  useEffect(() => {
    if (section) {
      setHighlights(getHighlightsForSection(section.id));
      setNoteCount(getNotesForSection(section.id).length);
      setShowTts(false);
      setActiveTtsPara(-1);
      setHlPopup(null);
    }
  }, [section?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (section) {
      addHistory(section);
      const shouldShowAd = trackSectionOpen();
      if (shouldShowAd) showInterstitial(settings.isPro);
      refreshBanner(settings.isPro);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // TTS paragraph change — auto-scroll
  const handleTtsParaChange = useCallback((idx) => {
    setActiveTtsPara(idx);
    if (idx >= 0 && paraRefs.current[idx]) {
      paraRefs.current[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Text selection handler for highlights
  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const selectedText = sel.toString().trim();
    if (!selectedText || selectedText.length < 2) return;

    // Find which paragraph the selection is in
    const paraEl = range.startContainer.parentElement?.closest('[data-para-index]');
    if (!paraEl) return;

    const paraIndex = parseInt(paraEl.dataset.paraIndex, 10);
    if (isNaN(paraIndex)) return;

    // Calculate offsets within the paragraph text
    const paraText = paraEl.textContent || '';
    const startOffset = paraText.indexOf(selectedText);
    if (startOffset === -1) return;
    const endOffset = startOffset + selectedText.length;

    // Get position for popup
    const rect = range.getBoundingClientRect();
    setHlPopup({
      x: rect.left + rect.width / 2,
      y: rect.top,
      paraIndex,
      startOffset,
      endOffset,
      text: selectedText,
    });
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelect);
    document.addEventListener('touchend', handleTextSelect);
    return () => {
      document.removeEventListener('mouseup', handleTextSelect);
      document.removeEventListener('touchend', handleTextSelect);
    };
  }, [handleTextSelect]);

  const handleHighlightColor = (color) => {
    if (!hlPopup || !section) return;
    const hl = addHighlight(
      section.id,
      hlPopup.paraIndex,
      hlPopup.startOffset,
      hlPopup.endOffset,
      hlPopup.text,
      color,
    );
    setHighlights(prev => [...prev, hl]);
    setHlPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleDeleteHighlight = (hlId) => {
    if (!section) return;
    deleteHighlight(section.id, hlId);
    setHighlights(prev => prev.filter(h => h.id !== hlId));
  };

  if (loadingData) {
    return (
      <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper">
        <Header title="อ่าน" />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-display italic text-ink-soft text-[14px]">กำลังโหลด…</p>
        </div>
      </div>
    );
  }

  if (!book || !section) {
    return (
      <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper">
        <Header title="อ่าน" />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-serif italic text-ink-soft">ไม่พบมาตรา</p>
        </div>
      </div>
    );
  }

  const bookmarked = isBookmarked(section.id);
  const bodyParagraphs = parseBody(section.text);
  const seeAlsoRefs = extractSectionRefs(section.text);

  const cleanTitle = section.title.replace(/^มาตรา\s+[\d/]+\s*/i, '');

  const fontSizes = { S: 18, M: 20, L: 22, XL: 24 };
  const bodyFontSize = fontSizes[settings.fontScale] ?? 16;

  const goToRef = (refNum) => {
    const target = book.sections.find(s => s.number === refNum);
    if (target) navigate(`/code/${bookId}/section/${encodeURIComponent(target.id)}`);
  };

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">
      <AdBanner />
      <Header
        title={book.shortName.toUpperCase()}
        onBack={() => navigate(`/code/${bookId}`)}
        rightSlot={
          <div className="flex items-center gap-2">
            {/* TTS button */}
            <button
              onClick={() => setShowTts(v => !v)}
              className={`p-1 ${showTts ? 'text-accent' : 'text-ink dark:text-paper'}`}
              aria-label="อ่านออกเสียง"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </button>

            {/* Notes button */}
            <button
              onClick={() => setShowNotes(true)}
              className="p-1 text-ink dark:text-paper relative"
              aria-label="บันทึก"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {noteCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-paper text-[9px] font-bold rounded-full flex items-center justify-center">
                  {noteCount}
                </span>
              )}
            </button>

            {/* Bookmark button */}
            <BookmarkIcon
              active={bookmarked}
              onClick={() => {
                if (settings.isPro) toggleBookmark(section);
                else navigate('/settings');
              }}
            />
          </div>
        }
      />

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-20">
        <div className="px-5">

          {/* Hero section number */}
          <div className="pt-5 pb-3.5 border-b-2 border-rule dark:border-paper">
            <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-accent">
              มาตรา
            </div>
            <div
              className="font-display font-extralight leading-none text-ink dark:text-paper"
              style={{
                fontSize: 'clamp(80px, 22vw, 150px)',
                letterSpacing: -6,
                lineHeight: 0.85,
                fontVariantNumeric: 'lining-nums',
                marginTop: 4,
              }}
            >
              {section.number}
            </div>
            {cleanTitle && (
              <div
                className="font-display font-medium italic leading-snug mt-3"
                style={{ fontSize: 20, letterSpacing: -0.3 }}
              >
                {cleanTitle}
              </div>
            )}

            {/* Meta row */}
            <div className="flex gap-3 mt-3 font-ui text-[10px] text-ink-soft dark:text-rule-soft tracking-wide">
              <span className="font-semibold text-ink dark:text-paper">{book.abbr || book.shortName}</span>
              <span>§ {section.number}</span>
            </div>
          </div>

          {/* Toolbar row — highlight count + delete */}
          {highlights.length > 0 && (
            <div className="flex items-center gap-2 py-2 border-b border-rule-soft/50 dark:border-ink-soft/50">
              <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">
                ไฮไลท์ {highlights.length} จุด
              </div>
              <button
                onClick={() => {
                  highlights.forEach(h => deleteHighlight(section.id, h.id));
                  setHighlights([]);
                }}
                className="font-ui text-[10px] text-accent ml-auto"
              >
                ลบทั้งหมด
              </button>
            </div>
          )}

          {/* Body text — numbered paragraphs with highlights + TTS glow */}
          <div
            className="py-4"
            style={{
              fontFamily: "'Trirong', Georgia, serif",
              fontSize: bodyFontSize,
              lineHeight: 1.6,
              textAlign: settings.justified ? 'justify' : 'left',
            }}
          >
            {bodyParagraphs.length > 0 ? (
              bodyParagraphs.map((para, i) => {
                const paraHighlights = highlights.filter(h => h.paraIndex === i);
                const isTtsActive = activeTtsPara === i;

                return (
                  <div
                    key={i}
                    ref={el => (paraRefs.current[i] = el)}
                    className={`flex gap-3 mb-3.5 items-baseline rounded-sm transition-colors duration-300 ${
                      isTtsActive ? 'bg-ochre/15 -mx-2 px-2 py-1' : ''
                    }`}
                    data-para-index={i}
                  >
                    <div
                      className="font-display font-semibold italic text-accent flex-shrink-0"
                      style={{ fontSize: 18, minWidth: 28, fontVariantNumeric: 'lining-nums', lineHeight: 1 }}
                    >
                      §{i + 1}
                    </div>
                    <div className="flex-1" data-para-index={i}>
                      {renderHighlightedText(para, paraHighlights)}
                    </div>
                  </div>
                );
              })
            ) : (
              <p>{section.text}</p>
            )}
          </div>

          {/* See also */}
          {seeAlsoRefs.filter(r => r !== section.number).length > 0 && (
            <div className="border-t border-rule dark:border-ink-soft pt-3.5 pb-4">
              <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-accent mb-2">
                ดูเพิ่มเติม
              </div>
              {seeAlsoRefs
                .filter(r => r !== section.number)
                .map((ref, i) => {
                  const refSection = book.sections.find(s => s.number === ref);
                  if (!refSection) return null;
                  const refTitle = refSection.title.replace(/^มาตรา\s+[\d/]+\s*/i, '');
                  return (
                    <button
                      key={i}
                      className="w-full text-left flex items-baseline justify-between py-2.5"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid #bdb19a' }}
                      onClick={() => goToRef(ref)}
                    >
                      <div className="flex items-baseline gap-3">
                        <span
                          className="font-display font-normal italic text-ink dark:text-paper"
                          style={{ fontSize: 22, fontVariantNumeric: 'lining-nums' }}
                        >
                          §{ref}
                        </span>
                        <span className="font-serif text-[13px] text-ink-soft dark:text-rule-soft">
                          {refTitle}
                        </span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </button>
                  );
                })}
            </div>
          )}

          <div className="h-6" />
        </div>
      </div>

      {/* Floating prev / next */}
      {!showTts && (
        <div
          className="absolute bottom-3 left-4 right-4 flex border-[1.5px] border-rule dark:border-ink-soft rounded overflow-hidden bg-paper dark:bg-dark-bg"
          style={{ zIndex: 10 }}
        >
          <button
            className="flex-1 py-2.5 text-center font-display text-[13px] italic border-r border-rule dark:border-ink-soft disabled:opacity-30 hover:bg-paper-dk dark:hover:bg-dark-card transition-colors"
            disabled={!prevSection}
            onClick={() => prevSection && navigate(`/code/${bookId}/section/${encodeURIComponent(prevSection.id)}`)}
          >
            ← {prevSection?.number ?? '—'}
          </button>
          <button
            className="flex-1 py-2.5 text-center font-display text-[13px] italic font-medium bg-ink dark:bg-paper text-paper dark:text-ink disabled:opacity-30 hover:opacity-90 transition-opacity"
            disabled={!nextSection}
            onClick={() => nextSection && navigate(`/code/${bookId}/section/${encodeURIComponent(nextSection.id)}`)}
          >
            {nextSection?.number ?? '—'} →
          </button>
        </div>
      )}

      {/* TTS Player */}
      <TtsPlayer
        paragraphs={bodyParagraphs}
        onParaChange={handleTtsParaChange}
        visible={showTts}
        onClose={() => { setShowTts(false); setActiveTtsPara(-1); }}
      />

      {/* Notes Drawer */}
      <NoteDrawer
        sectionId={section.id}
        visible={showNotes}
        onClose={() => {
          setShowNotes(false);
          setNoteCount(getNotesForSection(section.id).length);
        }}
      />

      {/* Highlight Color Popup */}
      <HighlightPopup
        position={hlPopup}
        onSelect={handleHighlightColor}
        onDismiss={() => {
          setHlPopup(null);
          window.getSelection()?.removeAllRanges();
        }}
      />
    </div>
  );
}
