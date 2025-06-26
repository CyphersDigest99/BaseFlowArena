# Word List Editing Logic

## Overview
Allows editing of `random word list.txt` via a modal interface.

## Logic
- **Button**: `<button id="edit-word-list-btn">Edit Word List</button>`.
- **Modal**: `#word-list-editor` displays all words in editable inputs.
- **Editing**:
  - Each word has an input field and a "Remove" button.
  - Updates are sent to `/update-word-list` endpoint.
- **Server**: `server.py` writes updated words to `random word list.txt`.

## Files
- `index.html`: Lines 400–450 (UI), 600–700 (logic).
- `server.py`: Lines 100–120 (endpoint).