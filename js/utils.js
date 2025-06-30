// js/utils.js
// General utility functions.

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

// --- Directional Swipe Animations for Manual Navigation ---
// These effects create directional swipes when using arrow buttons for word navigation
// The swipe overlay is appended as a child of the word display's parent container (not the body)
// This ensures the overlay is always clipped to the word display area and appears behind all UI controls
// The parent container is set to position: relative and overflow: hidden to enforce this relationship
// The overlay itself uses position: absolute and a low z-index so it is always behind siblings (buttons, icons, etc.)

export function triggerHorizontalSwipe(direction = 'right') {
    const wordDisplay = document.getElementById('word-display');
    if (!wordDisplay) return;

    const currentWord = wordDisplay.textContent;
    if (!currentWord || currentWord === "NO WORDS!" || currentWord === "LOADING..." || currentWord === "ERROR") {
        return;
    }

    // --- PARENT/CHILD/SIBLING RELATIONSHIP ---
    // The overlay is a child of the word display's parent container
    // The parent container is set to position: relative and overflow: hidden
    // This ensures the overlay is always clipped to the word display area and appears behind all UI controls
    // The overlay uses position: absolute and z-index: 1 so it is always behind siblings (buttons, icons, etc.)
    const computedStyle = window.getComputedStyle(wordDisplay);
    const parent = wordDisplay.parentElement;
    if (!parent) return;
    parent.style.position = 'relative'; // Ensure parent is positioned
    parent.style.overflow = 'hidden'; // Clip overlay to word display area
    const rect = wordDisplay.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const offsetLeft = rect.left - parentRect.left;
    const offsetTop = rect.top - parentRect.top;

    // Create overlay for swipe animation as a child of the word display's parent
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: absolute;
        left: ${offsetLeft - 15}px;
        top: ${offsetTop - 15}px;
        width: ${rect.width + 30}px;
        height: ${rect.height + 30}px;
        font-family: ${computedStyle.fontFamily};
        font-size: ${computedStyle.fontSize};
        font-weight: ${computedStyle.fontWeight};
        color: ${computedStyle.color};
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        pointer-events: none;
        z-index: 1;
        text-align: center;
        border-radius: 8px;
        opacity: 1;
        transform: translateX(${direction === 'right' ? '0%' : '0%'});
        transition: transform 0.4s ease-out;
        overflow: hidden;
    `;
    parent.appendChild(overlay);

    // Hide original word display during animation
    const originalDisplay = wordDisplay.style.display;
    wordDisplay.style.display = 'none';

    // Set initial content
    overlay.textContent = currentWord;

    // Add glow effect
    overlay.style.textShadow = '0 0 15px #00ffff, 0 0 30px #ff00ff';

    // Trigger swipe animation - REVERSED: right arrow makes word move left, left arrow makes word move right
    setTimeout(() => {
        overlay.style.transform = `translateX(${direction === 'right' ? '-100%' : '100%'})`;
    }, 50);

    // Cleanup after animation
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        wordDisplay.style.display = originalDisplay;
    }, 450);
}

export function triggerVerticalSwipe(direction = 'down') {
    const wordDisplay = document.getElementById('word-display');
    if (!wordDisplay) return;

    const currentWord = wordDisplay.textContent;
    if (!currentWord || currentWord === "NO WORDS!" || currentWord === "LOADING..." || currentWord === "ERROR") {
        return;
    }

    // --- PARENT/CHILD/SIBLING RELATIONSHIP ---
    // The overlay is a child of the word display's parent container
    // The parent container is set to position: relative and overflow: hidden
    // This ensures the overlay is always clipped to the word display area and appears behind all UI controls
    // The overlay uses position: absolute and z-index: 1 so it is always behind siblings (buttons, icons, etc.)
    const computedStyle = window.getComputedStyle(wordDisplay);
    const parent = wordDisplay.parentElement;
    if (!parent) return;
    parent.style.position = 'relative'; // Ensure parent is positioned
    parent.style.overflow = 'hidden'; // Clip overlay to word display area
    const rect = wordDisplay.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const offsetLeft = rect.left - parentRect.left;
    const offsetTop = rect.top - parentRect.top;

    // Create overlay for swipe animation as a child of the word display's parent
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: absolute;
        left: ${offsetLeft - 15}px;
        top: ${offsetTop - 15}px;
        width: ${rect.width + 30}px;
        height: ${rect.height + 30}px;
        font-family: ${computedStyle.fontFamily};
        font-size: ${computedStyle.fontSize};
        font-weight: ${computedStyle.fontWeight};
        color: ${computedStyle.color};
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        pointer-events: none;
        z-index: 1;
        text-align: center;
        border-radius: 8px;
        opacity: 1;
        transform: translateY(${direction === 'down' ? '0%' : '0%'});
        transition: transform 0.4s ease-out;
        overflow: hidden;
    `;
    parent.appendChild(overlay);

    // Hide original word display during animation
    const originalDisplay = wordDisplay.style.display;
    wordDisplay.style.display = 'none';

    // Set initial content
    overlay.textContent = currentWord;

    // Add glow effect
    overlay.style.textShadow = '0 0 15px #00ffff, 0 0 30px #ff00ff';

    // Trigger swipe animation - REVERSED: down arrow makes word move up, up arrow makes word move down
    setTimeout(() => {
        overlay.style.transform = `translateY(${direction === 'down' ? '-100%' : '100%'})`;
    }, 50);

    // Cleanup after animation
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        wordDisplay.style.display = originalDisplay;
    }, 450);
}

