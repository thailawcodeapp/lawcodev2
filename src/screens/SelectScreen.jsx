import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useTts } from '../context/TtsContext';
import TabBar from '../components/TabBar';
import { cleanTitle, buildItemsFromRefs } from '../lib/sectionText';
import {
  getFolders, createFolder, deleteFolder, renameFolder,
  addSectionsToFolder, removeSectionFromFolder,
} from '../lib/folders';

const keyOf = (bookId, sectionId) => `${bookId}::${sectionId}`;

export default function SelectScreen() {
  const { books, loadingData } = useApp();
  const { playSections } = useTts();

  const available = books.filter(b => b.available && b.sections?.length);
  const [activeBookId, setActiveBookId] = useState(null);
  const activeBook = available.find(b => b.id === activeBookId) || available[0];

  const [selected, setSelected] = useState({}); // key -> {sectionId,bookId,number,title}
  const [filter, setFilter] = useState('');
  const [folders, setFolders] = useState(() => getFolders());
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');

  const refreshFolders = () => setFolders(getFolders());
  const selectedList = Object.values(selected);

  const visibleSections = useMemo(() => {
    if (!activeBook) return [];
    const f = filter.trim();
    if (!f) return activeBook.sections;
    const low = f.toLowerCase();
    return activeBook.sections.filter(
      s => String(s.number).startsWith(f) || s.title?.toLowerCase().includes(low),
    );
  }, [activeBook, filter]);

  const toggleSelect = (s) => {
    const k = keyOf(activeBook.id, s.id);
    setSelected(prev => {
      const next = { ...prev };
      if (next[k]) delete next[k];
      else next[k] = { sectionId: s.id, bookId: activeBook.id, number: s.number, title: s.title };
      return next;
    });
  };

  const playSelected = () => {
    const items = buildItemsFromRefs(books, selectedList);
    if (items.length) playSections(items, 0);
  };

  const playFolder = (folder) => {
    const items = buildItemsFromRefs(books, folder.sections);
    if (items.length) playSections(items, 0);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const f = createFolder(name);
    setNewName('');
    setCreating(false);
    refreshFolders();
    setActiveFolderId(f.id);
  };

  const addToActiveFolder = () => {
    let folderId = activeFolderId;
    if (!folderId) {
      // No folder chosen — create one automatically
      const f = createFolder(`รายการที่ ${folders.length + 1}`);
      folderId = f.id;
    }
    addSectionsToFolder(folderId, selectedList);
    setSelected({});
    setActiveFolderId(folderId);
    refreshFolders();
    setExpandedId(folderId);
  };

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
            <button
              key={b.id}
              onClick={() => setActiveBookId(b.id)}
              className="whitespace-nowrap font-ui text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 transition-colors"
              style={{
                background: on ? '#a93225' : 'transparent',
                color: on ? '#ece4d4' : undefined,
                border: on ? '1px solid #a93225' : '1px solid #bdb19a',
              }}
            >
              {b.shortName}
            </button>
          );
        })}
      </div>

      {/* Two-panel body */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT — browse + tick */}
        <div className="flex flex-col min-h-0" style={{ width: '57%' }}>
          <div className="px-2.5 py-1.5 border-b border-rule-soft dark:border-ink-soft flex-shrink-0">
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="ค้นเลขมาตรา / คำ"
              className="w-full bg-card dark:bg-dark-card text-ink dark:text-paper font-ui text-[12px] rounded-md px-2.5 py-1.5 outline-none border border-rule-soft dark:border-ink-soft placeholder:text-ink-soft/50"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {visibleSections.map((s, idx) => {
              const k = keyOf(activeBook.id, s.id);
              const on = !!selected[k];
              return (
                <button
                  key={`${s.id}_${idx}`}
                  onClick={() => toggleSelect(s)}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 border-b border-rule-soft/40 dark:border-ink-soft/40"
                >
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center"
                    style={{
                      borderColor: on ? '#a93225' : '#bdb19a',
                      background: on ? '#a93225' : 'transparent',
                    }}
                  >
                    {on && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ece4d4" strokeWidth="3">
                        <path d="M5 12l5 5L20 6" />
                      </svg>
                    )}
                  </span>
                  <span className="font-display font-medium italic text-accent flex-shrink-0" style={{ fontSize: 14, minWidth: 30, fontVariantNumeric: 'lining-nums' }}>
                    {s.number}
                  </span>
                  <span className="font-serif text-[12px] text-ink dark:text-paper truncate">
                    {cleanTitle(s.title) || '—'}
                  </span>
                </button>
              );
            })}
            <div className="h-2" />
          </div>
        </div>

        {/* RIGHT — folders */}
        <div className="flex flex-col min-h-0 border-l-2 border-rule dark:border-paper" style={{ width: '43%' }}>
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-rule-soft dark:border-ink-soft flex-shrink-0">
            <span className="font-ui text-[10px] tracking-[1px] uppercase font-bold text-ink-soft dark:text-rule-soft">โฟลเดอร์</span>
            <button onClick={() => setCreating(v => !v)} className="font-ui text-[11px] font-bold text-accent">+ ใหม่</button>
          </div>

          {creating && (
            <div className="px-2.5 py-2 border-b border-rule-soft dark:border-ink-soft flex gap-1.5 flex-shrink-0">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="ชื่อโฟลเดอร์"
                autoFocus
                className="flex-1 min-w-0 bg-card dark:bg-dark-card text-ink dark:text-paper font-ui text-[11px] rounded px-2 py-1 outline-none border border-rule-soft dark:border-ink-soft"
              />
              <button onClick={handleCreate} className="font-ui text-[11px] font-bold text-accent px-1">✓</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {folders.length === 0 && !creating && (
              <div className="px-3 py-5 text-center font-serif text-[11px] italic text-ink-soft dark:text-rule-soft leading-snug">
                สร้างโฟลเดอร์ แล้วเลือกมาตราจากด้านซ้ายมาเก็บไว้ฟัง
              </div>
            )}
            {folders.map(f => {
              const on = f.id === activeFolderId;
              const expanded = f.id === expandedId;
              return (
                <div key={f.id} className="border-b border-rule-soft/50 dark:border-ink-soft/50">
                  <div
                    className="flex items-center gap-1 px-2 py-1.5"
                    style={{ background: on ? 'rgba(169,50,37,0.10)' : 'transparent' }}
                  >
                    <button onClick={() => setActiveFolderId(on ? null : f.id)} className="flex-1 min-w-0 text-left">
                      {renamingId === f.id ? (
                        <input
                          value={renameText}
                          onChange={e => setRenameText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { renameFolder(f.id, renameText); setRenamingId(null); refreshFolders(); } }}
                          onBlur={() => { renameFolder(f.id, renameText); setRenamingId(null); refreshFolders(); }}
                          autoFocus
                          className="w-full bg-card dark:bg-dark-card text-ink dark:text-paper font-ui text-[11px] rounded px-1 py-0.5 outline-none border border-rule-soft"
                        />
                      ) : (
                        <>
                          <div className="font-display text-[13px] font-medium truncate" style={{ color: on ? '#a93225' : undefined }}>
                            {f.name}
                          </div>
                          <div className="font-ui text-[9px] text-ink-soft dark:text-rule-soft">{f.sections.length} มาตรา</div>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => playFolder(f)}
                      disabled={!f.sections.length}
                      className="w-7 h-7 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0 disabled:opacity-30"
                      aria-label="เล่น"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </button>
                    <button onClick={() => setExpandedId(expanded ? null : f.id)} className="p-1 text-ink-soft dark:text-rule-soft flex-shrink-0" aria-label="ดู">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </button>
                  </div>

                  {expanded && (
                    <div className="pb-1.5">
                      {f.sections.length === 0 && (
                        <div className="px-3 py-1.5 font-serif text-[10px] italic text-ink-soft dark:text-rule-soft">ยังไม่มีมาตรา</div>
                      )}
                      {f.sections.map(s => (
                        <div key={s.sectionId} className="flex items-center gap-1.5 px-2.5 py-1">
                          <span className="font-display italic text-accent text-[12px]" style={{ minWidth: 26 }}>{s.number}</span>
                          <span className="font-serif text-[10.5px] text-ink-soft dark:text-rule-soft truncate flex-1">{cleanTitle(s.title) || '—'}</span>
                          <button onClick={() => { removeSectionFromFolder(f.id, s.sectionId); refreshFolders(); }} className="text-ink-soft hover:text-accent p-0.5" aria-label="ลบ">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-3 px-2.5 pt-1">
                        <button onClick={() => { setRenamingId(f.id); setRenameText(f.name); }} className="font-ui text-[10px] text-ink-soft dark:text-rule-soft underline">เปลี่ยนชื่อ</button>
                        <button onClick={() => { deleteFolder(f.id); refreshFolders(); if (activeFolderId === f.id) setActiveFolderId(null); }} className="font-ui text-[10px] text-accent underline">ลบโฟลเดอร์</button>
                      </div>
                    </div>
                  )}
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
          <div className="font-ui text-[11px] font-bold text-ink dark:text-paper flex-shrink-0">
            เลือก {selectedList.length}
          </div>
          <button onClick={() => setSelected({})} className="font-ui text-[10px] text-ink-soft dark:text-rule-soft underline flex-shrink-0">ล้าง</button>
          <div className="flex-1" />
          <button
            onClick={addToActiveFolder}
            className="font-ui text-[11px] font-semibold px-3 py-2 rounded-lg border border-rule dark:border-ink-soft text-ink dark:text-paper"
          >
            + โฟลเดอร์
          </button>
          <button
            onClick={playSelected}
            className="font-ui text-[11px] font-bold px-3.5 py-2 rounded-lg bg-accent text-paper flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            ฟังเลย
          </button>
        </div>
      )}

      <TabBar />
    </div>
  );
}
