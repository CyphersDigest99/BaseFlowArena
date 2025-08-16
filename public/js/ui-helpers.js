// js/ui-helpers.js

export function updateBpmIndicator(bpmValue) {
    const bpmDisplay = document.getElementById('bpm-display');
    if (bpmDisplay) bpmDisplay.textContent = bpmValue;
    const beatIntervalSeconds = bpmValue > 0 ? 60 / bpmValue : 0.5;
    document.documentElement.style.setProperty('--beat-interval', `${beatIntervalSeconds}s`);
    const wordDisplayUnit = document.getElementById('word-display-unit');
    if (wordDisplayUnit?.classList.contains('buzz-with-bpm')) {
        wordDisplayUnit.style.animationDuration = `${beatIntervalSeconds}s`;
    }
} 