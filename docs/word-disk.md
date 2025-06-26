# Word Disk Component

## Overview
The Word Disk is a 3D rotating wheel that displays words for the user to freestyle with. It mimics a slot machine, where words cycle vertically (up and down) through a front-facing window.

## Implementation Details
- **HTML**: The word disk is a `<div>` with the ID `word-disk`, containing multiple `.word-face` divs for each word.
- **CSS**:
  - Uses `perspective` and `transform-style: preserve-3d` to create a 3D effect.
  - Each `.word-face` is rotated around the X-axis (`rotateX`) to form a vertical cylinder.
  - Opacity is adjusted based on the word's position, with the front-facing word (at 0°) being most visible.
- **JavaScript**:
  - `initializeDisk()`: Sets up the word faces and their initial positions.
  - `updateDiskFaces()`: Updates the words and their positions/opacity during rotation.
  - `changeWord()`, `prevWord()`, `nextWord()`: Handle the rotation logic by adjusting the `diskRotation` angle and applying `rotateX`.

## Features
- Words cycle vertically like a slot machine.
- The front-facing word is highlighted (highest opacity).
- Users can navigate through words manually (up/down buttons) or automatically (timed cycling).
- Supports blacklisting, favoriting, and finding rhymes/related words via a context menu.

## Known Issues
- None at this time.