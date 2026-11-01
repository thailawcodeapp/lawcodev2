// "โฟลเดอร์ของฉัน" on Wave's Select screen (spec 5.3): every folder as a card
// with ▶ to play all of it, then a row to make a new one. Tapping a card opens
// it to manage its sections; stats groups also have per-book chips.
import { useState } from 'react';
import { LAW_BOOKS_META } from '../../data/lawMeta';
import { createFolder } from '../../lib/folders';
import TransportGlyph from './TransportGlyph';
import FolderArt from './FolderArt';

const metaOf = (id) => LAW_BOOKS_META.find(m => m.id === id);

function PlayButton({ source, play, onPress, disabled, name }) {
  const on = play.isPlayingSource(source);
  return (
    <button onClick={onPress} disabled={disabled} className="tap-btn wv-circle" aria-label={`${on ? 'หยุด' : 'ฟังทั้งโฟลเดอร์'} ${name}`}>
      <TransportGlyph stopping={on} />
    </button>
  );
}

export default function FoldersView({ folders, play, onEdit, creating, setCreating, isPro, onNeedPro, onCreated }) {
  const [newName, setNewName] = useState('');
  const top = folders.filter(f => !f.parentId);
  const childrenOf = (id) => folders.filter(f => f.parentId === id);
  const hasOwn = top.some(f => f.type !== 'group');

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    const f = createFolder(name);
    setNewName('');
    setCreating(false);
    onCreated(f);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      {top.map(f => {
        if (f.type === 'group') {
          const kids = childrenOf(f.id).filter(c => c.sections.length);
          const total = kids.reduce((sum, c) => sum + c.sections.length, 0);
          return (
            <div key={f.id} data-tour={f.id === 'grp-forgotten' ? 'folder-forgotten' : undefined} className="wv-card mx-4 mt-2.5 p-3.5">
              <div className="flex items-center gap-3">
                <button onClick={() => onEdit(f)} className="tap-row flex-1 min-w-0 flex items-center gap-3 text-left">
                  <FolderArt folder={f} folders={folders} thumb />
                  <span className="min-w-0">
                    <span className="block font-ui text-[14px] font-semibold truncate">{f.name}</span>
                    <span className="block font-ui text-[11.5px] text-ink-soft dark:text-rule-soft">{f.readOnly ? 'อัตโนมัติ · ' : ''}{kids.length} ฉบับ · {total} มาตรา</span>
                  </span>
                </button>
                <PlayButton source={`group:${f.id}`} play={play} onPress={() => play.playGroup(f.id)} disabled={!total} name={f.name} />
              </div>
              {kids.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {kids.map(c => (
                    <button key={c.id} onClick={() => play.playLeaf(c)} className="tap-btn wv-kid">
                      <i style={{ background: metaOf(c.bookId)?.waveColor }} />
                      {metaOf(c.bookId)?.shortLabel ?? c.name} {c.sections.length}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <div key={f.id} className="wv-card mx-4 mt-2.5 p-3.5 flex items-center gap-3">
            <button onClick={() => onEdit(f)} className="tap-row flex-1 min-w-0 flex items-center gap-3 text-left">
              <FolderArt folder={f} folders={folders} thumb />
              <span className="min-w-0">
                <span className="block font-ui text-[14px] font-semibold truncate">{f.name}</span>
                <span className="block font-ui text-[11.5px] text-ink-soft dark:text-rule-soft">{f.sections.length} มาตรา</span>
              </span>
            </button>
            <PlayButton source={`leaf:${f.id}`} play={play} onPress={() => play.playLeaf(f)} disabled={!f.sections.length} name={f.name} />
          </div>
        );
      })}
      {creating ? (
        <div className="wv-card mx-4 mt-2.5 p-2.5 flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="ชื่อโฟลเดอร์ใหม่"
            aria-label="ชื่อโฟลเดอร์ใหม่"
            className="wv-input flex-1 min-w-0"
          />
          <button onClick={create} disabled={!newName.trim()} className="tap-btn font-ui text-accent text-[13px] font-bold px-2 disabled:opacity-40">สร้าง</button>
          <button onClick={() => setCreating(false)} className="tap-btn font-ui text-ink-soft dark:text-rule-soft text-[13px] px-1">ยกเลิก</button>
        </div>
      ) : (
        <button onClick={() => (isPro ? setCreating(true) : onNeedPro())} className="wv-newrow tap-btn mx-4 mt-2.5">
          <span aria-hidden="true">＋</span>
          โฟลเดอร์ใหม่
          {!isPro && <span className="wv-pro">PRO</span>}
        </button>
      )}
      {!hasOwn && (
        <p className="font-ui text-[12.5px] text-ink-soft dark:text-rule-soft mt-4 px-6 text-center">
          ยังไม่มีโฟลเดอร์ของตัวเอง กด "โฟลเดอร์ใหม่" ด้านบนนี้เพื่อสร้าง
        </p>
      )}
    </div>
  );
}
