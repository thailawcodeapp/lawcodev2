// Table-of-contents state for the Select screen: the loaded TOC per book, the
// path drilled into, and the sections a leaf or a search shows. Moved out of
// SelectScreen unchanged so WaveSelect can share it.
import { useEffect, useMemo, useState } from 'react';
import { loadToc, sectionsInRange } from '../lib/toc';

export function useTocNavigation({ activeBook, filter }) {
  const [tocByBook, setTocByBook] = useState({});
  const [tocPath, setTocPath] = useState([]); // array of node refs from root

  // `tocLoaded` is tracked separately from the data because loadToc resolves
  // to [] on failure, which is otherwise indistinguishable from "not fetched
  // yet" — the empty state used to show "กำลังโหลดสารบาญ…" forever when the
  // fetch had actually failed.
  const [tocLoaded, setTocLoaded] = useState({});

  const fetchToc = (bookId) => {
    loadToc(bookId).then(toc => {
      setTocByBook(t => ({ ...t, [bookId]: toc }));
      setTocLoaded(l => ({ ...l, [bookId]: true }));
    });
  };

  useEffect(() => {
    if (!activeBook) return;
    if (tocByBook[activeBook.id]) return;
    fetchToc(activeBook.id);
  }, [activeBook?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // loadToc only caches successful fetches, so this genuinely re-requests.
  const retryToc = () => {
    if (!activeBook) return;
    setTocLoaded(l => ({ ...l, [activeBook.id]: false }));
    fetchToc(activeBook.id);
  };

  useEffect(() => { setTocPath([]); }, [activeBook?.id]);

  const toc = tocByBook[activeBook?.id] || [];
  const currentNodes = tocPath.length ? tocPath[tocPath.length - 1].children : toc;
  const atLeaf = tocPath.length > 0 && !tocPath[tocPath.length - 1].children?.length;

  // Sections shown at a leaf TOC node, or matching a search.
  const visibleSections = useMemo(() => {
    if (!activeBook) return [];
    const f = filter.trim();
    if (f) {
      const low = f.toLowerCase();
      return activeBook.sections.filter(
        s => String(s.number).startsWith(f) || s.title?.toLowerCase().includes(low),
      );
    }
    if (atLeaf) return sectionsInRange(activeBook, tocPath[tocPath.length - 1].range);
    return [];
  }, [activeBook, filter, tocPath, atLeaf]);

  // Every section under the node drilled into (for select-all-in-node).
  const nodeAllSections = useMemo(() => {
    if (!activeBook || !tocPath.length) return null;
    return sectionsInRange(activeBook, tocPath[tocPath.length - 1].range);
  }, [activeBook, tocPath]);

  return { toc, tocLoaded, retryToc, tocPath, setTocPath, currentNodes, atLeaf, visibleSections, nodeAllSections };
}
