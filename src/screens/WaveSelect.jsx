// Wave theme's Select screen (spec 5): book chips, the chosen law's waveform
// (a bar jumps to its chapter), table-of-contents cards to zoom through, then
// tick sections and "＋ เพิ่ม" opens the folder sheet. Logic is shared with
// Classic's SelectScreen through hooks.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useProAccess } from '../context/ProAccessContext';
import { gateContentFor } from '../lib/proAccessCopy';
import TabBar from '../components/TabBar';
import FolderEditModal from '../components/FolderEditModal';
import ProGateModal from '../components/ProGateModal';
import SignInGateModal from '../components/SignInGateModal';
import WaveBars from '../components/wave/WaveBars';
import FolderPickerSheet from '../components/wave/FolderPickerSheet';
import FoldersView from '../components/wave/FoldersView';
import TransportGlyph from '../components/wave/TransportGlyph';
import { useTocNavigation } from '../hooks/useTocNavigation';
import { useSectionSelection } from '../hooks/useSectionSelection';
import { useFolderPlayback } from '../hooks/useFolderPlayback';
import { getFolders } from '../lib/folders';
import { undoAdd } from '../lib/folderPicker';
import { getAllMemory } from '../lib/memory';
import { getAllStats } from '../lib/stats';
import { keyOf } from '../lib/selection';
import { nodeShortLabel, sectionsInRange, tocNodeKey } from '../lib/toc';
import { pathToSection } from '../lib/wave';
import { cleanTitle } from '../lib/sectionText';
import { showToast } from '../lib/toast';
import { pushBack } from '../lib/backStack';

// Remembered = green, forgotten = orange — the same as Classic.
function memColor(mem) {
  if (mem === 'remembered') return '#2d8c4a';
  if (mem === 'forgotten') return '#e8821e';
  return undefined;
}

function Check({ state }) {
  return (
    <span className={`wv-check${state === 'all' ? ' is-on' : state === 'some' ? ' is-some' : ''}`} aria-hidden="true">
      {state === 'all' ? '✓' : state === 'some' ? '–' : ''}
    </span>
  );
}

