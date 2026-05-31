import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from './AppContext';
import * as tts from '../lib/tts';
import { consume as consumeQuota, getRemaining } from '../lib/quota';
import { recordListen } from '../lib/stats';

const TtsCtx = createContext(null);

export function TtsProvider({ children }) {
  const { settings, setSettings } = useApp();
  const isProRef = useRef(settings.isPro);
  useEffect(() => { isProRef.current = settings.isPro; }, [settings.isPro]);

  const [, setTick] = useState(0);
  const forceRender = useCallback(() => setTick(t => t + 1), []);
  const [current, setCurrent] = useState({ itemIndex: -1, chunkIndex: -1, paraIndex: -1 });
  const [quotaBlocked, setQuotaBlocked] = useState(false);

  // Apply persisted voice settings to the engine
  useEffect(() => {
    tts.setRate(settings.ttsRate ?? 1.0);
    tts.setPitch(settings.ttsPitch ?? 1.0);
    if (settings.ttsVoice != null) tts.setVoice(settings.ttsVoice);
  }, [settings.ttsRate, settings.ttsPitch, settings.ttsVoice]);

  // Wire engine hooks once
  useEffect(() => {
    tts.setHooks({
      onState: forceRender,
      onChange: (itemIndex, chunkIndex, paraIndex) =>
        setCurrent({ itemIndex, chunkIndex, paraIndex }),
      onItemStart: (item) => {
        if (!isProRef.current) {
          if (!consumeQuota()) { setQuotaBlocked(true); return false; }
        }
        recordListen(item);
        return true;
      },
      onFinish: () => {},
    });
    return () => tts.stop();
  }, [forceRender]);

  const playSections = useCallback((items, startIndex = 0) => {
    setQuotaBlocked(false);
    if (!items || !items.length) return;
    if (!isProRef.current && getRemaining() <= 0) {
      setQuotaBlocked(true);
      return;
    }
    tts.playItems(items, startIndex);
  }, []);

  const value = {
    // state
    playing: tts.isSpeaking(),
    paused: tts.isPaused(),
    current,
    itemIndex: tts.currentItemIndex(),
    itemCount: tts.itemCount(),
    currentItem: tts.currentItem(),
    items: tts.getItems(),
    quotaBlocked,
    setQuotaBlocked,
    // controls
    playSections,
    pause: tts.pause,
    resume: tts.resume,
    stop: tts.stop,
    next: tts.next,
    prev: tts.prev,
    goToItem: tts.goToItem,
    speakSample: tts.speakSample,
    available: tts.isTtsAvailable(),
    // settings
    setRate: (r) => { tts.setRate(r); setSettings(s => ({ ...s, ttsRate: r })); },
    setPitch: (p) => { tts.setPitch(p); setSettings(s => ({ ...s, ttsPitch: p })); },
    setVoice: (v) => { tts.setVoice(v); setSettings(s => ({ ...s, ttsVoice: v })); },
    rate: settings.ttsRate ?? 1.0,
    pitch: settings.ttsPitch ?? 1.0,
    voice: settings.ttsVoice ?? null,
    getVoices: tts.getVoices,
  };

  return <TtsCtx.Provider value={value}>{children}</TtsCtx.Provider>;
}

export function useTts() {
  const ctx = useContext(TtsCtx);
  if (!ctx) throw new Error('useTts must be used within TtsProvider');
  return ctx;
}
