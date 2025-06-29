// js/datamuse.js
// Handles fetching related words from the Datamuse API.

/**
 * Fetches words that "mean like" the given word using the Datamuse API.
 * @param {string} word - The word to find similar words for
 * @returns {Promise<string>} - A comma-separated string of related words or an error message
 */
export async function fetchMeansLike(word) {
    if (!word || word === "NO WORDS!") {
        return "No word available.";
    }

    try {
        const response = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            return "No related words found.";
        }
        
        // Extract the "word" property from the first 3-5 results
        const maxResults = Math.min(5, data.length);
        const relatedWords = data.slice(0, maxResults).map(item => item.word);
        
        return relatedWords.join(', ');
        
    } catch (error) {
        console.error('Error fetching related words:', error);
        return "Unable to fetch related words.";
    }
} 