// Focused edit modal for a single folder — rename, view sections, remove sections,
// delete the whole folder. (v15 #1)
import { useState } from 'react';
import {
  renameFolder, deleteFolder, removeSectionFromFolder, getFolder,
} from '../lib/folders';
import { cleanTitle } from '../lib/sectionText';

export default function FolderEditModal({ folder, onClose, onChanged }) {
  const [name, setName] = useState(folder.name);
  const [sections, setSections] = useState(folder.sections);
  const [editingName, setEditingName] = useState(false);

  // Swipe-down to close
  const [drag, setDrag] = useState({ y: 0, active: false, startY: 0 });
  const onTouchStart = (e) => setDrag({ y: 0, active: true, startY: e.touches[0].clientY });
  const onTouchMove = (e) => {
    if (!drag.active) return;
    setDrag(d => ({ ...d, y: Math.max(0, e.touches[0].clientY - drag.startY) }));
  };
  const onTouchEnd = () => {
    if (!drag.active) return;
    if (drag.y > 100) onClose();
    else setDrag({ y: 0, active: false, startY: 0 });
  };

  const canRename = folder.lockedName !== true;
  const canDelete = folder.deletable !== false;
  const canRemoveSections = !folder.readOnly; // v16 #2

  const saveName = () => {
    if (!canRename) { setEditingName(false); return; }
    const n = name.trim();
    if (n && n !== folder.name) {
      renameFolder(folder.id, n);
      onChanged?.();
    }
    setEditingName(false);
  };

  const handleRemove = (sectionId) => {
    removeSectionFromFolder(folder.id, sectionId);
    setSections(s => s.filter(x => x.sectionId !== sectionId));
    onChanged?.();
  };

  const handleDeleteFolder = () => {
    if (!canDelete) return;
    if (confirm(`ลบโฟลเดอร์ "${name}"?`)) {
      deleteFolder(folder.id);
      onChanged?.();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
      <div
        className="relative w-full bg-paper dark:bg-dark-bg rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          maxHeight: 'calc(100% - env(safe-area-inset-top, 0px) - 16px)',
          height: '80%',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: `translateY(${drag.y}px)`,
          transition: drag.active ? 'none' : 'transform 200ms',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-2 pb-1 cursor-grab select-none"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <div className="w-12 h-1.5 rounded-full bg-rule-soft dark:bg-ink-soft" />
        </div>

        {/* Header */}
        <div
          className="px-5 pt-1 pb-3 border-b border-rule dark:border-ink-soft select-none"
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-ui text-[9px] tracking-[2px] uppercase font-bold text-accent">แก้ไขโฟลเดอร์</div>
              {editingName ? (
                <input
                  value={name}
                  autoFocus
                  onChange={e => setName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setName(folder.name); setEditingName(false); } }}
                  className="w-full mt-1 bg-card dark:bg-dark-card text-ink dark:text-paper font-display text-[20px] font-medium rounded px-2 py-1 outline-none border border-rule-soft"
                />
              ) : (
                <button
                  onClick={() => canRename && setEditingName(true)}
                  className="flex items-center gap-2 text-left mt-0.5"
                >
                  <div className="font-display text-[20px] font-medium leading-tight truncate">{name}</div>
                  {canRename && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-ink-soft dark:text-rule-soft flex-shrink-0">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  )}
                </button>
              )}
              <div className="font-ui text-[10px] text-ink-soft dark:text-rule-soft mt-0.5">
                {sections.length} มาตรา
                {folder.readOnly && <span className="ml-2 text-accent">· จัดการอัตโนมัติ</span>}
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-ink-soft dark:text-rule-soft flex-shrink-0" aria-label="ปิด">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Section list */}
        <div className="flex-1 overflow-y-auto">
          {sections.length === 0 && (
            <div className="px-5 py-10 text-center font-serif text-[13px] italic text-ink-soft dark:text-rule-soft">
              ยังไม่มีมาตราในโฟลเดอร์นี้
            </div>
          )}
          {sections.map(s => (
            <div key={s.sectionId} className="flex items-center gap-3 px-5 py-2.5" style={{ borderBottom: '1px dotted #bdb19a' }}>
              <span className="font-display font-medium italic text-accent flex-shrink-0" style={{ fontSize: 16, minWidth: 44, fontVariantNumeric: 'lining-nums' }}>
                {s.number}
              </span>
              <span className="flex-1 min-w-0 font-serif text-[12.5px] text-ink-soft dark:text-rule-soft truncate">
                {cleanTitle(s.title) || '—'}
              </span>
              {canRemoveSections && (
                <button
                  onClick={() => handleRemove(s.sectionId)}
                  className="text-ink-soft dark:text-rule-soft hover:text-accent p-1.5 flex-shrink-0"
                  aria-label="นำออก"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {canDelete && (
          <div className="px-5 py-3 border-t border-rule dark:border-ink-soft flex-shrink-0">
            <button
              onClick={handleDeleteFolder}
              className="w-full font-ui text-[12px] font-bold py-3 rounded-lg border border-accent text-accent"
            >
              ลบโฟลเดอร์นี้
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
