// public/js/keyFinder.js

const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
// Natural minor scale: semitone intervals from root
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

/**
 * Returns the 7 notes of the natural minor scale for a given root note name.
 * e.g. getMinorScale('A') → ['A','B','C','D','E','F','G']
 * @param {string} rootName - Must use sharp notation (e.g. 'A#', not 'Bb').
 */
export function getMinorScale(rootName) {
  const rootIdx = CHROMATIC.indexOf(rootName);
  if (rootIdx === -1) return [];
  return MINOR_INTERVALS.map(i => CHROMATIC[(rootIdx + i) % 12]);
}

/**
 * Converts a frequency in Hz to a MIDI note number.
 * Returns null if outside vocal range (80–1100 Hz).
 */
export function freqToMidi(freq) {
  if (freq < 80 || freq > 1100) return null;
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

/**
 * Returns the note name (e.g. 'A', 'C#') for a MIDI note number.
 */
export function midiToName(midi) {
  return CHROMATIC[((midi % 12) + 12) % 12];
}

/**
 * Autocorrelation-based fundamental frequency detector.
 * @param {Float32Array} buf - From AnalyserNode.getFloatTimeDomainData(); expected fftSize 2048.
 * @param {number} sampleRate - AudioContext.sampleRate
 * @returns {number} Hz, or -1 if signal is too quiet / no clear pitch found.
 */
export function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;

  // RMS check — return -1 if too quiet
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.015) return -1;

  // Trim leading/trailing silence
  let r1 = 0, r2 = SIZE - 1;
  const thresh = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) >= thresh) { r1 = i; break; }
  }
  // r2 loop starts at i=1 (not 0) to avoid zero-length slice when trimming from the end
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) >= thresh) { r2 = SIZE - i; break; }
  }
  const trimmed = buf.slice(r1, r2);
  const N = trimmed.length;

  // Compute autocorrelation
  const c = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  // Find first dip, then first peak after the dip
  let d = 0;
  while (d < N - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < N; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  if (maxpos < 1 || maxpos >= N - 1) return -1;

  // Parabolic interpolation for sub-sample accuracy
  const x1 = c[maxpos - 1], x2 = c[maxpos], x3 = c[maxpos + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const T0 = a ? maxpos - b / (2 * a) : maxpos;

  return sampleRate / T0;
}
