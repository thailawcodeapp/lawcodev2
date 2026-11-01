// "โฟลเดอร์ของฉัน" on Wave Home (spec 3.3): every top-level folder as a tall
// card of its art, with ▶ to play all of it, then a card to make a new one.
// A card opens that folder to manage its sections.
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useFolderPlayback } from '../../hooks/useFolderPlayback';
import { getFolders } from '../../lib/folders';
import FolderArt from './FolderArt';
import TransportGlyph from './TransportGlyph';

const countOf = (f, folders) => (f.type === 'group'
  ? folders.filter(c => c.parentId === f.id).reduce((s, c) => s + c.sections.length, 0)
  : f.sections.length);

export default function FolderRow() {
  const navigate = useNavigate();
  const { books } = useApp();
  const folders = getFolders();
  const { playLeaf, playGroup, isPlayingSource } = useFolderPlayback({ books, folders });
  const list = folders.filter(f => !f.parentId);

  return (
    <>
      <div className="wv-sech">
        <h3>โฟลเดอร์ของฉัน</h3>
        <button type="button" onClick={() => navigate('/select', { state: { view: 'folders' } })}>ดูทั้งหมด</button>
      </div>
      <div className="wv-hscroll">
        {list.map(f => {
          const source = f.type === 'group' ? `group:${f.id}` : `leaf:${f.id}`;
          const on = isPlayingSource(source);
          const count = countOf(f, folders);
          return (
            <div key={f.id} className="wv-fcard">
              <button type="button" className="wv-fopen tap-btn" onClick={() => navigate('/select', { state: { view: 'folders', folderId: f.id } })}
                aria-label={`${f.name} ${count.toLocaleString()} มาตรา`}>
                <FolderArt folder={f} folders={folders} />
                <span className="wv-fshade">
                  <span className="wv-fname">{f.name}</span>
                  <span className="wv-fcount">{count.toLocaleString()} มาตรา</span>
                </span>
              </button>
              {count > 0 && (
                <button
                  type="button"
                  className="wv-fplay tap-btn"
                  onClick={() => (f.type === 'group' ? playGroup(f.id) : playLeaf(f))}
                  aria-label={`${on ? 'หยุด' : 'ฟังทั้งโฟลเดอร์'} ${f.name}`}
                >
                  <TransportGlyph stopping={on} size={13} />
                </button>
              )}
            </div>
          );
        })}
        <button type="button" className="wv-fnew tap-btn" onClick={() => navigate('/select', { state: { view: 'folders', create: true } })}>
          <span aria-hidden="true">＋</span>
          โฟลเดอร์ใหม่
        </button>
      </div>
    </>
  );
}
