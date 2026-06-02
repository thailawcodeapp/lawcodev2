import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useTts } from '../context/TtsContext';
import TabBar from '../components/TabBar';
import { cleanTitle, buildItemsFromRefs } from '../lib/sectionText';
import {
  getFolders, getTopLevel, getChildren, groupSectionCount,
  createFolder, deleteFolder, renameFolder,
  addSectionToFolder, addSectionsToFolder, addSectionsToGroup,
  removeSectionFromFolder,
} from '../lib/folders';
import { getAllMemory } from '../lib/memory';

const keyOf = (bookId, sectionId) => `${bookId}::${sectionId}`;

function colorFor(mem) {
  if (mem === 'remembered') return '#2d8c4a';
  if (mem === 'forgotten')  return '#c33b2c';
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
  const [expandedGroups, setExpandedGroups] = useState({ 'grp-forgotten': true }); // open by default
  const [folderModal, setFolderModal] = useState(false);
  const [memory, setMemory]           = useState(() => getAllMemory());

  const refreshFolders = () => setFolders(getFolders());
  const selectedList   = Object.values(selected);

  const visibleSections = useMemo(() => {
    if (!activeBook) return [];
    const f = filter.trim();
    if (!f) return activeBook.sections;
    const low = f.toLowerCase();
    return activeBook.sections.filter(
      s => String(s.number).startsWith(f) || s.title?.toLowerCase().includes(low),
    );
  }, [activeBook, filter]);

  const visibleKeys  = visibleSections.map(s => keyOf(activeBook?.id, s.id));
  const allSelected  = visibleKeys.length > 0 && visibleKeys.every(k => selected[k]);
  const someSelected = visibleKeys.some(k => selected[k]) && !allSelected;

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
        {/* LEFT — sections */}
        <div className="flex flex-col min-h-0" style={{ width: '57%' }}>
          <div className="px-2.5 py-1.5 border-b border-rule-soft dark:border-ink-soft flex-shrink-0">
            <input
              value={filter} onChange={e => setFilter(e.target.value)}
              placeholder="ค้นเลขมาตรา / คำ"
              className="w-full bg-card dark:bg-dark-card text-ink dark:text-paper font-ui text-[12px] rounded-md px-2.5 py-1.5 outline-none border border-rule-soft dark:border-ink-soft placeholder:text-ink-soft/50"
            />
          </div>

          {/* Select-all */}
          {visibleSections.length > 0 && (
            <button onClick={toggleSelectAll}
              className="flex items-center gap-2 px-2.5 py-1.5 border-b border-rule-soft dark:border-ink-soft flex-shrink-0 bg-paper-dk/30 dark:bg-dark-card/30"
            >
              <span className="w-4 h-4 rounded border flex items-center justify-center"
                style={{ borderColor: allSelected || someSelected ? '#a93225' : '#bdb19a', background: allSelected ? '#a93225' : 'transparent' }}
              >
                {allSelected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ece4d4" strokeWidth="3"><path d="M5 12l5 5L20 6" /></svg>}
                {someSelected && <span className="w-2 h-[2px] bg-accent" />}
              </span>
              <span className="font-ui text-[11px] font-bold text-ink dark:text-paper">{allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}</span>
              <span className="font-ui text-[10px] text-ink-soft dark:text-rule-soft ml-auto">{visibleSections.length} รายการ</span>
            </button>
          )}

          <div className="flex-1 overflow-y-auto">
            {visibleSections.map((s, idx) => {
              const k = keyOf(activeBook.id, s.id);
              const on = !!selected[k];
              const mem = memory[s.id];
              const titleColor = colorFor(mem);
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
                    style={{ fontSize: 14, minWidth: 30, fontVariantNumeric: 'lining-nums', color: titleColor || '#a93225' }}
                  >
                    {s.number}
                  </span>
                  <span className="font-serif text-[12px] truncate" style={{ color: titleColor }}>
                    {cleanTitle(s.title) || '—'}
                  </span>
                </button>
              );
            })}
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
                // Group accordion
                const isOpen = !!expandedGroups[item.id];
                const children = folders.filter(f => f.parentId === item.id);
                const total = children.reduce((s, c) => s + c.sections.length, 0);
                const isActive = activeFolderId === item.id;
                return (
                  <div key={item.id}>
                    {/* Group header row */}
                    <div className="flex items-center px-2 py-1.5 border-b border-rule-soft/60 dark:border-ink-soft/60"
                      style={{ background: isActive ? 'rgba(169,50,37,0.08)' : 'transparent' }}
                    >
                      <button onClick={() => setExpandedGroups(e => ({ ...e, [item.id]: !isOpen }))}
                        className="flex-shrink-0 p-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
                        >
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                      </button>
                      <button className="flex-1 min-w-0 text-left" onClick={() => setActiveFolderId(isActive ? null : item.id)}>
                        <div className="font-display text-[12px] font-semibold truncate" style={{ color: isActive ? '#a93225' : undefined }}>
                          {item.name}
                        </div>
                        <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft">{total} มาตรา</div>
                      </button>
                      <button onClick={() => playGroup(item.id)} disabled={!total}
                        className="w-6 h-6 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0 disabled:opacity-30 ml-1"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      </button>
                    </div>

                    {/* Children */}
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

      {/* Selection action bar */}
      {selectedList.length > 0 && (
        <div className="flex-shrink-0 border-t border-rule dark:border-ink-soft bg-paper dark:bg-dark-bg px-3 py-2 flex items-center gap-2">
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
          {!activeFolderId && (
            <button onClick={() => { const f = createFolder(`รายการที่ ${folders.filter(x => !x.permanent).length + 1}`); refreshFolders(); setActiveFolderId(f.id); addSectionsToFolder(f.id, selectedList); setSelected({}); refreshFolders(); }}
              className="font-ui text-[11px] font-semibold px-3 py-2 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper"
            >
              + โฟลเดอร์ใหม่
            </button>
          )}
          <button onClick={playSelected}
            className="font-ui text-[11px] font-bold px-3.5 py-2 rounded-lg bg-accent text-paper flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            ฟังเลย
          </button>
        </div>
      )}

      <TabBar />

      {/* Full-size folder management modal */}
      {folderModal && (
        <FolderModal
          folders={folders}
          onClose={() => setFolderModal(false)}
          refreshFolders={refreshFolders}
          playLeaf={playLeaf}
          playGroup={playGroup}
          setActiveFolderId={(id) => { setActiveFolderId(id); setFolderModal(false); }}
        />
      )}
    </div>
  );
}

