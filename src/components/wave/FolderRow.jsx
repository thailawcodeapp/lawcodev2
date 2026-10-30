// "โฟลเดอร์ของฉัน" on Wave Home (spec 3.3): up to six top-level folders that
// hold sections, as tall cards of their art, each with ▶ to play all of it;
// the card opens the folders view. Hidden when all are empty.
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
  const list = folders.filter(f => !f.parentId && countOf(f, folders) > 0).slice(0, 6);
  if (!list.length) return null;

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
          return (
            <div key={f.id} className="wv-fcard">
              <button type="button" className="wv-fopen tap-btn" onClick={() => navigate('/select', { state: { view: 'folders' } })}
                aria-label={`${f.name} ${countOf(f, folders).toLocaleString()} มาตรา`}>
                <FolderArt folder={f} />
                <span className="wv-fshade">
                  <span className="wv-fname">{f.name}</span>
                  <span className="wv-fcount">{countOf(f, folders).toLocaleString()} มาตรา</span>
                </span>
              </button>
              <button
                type="button"
                className="wv-fplay tap-btn"
                onClick={() => (f.type === 'group' ? playGroup(f.id) : playLeaf(f))}
                aria-label={`${on ? 'หยุด' : 'ฟังทั้งโฟลเดอร์'} ${f.name}`}
              >
                <TransportGlyph stopping={on} size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
