// js/wordApi.js
// Handles fetching synonyms from Datamuse and definitions from dictionaryapi.dev

/**
 * Fetches synonyms from Datamuse API
 * @param {string} word - The word to find synonyms for
 * @returns {Promise<string>} - A comma-separated string of synonyms or an error message
 */
async function fetchSynonyms(word) {
    if (!word || word === "NO WORDS!") {
        return "No word available.";
    }

    try {
        const response = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            return "No synonyms found.";
        }
        
        // Extract the "word" property from the first 5 results
        const maxResults = Math.min(5, data.length);
        const synonyms = data.slice(0, maxResults).map(item => item.word);
        
        return synonyms.join(', ');
        
    } catch (error) {
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
        return "No word available.";
    }

    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                return "No definition found.";
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
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
        console.error('Error fetching word data:', error);
        return {
            synonyms: "Unable to fetch synonyms.",
            definition: "Unable to fetch definition."
        };
    }
} 