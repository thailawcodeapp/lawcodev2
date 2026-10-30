// Play buttons for folders and selections. A button whose own source is
// already playing stops it instead of starting it again — without that the
// only way to stop was the player bar, and pressing the button you just
// pressed looked like the app had hung. Which button is "the one playing" is
// tracked here: two folders can hold the same sections, and the engine knows
// what it reads but not who asked.
import { useEffect, useState } from 'react';
import { useTts } from '../context/TtsContext';
import { isSpeaking as ttsIsSpeaking } from '../lib/tts';
import { buildItemsFromRefs } from '../lib/sectionText';
import { sortSectionsByNumber } from '../lib/folders';
import { showToast } from '../lib/toast';

export function useFolderPlayback({ books, folders, selectedList = [] }) {
  const { playSections, playing, stop } = useTts();
  const [playingSource, setPlayingSource] = useState(null);

  const isPlayingSource = (source) => playing && playingSource === source;

  // The icon reads the rendered `playing`, but the decision must not: a press
  // before React re-renders would see a stale value and start the same thing
  // over. isSpeaking() is read from the engine at the moment of the tap.
  const isPlayingSourceNow = (source) => ttsIsSpeaking() && playingSource === source;

  // Playback also ends on its own, or from the player bar.
  useEffect(() => { if (!playing) setPlayingSource(null); }, [playing]);

  // `label` names the queue on Wave's hero (spec 4.1).
  const playRefs = (source, label, refs, emptyMessage) => {
    if (isPlayingSourceNow(source)) {
      stop();
      setPlayingSource(null);
      return;
    }
    const items = buildItemsFromRefs(books, refs);
    if (!items.length) { showToast(emptyMessage); return; }
    playSections(items, 0, { label });
    setPlayingSource(source);
  };

  const playSelected = () => playRefs(
    'selected', `มาตราที่เลือก ${selectedList.length} มาตรา`, selectedList, 'ยังไม่ได้เลือกมาตรา',
  );

  const leafLabel = (leaf) => {
    const parent = leaf.parentId && folders.find(f => f.id === leaf.parentId);
    return parent ? `${parent.name} · ${leaf.name}` : leaf.name;
  };

  // Ascending section-number order, not the order they were added.
  const playLeaf = (leaf) => playRefs(
    `leaf:${leaf.id}`, leafLabel(leaf), sortSectionsByNumber(leaf.sections), `โฟลเดอร์ "${leaf.name}" ยังไม่มีมาตรา`,
  );

  // sortSectionsByNumber groups by book (canonical order) then by number.
  const playGroup = (groupId) => {
    const group = folders.find(f => f.id === groupId);
    const children = folders.filter(f => f.parentId === groupId);
    playRefs(`group:${groupId}`, group?.name ?? 'กลุ่ม', sortSectionsByNumber(children.flatMap(c => c.sections)), 'กลุ่มนี้ยังไม่มีมาตรา');
  };

  return { isPlayingSource, playRefs, playSelected, playLeaf, playGroup };
}
