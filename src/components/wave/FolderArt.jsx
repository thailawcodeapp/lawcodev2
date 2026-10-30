// A folder's picture: its origami art on its own colour, or — until the
// art file exists — the colour with a large symbol. `thumb` is the small
// square used in lists; otherwise it fills its box.
import { folderArt } from '../../lib/folderArt';

export default function FolderArt({ folder, thumb = false }) {
  const art = folderArt(folder);
  return (
    <span className={`wv-art${thumb ? ' is-thumb' : ''}`} style={{ '--fa': art.color }} aria-hidden="true">
      {art.image
        ? <img src={art.image} alt="" draggable="false" />
        : <span className="wv-art-sym">{art.symbol}</span>}
      {art.image && art.letter && <span className="wv-art-letter">{art.letter}</span>}
    </span>
  );
}
