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
├── word-list.txt           # Word database (19,115 words)
├── server.py               # Development server (python3 server.py)
├── public/
│   ├── js/                 # All JavaScript modules
│   │   ├── main.js         # App orchestrator
│   │   ├── wordManager.js  # Word loading/filtering
│   │   ├── wordSearch.js   # Prefix search (normal search)
│   │   ├── reverseSearch.js # Suffix search (reverse search)
│   │   ├── speech.js       # Voice recognition
│   │   ├── autoBPM.js      # BPM detection
│   │   ├── beatManager.js  # Audio playback
│   │   ├── rhyme.js        # Rhyme finding
│   │   ├── ui.js           # UI updates
│   │   ├── modal.js        # Modal dialogs
│   │   ├── state.js        # App state
│   │   └── storage.js      # LocalStorage persistence
│   ├── styles.css          # Main stylesheet
│   ├── beats/              # Audio files
│   └── word-list.txt       # (copy of root word-list.txt)
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
- **Word list**: Loaded from `/word-list.txt` at root

## Current Branch
`Reverse-Search-Cleanup` - Refactoring reverse search feature

## Important Files for Common Tasks
- **Add new words**: Edit `word-list.txt` or use in-app editor
- **Modify search behavior**: `public/js/wordSearch.js` or `public/js/reverseSearch.js`
- **Change styling**: `public/styles.css`
- **Update UI elements**: `public/js/ui.js` and `index.html`

## Testing Notes
- Use Chrome/Edge for best Web Speech API support
- Allow microphone access for voice features
- Clear localStorage if word list seems wrong: `localStorage.clear()`
