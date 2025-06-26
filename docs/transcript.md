# Transcript Logic

## Overview
The transcript feature captures spoken freestyle rap in real-time using Web Speech API, displaying it as live subtitles with color-coded frequent words.

## Logic
- **Input**: Web Speech API listens continuously with interim results.
- **Processing**:
  - Interim transcripts show live (e.g., “I’m freestyle…” updates as spoken).
  - Final transcripts append on pauses (>700ms) or punctuation (`.`, `!`), with line breaks.
  - Words are tracked in `wordFrequencies`, excluding structural words (e.g., “the”).
  - Frequent words are color-coded: red (≥10 uses), orange (≥7), yellow (≥4), green (2–3).
- **Output**: Rendered in `#transcript` with clickable spans for expansion (rhymes, synonyms, definitions).

## Files
- `index.html`: Lines 550–600 (`startRecognition()`, `updateTranscriptWithColors()`).