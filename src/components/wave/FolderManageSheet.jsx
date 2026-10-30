// Managing one folder on Wave: its sections with ✕ to take one out, "เพิ่มมาตรา"
// to go and tick more, rename and delete. A stats group lists its sections
// under each book, and removing one goes to that book's own leaf. "จำไม่ได้" is
// filled by the app, so it can only be looked through.
import { useState } from 'react';
import BottomSheet from '../BottomSheet';
import ConfirmDialog from '../ConfirmDialog';
import FolderArt from './FolderArt';
import { useApp } from '../../context/AppContext';
import { deleteFolder, removeSectionFromFolder, renameFolder, sortSectionsByNumber } from '../../lib/folders';
import { cleanTitle } from '../../lib/sectionText';
import { LAW_BOOKS_META } from '../../data/lawMeta';

const labelOf = (bookId) => LAW_BOOKS_META.find(m => m.id === bookId)?.shortLabel ?? bookId;

export default function FolderManageSheet({ folder, folders, onAdd, onClose, onChanged }) {
  const { books } = useApp();
  const [name, setName] = useState(folder.name);
  const [editingName, setEditingName] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const leaves = folder.type === 'group'
    ? folders.filter(f => f.parentId === folder.id && f.sections.length)
    : [folder];
  const total = leaves.reduce((sum, l) => sum + l.sections.length, 0);
  const canRename = folder.lockedName !== true;
  const canDelete = folder.deletable !== false;
  const canEdit = !folder.readOnly;

  // The "จำไม่ได้" folder stores blank titles, so fall back to the law's own.
  const titleFor = (s) => cleanTitle(s.title)
    || cleanTitle(books.find(b => b.id === s.bookId)?.sections?.find(x => x.id === s.sectionId)?.title)
    || '';

  const saveName = () => {
    const n = name.trim();
    if (canRename && n && n !== folder.name) {
      renameFolder(folder.id, n);
      onChanged();
    } else {
      setName(folder.name);
    }
    setEditingName(false);
  };

  const remove = (leafId, sectionId) => {
    removeSectionFromFolder(leafId, sectionId);
    onChanged();
  };

  const destroy = () => {
    deleteFolder(folder.id);
    setConfirmingDelete(false);
    onChanged();
    onClose();
  };

  return (
    <>
      <BottomSheet height="84%" onClose={onClose}>
        {({ dragHandlers }) => (
          <>
            <div className="px-5 pt-1 pb-3 flex items-center gap-3 border-b border-rule dark:border-ink-soft select-none flex-shrink-0" {...dragHandlers}>
              <FolderArt folder={folder} folders={folders} thumb />
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    aria-label="ชื่อโฟลเดอร์"
                    className="wv-input w-full"
                  />
                ) : (
                  <button onClick={() => canRename && setEditingName(true)} className="flex items-center gap-1.5 max-w-full text-left">
                    <span className="font-display text-[17px] font-bold truncate">{name}</span>
                    {canRename && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-ink-soft dark:text-rule-soft" aria-label="เปลี่ยนชื่อ">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                    )}
                  </button>
                )}
                <div className="font-ui text-[11.5px] text-ink-soft dark:text-rule-soft">
                  {total.toLocaleString()} มาตรา{folder.readOnly ? ' · แอปจัดการให้อัตโนมัติ' : ''}
                </div>
              </div>
              <button onClick={onClose} className="hit-44 tap-btn p-2 text-ink-soft dark:text-rule-soft flex-shrink-0" aria-label="ปิด">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {total === 0 && (
                <div className="px-6 py-10 text-center font-ui text-[13px] text-ink-soft dark:text-rule-soft">
                  {canEdit ? 'ยังไม่มีมาตรา กด "เพิ่มมาตรา" ด้านล่างเพื่อเลือก' : 'ยังไม่มีมาตราในโฟลเดอร์นี้'}
                </div>
              )}
              {leaves.map(leaf => (
                <div key={leaf.id}>
                  {folder.type === 'group' && (
                    <div className="px-5 pt-3 pb-1 font-ui text-[11px] font-semibold tracking-[0.06em] text-ink-soft dark:text-rule-soft">
                      {labelOf(leaf.bookId)} · {leaf.sections.length} มาตรา
                    </div>
                  )}
                  {sortSectionsByNumber(leaf.sections).map(s => (
                    <div key={s.sectionId} className="wv-srow flex items-center gap-3 pl-5 pr-3 py-1.5">
                      <span className="wv-num">{s.number}</span>
                      <span className="flex-1 min-w-0 font-ui text-[13px] truncate">{titleFor(s) || '—'}</span>
                      {canEdit && (
                        <button onClick={() => remove(leaf.id, s.sectionId)} className="hit-44 tap-btn p-2 text-ink-soft dark:text-rule-soft flex-shrink-0" aria-label={`นำมาตรา ${s.number} ออก`}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {(canEdit || canDelete) && (
              <div className="px-4 pt-2.5 pb-3 flex items-center gap-2 flex-shrink-0 border-t border-rule dark:border-ink-soft">
                {canEdit && (
                  <button onClick={() => onAdd(folder)} className="tap-btn flex-1 h-12 rounded-full bg-ochre text-[#1D1404] font-ui text-[14px] font-bold">
                    ＋ เพิ่มมาตรา
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => setConfirmingDelete(true)} className="tap-btn h-12 px-4 font-ui text-[13px] font-semibold text-accent">
                    ลบโฟลเดอร์
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </BottomSheet>
      {confirmingDelete && (
        <ConfirmDialog
          title={`ลบโฟลเดอร์ "${name}"?`}
          body="มาตราที่อยู่ในโฟลเดอร์นี้ไม่ถูกลบออกจากประมวล"
          confirmLabel="ลบโฟลเดอร์"
          onConfirm={destroy}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}
