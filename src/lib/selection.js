// Ticking sections on the Select screen, without React, so Classic and Wave
// share one tested definition. `selected` maps keyOf(book, section) to the
// entry folders and playback take.
export const keyOf = (bookId, sectionId) => `${bookId}::${sectionId}`;

const entryOf = (bookId, s) => ({ sectionId: s.id, bookId, number: s.number, title: s.title });

export function toggleOne(prev, bookId, section) {
  const k = keyOf(bookId, section.id);
  const next = { ...prev };
  if (next[k]) delete next[k];
  else next[k] = entryOf(bookId, section);
  return next;
}

// All on → all off; otherwise all on.
export function toggleMany(prev, bookId, sections) {
  const next = { ...prev };
  const allOn = sections.length > 0 && sections.every(s => next[keyOf(bookId, s.id)]);
  for (const s of sections) {
    const k = keyOf(bookId, s.id);
    if (allOn) delete next[k];
    else next[k] = entryOf(bookId, s);
  }
  return next;
}

export function selectionState(selected, bookId, sections) {
  if (!sections.length) return { all: false, some: false, count: 0, total: 0 };
  const on = sections.filter(s => selected[keyOf(bookId, s.id)]).length;
  return { all: on === sections.length, some: on > 0 && on < sections.length, count: on, total: sections.length };
}
