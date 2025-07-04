# Adding New MP3s to Your Beat Player

## Quick Steps:

1. **Drop your MP3 files into the `beats/` folder**
2. **Add them to the playlist in `js/beatManager.js`**

## Method 1: Manual Addition (Recommended)

1. Open `js/beatManager.js`
2. Find the `BEAT_PLAYLIST` array (around line 8)
3. Add your new beat like this:

```javascript
{
    name: "Your Beat Name",
    file: "beats/your-filename.mp3"
},
```

### Example:
If you add a file called `my-new-beat.mp3` to the `beats/` folder, add this to the playlist:

```javascript
{
    name: "My New Beat",
    file: "beats/my-new-beat.mp3"
},
```

## Method 2: Dynamic Addition (Advanced)

You can also add beats programmatically using the `addMP3ToPlaylist` function:

```javascript
import { addMP3ToPlaylist } from './js/beatManager.js';

// Add with auto-generated name
addMP3ToPlaylist('beats/new-beat.mp3');

// Add with custom name
addMP3ToPlaylist('beats/new-beat.mp3', 'My Custom Beat Name');
```

## File Naming Tips:

- Use simple filenames without special characters
- Avoid spaces in filenames (use hyphens or underscores)
- Make sure the file path in the playlist matches exactly

## What Happens When You Add a Beat:

✅ **Automatic Features:**
- BPM detection and storage per track
- Album art extraction (if embedded in MP3)
- Waveform visualization
- Volume control
- Playlist navigation

✅ **UI Updates:**
- Beat counter updates (e.g., "3/8: Your Beat Name")
- Previous/Next buttons work with new beats
- All controls work immediately

## Troubleshooting:

- **Beat not playing?** Check the file path is correct
- **No album art?** The MP3 might not have embedded artwork
- **BPM not detected?** Use the BPM detection feature or set it manually

That's it! Your new beats will be available immediately after adding them to the playlist. 