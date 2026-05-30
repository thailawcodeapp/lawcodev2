// Text-to-Speech wrapper using Web Speech API
// Supports Thai (th-TH) — no AI needed

let currentUtterance = null;
let onParagraphChange = null;
let paragraphs = [];
let currentParaIndex = -1;
let _rate = 1.0;
let _speaking = false;
let _paused = false;

export function isTtsAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function setTtsRate(rate) {
  _rate = Math.max(0.5, Math.min(2.0, rate));
}

export function getTtsRate() {
  return _rate;
}

export function isSpeaking() {
  return _speaking;
}

export function isPaused() {
  return _paused;
}

export function getCurrentParaIndex() {
  return currentParaIndex;
}

function speakParagraph(index) {
  if (index >= paragraphs.length) {
    stopTts();
    return;
  }

  currentParaIndex = index;
  onParagraphChange?.(index);

  const utter = new SpeechSynthesisUtterance(paragraphs[index]);
  utter.lang = 'th-TH';
  utter.rate = _rate;

  utter.onend = () => {
    if (_speaking && !_paused) {
      speakParagraph(index + 1);
    }
  };

  utter.onerror = (e) => {
    if (e.error !== 'canceled') {
      // Try next paragraph on non-cancel errors
      if (_speaking) speakParagraph(index + 1);
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

  speakParagraph(startIndex);
}

export function pauseTts() {
  if (!isTtsAvailable() || !_speaking) return;
  speechSynthesis.pause();
  _paused = true;
}

export function resumeTts() {
  if (!isTtsAvailable() || !_speaking) return;
  speechSynthesis.resume();
  _paused = false;
}

export function stopTts() {
  if (!isTtsAvailable()) return;
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
