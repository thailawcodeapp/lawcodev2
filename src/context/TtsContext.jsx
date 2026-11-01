import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from './AppContext';
import { useProAccess } from './ProAccessContext';
import * as tts from '../lib/tts';
import { DEFAULT_VOICE } from '../lib/audioManifest';
import { migrateLegacyVoice } from './voiceMigration';
import { consume as consumeQuota, getRemaining } from '../lib/quota';
import { recordListen } from '../lib/stats';
import { beginSection, endSection, leaveSection } from '../lib/listenTime';
import { startQueue, markItem, markDone, getResume, clearResume, resolveResume } from '../lib/resumeQueue';
import { buildItemsFromRefs } from '../lib/sectionText';
import { App as CapApp } from '@capacitor/app';

const TtsCtx = createContext(null);

export function TtsProvider({ children }) {
  const { settings, setSettings, books, loadingData } = useApp();
  const { isPro: proAccessIsPro, state: proAccessState } = useProAccess();
  const isProRef = useRef(proAccessIsPro);
  useEffect(() => { isProRef.current = proAccessIsPro; }, [proAccessIsPro]);
  const rateRef = useRef(1);
  rateRef.current = settings.ttsRate ?? 1.0;

  const [, setTick] = useState(0);
  const forceRender = useCallback(() => setTick(t => t + 1), []);
  const [current, setCurrent] = useState({ itemIndex: -1, chunkIndex: -1, paraIndex: -1 });
  const [quotaBlocked, setQuotaBlocked] = useState(false);

  // Which pre-rendered voice to fetch. Unset means DEFAULT_VOICE — read from
  // audioManifest.js rather than repeated here, so the two files cannot drift
  // apart on what "unset" means. 'm' and 'f' are the earlier voices, kept as
  // choices rather than replaced.
  //
  // Applied before rate and pitch because it also decides the wording the
  // device-voice fallback would speak, not only which file is downloaded.
  useEffect(() => {
    tts.setAudioVoice(settings.audioVoice ?? DEFAULT_VOICE);
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
        // Before the quota check: a section refused for quota is still where
        // the queue stopped, so resuming starts there.
        markItem(tts.currentItemIndex());
        if (!isProRef.current) {
          if (!consumeQuota()) { setQuotaBlocked(true); return false; }
        }
        recordListen(item);
        beginSection(item, rateRef.current);
        return true;
      },
      // What the Android queue is cut to, since native plays it with no one
      // left to ask before each section once the app is off screen.
      itemAllowance: () => (isProRef.current ? Infinity : getRemaining()),
      onFinish: () => { endSection(); markDone(); forceRender(); },
    });
    return () => tts.stop();
  }, [forceRender]);

  // `label` names the queue on Wave's hero ("สอบเนติ สมัย 78"). The queue is
  // saved before playItems because native announces its first section from
  // inside it, and markItem needs the new queue already there.
  // True when playback started; false when there was nothing to play or the
  // daily quota refused it, so a caller can tell its button never lit up.
  const playSections = useCallback((items, startIndex = 0, { label } = {}) => {
    setQuotaBlocked(false);
    if (!items || !items.length) return false;
    if (!isProRef.current && getRemaining() <= 0) {
      setQuotaBlocked(true);
      return false;
    }
    leaveSection();
    startQueue(items, startIndex, label);
    tts.playItems(items, startIndex);
    return true;
  }, []);

  // The hero's "ฟังต่อ". False when there is nothing to resume, so the caller
  // can fall back. A queue whose sections are all gone is cleared — but only
  // once the corpus has loaded.
  const playResume = useCallback(() => {
    if (loadingData) return false;
    const raw = getResume();
    const r = resolveResume(raw, books);
    // Clearing changes only localStorage, so redraw for the hero to drop it.
    if (!r) {
      if (raw && !raw.done) { clearResume(); forceRender(); }
      return false;
    }
    const items = buildItemsFromRefs(books, r.refs);
    if (!items.length) { clearResume(); forceRender(); return false; }
    playSections(items, r.index, { label: r.label });
    return true;
  }, [books, loadingData, playSections, forceRender]);

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
    playResume,
    resumeQueue: getResume(),
    pause: tts.pause,
    resume: tts.resume,
    stop: () => { leaveSection(); tts.stop(); },
    next: () => { leaveSection(); tts.next(); },
    prev: () => { leaveSection(); tts.prev(); },
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
