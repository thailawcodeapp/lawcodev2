import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from './AppContext';
import { useProAccess } from './ProAccessContext';
import * as tts from '../lib/tts';
import { migrateLegacyVoice } from './voiceMigration';
import { consume as consumeQuota, getRemaining } from '../lib/quota';
import { recordListen } from '../lib/stats';
import { App as CapApp } from '@capacitor/app';

const TtsCtx = createContext(null);

export function TtsProvider({ children }) {
  const { settings, setSettings } = useApp();
  const { isPro: proAccessIsPro, state: proAccessState } = useProAccess();
  const isProRef = useRef(proAccessIsPro);
  useEffect(() => { isProRef.current = proAccessIsPro; }, [proAccessIsPro]);

  const [, setTick] = useState(0);
  const forceRender = useCallback(() => setTick(t => t + 1), []);
  const [current, setCurrent] = useState({ itemIndex: -1, chunkIndex: -1, paraIndex: -1 });
  const [quotaBlocked, setQuotaBlocked] = useState(false);

  // Which pre-rendered voice to fetch. Unset means the default, which is the
  // Gemini male voice — the one that reads the statutes' own spacing
  // correctly. 'f' is the Chirp3 female voice earlier builds shipped, kept as
  // a choice rather than replaced.
  //
  // Applied before rate and pitch because it also decides the wording the
  // device-voice fallback would speak, not only which file is downloaded.
  useEffect(() => {
    tts.setAudioVoice(settings.audioVoice ?? 'm');
  }, [settings.audioVoice]);

  // Restore the saved repeat mode into the engine on mount, and keep the two
  // in step afterwards — the engine holds it in module state, which a reload
  // clears while the persisted setting survives.
  useEffect(() => {
    tts.setRepeat(settings.ttsRepeat ?? 'off');
  }, [settings.ttsRepeat]);

  // Apply persisted voice settings to the engine
  useEffect(() => {
    tts.setRate(settings.ttsRate ?? 1.0);
    tts.setPitch(settings.ttsPitch ?? 1.0);
    if (settings.ttsVoice != null) {
      tts.setVoice(settings.ttsVoice);
      // Older builds persisted the plugin's numeric voice-list index. The
      // engine already drops it (falls back to auto-pick); mirror that in
      // settings too, or the <select> keeps a stale number that matches no
      // <option> (keyed by voiceURI) and renders blank instead of showing
      // "auto".
      const migrated = migrateLegacyVoice(settings.ttsVoice);
      if (migrated !== settings.ttsVoice) {
        setSettings(s => ({ ...s, ttsVoice: migrated }));
      }
    }
  }, [settings.ttsRate, settings.ttsPitch, settings.ttsVoice, setSettings]);

  // Voices are installed in iOS Settings, which means leaving and returning to
  // the app. Re-resolve on every resume so a voice downloaded mid-session is
  // picked up without a force-quit.
  useEffect(() => {
    let handle;
    CapApp.addListener('resume', () => tts.clearVoiceCache())
      .then((h) => { handle = h; })
      .catch(() => {});
    return () => { handle?.remove?.(); };
  }, []);

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
    voiceKind: tts.currentVoiceKind(),
    items: tts.getItems(),
    quotaBlocked,
    setQuotaBlocked,
    proAccessState,
    // preview samples (outside the playlist — no quota)
    samplePlaying: tts.isSamplePlaying(),
    samplePlayingKind: tts.samplePlayingKind(),
    toggleSampleFile: tts.toggleSampleFile,
    toggleSampleDevice: tts.toggleSampleDevice,
    stopSample: tts.stopSample,
    // controls
    playSections,
    pause: tts.pause,
    resume: tts.resume,
    stop: tts.stop,
    next: tts.next,
    prev: tts.prev,
    goToItem: tts.goToItem,
    // Repeat is persisted like rate and pitch: someone who listens on loop
    // wants that on the next section too, not only until the app restarts.
    repeat: settings.ttsRepeat ?? 'off',
    setRepeat: (m) => { tts.setRepeat(m); setSettings(s => ({ ...s, ttsRepeat: m })); },
    // Which pre-rendered voice to fetch. Changing it mid-playback deliberately
    // does not interrupt: buildSectionItem binds the voice onto every chunk
    // when the queue is built, so the section playing now finishes in the
    // voice it started in and the new one takes effect at the next section.
    // Decided rather than overlooked — stopping playback to honour a settings
    // tap costs more than it gains, and rebuilding the queue mid-section is
    // the most fragile part of the engine.
    audioVoice: settings.audioVoice ?? tts.currentAudioVoice(),
    setAudioVoice: (v) => { tts.setAudioVoice(v); setSettings(s => ({ ...s, audioVoice: v })); },
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
