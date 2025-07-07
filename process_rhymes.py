#!/usr/bin/env python3
"""
Rhyme Data Processor for BaseFlowArena

This script processes a word list to generate phonetic rhyme patterns and syllable counts
for the BaseFlowArena application. It uses the CMU Pronouncing Dictionary (via the
'pronouncing' library) to extract vowel sound patterns that enable rhyme detection
and syllable counting for freestyle rap training.

The script reads words from a text file and outputs a JSON file containing:
- Rhyme patterns (sequence of vowel sounds)
- Syllable counts for each word
- Original word as key (case preserved)

Features:
- Extracts ALL vowel sounds in sequence (not just stressed syllables)
- Handles multiple pronunciations (uses first available)
- Provides syllable counting for rhythm training
- Generates JSON output compatible with the web application
- Includes error handling and progress reporting

Usage:
    python process_rhymes.py
    
    Requires:
    - Input file: 'random word list.txt' (one word per line)
    - Output file: 'rhyme_data.json' (created automatically)
    - Dependencies: pronouncing, json, re, os

Dependencies:
    - pronouncing: CMU Pronouncing Dictionary interface
    - json: JSON file I/O
    - re: Regular expressions for phonetic pattern matching
    - os: File path operations

Output Format:
    {
        "word": {
            "rhyme_pattern": ["AA", "IY"],
            "phonemes": ["IH", "G", "Z", "AE", "M", "P", "AH", "L"],
            "syllables": 2
        }
    }

Note: Words not found in the CMU dictionary are excluded from the output
with a warning count displayed during processing.
"""

import pronouncing
import json
import re
import os

# --- CONFIGURATION ---
# Input word list file (assumed to be in the same directory as this script)
WORD_LIST_FILE = 'random word list.txt'
# Output JSON file (will be created/overwritten in the same directory)
OUTPUT_JSON_FILE = 'rhyme_data.json'

# --- PATH DETERMINATION ---
# Determine paths based on script location for reliable file access
SCRIPT_DIR = os.path.dirname(__file__)
INPUT_PATH = os.path.join(SCRIPT_DIR, WORD_LIST_FILE)
OUTPUT_PATH = os.path.join(SCRIPT_DIR, OUTPUT_JSON_FILE)


# --- PHONETIC PROCESSING FUNCTIONS ---

def get_all_phonemes(word):
    """
    Gets the complete phonetic representation of a word as an array of phonemes.
    Uses the CMU Pronouncing Dictionary via the 'pronouncing' library.
    Returns a list of all phonemes (e.g., ['IH', 'G', 'Z', 'AE', 'M', 'P', 'AH', 'L']) or None if not found.
    
    Args:
        word (str): The word to analyze
        
    Returns:
        list or None: List of all phonemes in order, or None if word not found
        
    Note:
        This function extracts ALL phonemes in sequence, including consonants and vowels,
        which is crucial for advanced rhyme similarity scoring.
    """
    # Ensure the word is lowercase for lookup, as CMUdict keys are often lowercase
    word_lower = word.lower()
    phones_list = pronouncing.phones_for_word(word_lower)

    if not phones_list:
        return None  # Word not found in the dictionary

    # Use the first pronunciation found in the list (most common)
    pronunciation = phones_list[0]
    phonemes = pronunciation.split(' ')

    # Return the list of phonemes if any were found, otherwise None
    return phonemes if phonemes else None

def get_all_vowel_pattern(word):
    """
    Finds the sequence of ALL vowel sounds for a word, regardless of stress.
    Uses the CMU Pronouncing Dictionary via the 'pronouncing' library.
    Returns a list of vowel phonemes (e.g., ['UW', 'IY']) or None if not found.
    
    Args:
        word (str): The word to analyze
        
    Returns:
        list or None: List of vowel phonemes in order, or None if word not found
        
    Note:
        This function extracts ALL vowels in sequence, not just stressed ones,
        which is crucial for comprehensive rhyme detection in freestyle rap.
    """
    # Ensure the word is lowercase for lookup, as CMUdict keys are often lowercase
    word_lower = word.lower()
    phones_list = pronouncing.phones_for_word(word_lower)

    if not phones_list:
        return None  # Word not found in the dictionary

    # Use the first pronunciation found in the list (most common)
    pronunciation = phones_list[0]
    phonemes = pronunciation.split(' ')

    all_vowels = []
    for phone in phonemes:
        # Check if the phoneme starts with a standard English vowel character
        # This regex matches Arpabet vowel symbols like AA, AE, AH, AO, etc.
        if re.match(r'^[AEIOU]', phone):
            # Extract the vowel part (remove any trailing stress number like 0, 1, or 2)
            vowel = re.sub(r'[012]$', '', phone)
            all_vowels.append(vowel)

    # Return the list of vowels if any were found, otherwise None
    return all_vowels if all_vowels else None


