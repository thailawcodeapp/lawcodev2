import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useTts } from '../context/TtsContext';
import TabBar from '../components/TabBar';
import FolderEditModal from '../components/FolderEditModal';
import { cleanTitle, buildItemsFromRefs } from '../lib/sectionText';
import {
  getFolders, getTopLevel, getChildren, groupSectionCount,
  createFolder, deleteFolder, renameFolder,
  addSectionToFolder, addSectionsToFolder, addSectionsToGroup,
  removeSectionFromFolder,
} from '../lib/folders';
import { getAllMemory } from '../lib/memory';
import { loadToc, sectionsInRange } from '../lib/toc';

const keyOf = (bookId, sectionId) => `${bookId}::${sectionId}`;

// Title-text colors only (#5, #6): remembered = green, forgotten = orange
function titleColor(mem) {
  if (mem === 'remembered') return '#2d8c4a';
  if (mem === 'forgotten')  return '#e8821e';
  return undefined;
}

export default function SelectScreen() {
  const { books, loadingData } = useApp();
  const { playSections } = useTts();

  const available = books.filter(b => b.available && b.sections?.length);
  const [activeBookId, setActiveBookId] = useState(null);
  const activeBook = available.find(b => b.id === activeBookId) || available[0];

  const [selected, setSelected]       = useState({});
  const [filter, setFilter]           = useState('');
  const [folders, setFolders]         = useState(() => getFolders());
  const [activeFolderId, setActiveFolderId] = useState(null); // leaf id being targeted
  // Accordion mode (#2): only one group expanded at a time
  const [expandedGroup, setExpandedGroup] = useState('grp-forgotten');
  // { open, mode: 'browse' | 'create' | 'edit', focusId }
  const [folderModal, setFolderModalState] = useState({ open: false, mode: 'browse', focusId: null });
  const setFolderModal = (val) => {
    if (typeof val === 'boolean') setFolderModalState({ open: val, mode: 'browse', focusId: null });
    else setFolderModalState(val);
  };
  const [memory, setMemory]           = useState(() => getAllMemory());
  // v15 #1: focused folder editor
  const [editFolder, setEditFolder]   = useState(null);
  // v15 #2: TOC navigation stack on the left panel
  const [tocByBook, setTocByBook]     = useState({});
  const [tocPath, setTocPath]         = useState([]); // array of node refs from root

  // Load TOC for the active book once
  useEffect(() => {
    if (!activeBook) return;
    if (tocByBook[activeBook.id]) return;
    loadToc(activeBook.id).then(toc => {
      setTocByBook(t => ({ ...t, [activeBook.id]: toc }));
    });
  }, [activeBook?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset TOC path when switching books
  useEffect(() => { setTocPath([]); }, [activeBook?.id]);

  const refreshFolders = () => setFolders(getFolders());
  const selectedList   = Object.values(selected);

  // Current TOC level (root if no path, otherwise children of last path node)
  const currentToc = tocByBook[activeBook?.id] || [];
  const currentNodes = tocPath.length
    ? tocPath[tocPath.length - 1].children
    : currentToc;

  // When inside the TOC and on a leaf node (no children), show that node's sections.
  // When on a non-leaf node, show navigation. When at root, show top-level categories.
  const atLeaf = tocPath.length > 0 && !tocPath[tocPath.length - 1].children?.length;

  // Sections currently visible — only used when at a leaf TOC node OR when searching.
  const visibleSections = useMemo(() => {
    if (!activeBook) return [];
    const f = filter.trim();
    if (f) {
      const low = f.toLowerCase();
      return activeBook.sections.filter(
        s => String(s.number).startsWith(f) || s.title?.toLowerCase().includes(low),
      );
    }
    if (atLeaf) {
      const node = tocPath[tocPath.length - 1];
      return sectionsInRange(activeBook, node.range);
    }
    return [];
  }, [activeBook, filter, tocPath, atLeaf]);

  // Sections covered by the currently-focused TOC node (for select-all-in-node)
  const nodeAllSections = useMemo(() => {
    if (!activeBook || !tocPath.length) return null;
    return sectionsInRange(activeBook, tocPath[tocPath.length - 1].range);
  }, [activeBook, tocPath]);

  const visibleKeys  = visibleSections.map(s => keyOf(activeBook?.id, s.id));
  const allSelected  = visibleKeys.length > 0 && visibleKeys.every(k => selected[k]);
  const someSelected = visibleKeys.some(k => selected[k]) && !allSelected;

  // Bulk-select all sections under any TOC node (#2)
  const selectAllInNode = (node) => {
    const secs = sectionsInRange(activeBook, node.range);
    setSelected(prev => {
      const next = { ...prev };
      // Detect current state — if all already selected, toggle off; else toggle on
      const allOn = secs.length > 0 && secs.every(s => next[keyOf(activeBook.id, s.id)]);
      for (const s of secs) {
        const k = keyOf(activeBook.id, s.id);
        if (allOn) delete next[k];
        else next[k] = { sectionId: s.id, bookId: activeBook.id, number: s.number, title: s.title };
      }
      return next;
    });
  };

  // How many sections under this node are already selected (for indicator)
  const nodeSelectionState = (node) => {
    const secs = sectionsInRange(activeBook, node.range);
    if (secs.length === 0) return { all: false, some: false, count: 0, total: 0 };
    const on = secs.filter(s => selected[keyOf(activeBook.id, s.id)]).length;
    return { all: on === secs.length, some: on > 0 && on < secs.length, count: on, total: secs.length };
  };

  const toggleSelect = (s) => {
    const k = keyOf(activeBook.id, s.id);
    setSelected(prev => {
      const next = { ...prev };
      if (next[k]) delete next[k];
      else next[k] = { sectionId: s.id, bookId: activeBook.id, number: s.number, title: s.title };
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = { ...prev };
      if (allSelected) {
        for (const s of visibleSections) delete next[keyOf(activeBook.id, s.id)];
      } else {
        for (const s of visibleSections) {
          next[keyOf(activeBook.id, s.id)] = { sectionId: s.id, bookId: activeBook.id, number: s.number, title: s.title };
        }
      }
      return next;
    });
  };

  const playSelected = () => {
    const items = buildItemsFromRefs(books, selectedList);
    if (items.length) playSections(items, 0);
  };

  const playLeaf = (leaf) => {
    const items = buildItemsFromRefs(books, leaf.sections);
    if (items.length) playSections(items, 0);
  };

  const playGroup = (groupId) => {
    const children = folders.filter(f => f.parentId === groupId);
    const all = children.flatMap(c => c.sections);
    const items = buildItemsFromRefs(books, all);
    if (items.length) playSections(items, 0);
  };

  const addToTarget = () => {
    if (!activeFolderId || !selectedList.length) return;
    const f = folders.find(x => x.id === activeFolderId);
    if (!f) return;
    if (f.type === 'group') {
      addSectionsToGroup(f.id, selectedList);
    } else {
      addSectionsToFolder(f.id, selectedList);
    }
    setSelected({});
    refreshFolders();
  };

  const topLevel = getTopLevel();

  if (loadingData) {
    return (
      <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif">
        <div className="flex-1 flex items-center justify-center">
          <p className="font-display italic text-ink-soft text-[14px]">กำลังโหลด…</p>
        </div>
        <TabBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-paper dark:bg-dark-bg text-ink dark:text-paper font-serif overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="font-ui text-[9px] tracking-[3px] uppercase font-bold text-accent">ฟังประมวลกฎหมาย</div>
        <div className="font-display font-light leading-none mt-0.5" style={{ fontSize: 30, letterSpacing: -0.8 }}>
          เลือก<span className="italic">ตัวบท</span>
        </div>
      </div>

      {/* Book tabs */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto flex-shrink-0 border-b border-rule dark:border-ink-soft" style={{ scrollbarWidth: 'none' }}>
        {available.map(b => {
          const on = b.id === activeBook?.id;
          return (
            <button key={b.id} onClick={() => setActiveBookId(b.id)}
              className="whitespace-nowrap font-ui text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ background: on ? '#a93225' : 'transparent', color: on ? '#ece4d4' : undefined, border: on ? '1px solid #a93225' : '1px solid #bdb19a' }}
            >
              {b.shortName}
            </button>
          );
        })}
      </div>

      {/* Two-panel body */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT — TOC navigation OR sections-at-leaf OR search results (v15 #2)
            Font sizes scaled ~30% larger than before. */}
        <div className="flex flex-col min-h-0" style={{ width: '57%' }}>
          {/* Search box */}
          <div className="px-3 py-2 border-b border-rule-soft dark:border-ink-soft flex-shrink-0">
            <input
              value={filter} onChange={e => setFilter(e.target.value)}
              placeholder="ค้นเลขมาตรา / คำ"
              className="w-full bg-card dark:bg-dark-card text-ink dark:text-paper font-ui text-[15px] rounded-md px-3 py-2 outline-none border border-rule-soft dark:border-ink-soft placeholder:text-ink-soft/50"
            />
          </div>

          {/* Breadcrumb / back row (only when navigating TOC) */}
          {!filter.trim() && tocPath.length > 0 && (
            <div className="flex items-center px-3 py-1.5 border-b border-rule-soft dark:border-ink-soft flex-shrink-0 bg-paper-dk/30 dark:bg-dark-card/30">
              <button
                onClick={() => setTocPath(p => p.slice(0, -1))}
                className="flex items-center gap-1 font-ui text-[13px] font-semibold text-accent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 6-6 6 6 6" /></svg>
                ย้อนกลับ
              </button>
              <span className="font-ui text-[12px] text-ink-soft dark:text-rule-soft truncate flex-1 ml-2">
                {tocPath.map(n => n.num ? `${n.word} ${n.num}` : n.name).join(' › ')}
              </span>
            </div>
          )}

          {/* Select-all (for current node or search results) */}
          {!filter.trim() && tocPath.length > 0 && nodeAllSections && nodeAllSections.length > 0 && (
            <button
              onClick={() => selectAllInNode(tocPath[tocPath.length - 1])}
              className="flex items-center gap-2 px-3 py-2 border-b border-rule-soft dark:border-ink-soft flex-shrink-0 bg-paper-dk/30 dark:bg-dark-card/30"
            >
              {(() => {
                const st = nodeSelectionState(tocPath[tocPath.length - 1]);
                return (
                  <>
                    <span className="w-5 h-5 rounded border flex items-center justify-center"
                      style={{ borderColor: st.all || st.some ? '#a93225' : '#bdb19a', background: st.all ? '#a93225' : 'transparent' }}
                    >
                      {st.all && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ece4d4" strokeWidth="3"><path d="M5 12l5 5L20 6" /></svg>}
                      {st.some && <span className="w-2.5 h-[2px] bg-accent" />}
                    </span>
                    <span className="font-ui text-[13px] font-bold text-ink dark:text-paper">
                      {st.all ? 'ยกเลิกทั้งหมวด' : 'เลือกทั้งหมวด'}
                    </span>
                    <span className="font-ui text-[12px] text-ink-soft dark:text-rule-soft ml-auto">
                      {st.count}/{st.total}
                    </span>
                  </>
                );
              })()}
            </button>
          )}
          {filter.trim() && visibleSections.length > 0 && (
            <button onClick={toggleSelectAll}
              className="flex items-center gap-2 px-3 py-2 border-b border-rule-soft dark:border-ink-soft flex-shrink-0 bg-paper-dk/30 dark:bg-dark-card/30"
            >
              <span className="w-5 h-5 rounded border flex items-center justify-center"
                style={{ borderColor: allSelected || someSelected ? '#a93225' : '#bdb19a', background: allSelected ? '#a93225' : 'transparent' }}
              >
                {allSelected && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ece4d4" strokeWidth="3"><path d="M5 12l5 5L20 6" /></svg>}
                {someSelected && <span className="w-2.5 h-[2px] bg-accent" />}
              </span>
              <span className="font-ui text-[13px] font-bold text-ink dark:text-paper">{allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}</span>
              <span className="font-ui text-[12px] text-ink-soft dark:text-rule-soft ml-auto">{visibleSections.length} รายการ</span>
            </button>
          )}

          <div className="flex-1 overflow-y-auto">
            {/* Mode A: Search results — show flat section list */}
            {filter.trim() && visibleSections.map((s, idx) => {
              const k = keyOf(activeBook.id, s.id);
              const on = !!selected[k];
              const mem = memory[s.id];
              const bodyColor = titleColor(mem);
              return (
                <button key={`${s.id}_${idx}`} onClick={() => toggleSelect(s)}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 border-b border-rule-soft/40 dark:border-ink-soft/40"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center"
                    style={{ borderColor: on ? '#a93225' : '#bdb19a', background: on ? '#a93225' : 'transparent' }}
                  >
                    {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ece4d4" strokeWidth="3"><path d="M5 12l5 5L20 6" /></svg>}
                  </span>
                  <span className="font-display font-medium italic flex-shrink-0"
                    style={{ fontSize: 18, minWidth: 38, fontVariantNumeric: 'lining-nums', color: '#a93225' }}
                  >
                    {s.number}
                  </span>
                  <span className="font-serif text-[15px] truncate" style={{ color: bodyColor }}>
                    {cleanTitle(s.title) || '—'}
                  </span>
                </button>
              );
            })}

            {/* Mode B: TOC categories — navigate hierarchy */}
            {!filter.trim() && !atLeaf && currentNodes.map((node, idx) => {
              const hasChildren = node.children?.length > 0;
              const st = nodeSelectionState(node);
              return (
                <div key={idx} className="flex items-center gap-2 px-3 py-2.5 border-b border-rule-soft/40 dark:border-ink-soft/40">
                  {/* Selection checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); selectAllInNode(node); }}
                    className="flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center"
                    style={{ borderColor: st.all || st.some ? '#a93225' : '#bdb19a', background: st.all ? '#a93225' : 'transparent' }}
                    aria-label="เลือกหมวด"
                  >
                    {st.all && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ece4d4" strokeWidth="3"><path d="M5 12l5 5L20 6" /></svg>}
                    {st.some && <span className="w-2.5 h-[2px] bg-accent" />}
                  </button>
                  {/* Drill into category */}
                  <button
                    onClick={() => setTocPath(p => [...p, node])}
                    disabled={!hasChildren && !node.range}
                    className="flex-1 min-w-0 text-left flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-semibold text-[15px] text-ink dark:text-paper truncate">
                        {node.num ? `${node.word} ${node.num}` : node.name}
                      </div>
                      <div className="font-serif text-[12.5px] text-ink-soft dark:text-rule-soft truncate">
                        {node.num ? node.name : ''}
                        {node.range && (
                          <span className="ml-1 opacity-70">· มาตรา {node.range.from}–{node.range.to}</span>
                        )}
                      </div>
                    </div>
                    {hasChildren && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-soft dark:text-rule-soft flex-shrink-0">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}

            {/* Mode C: At a leaf TOC node — show its sections (ticked individually).
                v16: font + row 15% smaller than category mode for denser browsing. */}
            {!filter.trim() && atLeaf && visibleSections.map((s, idx) => {
              const k = keyOf(activeBook.id, s.id);
              const on = !!selected[k];
              const mem = memory[s.id];
              const bodyColor = titleColor(mem);
              return (
                <button key={`${s.id}_${idx}`} onClick={() => toggleSelect(s)}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 border-b border-rule-soft/40 dark:border-ink-soft/40"
                >
                  <span className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center"
                    style={{ borderColor: on ? '#a93225' : '#bdb19a', background: on ? '#a93225' : 'transparent' }}
                  >
                    {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ece4d4" strokeWidth="3"><path d="M5 12l5 5L20 6" /></svg>}
                  </span>
                  <span className="font-display font-medium italic flex-shrink-0"
                    style={{ fontSize: 15, minWidth: 32, fontVariantNumeric: 'lining-nums', color: '#a93225' }}
                  >
                    {s.number}
                  </span>
                  <span className="font-serif text-[13px] truncate" style={{ color: bodyColor }}>
                    {cleanTitle(s.title) || '—'}
                  </span>
                </button>
              );
            })}

            {/* Empty state */}
            {!filter.trim() && !atLeaf && currentNodes.length === 0 && (
              <div className="px-3 py-6 text-center font-serif text-[12px] italic text-ink-soft dark:text-rule-soft">
                กำลังโหลดสารบาญ…
              </div>
            )}

            <div className="h-2" />
          </div>
        </div>

        {/* RIGHT — hierarchical folders */}
        <div className="flex flex-col min-h-0 border-l-2 border-rule dark:border-paper" style={{ width: '43%' }}>
          {/* Header button → open full modal */}
          <button onClick={() => setFolderModal(true)}
            className="flex items-center justify-between px-2.5 py-1.5 border-b border-rule-soft dark:border-ink-soft flex-shrink-0 hover:bg-paper-dk/40 dark:hover:bg-dark-card/40"
          >
            <span className="font-ui text-[10px] tracking-[1px] uppercase font-bold text-accent">โฟลเดอร์</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
          </button>

          <div className="flex-1 overflow-y-auto">
            {topLevel.map(item => {
              if (item.type === 'group') {
                // #2: accordion — tap whole row to toggle. Opening one closes others.
                const isOpen = expandedGroup === item.id;
                const children = folders.filter(f => f.parentId === item.id);
                const total = children.reduce((s, c) => s + c.sections.length, 0);
                const isActive = activeFolderId === item.id;
                return (
                  <div key={item.id}>
                    {/* Group header — full row toggles expand */}
                    <button
                      onClick={() => {
                        setExpandedGroup(isOpen ? null : item.id);
                        setActiveFolderId(isActive ? null : item.id);
                      }}
                      className="w-full flex items-center px-2 py-2 border-b border-rule-soft/60 dark:border-ink-soft/60"
                      style={{ background: isActive ? 'rgba(169,50,37,0.08)' : 'transparent' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        className="flex-shrink-0"
                        style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                      <div className="flex-1 min-w-0 text-left pl-2">
                        <div className="font-display text-[12px] font-semibold truncate" style={{ color: isActive ? '#a93225' : undefined }}>
                          {item.name}
                        </div>
                        <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft">{total} มาตรา</div>
                      </div>
                      <span
                        onClick={(e) => { e.stopPropagation(); playGroup(item.id); }}
                        role="button"
                        aria-label="เล่น"
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ml-1"
                        style={{ background: total ? '#a93225' : 'rgba(169,50,37,0.3)', color: '#ece4d4' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      </span>
                    </button>

                    {/* Children (only the open group's) */}
                    {isOpen && children.map(child => {
                      const childActive = activeFolderId === child.id;
                      return (
                        <div key={child.id}
                          className="flex items-center pl-6 pr-2 py-1.5 border-b border-rule-soft/30 dark:border-ink-soft/30"
                          style={{ background: childActive ? 'rgba(169,50,37,0.10)' : 'rgba(0,0,0,0.02)' }}
                        >
                          <button onClick={() => setActiveFolderId(childActive ? null : child.id)} className="flex-1 min-w-0 text-left">
                            <div className="font-display text-[12px] truncate" style={{ color: childActive ? '#a93225' : undefined }}>
                              {child.name}
                            </div>
                            <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft">{child.sections.length}</div>
                          </button>
                          <button onClick={() => playLeaf(child)} disabled={!child.sections.length}
                            className="w-6 h-6 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0 disabled:opacity-30"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // Regular user leaf folder
              const on = activeFolderId === item.id;
              return (
                <div key={item.id}
                  className="flex items-center gap-1 px-2 py-2 border-b border-rule-soft/50 dark:border-ink-soft/50"
                  style={{ background: on ? 'rgba(169,50,37,0.10)' : 'transparent' }}
                >
                  <button onClick={() => setActiveFolderId(on ? null : item.id)} className="flex-1 min-w-0 text-left">
                    <div className="font-display text-[13px] font-medium truncate" style={{ color: on ? '#a93225' : undefined }}>
                      {item.name}
                    </div>
                    <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft">{item.sections.length} มาตรา</div>
                  </button>
                  <button onClick={() => playLeaf(item)} disabled={!item.sections.length}
                    className="w-7 h-7 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0 disabled:opacity-30"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                </div>
              );
            })}
            <div className="h-2" />
          </div>
        </div>
      </div>

      {/* Bottom action bar (#1):
          - With selection: + เพิ่มใน (if folder targeted) · ฟังเลย
          - With folder targeted (no selection): แก้ไข (opens management modal)
          - Always: เพิ่มโฟลเดอร์ at the far right */}
      {(selectedList.length > 0 || activeFolderId || true) && (
        <div className="flex-shrink-0 border-t border-rule dark:border-ink-soft bg-paper dark:bg-dark-bg px-3 py-2 flex items-center gap-2">
          {selectedList.length > 0 ? (
            <>
              <div className="font-ui text-[11px] font-bold text-ink dark:text-paper flex-shrink-0">เลือก {selectedList.length}</div>
              <button onClick={() => setSelected({})} className="font-ui text-[10px] text-ink-soft dark:text-rule-soft underline flex-shrink-0">ล้าง</button>
              <div className="flex-1" />
              {activeFolderId && (
                <button onClick={addToTarget}
                  className="font-ui text-[11px] font-semibold px-3 py-2 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper"
                >
                  + เพิ่มใน
                </button>
              )}
              <button onClick={playSelected}
                className="font-ui text-[11px] font-bold px-3.5 py-2 rounded-lg bg-accent text-paper flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                ฟังเลย
              </button>
            </>
          ) : (
            <>
              <div className="flex-1" />
              {activeFolderId && (
                <button onClick={() => {
                  const f = folders.find(x => x.id === activeFolderId);
                  if (f && f.type !== 'group') setEditFolder(f);
                  else setFolderModal({ open: true, mode: 'edit', focusId: activeFolderId });
                }}
                  className="font-ui text-[11px] font-semibold px-3 py-2 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  แก้ไข
                </button>
              )}
              <button onClick={() => setFolderModal({ open: true, mode: 'create', focusId: null })}
                className="font-ui text-[11px] font-bold px-3.5 py-2 rounded-lg bg-accent text-paper flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                เพิ่มโฟลเดอร์
              </button>
            </>
          )}
        </div>
      )}

      <TabBar />

      {/* Full-size folder management modal */}
      {folderModal.open && (
        <FolderModal
          folders={folders}
          initialMode={folderModal.mode}
          initialExpandedId={folderModal.focusId}
          onClose={() => setFolderModal(false)}
          refreshFolders={refreshFolders}
          playLeaf={playLeaf}
          playGroup={playGroup}
          setActiveFolderId={(id) => { setActiveFolderId(id); setFolderModal(false); }}
        />
      )}

      {/* Focused single-folder editor (v15 #1) */}
      {editFolder && (
        <FolderEditModal
          folder={editFolder}
          onClose={() => setEditFolder(null)}
          onChanged={() => {
            refreshFolders();
            // Refresh focused folder data from the latest list
            const next = getFolders().find(x => x.id === editFolder.id);
            if (next) setEditFolder(next);
            else setEditFolder(null); // folder was deleted
          }}
        />
      )}
    </div>
  );
}

// ─── Full-size Folder Modal ───────────────────────────────────────────────────
function FolderModal({ folders, initialMode, initialExpandedId, onClose, refreshFolders, playLeaf, playGroup, setActiveFolderId }) {
  const [creating, setCreating]     = useState(initialMode === 'create');
  const [newName, setNewName]       = useState('');
  const [expandedId, setExpandedId] = useState(initialExpandedId || null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');

  // #3: swipe-down on the handle/header area to close
  const [drag, setDrag] = useState({ y: 0, active: false, startY: 0 });
  const onTouchStart = (e) => setDrag({ y: 0, active: true, startY: e.touches[0].clientY });
  const onTouchMove = (e) => {
    if (!drag.active) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.startY);
    setDrag(d => ({ ...d, y: dy }));
  };
  const onTouchEnd = () => {
    if (!drag.active) return;
    if (drag.y > 100) onClose();
    else setDrag({ y: 0, active: false, startY: 0 });
  };
  const onMouseDown = (e) => setDrag({ y: 0, active: true, startY: e.clientY });
  const onMouseMove = (e) => {
    if (!drag.active) return;
    setDrag(d => ({ ...d, y: Math.max(0, e.clientY - drag.startY) }));
  };
  const onMouseUp = () => {
    if (!drag.active) return;
    if (drag.y > 100) onClose();
    else setDrag({ y: 0, active: false, startY: 0 });
  };

  const topLevel = folders.filter(f => !f.parentId);
  const groups   = topLevel.filter(f => f.type === 'group');
  const userLeaves = topLevel.filter(f => f.type !== 'group');

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const f = createFolder(name);
    setNewName(''); setCreating(false);
    refreshFolders(); setExpandedId(f.id);
  };

  const handleRename = (id) => {
    renameFolder(id, renameText); setRenamingId(null); refreshFolders();
  };

  const handleDelete = (id) => {
    if (confirm('ลบโฟลเดอร์นี้?')) { deleteFolder(id); refreshFolders(); setExpandedId(null); }
  };

  const renderFolderRow = (f, isChild = false) => {
    const exp = f.id === expandedId;
    const children = isChild ? [] : folders.filter(x => x.parentId === f.id);
    const total = f.type === 'group'
      ? children.reduce((s, c) => s + c.sections.length, 0)
      : f.sections.length;

    return (
      <div key={f.id} className={`border-b border-rule dark:border-ink-soft ${isChild ? 'pl-4' : ''}`}>
        <div className="flex items-center gap-2 px-4 py-2.5">
          {children.length > 0 && (
            <button onClick={() => setExpandedId(exp ? null : f.id)} className="flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: exp ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          )}
          <div className="flex-1 min-w-0">
            {renamingId === f.id ? (
              <input value={renameText} onChange={e => setRenameText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(f.id); if (e.key === 'Escape') setRenamingId(null); }}
                onBlur={() => handleRename(f.id)} autoFocus
                className="w-full bg-card dark:bg-dark-card text-ink dark:text-paper font-ui text-[14px] rounded px-2 py-1 outline-none border border-rule-soft"
              />
            ) : (
              <>
                <div className="font-display text-[14px] font-medium truncate">{f.name}</div>
                <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft">{total} มาตรา</div>
              </>
            )}
          </div>
          <button
            onClick={() => f.type === 'group' ? playGroup(f.id) : playLeaf(f)}
            disabled={!total}
            className="w-8 h-8 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0 disabled:opacity-30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
        </div>

        {/* Expanded children */}
        {exp && children.map(c => renderFolderRow(c, true))}

        {/* Actions row */}
        {exp && (
          <div className="flex gap-4 px-4 pb-2 flex-wrap">
            {f.lockedName !== true && (
              <button onClick={() => { setRenamingId(f.id); setRenameText(f.name); }}
                className="font-ui text-[11px] text-ink-soft dark:text-rule-soft underline">เปลี่ยนชื่อ</button>
            )}
            <button onClick={() => setActiveFolderId(f.id)}
              className="font-ui text-[11px] text-accent underline">
              {f.type === 'group' ? 'เพิ่มมาตราเข้ากลุ่มนี้' : 'เลือก'}
            </button>
            {f.deletable !== false && (
              <button onClick={() => handleDelete(f.id)}
                className="font-ui text-[11px] text-accent underline ml-auto">ลบ</button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={onClose}
      onMouseMove={drag.active ? onMouseMove : undefined}
      onMouseUp={drag.active ? onMouseUp : undefined}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative w-full bg-paper dark:bg-dark-bg rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          // #3.1: respect device-nav safe area + cap height so it never overflows
          maxHeight: 'calc(100% - env(safe-area-inset-top, 0px) - 16px)',
          height: '85%',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: `translateY(${drag.y}px)`,
          transition: drag.active ? 'none' : 'transform 200ms',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Swipe-down handle (#3) */}
        <div
          className="flex justify-center pt-2 pb-1 cursor-grab select-none"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
        >
          <div className="w-12 h-1.5 rounded-full bg-rule-soft dark:bg-ink-soft" />
        </div>

        <div
          className="flex items-center justify-between px-5 pt-1 pb-3 border-b border-rule dark:border-ink-soft select-none"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
        >
          <div>
            <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-accent">โฟลเดอร์</div>
            <div className="font-display text-[20px] font-medium leading-tight">จัดการโฟลเดอร์</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCreating(true)}
              className="font-ui text-[11px] font-bold px-3 py-2 rounded-lg bg-accent text-paper">+ ใหม่</button>
            <button onClick={onClose} className="p-2 text-ink-soft dark:text-rule-soft">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {creating && (
          <div className="px-5 py-2.5 border-b border-rule dark:border-ink-soft flex gap-2 flex-shrink-0">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
              autoFocus placeholder="ชื่อโฟลเดอร์"
              className="flex-1 bg-card dark:bg-dark-card text-ink dark:text-paper font-ui text-[13px] rounded-lg px-3 py-2 outline-none border border-rule-soft dark:border-ink-soft"
            />
            <button onClick={handleCreate} className="font-ui text-[12px] font-bold px-3 py-2 rounded-lg bg-ink dark:bg-paper text-paper dark:text-ink">บันทึก</button>
            <button onClick={() => { setCreating(false); setNewName(''); }} className="font-ui text-[12px] px-3 py-2 rounded-lg border border-rule dark:border-ink-soft">ยกเลิก</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Permanent groups */}
          {groups.map(g => renderFolderRow(g))}

          {/* User folders */}
          {userLeaves.length === 0 && !creating && (
            <div className="px-5 py-6 text-center font-serif text-[12px] italic text-ink-soft dark:text-rule-soft">
              กด "+ ใหม่" เพื่อสร้างโฟลเดอร์ส่วนตัว
            </div>
          )}
          {userLeaves.map(f => renderFolderRow(f))}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
