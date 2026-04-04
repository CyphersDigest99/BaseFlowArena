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

/**
 * Updates piano key highlight classes based on the detected root note.
 * @param {string|null} rootName - Note name e.g. 'A', or null to clear all highlights.
 */
function updatePiano(rootName) {
  const keys = document.querySelectorAll('.kf-key');
  const scaleNotes = rootName ? getMinorScale(rootName) : [];

  keys.forEach(key => {
    const note = key.dataset.note;
    key.classList.remove('kf-key--root', 'kf-key--scale');
    if (!rootName) return;
    if (note === rootName) {
      key.classList.add('kf-key--root');
    } else if (scaleNotes.includes(note)) {
      key.classList.add('kf-key--scale');
    }
  });
}

/**
 * Updates the note label, scale name, and piano highlights.
 * @param {string|null} noteName - e.g. 'A', or null to show idle state.
 */
function updateDisplay(noteName) {
  const noteEl = document.getElementById('kf-detected-note');
  const scaleEl = document.getElementById('kf-scale-name');
  if (!noteEl || !scaleEl) return;

  if (!noteName) {
    noteEl.textContent = '—';
    scaleEl.textContent = '—';
    updatePiano(null);
    return;
  }

  noteEl.textContent = noteName;
  scaleEl.textContent = `${noteName} Natural Minor`;
  updatePiano(noteName);
}

// Module-level state — shared between open/close/loop
let _audioCtx = null;
let _analyser = null;
let _stream = null;
let _rafId = null;
let _buf = null;
// Debounce: only switch displayed note when same note is stable for N frames
let _lastNote = null;
let _noteCount = 0;
const NOTE_HOLD_FRAMES = 4;

function startPitchLoop() {
  if (!_analyser || !_audioCtx) return;

  function tick() {
    if (!_analyser || !_buf) return;
    _analyser.getFloatTimeDomainData(_buf);
    const freq = autoCorrelate(_buf, _audioCtx.sampleRate);

    if (freq > 0) {
      const midi = freqToMidi(freq);
      if (midi !== null) {
        const name = midiToName(midi);
        if (name === _lastNote) {
          _noteCount++;
          if (_noteCount >= NOTE_HOLD_FRAMES) updateDisplay(name);
        } else {
          _lastNote = name;
          _noteCount = 1; // count this frame as the first observation
        }
      }
    }

    _rafId = requestAnimationFrame(tick);
  }

  _rafId = requestAnimationFrame(tick);
}

/**
 * Opens the Key Finder modal and starts mic capture + pitch detection.
 */
export async function open() {
  if (_audioCtx) return; // already open — prevent double-init
  const modal = document.getElementById('key-finder-modal');
  if (!modal) return;

  try {
    _stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    _audioCtx = new AudioContext();
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = 2048;
    _buf = new Float32Array(_analyser.fftSize);

    const source = _audioCtx.createMediaStreamSource(_stream);
    source.connect(_analyser);

    modal.style.display = 'block';
    updateDisplay(null);
    startPitchLoop();
  } catch (err) {
    console.warn('Key Finder: mic access denied or unavailable', err);
    modal.style.display = 'block';
  }
}

/**
 * Closes the Key Finder modal and releases all audio resources.
 */
export function close() {
  const modal = document.getElementById('key-finder-modal');
  if (modal) modal.style.display = 'none';

  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
  if (_audioCtx) { _audioCtx.close(); _audioCtx = null; }
  _analyser = null;
  _buf = null;
  _lastNote = null;
  _noteCount = 0;

  updateDisplay(null);
}

/**
 * Wires the FIND KEY button and modal close handlers.
 * Call once from main.js after DOMContentLoaded.
 */
export function init() {
  const openBtn = document.getElementById('open-key-finder-button');
  const closeBtn = document.getElementById('close-key-finder-modal');
  const modal = document.getElementById('key-finder-modal');

  if (!openBtn || !closeBtn || !modal) {
    console.warn('Key Finder: DOM elements not found');
    return;
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);

  // Close on backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });
}
