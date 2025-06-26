# Speech Recognition Logic

## Overview
Handles speech recognition using Web Speech API or Google Cloud Speech-to-Text.

## Logic
- **Modes**: Toggles between Web Speech (`web`) and Google Cloud (`server`).
- **Web Speech**:
  - Uses `SpeechRecognition` for real-time transcription.
  - Processes interim and final transcripts, adding line breaks for pauses greater than 700ms.
  - Matches spoken words against the current word, with debouncing via `lastMatchedWord`.
  - Displays transcript from bottom to top (newer text at the bottom) using `flex-direction: column-reverse` in CSS.
- **Google Cloud**:
  - Streams audio via `MediaRecorder` to `/transcribe` endpoint.
  - Matches words similarly, with debouncing.
- **Debouncing**: Prevents rapid word cycling by tracking `lastMatchedWord` and resetting on manual changes.
- **Transcript Display**:
  - Text fills from bottom to top.
  - Interim results are appended at the bottom and updated in real-time.

## Files
- `script.js`: `startWebSpeech()`, `handleSpeechResult()`, `handleSpeechError()` for Web Speech logic.
- `index.html`: Contains the transcript div (`<div id="transcript">`).
- `styles.css`: Styles for the transcript box, including `flex-direction: column-reverse` for bottom-to-top display.