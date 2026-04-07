/**
 * @fileoverview General Utility and Animation Effects Module
 *
 * This module provides general-purpose utility functions and advanced UI animation effects
 * for the BaseFlowArena application. It includes string similarity, particle bursts, swipe
 * transitions, pixel dissolve/construct effects, and legacy compatibility helpers.
 *
 * Key responsibilities:
 * - Calculate Levenshtein distance for string similarity
 * - Trigger animated particle bursts and combo effects
 * - Animate horizontal/vertical swipe transitions for word navigation
 * - Animate pixel block dissolve/construct transitions for word changes
 * - Provide legacy confetti effect compatibility
 *
 * Dependencies: DOM APIs, CSS transitions, (optionally) document structure
 */

// js/utils.js
// General utility functions.

/**
 * Calculates the normalized Levenshtein similarity between two strings (0.0-1.0).
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity score (1.0 = identical, 0.0 = completely different)
 */
export function levenshteinDistance(a, b) {
    if (!a || !b) return 0.0;
    a = a.toLowerCase(); b = b.toLowerCase();
    if (a.length === 0) return b.length === 0 ? 1.0 : 0.0;
    if (b.length === 0) return 0.0;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j += 1) {
        for (let i = 1; i <= a.length; i += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min( matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator );
        }
    }
    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1.0;
    return 1.0 - (distance / maxLength); // Return similarity score
}

// --- Sophisticated Particle Burst Effect ---
/**
 * Triggers a glowing particle burst and combo animation on the word display.
 * @param {number} streak - Current streak count for enhanced effects
 */
export function triggerParticleBurst(streak = 0) {
    const wordDisplay = document.getElementById('word-display');
    if (!wordDisplay) return;

    // Enhanced glow effect based on streak
    const glowIntensity = Math.min(20 + streak * 5, 50);
    const glowColor = streak >= 5 ? '#ffd700' : '#00ffff';
    const secondaryGlow = streak >= 3 ? '#ff00ff' : '#4ecdc4';
    
    wordDisplay.style.textShadow = `0 0 ${glowIntensity}px ${glowColor}, 0 0 ${glowIntensity * 2}px ${secondaryGlow}`;
    setTimeout(() => {
        wordDisplay.style.textShadow = '';
    }, 500);

    // Add streak-specific effects
    if (streak >= 10) {
        // Create a special "combo" effect for high streaks
        const comboText = document.createElement('div');
        comboText.textContent = `${streak} COMBO!`;
        comboText.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            color: #ffd700;
            font-size: 2em;
            font-weight: bold;
            text-shadow: 0 0 20px #ffd700;
            pointer-events: none;
            user-select: none;
            transform: translate(-50%, -50%);
            opacity: 0;
            transition: all 1s ease-out;
            z-index: 1001;
        `;
        document.body.appendChild(comboText);

        setTimeout(() => {
            comboText.style.opacity = '1';
            comboText.style.transform = 'translate(-50%, -50%) scale(1.5)';
        }, 100);

        setTimeout(() => {
            comboText.style.opacity = '0';
            comboText.style.transform = 'translate(-50%, -50%) scale(0.8)';
            setTimeout(() => {
                if (comboText.parentNode) {
                    comboText.parentNode.removeChild(comboText);
                }
            }, 1000);
        }, 1000);
    }
}

// --- Two-Slot Animation System ---
/**
 * Triggers a horizontal swipe animation for word navigation.
 * @param {string} direction - 'right' or 'left'
 * @param {string} newWord - The new word to display
 */
export function triggerHorizontalSwipe(direction = 'right', newWord = null) {
    const wordDisplay = document.getElementById('word-display');
    
    if (!wordDisplay) return;

    const currentWord = wordDisplay.dataset.word || wordDisplay.textContent;
    if (!currentWord || currentWord === "NO WORDS!" || currentWord === "LOADING..." || currentWord === "ERROR") {
        return;
    }

    // For now, just update the word display directly since we don't have the slot system
    if (newWord) {
        wordDisplay.dataset.word = newWord;
    }
}

/**
 * Triggers a vertical swipe animation for word navigation.
 * @param {string} direction - 'down' or 'up'
 * @param {string} newWord - The new word to display
 */
export function triggerVerticalSwipe(direction = 'down', newWord = null) {
    const wordDisplay = document.getElementById('word-display');

    if (!wordDisplay) return;

    const currentWord = wordDisplay.dataset.word || wordDisplay.textContent;
    if (!currentWord || currentWord === "NO WORDS!" || currentWord === "LOADING..." || currentWord === "ERROR") {
        return;
    }

    // For now, just update the word display directly since we don't have the slot system
    if (newWord) {
        wordDisplay.dataset.word = newWord;
    }
}

// --- Text Dissolve/Construct Effect ---
/**
 * Triggers a pixel block dissolve/construct animation for word transitions.
 * Dissolves the current word, waits for a new word, then constructs the new word.
 */
export function triggerPixelBlockEffect() {
    const wordDisplay = document.getElementById('word-display');
    if (!wordDisplay) return;

    const currentWord = wordDisplay.dataset.word || wordDisplay.textContent;
    if (!currentWord || currentWord === "NO WORDS!" || currentWord === "LOADING..." || currentWord === "ERROR") {
        return;
    }

    // Ensure content is wrapped in flip-letter spans (may not be on first word)
    if (!wordDisplay.querySelector('.flip-letter')) {
        wordDisplay.innerHTML = currentWord.split('').map(ch =>
            `<span class="flip-letter">${ch === ' ' ? '&nbsp;' : ch}</span>`
        ).join('');
    }

    // Remove any active entrance animation BEFORE touching animation properties —
    // otherwise the browser restarts the old animation and causes a flicker.
    wordDisplay.classList.remove('flip-from-top', 'flip-from-bottom');

    // Freeze each span in its current visual state (entrance animation's final frame)
    // so removing the class doesn't cause them to jump.
    wordDisplay.querySelectorAll('.flip-letter').forEach((span, i) => {
        span.style.animation = 'none';
        span.style.opacity = '1';
        span.style.transform = 'none';
        span.style.filter = 'none';
    });

    // Force reflow so the frozen state is committed before dissolve starts
    void wordDisplay.offsetWidth;

    // Now set staggered delays and start the dissolve
    wordDisplay.querySelectorAll('.flip-letter').forEach((span, i) => {
        span.style.animation = '';
        span.style.opacity = '';
        span.style.transform = '';
        span.style.filter = '';
        span.style.animationDelay = `${i * 30}ms`;
    });

    wordDisplay.classList.add('dissolve-exit');
}

// Function to cancel all animations (for mode switching)
export function cancelAllAnimations() {
    animationQueue = [];
    isAnimating = false;

    const wordDisplay = document.getElementById('word-display');
    if (wordDisplay) {
        wordDisplay.classList.remove('flip-from-top', 'flip-from-bottom', 'dissolve-exit');
        wordDisplay.querySelectorAll('.flip-letter').forEach(el => {
            el.style.animationDelay = '';
        });
    }
}

// Legacy confetti function (kept for compatibility)
/**
 * Triggers the legacy confetti effect (redirects to pixel block effect).
 */
export function triggerConfetti() {
    triggerPixelBlockEffect(); // Redirect to new effect
}