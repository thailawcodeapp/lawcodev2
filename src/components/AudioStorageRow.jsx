import { useEffect, useState, useCallback } from 'react';
import { cacheBytes, clearCache } from '../lib/audioCache';
import { formatBytes } from '../lib/formatBytes';
import { isAudioEnabled } from '../lib/audioManifest';
import { showToast } from '../lib/toast';

export default function AudioStorageRow() {
  const [bytes, setBytes] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    cacheBytes().then(setBytes).catch(() => setBytes(0));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Nothing to say when the feature is off: the cache is empty and always
  // will be, and an unexplained "0 MB" row invites the question it cannot
  // answer.
  if (!isAudioEnabled()) return null;

  const onClear = async () => {
    setBusy(true);
    try {
      await clearCache();
      showToast('ล้างเสียงที่เก็บไว้แล้ว');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="py-2.5 pl-4" style={{ borderTop: '1px dotted var(--rule-hair)' }}>
      <div className="flex items-center justify-between">
        <div className="font-serif text-[14px] text-ink dark:text-paper">เสียงที่เก็บไว้ในเครื่อง</div>
        <div className="flex items-center gap-3">
          <div className="font-display text-[13px] italic text-ink-soft dark:text-rule-soft">
            {bytes === null ? '…' : formatBytes(bytes)}
          </div>
          <button
            onClick={onClear}
            disabled={busy || !bytes}
            className="tap-btn hit-44 font-ui text-[12px] px-2.5 py-1 rounded-md border border-rule dark:border-ink-soft disabled:opacity-35"
          >
            {busy ? 'กำลังล้าง…' : 'ล้าง'}
          </button>
        </div>
      </div>
      <div className="font-ui text-[11px] opacity-60 mt-1 pr-2 leading-relaxed">
        มาตราที่เคยฟังแล้วจะถูกเก็บไว้ ทำให้ฟังซ้ำได้โดยไม่ต้องใช้เน็ต
        ล้างได้ทุกเมื่อ แล้วจะโหลดใหม่เองเมื่อกดฟังอีกครั้ง
      </div>
    </div>
  );
}
