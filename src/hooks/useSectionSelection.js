// Ticked sections on the Select screen. A selection survives switching books.
import { useState } from 'react';
import { keyOf, toggleOne, toggleMany, selectionState } from '../lib/selection';
import { sectionsInRange } from '../lib/toc';

export function useSectionSelection({ activeBook, visibleSections }) {
  const [selected, setSelected] = useState({});
  const selectedList = Object.values(selected);
  const bookId = activeBook?.id;

  const visibleKeys = visibleSections.map(s => keyOf(bookId, s.id));
  const allSelected = visibleKeys.length > 0 && visibleKeys.every(k => selected[k]);
  const someSelected = visibleKeys.some(k => selected[k]) && !allSelected;

  const toggleSelect = (s) => setSelected(prev => toggleOne(prev, bookId, s));
  const toggleSelectAll = () => setSelected(prev => toggleMany(prev, bookId, visibleSections));
  const selectAllInNode = (node) => {
    const secs = sectionsInRange(activeBook, node.range);
    setSelected(prev => toggleMany(prev, bookId, secs));
  };
  const nodeSelectionState = (node) => selectionState(selected, bookId, sectionsInRange(activeBook, node.range));

  return {
    selected, setSelected, selectedList, toggleSelect, selectAllInNode, nodeSelectionState,
    toggleSelectAll, allSelected, someSelected,
  };
}
