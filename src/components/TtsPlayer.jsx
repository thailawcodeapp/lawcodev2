import { useState, useEffect } from 'react';
import {
  isTtsAvailable, startTts, pauseTts, resumeTts, stopTts,
  isSpeaking, isPaused, getTtsRate, setTtsRate,
  skipToNextPara, skipToPrevPara,
} from '../lib/tts';

const RATES = [0.7, 1.0, 1.2, 1.5];

export default function TtsPlayer({ paragraphs, onParaChange, visible, onClose }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1.0);

  useEffect(() => {
    return () => stopTts();
  }, []);

  if (!visible || !isTtsAvailable()) return null;

  const handlePlay = () => {
    if (paused) {
      resumeTts();
      setPaused(false);
    } else if (!speaking) {
      startTts(paragraphs, 0, (idx) => {
        onParaChange?.(idx);
        if (idx === -1) {
          setSpeaking(false);
          setPaused(false);
        }
      });
      setSpeaking(true);
    }
  };

  const handlePause = () => {
    pauseTts();
    setPaused(true);
  };

  const handleStop = () => {
    stopTts();
    setSpeaking(false);
    setPaused(false);
    onClose?.();
  };

  const cycleRate = () => {
    const idx = RATES.indexOf(rate);
    const next = RATES[(idx + 1) % RATES.length];
    setRate(next);
    setTtsRate(next);
  };

  return (
    <div
      className="fixed bottom-16 left-3 right-3 bg-ink dark:bg-paper text-paper dark:text-ink rounded-lg shadow-lg px-3 py-2.5 flex items-center gap-2"
      style={{ zIndex: 20 }}
    >
      {/* Prev */}
      <button
        onClick={() => skipToPrevPara()}
        className="p-1.5 opacity-70 hover:opacity-100"
        aria-label="ย้อนกลับ"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        onClick={speaking && !paused ? handlePause : handlePlay}
        className="w-10 h-10 rounded-full bg-accent text-paper flex items-center justify-center flex-shrink-0"
        aria-label={speaking && !paused ? 'หยุดชั่วคราว' : 'เล่น'}
      >
        {speaking && !paused ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Next */}
      <button
        onClick={() => skipToNextPara()}
        className="p-1.5 opacity-70 hover:opacity-100"
        aria-label="ถัดไป"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>

      {/* Rate */}
      <button
        onClick={cycleRate}
        className="font-ui text-[11px] font-bold px-2 py-1 rounded border border-current opacity-70 hover:opacity-100 ml-auto"
      >
        {rate}x
      </button>

      {/* Close */}
      <button
        onClick={handleStop}
        className="p-1.5 opacity-60 hover:opacity-100"
        aria-label="ปิด"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
