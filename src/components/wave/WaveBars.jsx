// One law's waveform: equal stretches of its sections, as tall as they are
// long to listen to, filled in its colour as they are heard (spec 3.4).
import { useMemo } from 'react';
import { waveBars, barOpacity } from '../../lib/wave';

// `flashFrom`: the first section index of a bar to outline in gold once,
// after it was tapped (spec 5.1).
export default function WaveBars({ book, heard, nBars, height, onBar, dim = false, flashFrom = null }) {
  const bars = useMemo(
    () => (book.sections?.length ? waveBars(book.sections, heard, nBars) : []),
    [book.sections, heard, nBars],
  );
  if (!bars.length) {
    // Still loading: even bars, so the row keeps its height.
    return <div className="wv-bars" style={{ height }} aria-hidden="true">{Array.from({ length: nBars }, (_, k) => <span key={k} className="wv-bar"><i style={{ height: '40%' }} /></span>)}</div>;
  }
  return (
    <div className={`wv-bars${dim ? ' is-dim' : ''}`} style={{ height }}>
      {bars.map((b, k) => {
        const first = book.sections[b.from], last = book.sections[b.to - 1];
        return (
          <button
            key={k}
            type="button"
            className={`wv-bar${b.from === flashFrom ? ' is-flash' : ''}`}
            onClick={() => onBar(b.from)}
            aria-label={`${book.shortLabel} มาตรา ${first.number} ถึง ${last.number} ฟังแล้ว ${Math.round(b.heard * 100)}%`}
          >
            <i style={{ height: `${(b.height * 100).toFixed(1)}%`, '--c': book.waveColor, '--o': barOpacity(b.heard).toFixed(2) }} />
          </button>
        );
      })}
    </div>
  );
}
