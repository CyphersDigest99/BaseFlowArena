# BaseFlowArena - Claude Code Context

## Branch & Deployment Protocol (READ BEFORE COMMITTING)

This repo has **two branches** (`main` and `discord`) that deploy to **two separate Vercel projects** with different wiring. Before committing or pushing on either branch, **review `docs/architecture.md`** to confirm:
- The change belongs on the branch you're committing to (shared vs. branch-specific)
- Any API additions update all three proxy locations (vercel.json, server.py, Discord Developer Portal)
- Cache-bust is done at HTML entry points only, never on ES module imports
- One-way merge: `main → discord` only, never the reverse

The architecture doc has the current deployment wiring (GitHub Action, `VERCEL_TOKEN`, Ignored Build Step) and a recovery table for common failures. Consult it when anything about branches, Vercel, or deploys comes up.

## Project Overview
BaseFlowArena is a web-based freestyle rap training application with intelligent word prompts, real-time BPM detection, voice recognition, and a curated beat library.

## Tech Stack
- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Libraries**: Three.js (3D background), Howler.js (audio), Web Speech API, Web Audio API
- **Backend**: Python (dev server, rhyme processing)

## Project Structure
```
BaseFlowArena/
├── index.html              # Main HTML entry point (canonical, served by server)
├── styles.css              # Main stylesheet (canonical, CRT themes)
├── server.py               # Development server (python3 server.py)
├── word-list.txt           # Default word database (19,115 words)
├── scrabble-nwl2023.txt    # Scrabble NWL2023 dictionary (196,601 words)
├── public/
│   ├── js/                 # All JavaScript modules
│   │   ├── main.js         # App orchestrator
│   │   ├── wordManager.js  # Word loading/filtering/switching
│   │   ├── wordSearch.js   # Prefix search (normal search)
│   │   ├── reverseSearch.js # Suffix search (reverse search)
│   │   ├── speech.js       # Voice recognition
│   │   ├── autoBPM.js      # BPM detection
│   │   ├── beatManager.js  # Audio playback
│   │   ├── rhyme.js        # Rhyme finding + feedback card
│   │   ├── phonetics.js    # Phonetic scoring engine
│   │   ├── ui.js           # UI updates + split-flap animations
│   │   ├── modal.js        # Modal dialogs
│   │   ├── state.js        # App state
│   │   └── storage.js      # LocalStorage persistence
│   ├── beats/              # Audio files
│   ├── cmu_lookup.json     # Compact CMU dictionary (vowel patterns)
│   ├── cmu_phonemes.json   # Full CMU phoneme data (117k entries)
│   └── rhyme_data.json     # Pre-baked rhyme data for word list
├── docs/                   # Feature specs and plans
└── beats/                  # Beat audio files
```

**IMPORTANT: No HTML or CSS in `public/`.** `index.html` and `styles.css` live at root only. Do NOT create `public/index.html` or `public/styles.css` — they were deleted to end duplication drift.

## Development Commands
```bash
# Start dev server
python3 server.py
# Server runs at http://localhost:8000

# The server serves from the project root
# index.html loads JS/CSS from public/ folder
```

## Key Conventions
- **HTML/CSS at root**, JS in `public/js/`, data files in `public/`
- **File naming**: BPM must be ALL CAPS (autoBPM.js, not autobpm.js)
- **Module imports**: Use relative paths (e.g., `./autoBPM.js`)
- **Word lists**: Selectable via dropdown (Default 19K or Scrabble 196K)
- **Themes**: CRT-style with green (classic) or amber (dark) phosphor

## Current Branch
`Reverse-Search-Cleanup` - Refactoring reverse search feature

## Important Files for Common Tasks
- **Add new words**: Edit `word-list.txt` or use in-app editor (small lists only)
- **Add word list**: Drop `.txt` file in root + public, add option to dropdown in index.html
- **Modify search behavior**: `public/js/wordSearch.js` or `public/js/reverseSearch.js`
- **Change styling/themes**: `styles.css` (root)
- **Update UI elements**: `public/js/ui.js` and `index.html` (root)
- **Word transitions**: Split-flap animation in `ui.js` displayWord function

## Testing Notes
- Use Chrome/Edge for best Web Speech API support
- Allow microphone access for voice features
- Clear localStorage if word list seems wrong: `localStorage.clear()`
- Large word lists (>50K) show preview only in editor modal
