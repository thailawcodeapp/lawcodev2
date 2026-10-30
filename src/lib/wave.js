// The waveforms of the Wave theme (spec 3.1, 3.4), as pure functions.
//
// A law's wave splits its sections, in order, into equal stretches. A bar is
// as tall as its stretch is long to listen to — the text length stands in
// for audio time — and coloured by how much of it has been heard.

export function waveBars(sections, heard, nBars) {
  const N = sections.length;
  const n = Math.min(nBars, N);
  if (!n) return [];
  const raw = [];
  for (let k = 0; k < n; k++) {
    const from = Math.floor((k * N) / n);
    const to = Math.floor(((k + 1) * N) / n);
    let len = 0;
    let got = 0;
    for (let i = from; i < to; i++) {
      len += (sections[i].text || '').length;
      if (heard.has(sections[i].id)) got++;
    }
    raw.push({ from, to, len, heard: got / (to - from) });
  }
  const max = Math.max(...raw.map(b => b.len)) || 1;
  return raw.map(b => ({ from: b.from, to: b.to, height: 0.16 + 0.84 * Math.sqrt(b.len / max), heard: b.heard }));
}

export function barOpacity(heard) {
  return heard > 0 ? 0.35 + 0.65 * heard : 0;
}

// The hero's queue wave: one bar per section, or 40 equal groups when the
// queue is longer. A group is done when the queue is past all of it.
export function queueBars(lengths, index, done, nBars = 40) {
  const N = lengths.length;
  const n = Math.min(nBars, N);
  if (!n) return [];
  const raw = [];
  for (let k = 0; k < n; k++) {
    const from = Math.floor((k * N) / n);
    const to = Math.floor(((k + 1) * N) / n);
    let len = 0;
    for (let i = from; i < to; i++) len += lengths[i] || 0;
    const state = done || to <= index ? 'done' : index >= from && index < to ? 'now' : '';
    raw.push({ len, state });
  }
  const max = Math.max(...raw.map(b => b.len)) || 1;
  return raw.map(b => ({ height: 0.28 + 0.72 * Math.sqrt(b.len / max), state: b.state }));
}

// Same comparison as sectionsInRange in toc.js: "29/1" is section 29, sub 1.
const key = (n) => {
  const [main, sub] = String(n).split('/');
  return [parseFloat(main) || 0, parseFloat(sub) || 0];
};

export function numberInRange(number, range) {
  if (!range) return false;
  const [m, s] = key(number);
  const [fm, fs] = key(range.from);
  const [tm, ts] = key(range.to);
  if (m < fm || m > tm) return false;
  if (m === fm && s < fs) return false;
  if (m === tm && s > ts) return false;
  return true;
}

// From the top of a law's table of contents down to the deepest node whose
// range holds the section — where a tapped bar opens in Select.
export function pathToSection(toc, number) {
  const path = [];
  let level = toc || [];
  while (level.length) {
    const node = level.find(n => numberInRange(number, n.range));
    if (!node) break;
    path.push(node);
    level = node.children || [];
  }
  return path;
}
