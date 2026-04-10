// public/js/session.js
// Manages the PartyKit real-time connection for Discord Activity multiplayer sessions.
// All functions are safe no-ops when not in a session (i.e. when running in a regular browser).

import { state } from './state.js';
import * as ui from './ui.js';
import * as rhyme from './rhyme.js';
// PartySocket is imported dynamically inside connect() so a blocked CDN
// doesn't prevent session.js (and main.js) from loading at all.

// Set this to your deployed PartyKit host after running `npx partykit deploy`.
// Format: "<project-name>.<partykit-username>.partykit.dev"
// For local dev: "127.0.0.1:1999"
const PARTYKIT_HOST = 'rhyme-nexus.cyphersdigest99.partykit.dev';

let _socket = null;
let _isHost = false;
let _userId = null;
let _onHostChange = null;

/** Returns true if the current user is the room host. */
export function isHost() {
  return _isHost;
}

/** Returns true if a PartyKit session is currently active. */
export function isActive() {
  return _socket !== null;
}

/**
 * Register a callback that fires whenever host status changes.
 * The callback receives a single boolean: true if this client is now the host.
 */
export function setOnHostChange(callback) {
  _onHostChange = callback;
}

/**
 * Connect to a PartyKit room.
 * @param {string} instanceId - The Discord Activity instanceId (used as room key).
 * @param {string} userId - A stable ID for this browser session (from sessionStorage).
 */
export async function connect(instanceId, userId) {
  _userId = userId;

  let PartySocket;
  try {
    ({ default: PartySocket } = await import('/esm/partysocket@1.0.2'));
  } catch (err) {
    throw new Error('[session] Failed to load PartySocket: ' + err.message);
  }

  return new Promise((resolve, reject) => {
    _socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: instanceId,
      query: { userId },
    });

    _socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
      // Resolve after handleMessage so _isHost is set before callers resume.
      if (msg.type === 'ROOM_STATE') resolve();
    });

    _socket.addEventListener('error', (err) => {
      console.error('[session] WebSocket error:', err);
      reject(new Error('[session] WebSocket connection failed'));
    });

    _socket.addEventListener('close', () => {
      console.log('[session] Connection closed');
    });
  });
}

// NOTE: Assumes phonetics data (CMU lookup + inverted index) is already loaded.
// connect() must only be called after phonetics.loadCmuLookup() and loadCmuPhonemes() resolve.
function applyWordChange(word) {
  state.currentWord = word;
  state.currentWordIndex = -1;
  state.lastMatchedWord = null;
  state.currentRhymeList = rhyme.getValidRhymesForWord(word);
  state.currentRhymeIndex = -1;
  ui.displayWord(word);
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'ROOM_STATE': {
      _isHost = msg.isHost;
      // Apply the room's current word to all clients (including reconnecting host)
      if (msg.currentWord) applyWordChange(msg.currentWord);
      // Sync word list if different
      if (msg.wordListFile && msg.wordListFile !== state.wordListFile) {
        state.wordListFile = msg.wordListFile;
        state.wordList = [];          // Force reload
        state.filteredWordList = [];
        import('./wordManager.js').then(wm => wm.loadWords());
      }
      state.minSyllables = msg.minSyllables ?? 0;
      state.maxSyllables = msg.maxSyllables ?? 0;
      state.isCycling = msg.isCycling ?? false;
      state.cycleSpeed = msg.cycleSpeed ?? 10;
      if (_onHostChange) _onHostChange(_isHost);
      break;
    }

    case 'WORD_CHANGE':
      // Viewers apply the incoming word; host already updated locally
      if (!_isHost) applyWordChange(msg.word);
      break;

    case 'SETTINGS_CHANGE':
      if (!_isHost) {
        if (msg.wordListFile && msg.wordListFile !== state.wordListFile) {
          state.wordListFile = msg.wordListFile;
          state.wordList = [];
          state.filteredWordList = [];
          import('./wordManager.js').then(wm => wm.loadWords());
        }
        if (msg.minSyllables !== undefined) state.minSyllables = msg.minSyllables;
        if (msg.maxSyllables !== undefined) state.maxSyllables = msg.maxSyllables;
      }
      break;

    case 'CYCLE_STATE':
      // Viewers don't run their own interval (host drives word changes via WORD_CHANGE),
      // but we keep state in sync so a promoted host has accurate values.
      state.isCycling = msg.isCycling;
      state.cycleSpeed = msg.cycleSpeed;
      break;

    case 'HOST_CHANGE':
      _isHost = msg.newHostId === _userId;
      if (_onHostChange) _onHostChange(_isHost);
      break;
  }
}

// --- Outgoing messages (host only; all are no-ops for viewers) ---

export function broadcastWordChange(word) {
  if (!_socket || !_isHost) return;
  _socket.send(JSON.stringify({ type: 'WORD_CHANGE', word }));
}

export function broadcastCycleState(isCycling, cycleSpeed) {
  if (!_socket || !_isHost) return;
  _socket.send(JSON.stringify({ type: 'CYCLE_STATE', isCycling, cycleSpeed }));
}

export function broadcastSettingsChange(settings) {
  if (!_socket || !_isHost) return;
  _socket.send(JSON.stringify({ type: 'SETTINGS_CHANGE', ...settings }));
}

export function transferHost(newHostId) {
  if (!_socket || !_isHost) return;
  _socket.send(JSON.stringify({ type: 'HOST_TRANSFER', newHostId }));
}
