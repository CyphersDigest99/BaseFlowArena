/**
 * @fileoverview Word Data Fetcher (Related Words, Synonyms & Definitions)
 *
 * Fetches three types of word data for tooltip display:
 * - Related words from Datamuse API (ml= query, topic expansion)
 * - Synonyms + definitions from dictionaryapi.dev (single request)
 *
 * Dependencies: fetch API, Datamuse API, dictionaryapi.dev
 */

/**
 * Fetches related words (topic expansion) from Datamuse "means like" endpoint.
 * @param {string} word
 * @returns {Promise<string|null>} Comma-separated related words, or null
 */
async function fetchRelated(word) {
    if (!word || word === "NO WORDS!") return null;

    try {
        const response = await fetch(`/datamuse/words?ml=${encodeURIComponent(word)}&max=6`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        return data.slice(0, 5).map(item => item.word).join(', ');
    } catch (error) {
        console.error('Error fetching related words:', error);
        return null;
    }
}

/**
 * Fetches definition AND synonyms from dictionaryapi.dev in a single request.
 * @param {string} word
 * @returns {Promise<{definition: string|null, synonyms: string|null}>}
 */
async function fetchDefinitionData(word) {
    if (!word || word === "NO WORDS!") return { definition: null, synonyms: null };

    try {
        const response = await fetch(`/dictapi/api/v2/entries/en/${encodeURIComponent(word)}`);

        if (!response.ok) {
            if (response.status === 404) return { definition: null, synonyms: null };
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) return { definition: null, synonyms: null };

        const entry = data[0];
        let definition = null;
        let synonyms = null;

        // Extract definition from first meaning with a definition
        if (entry.meanings) {
            for (const meaning of entry.meanings) {
                if (!definition && meaning.definitions?.length > 0) {
                    definition = meaning.definitions[0].definition;
                }
            }

            // Collect synonyms from all meanings (meaning-level + definition-level)
            const allSyns = new Set();
            for (const meaning of entry.meanings) {
                for (const s of (meaning.synonyms || [])) allSyns.add(s);
                for (const d of (meaning.definitions || [])) {
                    for (const s of (d.synonyms || [])) allSyns.add(s);
                }
            }
            // Filter out multi-word phrases, keep concise single words
            const filtered = [...allSyns].filter(s => !s.includes(' ')).slice(0, 5);
            if (filtered.length > 0) {
                synonyms = filtered.join(', ');
            }
        }

        return { definition, synonyms };
    } catch (error) {
        console.error('Error fetching definition:', error);
        return { definition: null, synonyms: null };
    }
}

/**
 * Fetches related words, synonyms, and definition in parallel.
 * @param {string} word
 * @returns {Promise<{related: string|null, synonyms: string|null, definition: string|null}>}
 */
export async function fetchWordData(word) {
    try {
        const [related, dictData] = await Promise.all([
            fetchRelated(word),
            fetchDefinitionData(word)
        ]);

        return {
            related,
            synonyms: dictData.synonyms,
            definition: dictData.definition
        };
    } catch (error) {
        console.error('Error fetching word data:', error);
        return { related: null, synonyms: null, definition: null };
    }
}
