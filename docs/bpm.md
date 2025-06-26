# BPM Detection Logic

## Overview
Detects BPM via clicks, with configurable rows/columns and visual effects.

## Logic
- **Button**: `<button id="bpm-button">🖱️ BPM</button>`.
- **Detection**:
  - Calculates BPM from click intervals, averaging last 10 clicks.
  - Starts the first beat one interval after the last click.
- **Adjustment**:
  - `-` (left) and `+` (right) buttons adjust BPM by ±1.
- **Configuration**:
  - Row buttons (`+` and `-` with horizontal line) below the counter (max 8, min 1).
  - Column buttons (`+` and `-` with vertical line) on the right (max 8, min 4).
  - Adding/removing columns affects all rows.
  - New rows match the current column count.
- **Visual**:
  - Cycles through boxes with a pulsing effect and color changes per beat.

## Files
- `index.html`: Lines 150–170 (buttons), 340–360 (layout), 1150–1300 (logic).