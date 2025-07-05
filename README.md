# Freestyle Flow Arena

**A dynamic web-based freestyle rap training application that combines word prompts, rhythm detection, voice recognition, and beat playback to enhance your freestyle skills.**

## One-Liner

Transform your freestyle rap practice with intelligent word prompts, real-time BPM detection, voice-activated navigation, and a curated beat library - all in one powerful web application.

## Core Features

### 🎤 **Voice Control & Recognition**
- **Speech Recognition**: Navigate words and rhymes using voice commands
- **Voice-Activated Word Matching**: Automatically advance when you speak the displayed word
- **Voice Commands**: "Next word", "Show rhymes", "Show definition" - all hands-free
- **Real-time Transcript**: See your spoken words as you freestyle

### 🎵 **Rhythm Engine & BPM Detection**
- **Automatic BPM Detection**: Tap or speak to detect tempo from 60-200 BPM
- **Beat Grid Visualization**: Visual metronome with customizable rows/columns
- **BPM Multipliers**: 0.5x, 1x, 2x, 4x tempo variations for different flows
- **Beat Player**: Integrated playlist with 50+ curated hip-hop instrumentals
- **BPM Per Track**: Save and recall BPM settings for each beat

### 📝 **Word Management System**
- **Smart Word Prompts**: 1000+ words with syllable filtering (1-6+ syllables)
- **Rhyme Finder**: Phonetic rhyme detection with 50,000+ rhyme patterns
- **Word Ordering**: Random, alphabetical, or sequential word presentation
- **Custom Word Lists**: Edit, import, and manage your own word collections
- **Favorites & Blacklist**: Personalize your word selection

### 🎮 **Gamification & Progress**
- **Score Tracking**: Earn points for successful voice matches
- **Streak Counter**: Track consecutive successful matches
- **Word Frequency Analysis**: See which words you use most
- **Progress Persistence**: All settings and progress saved locally

### 🎨 **Modern UI & Experience**
- **3D Animated Background**: Dynamic Three.js road animation
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Theme**: Easy on the eyes for extended practice sessions
- **Tooltip System**: Hover for definitions, synonyms, and word info
- **Modal Dialogs**: Clean, organized settings and rhyme finder

### ⚙️ **Advanced Controls**
- **Activation Modes**: Manual, voice-activated, or timed cycling
- **Random Number Generator**: Generate random numbers for freestyle challenges
- **Settings Management**: Export/import your configuration
- **Data Persistence**: All preferences saved in browser storage

## Tech Stack

### **Frontend**
- **Vanilla JavaScript (ES6 Modules)**: Modern, modular architecture
- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Custom styling with animations and responsive design
- **Three.js**: 3D animated background effects

### **Web APIs & Libraries**
- **Web Speech API**: Voice recognition and synthesis
- **Web Audio API**: Real-time BPM detection and analysis
- **Howler.js**: Audio playback and beat management
- **Canvas Confetti**: Celebration animations
- **Font Awesome**: Icon library for UI elements

### **Backend Processing**
- **Python 3**: Rhyme data processing and phonetic analysis
- **CMU Pronouncing Dictionary**: Phonetic pattern extraction
- **HTTP Server**: Local development server (server.py)

### **Data & Storage**
- **LocalStorage**: Persistent settings and user data
- **JSON**: Rhyme patterns and configuration files
- **Text Files**: Word lists and beat metadata

## Project Structure

```
BaseFlowArena/
├── index.html              # Main application entry point
├── styles.css              # Global styles and responsive design
├── server.py               # Python development server
├── process_rhymes.py       # Rhyme data processor
├── rhyme_data.json         # Generated phonetic patterns (50K+ words)
├── random word list.txt    # Base word collection
├── beats/                  # Curated hip-hop instrumentals (50+ tracks)
├── js/                     # JavaScript modules
│   ├── main.js            # Application orchestrator & event handling
│   ├── wordManager.js     # Word loading, filtering, navigation
│   ├── speech.js          # Voice recognition & command processing
│   ├── autoBPM.js         # Real-time BPM detection engine
│   ├── beatManager.js     # Audio playback & playlist management
│   ├── rhyme.js           # Rhyme pattern matching & modal
│   ├── storage.js         # Settings persistence & data management
│   ├── ui.js              # UI updates & element management
│   ├── threeBackground.js # 3D animated background
│   ├── bpm.js             # Beat grid & metronome logic
│   ├── modal.js           # Modal dialog system
│   ├── state.js           # Application state management
│   ├── utils.js           # Utility functions & helpers
│   ├── wordApi.js         # Dictionary API integration
│   ├── datamuse.js        # Word suggestions & synonyms
│   ├── rng.js             # Random number generator
│   └── dictionary.js      # Local dictionary data
└── docs/                  # Documentation and examples
```

## Getting Started

### **Quick Start**
1. Clone or download the project
2. Run `python server.py` to start the development server
3. Open `http://localhost:8000` in your browser
4. Allow microphone access for voice features
5. Start freestyling!

### **First-Time Setup**
1. **Generate Rhyme Data**: Run `python process_rhymes.py` to create phonetic patterns
2. **Add Your Beats**: Place MP3 files in the `beats/` folder
3. **Customize Words**: Edit `random word list.txt` or use the in-app editor

### **Voice Features Setup**
- Ensure your browser supports Web Speech API (Chrome, Edge, Safari)
- Grant microphone permissions when prompted
- Test voice commands: "Next word", "Show rhymes"

## Key Modules Explained

### **Word Management (`wordManager.js`)**
Handles the core word system - loading, filtering by syllables, navigation, and gamification. Integrates with rhyme detection and voice recognition.

### **Speech Recognition (`speech.js`)**
Manages Web Speech API for voice commands and word matching. Provides real-time transcript display and handles various speech recognition states.

### **BPM Detection (`autoBPM.js`)**
Advanced tempo detection using Web Audio API. Analyzes microphone input to detect rhythmic patterns and calculate BPM with confidence scoring.

### **Beat Player (`beatManager.js`)**
Audio playback system using Howler.js. Manages playlist, volume, BPM per track, and UI synchronization for seamless beat integration.

### **Rhyme System (`rhyme.js`)**
Phonetic pattern matching for rhyme detection. Loads from processed JSON data and provides rhyme finder modal with user customization.

## Browser Compatibility

- **Chrome/Edge**: Full feature support
- **Firefox**: Most features (limited speech recognition)
- **Safari**: Core features (limited speech recognition)
- **Mobile**: Responsive design with touch-friendly controls

## Development

### **Adding New Features**
- Follow the modular ES6 architecture
- Add JSDoc comments for documentation
- Update state management in `state.js`
- Test voice features across browsers

### **Customizing Beats**
- Add MP3 files to `beats/` folder
- Update `BEAT_PLAYLIST` in `beatManager.js`
- Use descriptive filenames for automatic naming

### **Extending Word Lists**
- Edit `random word list.txt` (one word per line)
- Run `python process_rhymes.py` to regenerate rhyme data
- Use the in-app word list editor for quick changes

## License

This project is open source and available under the MIT License.

---

**Ready to elevate your freestyle game? Start the server and let the flow begin! 🎤🔥** 