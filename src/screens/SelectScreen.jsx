import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useProAccess } from '../context/ProAccessContext';
import { gateContentFor } from '../lib/proAccessCopy';
import TabBar from '../components/TabBar';
import FolderEditModal from '../components/FolderEditModal';
import SignInGateModal from '../components/SignInGateModal';
import { cleanTitle } from '../lib/sectionText';
import {
  getFolders, getTopLevel, getChildren, groupSectionCount,
  createFolder, deleteFolder, renameFolder,
  addSectionToFolder, addSectionsToFolder, addSectionsToGroup,
  removeSectionFromFolder,
} from '../lib/folders';
import { getAllMemory } from '../lib/memory';
import { tocNodeKey } from '../lib/toc';
import ProGateModal from '../components/ProGateModal';
import ConfirmDialog from '../components/ConfirmDialog';
import BottomSheet from '../components/BottomSheet';
import { CODE_BOOK_IDS } from '../data/lawMeta';
import { keyOf } from '../lib/selection';
import { useTocNavigation } from '../hooks/useTocNavigation';
import { useSectionSelection } from '../hooks/useSectionSelection';
import { useFolderPlayback } from '../hooks/useFolderPlayback';

// A play button that will stop shows a square, not a triangle. The toggle is
// only discoverable if the icon says which of the two it is about to do.
const TransportIcon = ({ stopping, size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    {stopping ? <rect x="6" y="6" width="12" height="12" rx="1.5" /> : <path d="M8 5v14l11-7z" />}
  </svg>
);

// What an open permanent group says under its books. A group lists only the
// books it has sections from — eleven rows, nine of them "0", buried the ones
// in use — so this line is what tells people any law can go in.
function groupHint(group) {
  if (group.readOnly) return 'มาตราที่กด "จำไม่ได้" ในหน้าสถิติ จะเข้ามาอยู่ที่นี่ แยกตามกฎหมายให้เอง';
  return 'เพิ่มได้จากทุกกฎหมาย: ติ๊กมาตราทางซ้าย แตะชื่อกลุ่มนี้ แล้วกด "+ เพิ่มใน"';
}

// Title-text colors only (#5, #6): remembered = green, forgotten = orange
function titleColor(mem) {
  if (mem === 'remembered') return '#2d8c4a';
  if (mem === 'forgotten')  return '#e8821e';
  return undefined;
}

export default function SelectScreen() {
  const { books, loadingData } = useApp();
  const { isPro, state: proAccessState } = useProAccess(); // v18 #4: folder creation is Pro-only

  const available = books.filter(b => b.available && b.sections?.length);
  const [activeBookId, setActiveBookId] = useState(null);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const activeBook = available.find(b => b.id === activeBookId) || available[0];

  const [filter, setFilter]           = useState('');
  const [folders, setFolders]         = useState(() => getFolders());
  const [activeFolderId, setActiveFolderId] = useState(null); // leaf id being targeted
  // Accordion mode (#2): only one group expanded at a time
  // v18 #3: all groups start collapsed (including "จำไม่ได้")
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [proHint, setProHint] = useState(false); // v18 #4: folder-create upsell
  // { open, mode: 'browse' | 'create' | 'edit', focusId }
  const [folderModal, setFolderModalState] = useState({ open: false, mode: 'browse', focusId: null });
  const setFolderModal = (val) => {
    if (typeof val === 'boolean') setFolderModalState({ open: val, mode: 'browse', focusId: null });
    else setFolderModalState(val);
  };
  const [memory, setMemory]           = useState(() => getAllMemory());
  // v15 #1: focused folder editor
  const [editFolder, setEditFolder]   = useState(null);
  const refreshFolders = () => setFolders(getFolders());
  const {
    tocLoaded, retryToc, tocPath, setTocPath, currentNodes, atLeaf, visibleSections, nodeAllSections,
  } = useTocNavigation({ activeBook, filter });
  const {
    selected, setSelected, selectedList, toggleSelect, selectAllInNode, nodeSelectionState,
    toggleSelectAll, allSelected, someSelected,
  } = useSectionSelection({ activeBook, visibleSections });
  const { isPlayingSource, playSelected, playLeaf, playGroup } = useFolderPlayback({ books, folders, selectedList });

  const addToTarget = () => {
    if (!activeFolderId || !selectedList.length) return;
    const f = folders.find(x => x.id === activeFolderId);
    if (!f) return;
    if (f.readOnly) return; // v16 #2: cannot add to "จำไม่ได้"
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
      {/* Header (v18 #2 — "ฟังประมวลกฎหมาย" as the large title) */}
      <div className="px-4 pt-3 pb-2.5 border-b-2 border-rule dark:border-paper flex-shrink-0">
        <div className="font-display font-light leading-none" style={{ fontSize: 30, letterSpacing: -0.8 }}>
          ฟัง<span className="italic">กฎหมาย</span>
        </div>
      </div>

      {/* Book picker. A row of chips held five books; with eleven most of
          them were off-screen, so the current book is one button that opens
          the whole list. */}
      <div className="px-4 py-2 flex-shrink-0 border-b border-rule dark:border-ink-soft">
        <button
          onClick={() => setBookPickerOpen(true)}
          className="tap-row w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rule-soft dark:border-ink-soft bg-card dark:bg-dark-card text-left"
          aria-label="เลือกกฎหมาย"
        >
          <div className="flex-1 min-w-0">
            <div className="font-ui text-[9px] tracking-[1.5px] uppercase font-bold text-accent">กฎหมาย</div>
            <div className="font-display text-[15px] font-medium truncate">{activeBook?.shortName}</div>
          </div>
          {selectedList.length > 0 && (
            <span className="font-ui text-[10px] text-ink-soft dark:text-rule-soft flex-shrink-0">
              เลือกแล้ว {selectedList.length}
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0 text-ink-soft dark:text-rule-soft">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
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
              className="tap-row flex items-center gap-2 px-3 py-2 border-b border-rule-soft dark:border-ink-soft flex-shrink-0 bg-paper-dk/30 dark:bg-dark-card/30"
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
              className="tap-row flex items-center gap-2 px-3 py-2 border-b border-rule-soft dark:border-ink-soft flex-shrink-0 bg-paper-dk/30 dark:bg-dark-card/30"
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

          <div data-tour="select-list" className="flex-1 overflow-y-auto">
            {/* Mode A: Search results — show flat section list */}
            {filter.trim() && visibleSections.map((s, idx) => {
              const k = keyOf(activeBook.id, s.id);
              const on = !!selected[k];
              const mem = memory[s.id];
              const bodyColor = titleColor(mem);
              return (
                <button key={`${s.id}_${idx}`} onClick={() => toggleSelect(s)}
                  className="tap-row w-full text-left flex items-center gap-2.5 px-3 py-2.5 border-b border-rule-soft/40 dark:border-ink-soft/40"
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
                  {/* An excerpt gets two lines: at this width one line holds about a
                      dozen Thai characters, too few to tell sections apart. */}
                  <span className={`font-serif text-[15px] ${s.excerpt ? 'line-clamp-2 leading-snug' : 'truncate'}`} style={{ color: bodyColor }}>
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
                // Keyed by the node itself, never by index. Drilling one level
                // swaps this list's contents while the row count often stays
                // the same, so an index key let React reuse each DOM node and
                // merely retype it — carrying the press highlight from บรรพ 1
                // onto whatever (ลักษณะ 2) took that slot.
                <div key={tocNodeKey(node, idx)} className="flex items-center gap-2 px-3 py-2.5 border-b border-rule-soft/40 dark:border-ink-soft/40">
                  {/* Selection checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); selectAllInNode(node); }}
                    className="hit-44 tap-btn flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center"
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
                    className="tap-row flex-1 min-w-0 text-left flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-semibold text-[15px] text-ink dark:text-paper truncate">
                        {node.num ? `${node.word} ${node.num}` : node.name}
                      </div>
                      <div className="font-serif text-[12.5px] text-ink-soft dark:text-rule-soft truncate">
                        {node.num ? node.name : ''}
                        {node.range && (
                          <span className="ml-1">· มาตรา {node.range.from}–{node.range.to}</span>
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
                  className="tap-row w-full text-left flex items-center gap-2 px-2.5 py-2 border-b border-rule-soft/40 dark:border-ink-soft/40"
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
                  <span className={`font-serif text-[13px] ${s.excerpt ? 'line-clamp-2 leading-snug' : 'truncate'}`} style={{ color: bodyColor }}>
                    {cleanTitle(s.title) || '—'}
                  </span>
                </button>
              );
            })}

            {/* Empty state — loading and failure are different things */}
            {!filter.trim() && !atLeaf && currentNodes.length === 0 && (
              <div className="px-3 py-6 text-center">
                {!tocLoaded[activeBook?.id] ? (
                  <div className="font-serif text-[12px] italic text-ink-soft dark:text-rule-soft">
                    กำลังโหลดสารบาญ…
                  </div>
                ) : (
                  <>
                    <div className="font-serif text-[12px] italic text-ink-soft dark:text-rule-soft">
                      โหลดสารบาญไม่สำเร็จ
                    </div>
                    <button
                      onClick={retryToc}
                      className="tap-btn mt-2 font-ui text-[11px] font-bold px-3 py-1.5 rounded-lg border border-accent text-accent"
                    >
                      ลองใหม่
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="h-2" />
          </div>
        </div>

        {/* RIGHT — hierarchical folders */}
        <div data-tour="select-folders" className="flex flex-col min-h-0 border-l-2 border-rule dark:border-paper" style={{ width: '43%' }}>
          {/* Header button → open full modal */}
          <button onClick={() => setFolderModal(true)}
            className="tap-row flex items-center justify-between px-2.5 py-1.5 border-b border-rule-soft dark:border-ink-soft flex-shrink-0 hover:bg-paper-dk/40 dark:hover:bg-dark-card/40"
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
                      data-tour={item.id === 'grp-forgotten' ? 'folder-forgotten' : undefined}
                      onClick={() => {
                        setExpandedGroup(isOpen ? null : item.id);
                        setActiveFolderId(isActive ? null : item.id);
                      }}
                      className="tap-row w-full flex items-center px-2 py-2 border-b border-rule-soft/60 dark:border-ink-soft/60"
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
                        className="hit-44 tap-btn w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ml-1"
                        style={{ background: total ? '#a93225' : 'rgba(169,50,37,0.3)', color: '#ece4d4' }}
                      >
                        <TransportIcon stopping={isPlayingSource(`group:${item.id}`)} size={11} />
                      </span>
                    </button>

                    {/* Children (only the open group's), only books that hold something */}
                    {isOpen && children.filter(c => c.sections.length).map(child => {
                      const childActive = activeFolderId === child.id;
                      return (
                        <div key={child.id}
                          className="flex items-center pl-6 pr-2 py-1.5 border-b border-rule-soft/30 dark:border-ink-soft/30"
                          style={{ background: childActive ? 'rgba(169,50,37,0.10)' : 'var(--row-alt)' }}
                        >
                          <button onClick={() => setActiveFolderId(childActive ? null : child.id)} className="tap-row flex-1 min-w-0 text-left">
                            <div className="font-display text-[12px] truncate" style={{ color: childActive ? '#a93225' : undefined }}>
                              {child.name}
                            </div>
                            <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft">{child.sections.length}</div>
                          </button>
                          <button onClick={() => playLeaf(child)} disabled={!child.sections.length}
                            className="hit-44 tap-btn w-6 h-6 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0 disabled:opacity-30"
                          >
                            <TransportIcon stopping={isPlayingSource(`leaf:${child.id}`)} size={11} />
                          </button>
                        </div>
                      );
                    })}
                    {isOpen && (
                      <div className="pl-6 pr-2 py-1.5 border-b border-rule-soft/30 dark:border-ink-soft/30 font-serif italic text-[10px] leading-snug text-ink-soft dark:text-rule-soft"
                        style={{ background: 'var(--row-alt)' }}
                      >
                        {groupHint(item)}
                      </div>
                    )}
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
                  <button onClick={() => setActiveFolderId(on ? null : item.id)} className="tap-row flex-1 min-w-0 text-left">
                    <div className="font-display text-[13px] font-medium truncate" style={{ color: on ? '#a93225' : undefined }}>
                      {item.name}
                    </div>
                    <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft">{item.sections.length} มาตรา</div>
                  </button>
                  <button onClick={() => playLeaf(item)} disabled={!item.sections.length}
                    className="hit-44 tap-btn w-7 h-7 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0 disabled:opacity-30"
                  >
                    <TransportIcon stopping={isPlayingSource(`leaf:${item.id}`)} size={13} />
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
        <div data-tour="select-bar" className="flex-shrink-0 border-t border-rule dark:border-ink-soft bg-paper dark:bg-dark-bg px-3 py-2 flex items-center gap-2">
          {selectedList.length > 0 ? (
            <>
              <div className="font-ui text-[11px] font-bold text-ink dark:text-paper flex-shrink-0">เลือก {selectedList.length}</div>
              <button onClick={() => setSelected({})} className="tap-btn font-ui text-[10px] text-ink-soft dark:text-rule-soft underline flex-shrink-0">ล้าง</button>
              <div className="flex-1" />
              {/* v16 #2: "+ เพิ่มใน" hidden when target folder is read-only */}
              {activeFolderId && !folders.find(x => x.id === activeFolderId)?.readOnly && (
                <button onClick={addToTarget}
                  className="tap-btn font-ui text-[11px] font-semibold px-3 py-2 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper"
                >
                  + เพิ่มใน
                </button>
              )}
              <button onClick={playSelected}
                className="tap-btn font-ui text-[11px] font-bold px-3.5 py-2 rounded-lg bg-accent text-paper flex items-center gap-1.5"
              >
                <TransportIcon stopping={isPlayingSource('selected')} size={12} />
                {isPlayingSource('selected') ? 'หยุด' : 'ฟังเลย'}
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
                  className="tap-btn font-ui text-[11px] font-semibold px-3 py-2 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  แก้ไข
                </button>
              )}
              {/* v18 #4: folder creation is Pro-only */}
              <button
                onClick={() => isPro ? setFolderModal({ open: true, mode: 'create', focusId: null }) : setProHint(true)}
                className="tap-btn font-ui text-[11px] font-bold px-3.5 py-2 rounded-lg bg-accent text-paper flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                เพิ่มโฟลเดอร์
                {!isPro && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="opacity-90">
                    <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm-3 8V6a3 3 0 0 1 6 0v3H9z" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>
      )}

      <TabBar />

      {bookPickerOpen && (
        <BookPicker
          books={available}
          activeId={activeBook?.id}
          selectedCountOf={(bookId) => selectedList.filter(x => x.bookId === bookId).length}
          onPick={(id) => { setActiveBookId(id); setFilter(''); setBookPickerOpen(false); }}
          onClose={() => setBookPickerOpen(false)}
        />
      )}

      {/* Full-size folder management modal */}
      {folderModal.open && (
        <FolderModal
          folders={folders}
          initialMode={folderModal.mode}
          initialExpandedId={folderModal.focusId}
          canCreate={isPro}
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

      {/* v18 #4: Pro upsell for folder creation. Shared with the reader's
          highlight and bookmark gates, and it now takes the user to the
          packages instead of telling them where to find them. */}
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

// ─── Book picker ──────────────────────────────────────────────────────────────
// Codes first, then the acts, numbered as on Home. The count of sections
// already ticked in each book is shown because a selection survives switching
// books, and otherwise nothing says where the ticks are.
function BookPicker({ books, activeId, selectedCountOf, onPick, onClose }) {
  const codes = books.filter(b => CODE_BOOK_IDS.includes(b.id));
  const groups = [
    { label: 'ประมวลกฎหมาย', list: codes, offset: 0 },
    { label: 'รัฐธรรมนูญและพระราชบัญญัติ', list: books.filter(b => !CODE_BOOK_IDS.includes(b.id)), offset: codes.length },
  ];
  return (
    <BottomSheet height="80%" onClose={onClose}>
      {({ dragHandlers }) => (
        <>
          <div className="px-5 pt-1 pb-3 border-b border-rule dark:border-ink-soft select-none flex-shrink-0" {...dragHandlers}>
            <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-accent">เลือกฟัง</div>
            <div className="font-display text-[20px] font-medium leading-tight">เลือกกฎหมาย</div>
          </div>
          <div className="flex-1 overflow-y-auto pb-4">
            {groups.filter(g => g.list.length).map(g => (
              <div key={g.label}>
                <div className="px-5 pt-3.5 pb-1.5 font-ui text-[10px] tracking-[1.5px] uppercase font-bold text-ink-soft dark:text-rule-soft">
                  {g.label}
                </div>
                {g.list.map((b, i) => {
                  const on = b.id === activeId;
                  const ticked = selectedCountOf(b.id);
                  return (
                    <button key={b.id} onClick={() => onPick(b.id)}
                      className="tap-row w-full text-left flex items-center gap-3 px-5 py-2.5 border-t border-rule-soft/60 dark:border-ink-soft/60"
                      style={{ background: on ? 'rgba(169,50,37,0.08)' : 'transparent' }}
                    >
                      <span className="font-display italic text-accent flex-shrink-0" style={{ fontSize: 18, minWidth: 26 }}>
                        {String(g.offset + i + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-display text-[15px] font-medium leading-snug" style={{ color: on ? '#a93225' : undefined }}>
                          {b.shortName}
                        </span>
                        <span className="block font-ui text-[10px] text-ink-soft dark:text-rule-soft">
                          {b.subtitle} · {b.sections.length} มาตรา{ticked ? ` · เลือกแล้ว ${ticked}` : ''}
                        </span>
                      </span>
                      {on && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a93225" strokeWidth="2.5" className="flex-shrink-0"><path d="M5 12l5 5L20 6" /></svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </BottomSheet>
  );
}

// ─── Full-size Folder Modal ───────────────────────────────────────────────────
function FolderModal({ folders, initialMode, initialExpandedId, canCreate = true, onClose, refreshFolders, playLeaf, playGroup, setActiveFolderId }) {
  const [creating, setCreating]     = useState(initialMode === 'create');
  const [newName, setNewName]       = useState('');
  const [expandedId, setExpandedId] = useState(initialExpandedId || null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');

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

  const [pendingDelete, setPendingDelete] = useState(null);

  const confirmDelete = () => {
    deleteFolder(pendingDelete);
    refreshFolders();
    setExpandedId(null);
    setPendingDelete(null);
  };

  const renderFolderRow = (f, isChild = false) => {
    const exp = f.id === expandedId;
    const children = isChild ? [] : folders.filter(x => x.parentId === f.id);
    // A group shows only the books it holds sections from; see groupHint.
    const shownChildren = children.filter(c => c.sections.length);
    const total = f.type === 'group'
      ? children.reduce((s, c) => s + c.sections.length, 0)
      : f.sections.length;

    return (
      <div key={f.id} className={`border-b border-rule dark:border-ink-soft ${isChild ? 'pl-4' : ''}`}>
        <div className="flex items-center gap-2 px-4 py-2.5">
          {f.type === 'group' && (
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
            className="hit-44 tap-btn w-8 h-8 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0 disabled:opacity-30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>
        </div>

        {/* Expanded children */}
        {exp && shownChildren.map(c => renderFolderRow(c, true))}
        {exp && f.type === 'group' && (
          <div className="pl-8 pr-4 pb-2 font-serif italic text-[11px] leading-snug text-ink-soft dark:text-rule-soft">
            {groupHint(f)}
          </div>
        )}

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
              <button onClick={() => setPendingDelete(f.id)}
                className="tap-btn font-ui text-[11px] text-accent underline ml-auto">ลบ</button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
    <BottomSheet height="85%" onClose={onClose}>
      {({ dragHandlers }) => (
      <>
        <div
          className="flex items-center justify-between px-5 pt-1 pb-3 border-b border-rule dark:border-ink-soft select-none flex-shrink-0"
          {...dragHandlers}
        >
          <div>
            <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-accent">โฟลเดอร์</div>
            <div className="font-display text-[20px] font-medium leading-tight">จัดการโฟลเดอร์</div>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <button onClick={() => setCreating(true)}
                className="tap-btn font-ui text-[11px] font-bold px-3 py-2 rounded-lg bg-accent text-paper">+ ใหม่</button>
            )}
            <button onClick={onClose} className="hit-44 tap-btn p-2 text-ink-soft dark:text-rule-soft">
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
      </>
      )}
    </BottomSheet>

      {pendingDelete && (
        <ConfirmDialog
          title="ลบโฟลเดอร์นี้?"
          body={`"${folders.find(f => f.id === pendingDelete)?.name ?? ''}" จะถูกลบ มาตราที่อยู่ในนั้นไม่ถูกลบออกจากประมวล`}
          confirmLabel="ลบโฟลเดอร์"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
