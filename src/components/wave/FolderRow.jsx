// "โฟลเดอร์ของฉัน" on Wave Home (spec 3.3): up to six top-level folders that
// hold sections, each with ▶ to play all of it. Hidden when all are empty.
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useFolderPlayback } from '../../hooks/useFolderPlayback';
import { getFolders } from '../../lib/folders';

const countOf = (f, folders) => (f.type === 'group'
  ? folders.filter(c => c.parentId === f.id).reduce((s, c) => s + c.sections.length, 0)
  : f.sections.length);

const TINTS = ['#E0773A', '#C24A3A', '#3D6FB6', '#2E9C8E', '#7B55B8', '#7F8F3A'];

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
        {list.map((f, i) => {
          const tint = TINTS[i % TINTS.length];
          const source = f.type === 'group' ? `group:${f.id}` : `leaf:${f.id}`;
          return (
            <div key={f.id} className="wv-fcard">
              <span className="wv-fico" style={{ background: `${tint}22`, color: tint }} aria-hidden="true">
                {f.readOnly ? '?' : f.type === 'group' ? '◆' : f.name.slice(0, 1)}
              </span>
              <span className="wv-fname">{f.name}</span>
              <span className="wv-frow">
                <span className="wv-fcount">{countOf(f, folders).toLocaleString()} มาตรา</span>
                <button
                  type="button"
                  className="wv-fplay tap-btn"
                  onClick={() => (f.type === 'group' ? playGroup(f.id) : playLeaf(f))}
                  aria-label={`${isPlayingSource(source) ? 'หยุด' : 'ฟังทั้งโฟลเดอร์'} ${f.name}`}
                >
                  {isPlayingSource(source) ? '■' : '▶'}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
