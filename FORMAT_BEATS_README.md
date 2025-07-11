# Format Beats - Automated Beat File Processing

This script automatically processes your beat files by sanitizing filenames, extracting AI-generated metadata, and generating waveform data for real-time display.

## Features

- **Filename Sanitization**: Converts messy filenames to clean, URL-friendly versions
- **AI Metadata Extraction**: Uses OpenAI GPT to extract track title, producer, type, mood, genre, year, and BPM
- **BPM Detection**: Automatically detects BPM from audio files using librosa's tempo detection
- **Waveform Generation**: Pre-processes audio files to generate waveform data for real-time display
- **File Renaming**: Automatically renames files to their sanitized versions
- **JSON Output**: Generates a structured `beats.json` file with all metadata
- **JavaScript Integration**: Creates a playlist file for integration with your existing beat player

## Installation

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

2. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)

## Usage

### Basic Usage
```bash
python format_beats.py --openai-key YOUR_API_KEY_HERE
```

### Advanced Options
```bash
python format_beats.py \
  --openai-key YOUR_API_KEY_HERE \
  --beats-dir beats \
  --output beats.json \
  --dry-run \
  --update-beat-manager
```

### Command Line Arguments

- `--openai-key`: (Required) Your OpenAI API key
- `--beats-dir`: Directory containing beat files (default: "beats")
- `--output`: Output JSON file name (default: "beats.json")
- `--dry-run`: Don't rename files, just generate metadata
- `--update-beat-manager`: Generate JavaScript playlist file for integration

## What the Script Does

### 1. File Scanning
- Scans the `/beats` directory for all `.mp3` files
- Logs the number of files found

### 2. Filename Sanitization
- Removes date prefixes (YYYYMMDD_)
- Removes special characters (quotes, brackets, etc.)
- Replaces spaces with hyphens
- Removes common prefixes like "[FREE]", "(FREE)"
- Example: `"20170904_A Storytelling Hip-Hop Beat ｜｜ ＂Symphony＂ (Prod. Flakron).mp3"` 
  becomes `"Symphony-A-Storytelling-Hip-Hop-Beat-Prod-Flakron.mp3"`

### 3. AI Metadata Extraction
Uses OpenAI GPT to analyze the original filename and extract:
- **trackTitle**: Main title of the track
- **producer**: Producer name if mentioned
- **type**: Type of beat (e.g., "J. Cole Type Beat", "Hip Hop")
- **mood**: Inferred mood/emotion
- **genre**: Primary genre
- **year**: Year if mentioned
- **bpm**: BPM if mentioned in filename

### 4. BPM Detection and Waveform Generation
- Loads each audio file using librosa
- **BPM Detection**: Uses librosa's beat tracking to detect tempo
- Calculates RMS energy for 100ms frames (for waveform)
- Normalizes and downsamples to 1000 points
- Stores both waveform data and detected BPM for real-time display

### 5. File Renaming
- Renames files to their sanitized versions
- Updates file paths in the metadata
- Skips if target filename already exists

### 6. JSON Output
Creates a structured `beats.json` file with:
```json
{
  "metadata": {
    "totalBeats": 75,
    "generatedAt": "2024-01-15T10:30:00",
    "version": "1.0"
  },
  "beats": [
    {
      "originalFileName": "20170904_A Storytelling Hip-Hop Beat ｜｜ ＂Symphony＂ (Prod. Flakron).mp3",
      "newFileName": "Symphony-A-Storytelling-Hip-Hop-Beat-Prod-Flakron.mp3",
      "filePath": "beats/Symphony-A-Storytelling-Hip-Hop-Beat-Prod-Flakron.mp3",
      "fileSize": 5456789,
      "waveform": [0.1, 0.3, 0.5, ...],
      "detectedBpm": 140,
      "trackTitle": "Symphony",
      "producer": "Flakron",
      "type": "Storytelling Hip-Hop Beat",
      "mood": "Emotional",
      "genre": "Hip Hop",
      "year": "2017",
      "bpm": "140"
    }
  ]
}
```

### 7. JavaScript Integration (Optional)
If `--update-beat-manager` is used, creates `js/generated_playlist.js`:
```javascript
export const BEAT_PLAYLIST = [
  {
    "name": "Symphony",
    "file": "beats/Symphony-A-Storytelling-Hip-Hop-Beat-Prod-Flakron.mp3"
  }
];

export const BEAT_METADATA = [/* full metadata array */];
```

## Integration with Your Beat Player

### Option 1: Use the JSON file directly
```javascript
import beatsData from './beats.json';
// Access beatsData.beats array
```

### Option 2: Use the generated JavaScript file
```javascript
import { BEAT_PLAYLIST, BEAT_METADATA } from './js/generated_playlist.js';
// Replace your existing BEAT_PLAYLIST with this
```

### Option 3: Update beatManager.js
Replace the manual `BEAT_PLAYLIST` array in `js/beatManager.js` with the generated one.

## Waveform Display

The script generates waveform data that can be used for real-time visualization:

```javascript
// Example: Display waveform in your beat player
function displayWaveform(beatData) {
  const canvas = document.getElementById('waveform-canvas');
  const ctx = canvas.getContext('2d');
  
  const waveform = beatData.waveform;
  const width = canvas.width;
  const height = canvas.height;
  
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  
  for (let i = 0; i < waveform.length; i++) {
    const x = (i / waveform.length) * width;
    const y = (1 - waveform[i]) * height;
    ctx.lineTo(x, y);
  }
  
  ctx.stroke();
}
```

## Safety Features

- **Dry Run Mode**: Use `--dry-run` to test without renaming files
- **Duplicate Protection**: Won't overwrite existing files
- **Error Handling**: Continues processing even if individual files fail
- **Logging**: Detailed logs of all operations
- **Backup**: Original filenames are preserved in the JSON output

## Troubleshooting

### Common Issues

1. **OpenAI API Error**: Check your API key and billing status
2. **File Permission Error**: Ensure write permissions in the beats directory
3. **Audio Processing Error**: Some files may be corrupted or unsupported
4. **Memory Issues**: Large audio files may require more RAM

### Logs
The script provides detailed logging. Check the console output for:
- File processing status
- AI extraction results
- Renaming operations
- Error messages

## Example Output

After running the script, you'll have:
- Clean, sanitized filenames
- Rich metadata for each beat
- Pre-generated waveform data
- A structured JSON file ready for your application
- Optional JavaScript integration files

This will significantly improve your beat player's performance and user experience by providing instant waveform display and rich metadata without real-time processing. 