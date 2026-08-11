import { useEffect, useState, useCallback } from 'react';
import { cacheBytes, cacheBytesByVoice, clearCache } from '../lib/audioCache';
import { formatBytes } from '../lib/formatBytes';
import { isAudioEnabled, VOICE_ORDER, VOICE_LABELS } from '../lib/audioManifest';
import { showToast } from '../lib/toast';

export default function AudioStorageRow() {
  const [bytes, setBytes] = useState(null);
  const [byVoice, setByVoice] = useState({});
  const [busy, setBusy] = useState(null);   // null | 'all' | a voice code

  const refresh = useCallback(() => {
    cacheBytes().then(setBytes).catch(() => setBytes(0));
    cacheBytesByVoice().then(setByVoice).catch(() => setByVoice({}));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Nothing to say when the feature is off: the cache is empty and always
  // will be, and an unexplained "0 MB" row invites the question it cannot
  // answer.
  if (!isAudioEnabled()) return null;

  const onClear = async (voice = null) => {
    setBusy(voice || 'all');
    try {
      await clearCache(voice);
      showToast(voice ? `ล้าง${VOICE_LABELS[voice]?.name ?? 'เสียง'}แล้ว` : 'ล้างเสียงที่เก็บไว้แล้ว');
    } finally {
      setBusy(null);
      refresh();
    }
  };

  // Only voices that actually hold files, in the picker's order rather than
  // whatever order the filesystem walk returned.
  const stored = VOICE_ORDER.filter((v) => byVoice[v] > 0);

  // One voice needs no breakdown — its row would restate the total sitting
  // directly above it, and a second "ล้าง" button beside it that does exactly
  // the same thing is worse than no breakdown at all. The split earns its
  // space only once someone has files from both, which is also the only time
  // they would wonder why the total grew.
  const showSplit = stored.length > 1;

  return (
    <div className="py-2.5 pl-4" style={{ borderTop: '1px dotted var(--rule-hair)' }}>
      <div className="flex items-center justify-between">
        <div className="font-serif text-[14px] text-ink dark:text-paper">เสียงที่เก็บไว้ในเครื่อง</div>
        <div className="flex items-center gap-3">
          <div className="font-display text-[13px] italic text-ink-soft dark:text-rule-soft">
            {bytes === null ? '…' : formatBytes(bytes)}
          </div>
          <button
            onClick={() => onClear()}
            disabled={!!busy || !bytes}
            className="tap-btn hit-44 font-ui text-[12px] px-2.5 py-1 rounded-md border border-rule dark:border-ink-soft disabled:opacity-35"
          >
            {busy === 'all' ? 'กำลังล้าง…' : 'ล้าง'}
          </button>
        </div>
      </div>

      {showSplit && (
        <div className="mt-1.5 pr-2">
          {stored.map((v) => (
            <div key={v} className="flex items-center justify-between py-1">
              <div className="font-ui text-[12px] text-ink-soft dark:text-rule-soft pl-3">
                {VOICE_LABELS[v]?.name ?? v}
              </div>
              <div className="flex items-center gap-3">
                <div className="font-display text-[12px] italic text-ink-soft dark:text-rule-soft tabular-nums">
                  {formatBytes(byVoice[v])}
                </div>
                <button
                  onClick={() => onClear(v)}
                  disabled={!!busy}
                  className="tap-btn font-ui text-[11px] px-2 py-0.5 rounded-md border border-rule-soft dark:border-ink-soft disabled:opacity-35"
                >
                  {busy === v ? 'กำลังล้าง…' : 'ล้าง'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="font-ui text-[11px] opacity-60 mt-1 pr-2 leading-relaxed">
        มาตราที่เคยฟังแล้วจะถูกเก็บไว้ ทำให้ฟังซ้ำได้โดยไม่ต้องใช้เน็ต
        ล้างได้ทุกเมื่อ แล้วจะโหลดใหม่เองเมื่อกดฟังอีกครั้ง
      </div>
    </div>
  );
}
