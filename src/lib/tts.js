// Text-to-Speech wrapper using Web Speech API
// Works on Android WebView (Capacitor) + Chrome browser

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

export function getTtsRate()          { return _rate; }
export function isSpeaking()          { return _speaking; }
export function isPaused()            { return _paused; }
export function getCurrentParaIndex() { return currentParaIndex; }

// Chrome bug: stops speaking after ~15s — keep alive with pause/resume
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
  utter.lang = 'th-TH';

  // Try to pick a Thai voice if available — but don't block on it.
  // On Android WebView, getVoices() often returns [] so we skip it
  // and let the system TTS engine handle th-TH automatically.
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    const thVoice = voices.find(v => v.lang === 'th-TH') ||
                    voices.find(v => v.lang.startsWith('th'));
    if (thVoice) utter.voice = thVoice;
  }

  utter.onend = () => {
    if (_speaking && !_paused) speakParagraph(index + 1);
  };

  utter.onerror = (e) => {
    if (e.error !== 'canceled' && _speaking) speakParagraph(index + 1);
  };

  speechSynthesis.speak(utter);
}

export function startTts(textParagraphs, startIndex = 0, onChange) {
  if (!isTtsAvailable()) return;

  stopTts();
  paragraphs = textParagraphs;
  onParagraphChange = onChange;
  _speaking = true;
  _paused = false;
  startKeepAlive();

  // Speak immediately — do NOT wait for voiceschanged.
  // On Android WebView, voiceschanged never fires even with Thai TTS installed,
  // so waiting for it means silence forever.
  speakParagraph(startIndex);
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