// ─── Full-size Folder Modal ───────────────────────────────────────────────────
function FolderModal({ folders, onClose, refreshFolders, playLeaf, playGroup, setActiveFolderId }) {
  const [creating, setCreating]     = useState(false);
  const [newName, setNewName]       = useState('');
  const [expandedId, setExpandedId] = useState(null);
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

        {/* Actions for non-permanent leaves only */}
        {exp && f.type !== 'group' && f.deletable !== false && (
          <div className="flex gap-4 px-4 pb-2">
            <button onClick={() => { setRenamingId(f.id); setRenameText(f.name); }}
              className="font-ui text-[11px] text-ink-soft dark:text-rule-soft underline">เปลี่ยนชื่อ</button>
            <button onClick={() => setActiveFolderId(f.id)}
              className="font-ui text-[11px] text-accent underline">เลือก</button>
            <button onClick={() => handleDelete(f.id)}
              className="font-ui text-[11px] text-accent underline ml-auto">ลบ</button>
          </div>
        )}
        {exp && f.type === 'group' && (
          <div className="flex gap-4 px-4 pb-2">
            <button onClick={() => setActiveFolderId(f.id)}
              className="font-ui text-[11px] text-accent underline">เพิ่มมาตราเข้ากลุ่มนี้</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative w-full bg-paper dark:bg-dark-bg rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '88%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-rule-soft dark:bg-ink-soft" />
        </div>

        <div className="flex items-center justify-between px-5 pt-1 pb-3 border-b border-rule dark:border-ink-soft">
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
