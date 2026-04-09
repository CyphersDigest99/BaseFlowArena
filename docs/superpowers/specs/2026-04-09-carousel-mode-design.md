# Carousel Mode — Design Spec
**Date:** 2026-04-09

## Overview

A hands-free, full-viewport view mode where words are displayed on 3D rotating cards arranged in a ring. As each card passes through the back of the ring it silently receives a new word, ready to display on its next pass to the front. No synonyms, definitions, or side panels — just the rotating words.

---

## Entry Point

A carousel icon button is added to the **Activation Mode panel header**, upper-right corner, next to the "Activation Mode" title. Clicking it launches the carousel overlay.

---

## Carousel Overlay

The overlay covers the full browser viewport (browser chrome and OS taskbar remain visible — this is not OS fullscreen). The app's side panels (left filter panel, right rhythm engine) are hidden while the overlay is active.

**Overlay controls:**
- **Config button** — top-left, opens the config panel
- **Exit button** — top-right, closes the overlay and restores the normal app view
- **Blacklist button** — bottom-center of the overlay, below the carousel ring. Blacklists the word currently on the front card and immediately swaps it for the next word. Uses the same blacklist mechanism as the main app.
- **Favorite button** — bottom-center, next to the blacklist button. Favorites the word currently on the front card. Uses the same favorites mechanism as the main app.

---

## Animation — requestAnimationFrame Loop

A single `angle` variable is incremented each frame based on the current speed setting. Each card is positioned at:

```
rotateY(angle + (360 / N × i)) translateZ(radius)
```

The ring is tilted on the X-axis (default −15°, configurable).

**Depth rendering:** The front card (near 0°) renders at full size and full brightness. Cards further around the ring are scaled down and faded proportionally, giving a depth illusion without perspective math.

**Word swapping:** Each frame, JS checks whether any card has crossed the ~180° threshold since the previous frame. When one does, it receives the next word from `wordManager` before it comes back around to the front. The swap is invisible to the viewer.

**Live config:** Speed, card count, tilt, and direction are plain variables read by the loop each frame. Changing any of them takes effect immediately.

---

## Config Panel

Triggered by the Config button. ESC also closes it. While the panel is open the carousel runs at 0.2× speed. Closing it resumes normal speed.

**Settings:**

| Setting | Control | Default |
|---|---|---|
| Rotation speed | Slider (seconds per revolution) | 20s |
| Direction | Segmented: CW / CCW | CW |
| Tilt angle | Slider (degrees) | −15° |
| Number of cards | Segmented: 4 / 6 / 8 / 10 / 12 | 8 |
| Syllable min | Slider | 1 |
| Syllable max | Slider | 4 |

The syllable min/max applies only to words shown in the carousel. It overrides the main app's syllable filter for the duration of the carousel session. When the user exits carousel mode, the main list reverts to its own syllable settings.

All settings are grouped into three visual sections: **Rotation**, **Cards**, **Words**.

---

## Word Sourcing

The carousel uses the same word source and ordering as the main app — whatever word list (txt file) is selected in the dropdown and whatever sort order (random, A-Z, etc.) is active at the time carries directly into the carousel. Changes to those settings mid-session are reflected immediately.

The one carousel-specific override is the syllable range from the config panel, which filters the word pool independently of the main app's syllable setting for the duration of the carousel session.

---

## Architecture

### New file
**`public/js/carouselMode.js`** — self-contained module with:
- `init()` — builds the overlay DOM and injects it into the page (called once on app load)
- `enter()` — shows overlay, hides side panels, starts the rAF loop
- `exit()` — stops the loop, hides overlay, restores side panels
- `openConfig()` / `closeConfig()` — toggles config panel, sets speed multiplier
- `rAFLoop(timestamp)` — main loop: increments angle, updates card transforms, detects 180° crossings, swaps words

### Modified files
- **`index.html`** — carousel button added to Activation Mode panel header
- **`styles.css`** — carousel overlay and card styles added (scoped under `.carousel-overlay` to avoid conflict with existing `perspective: none !important` rule on the main app)
- **`public/js/main.js`** — imports `carouselMode`, wires entry button click handler

### CSS scoping note
The main app has `perspective: none !important` and `transform-style: flat !important` applied broadly. Carousel 3D styles must be scoped under `.carousel-overlay` and use sufficient specificity to override those rules within the overlay.

---

## What Is Not In Scope

- Voice recognition or BPM sync in carousel mode
- Rhyme or synonym display
- Saving carousel settings between sessions (can be added later)
- Keyboard navigation of words within the carousel
