// TTS — uses native Android TextToSpeech on device, Web Speech API in browser
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const isNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

let onParagraphChange = null;
let paragraphs = [];
let currentParaIndex = -1;
let _rate = 1.0;
let _speaking = false;
let _paused = false;
let _stopRequested = false;

// ─── Web Speech API fallback (browser / dev preview) ───────────────────────

let _keepAliveInterval = null;

function startKeepAlive() {
  stopKeepAlive();
  _keepAliveInterval = setInterval(() => {
    if (_speaking && !_paused && speechSynthesis.speaking) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    }
  }, 10000);
}

function stopKeepAlive() {
  clearInterval(_keepAliveInterval);
  _keepAliveInterval = null;
}

function speakWebParagraph(index) {
  if (index >= paragraphs.length || _stopRequested) {
    stopTts();
    return;
  }
  currentParaIndex = index;
  onParagraphChange?.(index);

  const utter = new SpeechSynthesisUtterance(paragraphs[index]);
  utter.lang = 'th-TH';
  utter.rate = _rate;

  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    const v = voices.find(v => v.lang === 'th-TH') || voices.find(v => v.lang.startsWith('th'));
    if (v) utter.voice = v;
  }

  utter.onend = () => { if (_speaking && !_paused && !_stopRequested) speakWebParagraph(index + 1); };
  utter.onerror = (e) => { if (e.error !== 'canceled' && _speaking) speakWebParagraph(index + 1); };

  speechSynthesis.speak(utter);
}

// ─── Native TTS (Android device) ───────────────────────────────────────────

async function speakNativeParagraphs(startIndex) {
  for (let i = startIndex; i < paragraphs.length; i++) {
    if (_stopRequested) break;

    // Pause: wait until resumed or stopped
    while (_paused && !_stopRequested) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (_stopRequested) break;

    currentParaIndex = i;
    onParagraphChange?.(i);

    try {
      await TextToSpeech.speak({
        text: paragraphs[i],
        lang: 'th-TH',
        rate: _rate,
        pitch: 1.0,
        volume: 1.0,
        category: 'playback',
      });
    } catch {
      // canceled by stop() — exit loop
      break;
    }
  }

  if (!_stopRequested) stopTts();
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function isTtsAvailable() {
  if (isNative()) return true; // native plugin always available
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function setTtsRate(rate) { _rate = Math.max(0.5, Math.min(2.0, rate)); }
export function getTtsRate()          { return _rate; }
export function isSpeaking()          { return _speaking; }
export function isPaused()            { return _paused; }
export function getCurrentParaIndex() { return currentParaIndex; }

export function startTts(textParagraphs, startIndex = 0, onChange) {
  stopTts();
  paragraphs = textParagraphs;
  onParagraphChange = onChange;
  _speaking = true;
  _paused = false;
  _stopRequested = false;

  if (isNative()) {
    speakNativeParagraphs(startIndex);
  } else {
    startKeepAlive();
    speakWebParagraph(startIndex);
  }
}

export function pauseTts() {
  if (!_speaking) return;
  _paused = true;
  if (isNative()) {
    TextToSpeech.stop().catch(() => {});
  } else {
    speechSynthesis.pause();
    stopKeepAlive();
  }
}

export function resumeTts() {
  if (!_speaking || !_paused) return;
  _paused = false;
  if (!isNative()) {
    speechSynthesis.resume();
    startKeepAlive();
  }
  // native: the while loop in speakNativeParagraphs resumes automatically
}

export function stopTts() {
  _stopRequested = true;
  _speaking = false;
  _paused = false;
  stopKeepAlive();

  if (isNative()) {
    TextToSpeech.stop().catch(() => {});
  } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
  }

  currentParaIndex = -1;
  onParagraphChange?.(-1);
}

export function skipToNextPara() {
  if (!_speaking || currentParaIndex >= paragraphs.length - 1) return;
  const next = currentParaIndex + 1;
  if (isNative()) {
    TextToSpeech.stop().catch(() => {}); // triggers resume at next in loop
    setTimeout(() => {
      currentParaIndex = next - 1; // loop will increment to next
      speakNativeParagraphs(next);
    }, 50);
  } else {
    speechSynthesis.cancel();
    speakWebParagraph(next);
  }
}

export function skipToPrevPara() {
  if (!_speaking || currentParaIndex <= 0) return;
  const prev = currentParaIndex - 1;
  if (isNative()) {
    TextToSpeech.stop().catch(() => {});
    setTimeout(() => speakNativeParagraphs(prev), 50);
  } else {
    speechSynthesis.cancel();
    speakWebParagraph(prev);
  }
}
