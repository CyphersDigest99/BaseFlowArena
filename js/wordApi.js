/**
 * @fileoverview Word Data Fetcher (Synonyms & Definitions)
 *
 * This module provides functions to fetch synonyms (from Datamuse API) and definitions
 * (from dictionaryapi.dev) for a given word. It supports parallel fetching and returns
 * concise, user-friendly results for use in the UI or word exploration features.
 *
 * Key responsibilities:
 * - Fetch synonyms for a word from Datamuse API
 * - Fetch definitions for a word from dictionaryapi.dev
 * - Provide a unified function to fetch both in parallel
 * - Handle API/network errors and edge cases gracefully
 *
 * Dependencies: fetch API, Datamuse API, dictionaryapi.dev
 */

// js/wordApi.js
// Handles fetching synonyms from Datamuse and definitions from dictionaryapi.dev

/**
 * Fetches synonyms from Datamuse API
 * @param {string} word - The word to find synonyms for
 * @returns {Promise<string>} - A comma-separated string of synonyms or an error message
 */
async function fetchSynonyms(word) {
    if (!word || word === "NO WORDS!") {
        // Handle missing or invalid input
        return "No word available.";
    }

    try {
        // Query Datamuse API for synonyms
        const response = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}`);
        
        if (!response.ok) {
            // Handle HTTP errors
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            // No results found
            return "No synonyms found.";
        }
        
        // Extract the "word" property from the first 5 results
        const maxResults = Math.min(5, data.length);
        const synonyms = data.slice(0, maxResults).map(item => item.word);
        
        return synonyms.join(', ');
        
    } catch (error) {
        // Log and handle network or parsing errors
        console.error('Error fetching synonyms:', error);
        return "Unable to fetch synonyms.";
    }
}

/**
 * Fetches definition from dictionaryapi.dev
 * @param {string} word - The word to find definition for
 * @returns {Promise<string>} - The definition or an error message
 */
async function fetchDefinition(word) {
    if (!word || word === "NO WORDS!") {
        // Handle missing or invalid input
        return "No word available.";
    }

    try {
        // Query dictionaryapi.dev for definition
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                // No definition found for this word
                return "No definition found.";
            }
            // Handle HTTP errors
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            // No results found
            return "No definition found.";
        }
        
        // Get the first entry and its first meaning
        const entry = data[0];
        if (!entry.meanings || entry.meanings.length === 0) {
            return "No definition found.";
        }
        
        const meaning = entry.meanings[0];
        if (!meaning.definitions || meaning.definitions.length === 0) {
            return "No definition found.";
        }
        
        // Return the first definition
        return meaning.definitions[0].definition;
        
    } catch (error) {
        // Log and handle network or parsing errors
        console.error('Error fetching definition:', error);
        return "Unable to fetch definition.";
    }
}

/**
 * Fetches both synonyms and definition in parallel
 * @param {string} word - The word to get data for
 * @returns {Promise<Object>} - Object with synonyms and definition
 */
export async function fetchWordData(word) {
    try {
        const [synonyms, definition] = await Promise.all([
            fetchSynonyms(word),
            fetchDefinition(word)
        ]);
        
        return {
            synonyms,
            definition
        };
    } catch (error) {
        // Log and handle errors in parallel fetching
        console.error('Error fetching word data:', error);
        return {
            synonyms: "Unable to fetch synonyms.",
            definition: "Unable to fetch definition."
        };
    }
} 