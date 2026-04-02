# Changelog

## 2026-04-02
- Rebuild voice-match word transition animation: replace broken overlay system with CSS-only dissolve-exit animation on real flip-letter spans, eliminating style mismatch and competing animations
- Add dissolve-char CSS keyframe animation for staggered letter exit
- Fix rhyme modal tooltip getting stuck: cleanup was querying wrong class name (`.match-tooltip` vs `.rhyme-tier-tooltip`)
- Fix tooltip positioning: change from `position: absolute` to `position: fixed` for body-appended tooltips
- Fix rhyme modal heading in similarity mode: show only vowel (orange) phoneme blocks, filter out consonant (green) blocks
- Fix XSS in search autocomplete: replace innerHTML with textContent/DOM API in wordSearch.js and reverseSearch.js
- Fix memory leak in rhyme modal: replace per-item mouseenter/mouseleave listeners with event delegation on list container
- Delete stale root js/ directory (24 files) — only public/js/ is loaded by index.html
- Backfill CHANGELOG.md from git history

## 2025-08-17
- Improve layout/usability: taller word display cell, rhyme button repositioned to align with search buttons, smaller screen-shake font size

## 2025-08-16
- Refactor project structure to use `public/` directory for styles and scripts
- Revise HTML layout: reposition search buttons and rhyme finder button
- Add search input with autocomplete support

## 2025-08-09
- Fix reverse search icon positioning (bottom/left props, remove transform)
- Incomplete activation panel work (partial commit)

## 2025-08-08
- New activation panel with voice match and timed cycle buttons
- Move timed cycle controls into slider container
- Remove old activation controls

## 2025-07-22
- Add reverse search feature: find words ending with a specific suffix
- Keyboard navigation for reverse search suggestions

## 2025-07-19
- Enhance BPM management: conditionally set/stop BPM based on music playback state
- Reset BPM and stop animations on hard refresh
- Add ignored words feature with modal for managing excluded words from frequency tracking
- Search input visual feedback: dynamic border states, "Press Enter to add" prompt
- Add word search feature with autocomplete suggestions

## 2025-07-14
- Add microphone visualizer with real-time audio canvas
- Refactor word display with two-slot animation system for transitions

## 2025-07-13
- Fix triplet mode visual bug: only active box flashes gold, no container-wide effect

## 2025-07-12
- Iterate on triplet mode visuals: warm gold pulse following active beat box
- Add triplet mode background pulse animation at 3x BPM
- Redesign multiplier system: 1/2x, 2x, and Triplet modes with subdivision animation
- Redesign beat grid with moving light effect and smooth transitions
- Fix sync button delay: immediate visual feedback on click
- Fix beat box resync for instant response
- Add clickable first beat box for BPM grid resync
- Fix missing import for `updateBpmIndicator`
- Repair BPM display and sync logic
- Standardize autoBPM file naming and imports
- Add project rules document
- Rename heavy beats JSON (too large for Vercel)
- Clean up project structure and add deployment configs

## 2025-07-11
- Fix typo in random word list
- Add branch summary generation script
- Add beat analysis and lightweight version creation (`beats_lightweight.json`)
- Add beat player storage key for settings management
- Comment out BPM UI updates for stabilization

## 2025-07-10
- Refactor BPM indicator logic and introduce UI helper functions
- Add Classic theme and enhance theme controls

## 2025-07-09
- Implement theme customization with randomization
- Enhance keyboard navigation and visual feedback in rhyme finder

## 2025-07-08
- Add keyboard testing HTML and enhance keyboard control system

## 2025-07-06
- Enhance rhyme finder with phoneme support and sorting improvements
- Add rhyme sort toggle and update navigation logic
- Implement rhyme finder sorting controls
- Add Flow Meter component with dynamic animations

## 2025-07-05
- Revamp rhyme finder modal with dynamic heading and improved styling
- Enhance dynamic font scaling for word display
- Refactor word display area with feedback message wrapper
- Improve blacklist functionality
- New three-cell layout for word display area
- Add README with comprehensive documentation
- Revise ADDING_BEATS.md documentation
- Enhance process_rhymes.py with improved phonetic processing
- Add development HTTP server (`server.py`)

## 2025-07-04
- Add comprehensive documentation to styles.css

## 2025-07-03
- Mass documentation pass across all JS modules (state, storage, ui, wordManager, speech, autoBPM, beatManager, bpm, rhyme, modal, dictionary, datamuse, threeBackground, rng, utils)
- Refactor state management with enhanced organization
- Add new beat management features and MP3 integration

## 2025-07-01
- Add beat player functionality with Howler.js integration

## 2025-06-30
- Enhance tooltip animation and word display logic

## 2025-06-29
- Enhance tooltip system with new states and animations
- Add settings and data management features
- General UI/UX improvements, polish, and animations

## 2025-06-28
- Implement voice commands for voice match mode
- Add tooltip with definitions from DictionaryAPI
- Add synonym tooltip using Datamuse API
- Implement syllable filter with min/max inputs and dropdowns
- Fix word display container jitter
- Initial commit: Freestyle Flow Arena v1.0

## 2025-06-25
- Initial upload
