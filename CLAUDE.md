# BaseFlowArena - Claude Code Context

## Project Overview
BaseFlowArena is a web-based freestyle rap training application with intelligent word prompts, real-time BPM detection, voice recognition, and a curated beat library.

## Tech Stack
- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Libraries**: Three.js (3D background), Howler.js (audio), Web Speech API, Web Audio API
- **Backend**: Python (dev server, rhyme processing)

## Project Structure
```
BaseFlowArena/
├── index.html              # Main entry point (loads from public/)
├── word-list.txt           # Default word database (19,115 words)
├── scrabble-nwl2023.txt    # Scrabble NWL2023 dictionary (196,601 words)
├── server.py               # Development server (python3 server.py)
├── public/
│   ├── js/                 # All JavaScript modules
│   │   ├── main.js         # App orchestrator
│   │   ├── wordManager.js  # Word loading/filtering/switching
│   │   ├── wordSearch.js   # Prefix search (normal search)
│   │   ├── reverseSearch.js # Suffix search (reverse search)
│   │   ├── speech.js       # Voice recognition
│   │   ├── autoBPM.js      # BPM detection
│   │   ├── beatManager.js  # Audio playback
│   │   ├── rhyme.js        # Rhyme finding
│   │   ├── ui.js           # UI updates + split-flap animations
│   │   ├── modal.js        # Modal dialogs
│   │   ├── state.js        # App state
│   │   └── storage.js      # LocalStorage persistence
│   ├── styles.css          # Main stylesheet (CRT themes)
│   ├── beats/              # Audio files
│   ├── word-list.txt       # Default word list
│   └── scrabble-nwl2023.txt # Scrabble dictionary
├── docs/                   # Feature documentation
└── beats/                  # Beat audio files
```

## Development Commands
```bash
# Start dev server
python3 server.py
# Server runs at http://localhost:8000

# The server serves from the project root
# index.html loads JS/CSS from public/ folder
```

## Key Conventions
- **All web app code** lives in `/public/` folder
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
- **Change styling/themes**: `public/styles.css`
- **Update UI elements**: `public/js/ui.js` and `index.html`
- **Word transitions**: Split-flap animation in `ui.js` displayWord function

## Testing Notes
- Use Chrome/Edge for best Web Speech API support
- Allow microphone access for voice features
- Clear localStorage if word list seems wrong: `localStorage.clear()`
- Large word lists (>50K) show preview only in editor modal
