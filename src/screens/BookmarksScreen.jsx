import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import TabBar from '../components/TabBar';
import { cleanTitle } from '../lib/sectionText';

export default function BookmarksScreen() {
  const navigate = useNavigate();
  const { bookmarks, toggleBookmark, books, settings } = useApp();

  // Bookmarks are a Pro-only feature
  if (!settings.isPro) {
    return (
      <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">
        <div className="px-5 pt-3.5 pb-3 border-b-2 border-rule dark:border-paper flex-shrink-0">
          <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-accent">
            ประมวลกฎหมาย
          </div>
          <div
            className="font-display font-light leading-none mt-0.5"
            style={{ fontSize: 40, letterSpacing: -1, lineHeight: 0.9 }}
          >
            คลัง<span className="italic">บุ๊กมาร์ก</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pt-10 text-center">
          <div
            className="font-display font-light italic text-accent opacity-30 leading-none"
            style={{ fontSize: 72 }}
          >
            ✦
          </div>
          <div className="font-display text-[20px] font-medium italic mt-5" style={{ letterSpacing: -0.3 }}>
            ฟีเจอร์ Pro
          </div>
          <div className="font-serif text-[13px] italic text-ink-soft dark:text-rule-soft mt-2 leading-snug max-w-xs mx-auto">
            บันทึกมาตราที่สนใจไว้ในคลังส่วนตัว เข้าถึงได้ทุกเมื่อ
          </div>
          <div className="font-serif text-[12px] italic text-ink-soft dark:text-rule-soft mt-1 opacity-70">
            บุ๊กมาร์กเป็นส่วนหนึ่งของ Pro (จ่ายครั้งเดียว)
          </div>
          <button
            className="mt-6 font-ui text-[11px] font-bold tracking-wide uppercase px-5 py-2.5 bg-ink dark:bg-paper text-paper dark:text-ink rounded-sm hover:opacity-80 transition-opacity"
            onClick={() => navigate('/settings')}
          >
            ปลดล็อก Pro
          </button>
        </div>

        <TabBar />
      </div>
    );
  }

  const entries = Object.values(bookmarks).sort((a, b) => b.savedAt - a.savedAt);

  // Group by folder
  const folders = {};
  entries.forEach(b => {
    const f = b.folder || 'ทั่วไป';
    folders[f] = folders[f] || [];
    folders[f].push(b);
  });
  const folderEntries = Object.entries(folders);

  const getBookAbbr = (bookId) => {
    const book = books.find(b => b.id === bookId);
    return book?.abbr || book?.shortName?.slice(0, 3).toUpperCase() || '—';
  };


  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-3.5 pb-3 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-accent">
          ประมวลกฎหมาย
        </div>
        <div
          className="font-display font-light leading-none mt-0.5"
          style={{ fontSize: 40, letterSpacing: -1, lineHeight: 0.9 }}
        >
          คลัง<span className="italic">บุ๊กมาร์ก</span>
        </div>
        <div className="font-serif text-[12.5px] italic text-ink-soft dark:text-rule-soft mt-2">
          {entries.length} รายการ
          {folderEntries.length > 1 ? ` ใน ${folderEntries.length} โฟลเดอร์` : ''}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="px-5 pt-10 text-center">
            <div
              className="font-display font-light italic text-ink-soft dark:text-rule-soft opacity-30 leading-none"
              style={{ fontSize: 60 }}
            >
              §
            </div>
            <div className="font-serif text-[14px] italic text-ink-soft dark:text-rule-soft mt-4">
              ยังไม่มีบุ๊กมาร์ก
            </div>
            <div className="font-ui text-[11px] text-ink-soft dark:text-rule-soft mt-1">
              แตะไอคอนบุ๊กมาร์กขณะอ่านมาตราใดก็ได้
            </div>
          </div>
        ) : (
          <div className="px-5">
            {folderEntries.map(([folder, items], fi) => (
              <div key={folder} className="border-b border-rule dark:border-ink-soft">
                {/* Folder header */}
                <div className="flex items-baseline gap-3 pt-3.5 pb-1.5">
                  <div
                    className="font-display font-normal italic text-accent"
                    style={{ fontSize: 20, fontVariantNumeric: 'lining-nums', minWidth: 34 }}
                  >
                    {String(fi + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 font-display text-[18px] font-medium" style={{ letterSpacing: -0.3 }}>
                    {folder}
                  </div>
                  <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft">
                    {items.length} รายการ
                  </div>
                </div>

                {/* Bookmark entries */}
                {items.map((bm, i) => (
                  <div
                    key={bm.sectionId}
                    className="flex items-baseline justify-between py-2 pl-9"
                    style={{ borderTop: '1px dotted #bdb19a' }}
                  >
                    <button
                      className="flex items-baseline gap-2.5 flex-1 min-w-0 text-left"
                      onClick={() => navigate(`/code/${bm.bookId}/section/${encodeURIComponent(bm.sectionId)}`)}
                    >
                      <span className="font-ui text-[9px] text-ink-soft dark:text-rule-soft tracking-wide flex-shrink-0" style={{ minWidth: 28 }}>
                        {getBookAbbr(bm.bookId)}
                      </span>
                      <span
                        className="font-display font-medium italic text-ink dark:text-paper"
                        style={{ fontSize: 15, fontVariantNumeric: 'lining-nums' }}
                      >
                        §{bm.number}
                      </span>
                      <span className="font-serif text-[12.5px] text-ink-soft dark:text-rule-soft truncate">
                        — {cleanTitle(bm.title)}
                      </span>
                    </button>
                    <button
                      className="ml-3 flex-shrink-0 text-ink-soft dark:text-rule-soft hover:text-accent transition-colors"
                      onClick={() => toggleBookmark({ id: bm.sectionId, number: bm.number, title: bm.title, bookId: bm.bookId })}
                      aria-label="Remove bookmark"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ))}
            <div className="h-4" />
          </div>
        )}
      </div>

      <TabBar />
    </div>
  );
}
