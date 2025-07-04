/**
 * @fileoverview Word Definition Fetcher and Cache
 *
 * This module provides functions to fetch word definitions from local data, the Datamuse API,
 * and the Free Dictionary API, with caching and fallback logic for speed and reliability.
 *
 * Key responsibilities:
 * - Load and use local word definitions if available
 * - Fetch definitions from Datamuse API (fast, no API key)
 * - Fallback to Free Dictionary API if needed (with timeout)
 * - Cache definitions to minimize repeated API calls
 * - Return concise definitions for UI display
 *
 * Dependencies: fetch API, local definitions.json (optional), Datamuse API, Free Dictionary API
 */

let localDefinitions = null; // Holds local definitions loaded from definitions.json

// Simple cache to avoid repeated API calls
const definitionCache = new Map(); // word (lowercase) -> definition string or null

/**
 * Loads local definitions from definitions.json (if available).
 * Populates localDefinitions for instant lookups.
 * Call this once at app startup.
 */
export async function loadLocalDefinitions() {
    try {
        const response = await fetch('definitions.json');
        if (response.ok) {
            localDefinitions = await response.json();
            console.log(`Loaded ${Object.keys(localDefinitions).length} local definitions`);
        }
    } catch (error) {
        console.warn('Could not load local definitions:', error);
        localDefinitions = null;
    }
}

/**
 * Gets a concise definition for a word, using local, Datamuse, or Free Dictionary sources.
 * @param {string} word - The word to define
 * @returns {Promise<string|null>} - Short definition string, or null if not found
 */
export async function getWordDefinition(word) {
    if (!word) return null;
    
    const wordLower = word.toLowerCase();
    
    // Check local definitions first (instant)
    if (localDefinitions && localDefinitions[wordLower]) {
        return localDefinitions[wordLower];
    }
    
    // Check cache first
    if (definitionCache.has(wordLower)) {
        return definitionCache.get(wordLower);
    }
    
    try {
        // Use Datamuse API first (faster, no API key needed)
        const response = await fetch(`https://api.datamuse.com/words?sp=${wordLower}&md=d&max=1`);
        
        if (response.ok) {
            const data = await response.json();
            if (data && data[0] && data[0].defs && data[0].defs.length > 0) {
                // Datamuse format: "n\tDefinition" - remove part of speech prefix
                const rawDef = data[0].defs[0];
                const cleanDef = rawDef.replace(/^[a-z]\t/, '');
                // Keep it concise
                const shortDef = cleanDef.length > 60 ? cleanDef.substring(0, 57) + "..." : cleanDef;
                definitionCache.set(wordLower, shortDef);
                return shortDef;
            }
        }
        
        // Fallback to Free Dictionary API if Datamuse fails (but with shorter timeout)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5 second timeout
        
        try {
            const dictResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${wordLower}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (dictResponse.ok) {
                const dictData = await dictResponse.json();
                if (dictData && dictData[0] && dictData[0].meanings && dictData[0].meanings[0]) {
                    const definition = dictData[0].meanings[0].definitions[0].definition;
                    const shortDef = definition.length > 60 ? definition.substring(0, 57) + "..." : definition;
                    definitionCache.set(wordLower, shortDef);
                    return shortDef;
                }
            }
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                // Handle API timeout
                console.warn(`Dictionary API timeout for "${word}"`);
            }
        }
        
        // No definition found
        definitionCache.set(wordLower, null);
        return null;
        
    } catch (error) {
        // Log and cache errors
        console.warn(`Error fetching definition for "${word}":`, error);
        definitionCache.set(wordLower, null);
        return null;
    }
}
