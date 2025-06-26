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

export function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#00ffff', '#ff00ff', '#ffffff', '#f9a826'] // Use theme colors
        });
    } else {
        console.warn("Confetti function not found.");
    }
}