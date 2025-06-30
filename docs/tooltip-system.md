# Tooltip System Documentation

## Overview
The tooltip system in BaseFlowArena provides a multi-state, interactive way to display word definitions and synonyms. It features a sophisticated state management system with visual feedback, hover effects, and multiple interaction modes.

## Core Components

### Button Element
- **Location**: Bottom-right corner of the word display area
- **HTML Class**: `word-action-icon means-like-icon`
- **Default Icon**: Closed book (`fas fa-book`)

### Tooltip Display Areas
- **Synonyms Box**: Displays word synonyms
- **Definition Box**: Displays word definitions
- **Location**: Adjacent to the button

## State Management

### Tooltip States
The tooltip has two main states managed by `state.tooltip.isPinned`:

1. **Unpinned State** (`isPinned: false`)
   - Default state on page load
   - Tooltip content is hidden
   - Button shows closed book icon
   - Button has dim appearance

2. **Pinned State** (`isPinned: true`)
   - Tooltip content is visible
   - Button shows mode-specific icon
   - Button has bright appearance
   - Content persists until manually unpinned

### Display Modes
When pinned, the tooltip cycles through three display modes:

1. **"both"** - Shows both definition and synonyms
   - Icon: Open book (`fas fa-book-open`)
   - Color: Highlight color (orange)

2. **"synonyms"** - Shows only synonyms
   - Icon: Random icon (`fas fa-random`)
   - Color: Green

3. **"definition"** - Shows only definition
   - Icon: Paragraph icon (`fas fa-paragraph`)
   - Color: Primary accent (blue)

## Visual Behavior

### Unpinned State Visuals
- **Default Appearance**:
  - Icon: Closed book (`fas fa-book`)
  - Color: Secondary accent (dim)
  - Opacity: 70%
  - No glow or shadow

- **Hover Effects**:
  - Color: Primary accent (bright)
  - Opacity: 100%
  - Scale: 1.1x
  - Pulse animation
  - Shimmer effect
  - Box shadow glow

### Pinned State Visuals
- **Default Appearance**:
  - Icon: Mode-specific (book-open, random, or paragraph)
  - Color: Highlight color (bright orange)
  - Opacity: 100%
  - Glow effect with box shadow
  - Background: Subtle highlight color with transparency

- **Hover Effects**:
  - Maintains bright appearance
  - Scale: 1.1x
  - Enhanced glow effect
  - Pulse animation
  - Shimmer effect

## Animation Logic for Word Transitions

### Pixel Block Effect
When a word is matched by voice or changed via navigation, a pixel block animation is triggered for a smooth, visually engaging transition:

1. **Dissolve Phase**
   - The current word dissolves character by character, each letter fading out, shrinking, and rotating 180°.
   - The static word display is hidden during this phase to prevent overlap.

2. **Wait Phase**
   - The animation waits for the new word to be set in the background (e.g., after a voice match or navigation).
   - This ensures the animation is always in sync with the actual word change.

3. **Construct Phase**
   - The new word is constructed character by character, each letter fading in, scaling up, and rotating from -180° to 0°.
   - The static word display remains hidden until the animation is fully complete.

4. **Completion**
   - After all letters have animated in, the overlay is removed and the static word display is restored and made visible.
   - This guarantees that the static word only appears after the animation is finished, preventing any visual overlap or timing issues.

### Technical Details
- The animation is handled entirely by an overlay element, which is positioned over the word display area.
- The static word display (`#word-display`) is set to `display: none` during the animation and restored to `display: flex` only after the animation completes.
- Safety timeouts ensure the overlay is always cleaned up, even if something goes wrong.

## Interaction System

### Left-Click Behavior
- **Unpinned State**: 
  - Pins the tooltip
  - Switches to "both" mode
  - Shows definition and synonyms for current word
  - Button becomes bright

- **Pinned State**:
  - Cycles through display modes: both → synonyms → definition → both
  - Updates icon and content accordingly
  - Maintains pinned state

### Right-Click Behavior
- **Any State**: Unpins the tooltip
  - Returns to unpinned state
  - Hides tooltip content
  - Button returns to dim appearance
  - Icon changes back to closed book

### Hover Text (Tooltip Popup)
The button's `title` attribute shows contextual information:

- **Unpinned State**: "Show definition and synonyms"
- **Pinned State**: Shows next action based on current mode:
  - "both" mode: "Show synonyms only"
  - "synonyms" mode: "Show definition only"  
  - "definition" mode: "Show both definition and synonyms"

## CSS Animations

### Shimmer Effect
```css
@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
```
- Applied on hover in both pinned and unpinned states
- Creates a subtle gradient sweep effect
- Duration: 1.5s, infinite loop

### Pulse Animation
- Applied on hover in both states
- Creates a breathing effect
- Enhances visual feedback

### Scale Transform
- Applied on hover in both states
- Scales button to 1.1x size
- Provides tactile feedback

## State Transitions

### Word Navigation
When navigating to a new word (via arrow keys or other means):

1. **If Unpinned**: No change to tooltip state
2. **If Pinned**: 
   - Tooltip content updates for new word
   - Maintains current display mode
   - Maintains pinned state and bright appearance
   - Icon and hover text remain consistent

### Page Refresh
- Tooltip resets to unpinned state
- Returns to default closed book icon
- All content is hidden

## Technical Implementation

### Key Functions
- `updateTooltipView()`: Main function for updating tooltip display
- `showSynonyms()` / `hideSynonyms()`: Manage synonyms display
- `showDefinition()` / `hideDefinition()`: Manage definition display

### State Variables
- `state.tooltip.isPinned`: Boolean for pinned state
- `state.tooltip.displayMode`: String ('both', 'synonyms', 'definition')

### Event Handlers
- **mousedown**: Handles both left-click (pin/cycle) and right-click (unpin)
- **contextmenu**: Prevented to avoid browser context menu

## Accessibility Features

### Keyboard Navigation
- Tooltip button is focusable
- Enter key triggers left-click behavior
- Context menu key triggers right-click behavior

### Screen Reader Support
- Button has descriptive `title` attribute
- Icon changes provide visual state indication
- Content is properly labeled

## Troubleshooting

### Common Issues
1. **Tooltip not updating on word change**: Check if `updateTooltipView()` is called in word change callbacks
2. **Brightness not persisting when pinned**: Verify CSS specificity and `!important` declarations
3. **Hover text incorrect**: Ensure `title` attribute is updated in `updateTooltipView()`

### Debug Tips
- Check browser console for JavaScript errors
- Verify CSS classes are properly applied
- Test state transitions step by step
- Use browser dev tools to inspect element states

## Future Enhancements

### Potential Improvements
- Add keyboard shortcuts for tooltip control
- Implement tooltip positioning options
- Add animation preferences
- Support for custom tooltip themes
- Integration with voice commands

### Extension Points
- Additional display modes
- Custom icon sets
- Advanced animation effects
- Tooltip content formatting options 