// --- Text Dissolve/Construct Effect ---
// This effect creates a sophisticated word transition animation that:
// 1. Dissolves the current word character by character with rotation and scaling
// 2. Waits for the actual word change to happen in the background
// 3. Constructs the new word character by character with reverse rotation
// 4. Uses an invisible overlay to prevent bleed-through of static words
export function triggerPixelBlockEffect() {
    const wordDisplay = document.getElementById('word-display');
    if (!wordDisplay) return;

    const currentWord = wordDisplay.textContent;
    if (!currentWord || currentWord === "NO WORDS!" || currentWord === "LOADING..." || currentWord === "ERROR") {
        return;
    }

    // Get the position and styling of the word display for overlay positioning
    const rect = wordDisplay.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(wordDisplay);
    const containerStyle = window.getComputedStyle(wordDisplay.parentElement);
    const bodyStyle = window.getComputedStyle(document.body);
    
    // Create overlay container with larger coverage area to prevent word bleed-through
    // The overlay is positioned with extra padding (15px on each side) to ensure complete coverage
    // Background matches the page background to make the overlay invisible
    const overlay = document.createElement('div');
    overlay.style.cssText = `\n        position: fixed;\n        left: ${rect.left - 15}px;\n        top: ${rect.top - 15}px;\n        width: ${rect.width + 30}px;\n        height: ${rect.height + 30}px;\n        font-family: ${computedStyle.fontFamily};\n        font-size: ${computedStyle.fontSize};\n        font-weight: ${computedStyle.fontWeight};\n        color: ${computedStyle.color};\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        background: ${bodyStyle.backgroundColor || '#000'};\n        pointer-events: none;\n        z-index: 1000;\n        text-align: center;\n        border-radius: 8px;\n        opacity: 1;\n    `;
    
    document.body.appendChild(overlay);

    // CRITICAL: Hide the original word display to prevent static word bleed-through
    // This ensures only the animated overlay is visible during the entire effect
    const originalDisplay = wordDisplay.style.display;
    wordDisplay.style.display = 'none';

    // Phase 1: Dissolve current word character by character
    // Each character gets its own span element for individual animation control
    const dissolveWord = () => {
        const chars = currentWord.split('');
        
        // Create individual spans for each character with initial visible state
        // Each span has its own transition for smooth animation
        const charSpans = chars.map(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.cssText = `
                opacity: 1;
                transform: scale(1) rotate(0deg);
                transition: all 0.4s ease-out;
                display: inline-block;
                margin: 0 1px;
            `;
            return span;
        });
        
        // Clear overlay and add character spans
        overlay.innerHTML = '';
        charSpans.forEach(span => overlay.appendChild(span));
        
        let dissolvedChars = 0;
        const dissolveInterval = setInterval(() => {
            if (dissolvedChars >= chars.length) {
                clearInterval(dissolveInterval);
                // Word is fully dissolved, wait for word change then construct
                setTimeout(waitForWordChange, 200);
                return;
            }
            
            // Animate character out: fade to transparent, scale down, rotate 180°
            if (charSpans[dissolvedChars]) {
                charSpans[dissolvedChars].style.opacity = '0';
                charSpans[dissolvedChars].style.transform = 'scale(0.3) rotate(180deg)';
            }
            dissolvedChars++;
        }, 60); // Slightly slower for better visibility of the dissolve effect
    };

    // Phase 2: Wait for word change to happen, then construct new word
    // This phase monitors the hidden word display for changes (handles rhyme navigation, etc.)
    const waitForWordChange = () => {
        // Check for word changes more frequently to handle rhyme navigation
        let checkCount = 0;
        const maxChecks = 15; // Increased to 15 checks (1.5 seconds total)
        
        const checkForWordChange = () => {
            const newWord = wordDisplay.textContent;
            if (newWord && newWord !== currentWord && newWord !== "NO WORDS!" && newWord !== "LOADING..." && newWord !== "ERROR") {
                constructWord(newWord);
                return;
            }
            
            checkCount++;
            if (checkCount < maxChecks) {
                setTimeout(checkForWordChange, 100); // Check every 100ms
            } else {
                // No word change detected after all checks, just remove overlay
                cleanup();
            }
        };
        
        // Start checking after a short delay
        setTimeout(checkForWordChange, 100);
    };

    // Phase 3: Construct new word character by character
    // Characters start invisible, scaled down, and rotated -180°, then animate to normal
    const constructWord = (targetWord) => {
        const chars = targetWord.split('');
        let constructedChars = 0;
        
        // Start with all characters invisible, scaled down, and rotated -180°
        const invisibleChars = chars.map(char => 
            `<span style="opacity: 0; transform: scale(0.5) rotate(-180deg); transition: all 0.6s ease-out; display: inline-block;">${char}</span>`
        );
        overlay.innerHTML = invisibleChars.join('');
        
        const constructInterval = setInterval(() => {
            if (constructedChars >= chars.length) {
                clearInterval(constructInterval);
                // Construction complete, wait for rotation to finish then remove overlay
                setTimeout(cleanup, 1000); // Increased wait time for rotation to complete
                return;
            }
            
            // Make character visible with construction effect: fade in, scale up, rotate to 0°
            const charSpans = overlay.querySelectorAll('span');
            if (charSpans[constructedChars]) {
                charSpans[constructedChars].style.opacity = '1';
                charSpans[constructedChars].style.transform = 'scale(1) rotate(0deg)';
            }
            constructedChars++;
        }, 80); // Slightly slower to make rotation more visible
    };

    // Cleanup function: Remove overlay and restore original word display
    const cleanup = () => {
        // Remove the overlay
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        // CRITICAL: Restore the original word display so the new word is visible
        // Also ensure the display is set to flex to make it visible
        wordDisplay.style.display = 'flex';
    };

    // Add glow effect to the overlay for visual enhancement
    overlay.style.textShadow = '0 0 15px #00ffff, 0 0 30px #ff00ff';
    
    // Start the dissolve process
    dissolveWord();
    
    // Safety cleanup after a reasonable time to prevent memory leaks
    setTimeout(() => {
        if (overlay.parentNode) {
            cleanup();
        }
    }, 5000); // 5 second safety timeout
}

// Legacy confetti function (kept for compatibility)
export function triggerConfetti() {
    triggerPixelBlockEffect(); // Redirect to new effect
}