# Word Frequencies Logic

## Overview
Tracks frequent words and manually added common words.

## Logic
- **Tracking**: Counts words in `transcriptText`, excluding `structuralWords`.
- **Common Words**:
  - Manually added via `#add-common-word` input.
  - Persisted in `commonWords` using `localStorage`.
  - Displayed in green at the top of the "Common Words & Rhymes" section.
- **Frequent Words**: Shows top 5 frequent words with color-coded counts.

## Files
- `index.html`: Lines 380–400 (UI), 800–820 (logic).