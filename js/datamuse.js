/**
 * @fileoverview Datamuse API Word Relation Fetcher
 *
 * This module provides a function to fetch words related in meaning to a given word
 * using the Datamuse API. It is used to suggest synonyms or semantically similar words
 * for vocabulary expansion, writing assistance, or creative applications.
 *
 * Key responsibilities:
 * - Querying the Datamuse API for words that "mean like" a given word
 * - Handling API errors and edge cases
 * - Returning a concise, comma-separated list of related words
 *
 * Dependencies: fetch API, Datamuse API (https://www.datamuse.com/api/)
 */

// js/datamuse.js
// Handles fetching related words from the Datamuse API.

/**
 * Fetches words that "mean like" the given word using the Datamuse API.
 * @param {string} word - The word to find similar words for
 * @returns {Promise<string>} - A comma-separated string of related words or an error message
 */
export async function fetchMeansLike(word) {
    if (!word || word === "NO WORDS!") {
        // Handle missing or invalid input
        return "No word available.";
    }

    try {
        // Query Datamuse API for words with similar meaning
        const response = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}`);
        
        if (!response.ok) {
            // Handle HTTP errors
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            // No results found
            return "No related words found.";
        }
        
        // Extract the "word" property from the first 3-5 results
        const maxResults = Math.min(5, data.length);
        const relatedWords = data.slice(0, maxResults).map(item => item.word);
        
        return relatedWords.join(', ');
        
    } catch (error) {
        // Log and handle network or parsing errors
        console.error('Error fetching related words:', error);
        return "Unable to fetch related words.";
    }
} 