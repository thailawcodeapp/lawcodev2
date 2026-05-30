// Text-to-Speech wrapper using Web Speech API
// Supports Thai (th-TH) with fallback to default voice

let currentUtterance = null;
let onParagraphChange = null;
let paragraphs = [];
let currentParaIndex = -1;
let _rate = 1.0;
let _speaking = false;
let _paused = false;
let _keepAliveInterval = null;

export function isTtsAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function setTtsRate(rate) {
  _rate = Math.max(0.5, Math.min(2.0, rate));
}

export function getTtsRate() { return _rate; }
export function isSpeaking()  { return _speaking; }
export function isPaused()    { return _paused; }
export function getCurrentParaIndex() { return currentParaIndex; }

// Bug 1 fix: find best available voice for Thai, fall back gracefully
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null; // voices not loaded yet — will retry

  // Priority: th-TH exact → th prefix → any voice
  return (
    voices.find(v => v.lang === 'th-TH') ||
    voices.find(v => v.lang.startsWith('th')) ||
    voices[0] || null
  );
}

// Bug 2 fix: Chrome stops speechSynthesis after ~15s — keep it alive
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
  if (_keepAliveInterval) {
    clearInterval(_keepAliveInterval);
    _keepAliveInterval = null;
  }
}

function speakParagraph(index) {
  if (index >= paragraphs.length) {
    stopTts();
    return;
  }

  currentParaIndex = index;
  onParagraphChange?.(index);

  const utter = new SpeechSynthesisUtterance(paragraphs[index]);
  utter.rate = _rate;

  // Bug 1 fix: apply best available voice
  const voice = pickVoice();
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = 'th-TH';
  }

  utter.onend = () => {
    if (_speaking && !_paused) {
      speakParagraph(index + 1);
    }
  };

  utter.onerror = (e) => {
    if (e.error !== 'canceled' && _speaking) {
      speakParagraph(index + 1);
    }
  };

  currentUtterance = utter;
  speechSynthesis.speak(utter);
}

export function startTts(textParagraphs, startIndex = 0, onChange) {
  if (!isTtsAvailable()) return;

  stopTts();
  paragraphs = textParagraphs;
  onParagraphChange = onChange;
  _speaking = true;
  _paused = false;

  // Bug 1 fix: wait for voices if not loaded yet
  const voices = speechSynthesis.getVoices();
  if (!voices.length) {
    speechSynthesis.addEventListener('voiceschanged', () => {
      speakParagraph(startIndex);
    }, { once: true });
  } else {
    speakParagraph(startIndex);
  }

  startKeepAlive(); // Bug 2 fix
}

export function pauseTts() {
  if (!isTtsAvailable() || !_speaking) return;
  speechSynthesis.pause();
  _paused = true;
  stopKeepAlive();
}

export function resumeTts() {
  if (!isTtsAvailable() || !_speaking) return;
  speechSynthesis.resume();
  _paused = false;
  startKeepAlive();
}

export function stopTts() {
  if (!isTtsAvailable()) return;
  stopKeepAlive();
  speechSynthesis.cancel();
  _speaking = false;
  _paused = false;
  currentParaIndex = -1;
  currentUtterance = null;
  onParagraphChange?.(-1);
}

export function skipToNextPara() {
  if (!_speaking || currentParaIndex >= paragraphs.length - 1) return;
  speechSynthesis.cancel();
  speakParagraph(currentParaIndex + 1);
}

export function skipToPrevPara() {
  if (!_speaking || currentParaIndex <= 0) return;
  speechSynthesis.cancel();
  speakParagraph(currentParaIndex - 1);
}