export default function WaveSelect() {
  const location = useLocation();
  const navigate = useNavigate();
  const { books, loadingData } = useApp();
  const { isPro, state: proAccessState } = useProAccess();

  const available = books.filter(b => b.available && b.sections?.length);
  const [activeBookId, setActiveBookId] = useState(null);
  const activeBook = available.find(b => b.id === activeBookId) || available[0];

  const [filter, setFilter] = useState('');
  const [folders, setFolders] = useState(() => getFolders());
  const [view, setView] = useState('browse');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [proHint, setProHint] = useState(false);
  const [editFolder, setEditFolder] = useState(null);
  const [memory] = useState(() => getAllMemory());
  const [heard] = useState(() => new Set(Object.keys(getAllStats())));
  const refreshFolders = () => setFolders(getFolders());

  const toc = useTocNavigation({ activeBook, filter });
  const sel = useSectionSelection({ activeBook, visibleSections: toc.visibleSections });
  const play = useFolderPlayback({ books, folders, selectedList: sel.selectedList });

  // A bar tapped on Home (or here) opens at its chapter once the TOC is in.
  // The jump remembers its book, so it never lands in a different one.
  const [jump, setJump] = useState(null);
  const [flashFrom, setFlashFrom] = useState(null);

  // Android back closes this screen's layers one at a time, newest first,
  // instead of leaving the screen and losing a selection across books.
  const backRef = useRef(null);
  backRef.current = () => {
    if (proHint) { setProHint(false); return true; }
    if (pickerOpen) { setPickerOpen(false); return true; }
    if (editFolder) { setEditFolder(null); return true; }
    if (view === 'folders') { setView('browse'); return true; }
    if (filter) { setFilter(''); return true; }
    if (toc.tocPath.length) { toc.setTocPath(p => p.slice(0, -1)); return true; }
    return false;
  };
  useEffect(() => pushBack(() => backRef.current()), []);

  // Router state (a Home bar, the tour's folders view) is read once per
  // navigation, then cleared so a refresh or Back does not apply it again.
  // Books must be in first, or a valid bookId would look unavailable.
  useEffect(() => {
    const st = location.state;
    if (!st || loadingData) return;
    if (st.view === 'folders') {
      setView('folders');
    } else if (available.some(b => b.id === st.bookId)) {
      setView('browse');
      setActiveBookId(st.bookId);
      setFilter('');
      setFlashFrom(null);
      setJump(st.sectionNumber != null ? { bookId: st.bookId, number: st.sectionNumber } : null);
    }
    navigate('.', { replace: true, state: null });
  }, [location.key, loadingData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!jump || !activeBook || activeBook.id !== jump.bookId || !toc.tocLoaded[activeBook.id]) return;
    const path = pathToSection(toc.toc, jump.number);
    toc.setTocPath(path);
    const last = path[path.length - 1];
    showToast(`ไปที่ ${activeBook.shortLabel}${last ? ` · ${nodeShortLabel(last)}` : ''} (ม.${jump.number})`);
    setJump(null);
  }, [jump, activeBook?.id, toc.tocLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back one level by swiping in from the left edge.
  const edge = useRef(null);
  const chipRow = useRef(null);
  useEffect(() => {
    chipRow.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [activeBook?.id]);

  if (loadingData || !activeBook) {
    return (
      <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-ui">
        <div className="flex-1 grid place-items-center text-[14px] text-ink-soft dark:text-rule-soft">กำลังโหลด…</div>
        <TabBar />
      </div>
    );
  }

  const pickBook = (id) => { setActiveBookId(id); setFilter(''); setFlashFrom(null); setJump(null); };
  const node = toc.tocPath[toc.tocPath.length - 1];
  const searching = !!filter.trim();
  const bookName = activeBook.displayName ?? activeBook.fullName;
  const pctHeard = Math.round((activeBook.sections.filter(s => heard.has(s.id)).length / activeBook.sections.length) * 100);
  const scopeSections = node ? sectionsInRange(activeBook, node.range) : activeBook.sections;
  const scopeSource = node ? `node:${activeBook.id}:${tocNodeKey(node, 0)}` : `book:${activeBook.id}`;
  const playScope = () => play.playRefs(
    scopeSource,
    node ? `${activeBook.shortLabel} ${nodeShortLabel(node)}` : bookName,
    scopeSections.map(s => ({ bookId: activeBook.id, sectionId: s.id })),
    node ? 'หมวดนี้ยังไม่มีมาตรา' : 'ฉบับนี้ยังไม่มีมาตรา',
  );

  const onAdded = (res) => {
    // What actually went in (spec 8): sections a folder already had don't count.
    const n = new Set(res.added.map(a => a.sectionId)).size;
    sel.setSelected({});
    refreshFolders();
    if (!res.folderIds.length) { showToast('ไม่พบโฟลเดอร์ที่เลือก'); return; }
    if (!res.added.length) { showToast('ทุกมาตรามีอยู่ในโฟลเดอร์ที่เลือกแล้ว'); return; }
    showToast(`เพิ่ม ${n} มาตราใน ${res.folderIds.length} โฟลเดอร์แล้ว`, {
      action: { label: 'เลิกทำ', onPress: () => { undoAdd(res.added); refreshFolders(); } },
    });
  };

  const sectionRows = toc.visibleSections.map((s, idx) => {
    const on = !!sel.selected[keyOf(activeBook.id, s.id)];
    return (
      <button key={`${s.id}_${idx}`} onClick={() => sel.toggleSelect(s)} role="checkbox" aria-checked={on}
        className="tap-row wv-srow w-full text-left flex items-center gap-3 px-[18px] py-[11px]">
        <Check state={on ? 'all' : 'none'} />
        <span className="wv-num">{s.number}</span>
        <span className={`flex-1 min-w-0 text-[13.5px] ${s.excerpt ? 'line-clamp-2 leading-snug' : 'truncate'}`} style={{ color: memColor(memory[s.id]) }}>
          {cleanTitle(s.title) || '—'}
        </span>
        {heard.has(s.id) && <i className="wv-heard" style={{ background: activeBook.waveColor }} title="ฟังแล้ว" />}
      </button>
    );
  });

  let body;
  if (searching) {
    body = toc.visibleSections.length ? (
      <>
        <button onClick={sel.toggleSelectAll} role="checkbox" aria-checked={sel.allSelected ? true : sel.someSelected ? 'mixed' : false} className="tap-row wv-allrow w-full flex items-center gap-3 px-[18px] py-2.5">
          <Check state={sel.allSelected ? 'all' : sel.someSelected ? 'some' : 'none'} />
          <span className="text-[13px] font-semibold">{sel.allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}</span>
          <span className="ml-auto text-[11.5px] text-ink-soft dark:text-rule-soft">{toc.visibleSections.length} รายการ</span>
        </button>
        {sectionRows}
      </>
    ) : (
      <div className="px-4 py-7 text-center text-[13px] text-ink-soft dark:text-rule-soft">ไม่พบมาตราที่ตรงกับ "{filter.trim()}"</div>
    );
  } else if (toc.atLeaf) {
    const st = sel.nodeSelectionState(node);
    body = (
      <>
        <div className="wv-allrow flex items-center gap-3 px-[18px] py-2.5">
          <button onClick={() => sel.selectAllInNode(node)} role="checkbox" aria-checked={st.all ? true : st.some ? 'mixed' : false} className="tap-row flex-1 flex items-center gap-3 text-left">
            <Check state={st.all ? 'all' : st.some ? 'some' : 'none'} />
            <span className="text-[13px] font-semibold">{st.all ? 'ยกเลิกทั้งหมวด' : 'เลือกทั้งหมวด'}</span>
            <span className="ml-auto text-[11.5px] text-ink-soft dark:text-rule-soft">{st.count}/{st.total}</span>
          </button>
          <button onClick={playScope} className="tap-btn wv-circle" aria-label="ฟังทั้งหมวด">
            <TransportGlyph stopping={play.isPlayingSource(scopeSource)} />
          </button>
        </div>
        {sectionRows}
      </>
    );
  } else if (!toc.currentNodes.length) {
    body = (
      <div className="px-4 py-7 text-center">
        {!toc.tocLoaded[activeBook.id] ? (
          <div className="text-[13px] text-ink-soft dark:text-rule-soft">กำลังโหลดสารบาญ…</div>
        ) : (
          <>
            <div className="text-[13px] text-ink-soft dark:text-rule-soft">โหลดสารบาญไม่สำเร็จ</div>
            <button onClick={toc.retryToc} className="tap-btn mt-2 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-accent text-accent">ลองใหม่</button>
          </>
        )}
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-2 gap-[9px] px-4 pt-1.5 pb-3">
        {toc.currentNodes.map((n, idx) => (
          <button
            key={tocNodeKey(n, idx)}
            onClick={() => toc.setTocPath(p => [...p, n])}
            disabled={!n.children?.length && !n.range}
            className="tap-btn wv-tile text-left"
          >
            <b>{nodeShortLabel(n)}</b>
            {n.num && <span>{n.name}</span>}
            {n.range && <small>ม.{n.range.from}–{n.range.to}</small>}
          </button>
        ))}
        <button onClick={playScope} className="tap-btn wv-tile is-play text-left">
          <span className="wv-circle wv-knock" aria-hidden="true"><TransportGlyph stopping={play.isPlayingSource(scopeSource)} size={14} /></span>
          <span>
            <b>{node ? 'ฟังทั้งหมวด' : 'ฟังทั้งฉบับ'}</b>
            <small>{scopeSections.length.toLocaleString()} มาตรา</small>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-ui overflow-hidden"
      onTouchStart={e => {
        // A swipe inside a modal or bottom sheet belongs to that layer.
        const t = e.touches[0];
        const inLayer = e.target.closest?.('[role="dialog"], .fixed');
        edge.current = t.clientX < 24 && !inLayer ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={e => {
        const start = edge.current;
        edge.current = null;
        if (!start || view !== 'browse' || !toc.tocPath.length || searching) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        // Clearly sideways only, so a vertical scroll that drifts is not a Back.
        if (dx > 60 && Math.abs(t.clientY - start.y) < dx / 2) toc.setTocPath(p => p.slice(0, -1));
      }}
      onTouchCancel={() => { edge.current = null; }}
    >
      <div className="flex items-center justify-between px-[18px] pt-3 pb-2 flex-shrink-0">
        <div className="font-display text-[22px] font-bold">{view === 'folders' ? 'โฟลเดอร์ของฉัน' : 'เลือกฟัง'}</div>
        <button
          data-tour="select-folders"
          onClick={() => setView(v => (v === 'folders' ? 'browse' : 'folders'))}
          className="tap-btn wv-iconbtn"
          aria-label={view === 'folders' ? 'กลับไปเลือกมาตรา' : 'โฟลเดอร์ของฉัน'}
        >
          {view === 'folders' ? '✕' : '📁'}
        </button>
      </div>

      {view === 'folders' ? (
        <FoldersView folders={folders} play={play} onEdit={setEditFolder} />
      ) : (
        <div className="flex-1 min-h-0 flex flex-col relative">
          <div ref={chipRow} className="wv-chips flex-shrink-0">
            {available.map(b => (
              <button key={b.id} className="tap-btn wv-chip" aria-pressed={b.id === activeBook.id} onClick={() => pickBook(b.id)}>
                <i style={{ background: b.waveColor }} />{b.shortLabel}
              </button>
            ))}
          </div>
          <div className="wv-panel flex-shrink-0">
            <div className="flex items-baseline gap-2">
              <b className="flex-1 min-w-0 truncate text-[14px]">{bookName}</b>
              <span className="text-[11px] text-ink-soft dark:text-rule-soft">ฟังแล้ว {pctHeard}%</span>
            </div>
            <WaveBars
              book={activeBook}
              heard={heard}
              nBars={40}
              height={54}
              onBar={(i) => { setFilter(''); setFlashFrom(i); setJump({ bookId: activeBook.id, number: activeBook.sections[i].number }); }}
              flashFrom={flashFrom}
            />
            <div className="flex justify-between mt-1.5 text-[10px] text-ink-soft dark:text-rule-soft tabular-nums">
              <span>ม.{activeBook.sections[0].number}</span>
              <span>แตะแท่งเพื่อไปที่หมวด</span>
              <span>ม.{activeBook.sections.at(-1).number}</span>
            </div>
          </div>
          {toc.tocPath.length > 0 && !searching && (
            <button onClick={() => toc.setTocPath(p => p.slice(0, -1))} className="tap-row flex items-center gap-1.5 px-[18px] pt-3 pb-0.5 text-left flex-shrink-0">
              <span className="text-accent text-[20px] leading-none" aria-hidden="true">‹</span>
              <span className="text-[12px] text-ink-soft dark:text-rule-soft truncate">{toc.tocPath.map(nodeShortLabel).join(' › ')}</span>
            </button>
          )}
          <label className="wv-search flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input aria-label="ค้นเลขมาตราหรือคำในฉบับนี้" value={filter} onChange={e => setFilter(e.target.value)} placeholder="ค้นเลขมาตรา หรือคำในฉบับนี้" type="search" />
          </label>
          <div data-tour="select-list" className="flex-1 overflow-y-auto pb-3">{body}</div>
          {sel.selectedList.length === 0 && (
            // Where the bar will appear, so the tour's spotlight has something
            // to land on before anything is ticked.
            <div data-tour="select-bar" aria-hidden="true" className="absolute left-3 right-3 bottom-2 h-[52px]" style={{ pointerEvents: 'none', opacity: 0 }} />
          )}
          {sel.selectedList.length > 0 && (
            <div data-tour="select-bar" className="wv-selbar flex-shrink-0">
              <span>เลือก {sel.selectedList.length}</span>
              <button onClick={() => sel.setSelected({})} className="tap-btn wv-selbar-clear">ล้าง</button>
              <span className="flex-1" />
              <button onClick={() => setPickerOpen(true)} className="tap-btn wv-selbar-btn">＋ เพิ่ม</button>
              <button onClick={play.playSelected} className="tap-btn wv-selbar-btn is-primary">
                {play.isPlayingSource('selected') ? '■ หยุด' : '▶ ฟัง'}
              </button>
            </div>
          )}
        </div>
      )}

      <TabBar />

      {pickerOpen && (
        <FolderPickerSheet
          sections={sel.selectedList}
          isPro={isPro}
          onNeedPro={() => setProHint(true)}
          onClose={() => setPickerOpen(false)}
          onAdded={onAdded}
        />
      )}
      {editFolder && (
        <FolderEditModal
          folder={editFolder}
          onClose={() => setEditFolder(null)}
          onChanged={() => {
            refreshFolders();
            setEditFolder(getFolders().find(x => x.id === editFolder.id) || null);
          }}
        />
      )}
      {proHint && gateContentFor(proAccessState, 'folder')?.kind === 'buy' && (
        <ProGateModal
          title="สร้างโฟลเดอร์ — ฟีเจอร์ Pro"
          body="สมาชิก Pro สร้างโฟลเดอร์จัดหมวดมาตราได้ไม่จำกัด"
          onClose={() => setProHint(false)}
        />
      )}
      {proHint && gateContentFor(proAccessState, 'folder')?.kind !== 'buy' && (
        <SignInGateModal state={proAccessState} feature="folder" onClose={() => setProHint(false)} />
      )}
    </div>
  );
}