def get_syllable_count(word):
    """
    Gets the syllable count for a word using the pronouncing library.
    Returns the syllable count as an integer, or None if the word is not found.
    
    Args:
        word (str): The word to count syllables for
        
    Returns:
        int or None: Number of syllables, or None if word not found
        
    Note:
        Syllable counting is based on stressed phonemes (ending in 0, 1, or 2)
        and is essential for rhythm training in freestyle rap.
    """
    word_lower = word.lower()
    phones_list = pronouncing.phones_for_word(word_lower)
    if not phones_list:
        return None  # Word not found in dictionary

    # Use the first pronunciation
    pronunciation = phones_list[0]
    # Count all phonemes that end with a digit (0, 1, or 2) - these indicate stress
    syllable_count = len([ph for ph in pronunciation.split() if ph[-1].isdigit()])
    return max(1, syllable_count)  # Ensure at least 1 syllable


# --- MAIN PROCESSING LOGIC ---

def process_word_list():
    """
    Reads the input word list, processes each word to find its vowel pattern and syllable count,
    and writes the results to the output JSON file.
    
    This function orchestrates the entire processing pipeline:
    1. Validates input file existence
    2. Reads and filters word list
    3. Processes each word for phonetic data
    4. Generates summary statistics
    5. Writes structured JSON output
    
    The output JSON is structured for easy consumption by the web application's
    rhyme detection and syllable filtering features.
    """
    rhyme_patterns = {}
    not_found_count = 0
    processed_count = 0
    word_count = 0

    print(f"Starting rhyme pattern and syllable processing...")
    print(f"Reading words from: {INPUT_PATH}")

    # --- INPUT FILE VALIDATION ---
    # Check if the input file exists before attempting to read
    if not os.path.exists(INPUT_PATH):
        print(f"\n--- ERROR ---")
        print(f"Input file '{WORD_LIST_FILE}' not found in the directory:")
        print(f"'{SCRIPT_DIR}'")
        print(f"Please create this file with one word per line and run the script again.")
        return  # Stop execution if file not found

    # --- WORD LIST READING ---
    # Read words from the input file with error handling
    try:
        with open(INPUT_PATH, 'r', encoding='utf-8') as f:
            # Read lines, strip whitespace, filter out empty lines
            words = [line.strip() for line in f if line.strip()]
            word_count = len(words)
    except Exception as e:
        print(f"Error reading file '{INPUT_PATH}': {e}")
        return  # Stop execution if file cannot be read

    print(f"Found {word_count} words/phrases in the list.")
    print(f"Processing phonetic patterns and syllable counts (this may take a moment for large lists)...")

    # --- WORD PROCESSING LOOP ---
    # Process each word to extract phonetic data
    for word in words:
        # Get the vowel pattern using the helper function
        pattern = get_all_vowel_pattern(word)
        # Get the complete phoneme array
        phonemes = get_all_phonemes(word)
        # Get the syllable count
        syllable_count = get_syllable_count(word)

        if pattern and phonemes and syllable_count is not None:
            # Store pattern, phonemes, and syllable count with the original (case preserved) word as the key
            rhyme_patterns[word] = {
                "rhyme_pattern": pattern,
                "phonemes": phonemes,
                "syllables": syllable_count
            }
            processed_count += 1
        else:
            # Word's pronunciation not found in the CMU dictionary
            # Optionally print a warning for each missing word:
            # print(f" - Warning: Phonetic data not found for '{word}'")
            not_found_count += 1

    # --- PROCESSING SUMMARY ---
    print(f"\n--- Processing Complete ---")
    print(f"Successfully processed: {processed_count} words")
    if not_found_count > 0:
        print(f"Phonetic data not found for: {not_found_count} words (excluded from rhyme data)")
    print(f"Total words from list processed/attempted: {word_count}")

    # --- JSON OUTPUT GENERATION ---
    print(f"\nWriting {len(rhyme_patterns)} patterns to: {OUTPUT_PATH}")
    try:
        # Write the dictionary to a JSON file with pretty printing (indent=2)
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            # ensure_ascii=False for wider character support (international words)
            json.dump(rhyme_patterns, f, indent=2, ensure_ascii=False)
        print("Successfully wrote JSON file.")
    except Exception as e:
        print(f"--- ERROR ---")
        print(f"Error writing JSON file '{OUTPUT_PATH}': {e}")


# --- SCRIPT EXECUTION ENTRY POINT ---
if __name__ == "__main__":
    # This block ensures the code runs only when the script is executed directly
    # (not when imported as a module)
    process_word_list()