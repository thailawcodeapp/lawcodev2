// Builds public/keep-alive.wav — a whisper-quiet, seamlessly-looping tone
// played in the WebView for the whole duration of native background playback.
// See src/lib/audibleKeepAlive.js for why this exists at all.
//
// A pure sine at a frequency that divides evenly into the sample rate closes
// on itself exactly — 100 Hz at 44100 Hz is 441 samples per cycle, so one
// second is exactly 100 whole cycles and the last sample equals the first.
// Looping the file therefore produces zero click or pop at the seam, which
// matters here specifically: a click every second, for as long as a listening
// session runs, would be the one way this feature could actually get noticed.
//
// Amplitude is 4 out of a possible 32767 — about -78 dBFS, an order of
// magnitude below what any real speaker or headphone reproduces as audible
// sound, chosen deliberately non-zero rather than silence: Chromium's
// "this tab is audible" exemption from background-tab throttling is based on
// measured output level, not on whether something is nominally playing, and
// a muted or all-zero track does not qualify.
//
// Usage, from the repository root:
//   node scripts/make-keep-alive-wav.mjs
import { writeFileSync } from 'node:fs';

const SAMPLE_RATE = 44100;
const SECONDS = 1;
const FREQUENCY_HZ = 100; // divides SAMPLE_RATE evenly — see the header comment
const AMPLITUDE = 4; // out of 32767 (16-bit signed PCM)
const N = SAMPLE_RATE * SECONDS;

const samples = new Int16Array(N);
for (let i = 0; i < N; i++) {
  samples[i] = Math.round(AMPLITUDE * Math.sin((2 * Math.PI * FREQUENCY_HZ * i) / SAMPLE_RATE));
}

const dataBytes = samples.length * 2;
const buf = Buffer.alloc(44 + dataBytes);

buf.write('RIFF', 0, 'ascii');
buf.writeUInt32LE(36 + dataBytes, 4);
buf.write('WAVE', 8, 'ascii');
buf.write('fmt ', 12, 'ascii');
buf.writeUInt32LE(16, 16); // fmt chunk size
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(SAMPLE_RATE, 24);
buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate (1 channel * 2 bytes/sample)
buf.writeUInt16LE(2, 32); // block align
buf.writeUInt16LE(16, 34); // bits per sample
buf.write('data', 36, 'ascii');
buf.writeUInt32LE(dataBytes, 40);
for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);

writeFileSync('public/keep-alive.wav', buf);
console.log(`wrote public/keep-alive.wav (${buf.length} bytes, ${SECONDS}s @ ${SAMPLE_RATE}Hz, amplitude ${AMPLITUDE}/32767)`);
