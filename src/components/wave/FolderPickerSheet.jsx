// "เพิ่ม N มาตราใน…" — slides up from the bottom after "＋ เพิ่ม" (spec 5.2).
// Several folders can be ticked; the button adds to all of them at once.
import { useMemo, useState } from 'react';
import BottomSheet from '../BottomSheet';
import { createFolder, getFolders } from '../../lib/folders';
import { addToFolders, alreadyIn, pickerLists, sectionCount } from '../../lib/folderPicker';
import { LAW_BOOKS_META } from '../../data/lawMeta';

const labelOf = (bookId) => LAW_BOOKS_META.find(m => m.id === bookId)?.shortLabel ?? bookId;

export default function FolderPickerSheet({ sections, isPro, onNeedPro, onClose, onAdded }) {
  const [folders, setFolders] = useState(() => getFolders());
  const [checked, setChecked] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const lists = useMemo(() => pickerLists(folders), [folders]);
  const books = [...new Set(sections.map(s => s.bookId))].map(labelOf).join(', ');

  const toggle = (id) => setChecked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    const f = createFolder(name);
    setFolders(getFolders());
    setChecked(prev => new Set(prev).add(f.id));
    setCreating(false);
    setNewName('');
  };

  const confirm = () => {
    onAdded(addToFolders([...checked], sections));
    onClose();
  };

  const row = (f) => {
    const on = checked.has(f.id);
    const have = alreadyIn(f, sections, folders);
    const sub = f.type === 'group' ? `จะลงใน › ${books}` : `${sectionCount(f, folders)} มาตรา`;
    const note = have.length ? ` · มี ม.${have[0].number}${have.length > 1 ? ` และอีก ${have.length - 1}` : ''} อยู่แล้ว` : '';
    return (
      <button key={f.id} onClick={() => toggle(f.id)} role="checkbox" aria-checked={on}
        className="tap-row w-full flex items-center gap-3 px-5 py-2.5 text-left">
        <span className="wv-folder-icon" aria-hidden="true">{f.type === 'group' ? '◆' : f.name.slice(0, 1)}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-ui text-[14px] font-semibold truncate">{f.name}</span>
          <span className="block font-ui text-[11px] text-ink-soft dark:text-rule-soft truncate">{sub}{note}</span>
        </span>
        <span className={`wv-check${on ? ' is-on' : ''}`} aria-hidden="true">{on ? '✓' : ''}</span>
      </button>
    );
  };

  const section = (title, list) => list.length > 0 && (
    <div key={title}>
      <div className="px-5 pt-3 pb-1 font-ui text-[11px] font-semibold tracking-[0.06em] text-ink-soft dark:text-rule-soft">{title}</div>
      {list.map(row)}
    </div>
  );

  return (
    <BottomSheet height="82%" onClose={onClose}>
      {({ dragHandlers }) => (
        <>
          <div className="px-5 pt-1 pb-2 flex items-baseline select-none flex-shrink-0" {...dragHandlers}>
            <span className="font-display text-[17px] font-bold">เพิ่ม {sections.length} มาตราใน…</span>
            <span className="ml-auto font-ui text-[11px] text-ink-soft dark:text-rule-soft">เลือกได้หลายโฟลเดอร์</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {section('ใช้ล่าสุด', lists.recent)}
            {section('สถิติ · แยกลงตามฉบับให้เอง', lists.groups)}
            {section('โฟลเดอร์ของฉัน', lists.mine)}
            {creating ? (
              <div className="flex items-center gap-2 px-5 py-2.5">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') create(); }}
                  placeholder="ชื่อโฟลเดอร์ใหม่"
                  className="wv-input flex-1"
                />
                <button onClick={create} className="tap-btn font-ui text-accent text-[13px] font-bold px-2">สร้าง</button>
              </div>
            ) : (
              <button
                onClick={() => (isPro ? setCreating(true) : onNeedPro())}
                className="tap-row w-full flex items-center gap-3 px-5 py-2.5 text-left text-accent"
              >
                <span className="wv-folder-icon is-new" aria-hidden="true">＋</span>
                <span className="font-ui text-[14px] font-semibold">โฟลเดอร์ใหม่…</span>
                {!isPro && <span className="wv-pro">PRO</span>}
              </button>
            )}
          </div>
          <div className="px-4 pt-2 pb-3 flex-shrink-0">
            <button
              onClick={confirm}
              disabled={!checked.size}
              className="tap-btn w-full h-12 rounded-full bg-ochre text-[#1D1404] font-ui text-[14px] font-bold disabled:opacity-40"
            >
              {checked.size ? `เพิ่มใน ${checked.size} โฟลเดอร์` : 'เลือกโฟลเดอร์'}
            </button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
