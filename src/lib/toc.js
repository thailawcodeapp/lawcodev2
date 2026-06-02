// Table-of-contents loader + range utilities.

const cache = {};

export async function loadToc(bookId) {
  if (cache[bookId]) return cache[bookId];
  try {
    const res = await fetch(`/data/toc-${bookId}.json`);
    const data = await res.json();
    cache[bookId] = data;
    return data;
  } catch {
    return [];
  }
}

// Return all sections in `book` whose number falls inside the given range.
// Ranges may include slash forms like "29/1" — those are compared
// alphanumerically against the same form in the book.
export function sectionsInRange(book, range) {
  if (!book?.sections || !range) return [];
  const toKey = (n) => {
    const s = String(n);
    const [main, sub] = s.split('/');
    return [parseFloat(main) || 0, parseFloat(sub) || 0];
  };
  const [fM, fS] = toKey(range.from);
  const [tM, tS] = toKey(range.to);
  return book.sections.filter(s => {
    const [m, sub] = toKey(s.number);
    // Compare (main, sub) lexicographically
    if (m < fM || m > tM) return false;
    if (m === fM && sub < fS) return false;
    if (m === tM && sub > tS) return false;
    return true;
  });
}

// Flatten a TOC tree → array of leaves (nodes without children).
export function leafNodes(nodes) {
  const out = [];
  const walk = (list) => {
    for (const n of list) {
      if (n.children?.length) walk(n.children);
      else out.push(n);
    }
  };
  walk(nodes);
  return out;
}

// Human-readable label
export function nodeLabel(node) {
  const num = node.num ? `${node.word} ${node.num}` : node.name;
  return node.num ? `${num} · ${node.name}` : node.name;
}

// Short label without the name
export function nodeShortLabel(node) {
  return node.num ? `${node.word} ${node.num}` : node.name;
}
