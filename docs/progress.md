# Project Progress

## January 2026
- Added 90s underground CRT theme with green (classic) and amber (dark) phosphor styles
- Implemented split-flap display animation for word transitions (fuel pump style)
- Added word list source selector with support for multiple word lists
- Integrated Scrabble NWL2023 dictionary (196,601 words)
- Added direction-based flip animations (top/bottom based on navigation)
- Added letter segment borders for retro display effect
- Fixed case-insensitive word matching for search border indicator
- Added large word list handling with preview mode
- Backspace now closes search when query is empty

## Previous Progress
- Fixed server connection errors by adding chunked file serving in `server.py`.
- Implemented real-time transcript with line breaks and color-coded frequent words.
- Added progress meter, word frequency tracking, and word expansion.
- Added BPM detection with four-count visual.
- Added toggle for Web Speech API vs. Google Cloud Speech, revamped layout, and added mute button.
- Updated `server.py` to fix import error (`enums` removed).
- Fixed `FileNotFoundError` by updating `GOOGLE_CLOUD_CREDENTIALS` path.
- Fixed "Loading..." issue, improved speech recognition, and added BPM button.
- Fixed "Start Freestyle" button, resolved speech recognition errors, added BPM adjustments, improved word menu, and fixed refresh bug.
- Fixed word loading error, adjusted BPM buttons, added configurable four-count, fixed refresh bug.
- Fixed rapid word cycling, added BPM row/column removal, added pulsing color effect, added mic reinitialization, removed transcript popup, fixed main word menu, added favorited words list, and enhanced common words with persistence.
- Adjusted BPM timing, updated BPM buttons to -/+, fixed row/column logic, fixed common words display, added word list editing, and reversed transcript order.