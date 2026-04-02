#!/usr/bin/env python3
"""
Rhyme Data Processor for BaseFlowArena

This script processes a word list to generate phonetic rhyme patterns and syllable counts
for the BaseFlowArena application. It uses the CMU Pronouncing Dictionary (via the
'pronouncing' library) to extract vowel sound patterns that enable rhyme detection
and syllable counting for freestyle rap training.

The script reads words from a text file and outputs a JSON file containing:
- Rhyme patterns (sequence of vowel sounds with consonant context)
- Syllable counts for each word
- Original word as key (case preserved)

Features:
- Extracts ALL vowel sounds in sequence (not just stressed syllables)
- Handles multiple pronunciations (uses first available)
- Provides syllable counting for rhythm training
- Generates JSON output compatible with the web application
- Includes error handling and progress reporting
- Consonant-context-aware patterns (e.g., AE+nasal instead of AE)
- Full CMU dictionary lookup generation via --cmu-full flag

Usage:
    python process_rhymes.py [--input FILE] [--output-dir DIR] [--cmu-full] [--all]

    Requires:
    - Dependencies: pronouncing, json, re, os, argparse

Dependencies:
    - pronouncing: CMU Pronouncing Dictionary interface
    - json: JSON file I/O
    - re: Regular expressions for phonetic pattern matching
    - os: File path operations
    - argparse: Command-line argument parsing

Output Format (rhyme_data.json):
    {
        "word": {
            "rhyme_pattern": ["AE+nasal", "ER+null"],
            "phonemes": ["IH", "G", "Z", "AE", "M", "P", "AH", "L"],
            "syllables": 2
        }
    }

Output Format (cmu_lookup.json):
    {
        "word": "AE+nasal-ER+null|2"
    }

Note: Words not found in the CMU dictionary are excluded from the output
with a warning count displayed during processing.
"""

import pronouncing
import json
import re
import os

# --- PATH DETERMINATION ---
# Determine paths based on script location for reliable file access
SCRIPT_DIR = os.path.abspath(os.path.dirname(__file__))


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


# --- CONSONANT CLASSIFICATION ---

CONSONANT_CLASSES = {
    'nasal': {'N', 'M', 'NG'},
    'liquid': {'L', 'R'},
    'stop': {'P', 'B', 'T', 'D', 'K', 'G'},
    'fricative': {'F', 'V', 'S', 'Z', 'SH', 'ZH', 'TH', 'DH', 'HH', 'CH', 'JH'},
}

def classify_consonant(phoneme):
    """Classify a consonant phoneme into its perceptual class."""
    clean = re.sub(r'[012]$', '', phoneme)
    for cls, members in CONSONANT_CLASSES.items():
        if clean in members:
            return cls
    return 'other'


def get_context_aware_pattern(word):
    """
    Gets vowel pattern with consonant class context for each vowel.
    Returns list like ['AE+nasal', 'ER+null'] or None if word not found.
    """
    word_lower = word.lower()
    phones_list = pronouncing.phones_for_word(word_lower)
    if not phones_list:
        return None

    pronunciation = phones_list[0]
    phonemes = pronunciation.split(' ')

    pattern = []
    for i, phone in enumerate(phonemes):
        if re.match(r'^[AEIOU]', phone):
            vowel = re.sub(r'[012]$', '', phone)
            next_class = 'null'
            for j in range(i + 1, len(phonemes)):
                next_phone = phonemes[j]
                if not re.match(r'^[AEIOU]', next_phone):
                    next_class = classify_consonant(next_phone)
                    break
            pattern.append(f"{vowel}+{next_class}")

    return pattern if pattern else None


# --- CONFIGURATION (now via CLI args) ---
import argparse

def parse_args():
    parser = argparse.ArgumentParser(description='Generate rhyme data for BaseFlowArena')
    parser.add_argument('--input', default='word-list.txt',
                        help='Input word list file (default: word-list.txt)')
    parser.add_argument('--output-dir', default='public',
                        help='Output directory (default: public)')
    parser.add_argument('--cmu-full', action='store_true',
                        help='Generate cmu_lookup.json from full CMU dictionary')
    parser.add_argument('--all', action='store_true',
                        help='Generate both rhyme_data.json and cmu_lookup.json')
    return parser.parse_args()


def process_word_list(input_file, output_dir):
    """Generates rhyme_data.json from a word list file."""
    rhyme_patterns = {}
    not_found_count = 0
    processed_count = 0

    input_path = os.path.join(SCRIPT_DIR, input_file)
    output_path = os.path.join(SCRIPT_DIR, output_dir, 'rhyme_data.json')

    print(f"Generating rhyme_data.json...")
    print(f"Reading words from: {input_path}")

    if not os.path.exists(input_path):
        print(f"ERROR: Input file '{input_file}' not found.")
        return

    with open(input_path, 'r', encoding='utf-8') as f:
        words = [line.strip() for line in f if line.strip()]

    print(f"Found {len(words)} words. Processing...")

    for word in words:
        pattern = get_context_aware_pattern(word)
        phonemes = get_all_phonemes(word)
        syllable_count = get_syllable_count(word)

        if pattern and phonemes and syllable_count is not None:
            rhyme_patterns[word.lower()] = {
                "rhyme_pattern": pattern,
                "phonemes": phonemes,
                "syllables": syllable_count
            }
            processed_count += 1
        else:
            not_found_count += 1

    print(f"Processed: {processed_count} words")
    if not_found_count > 0:
        print(f"Not found in CMU: {not_found_count} words")

    print(f"Writing {len(rhyme_patterns)} patterns to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(rhyme_patterns, f, indent=2, ensure_ascii=False)
    print("Done.")


def generate_cmu_lookup(output_dir):
    """Generates cmu_lookup.json from the full CMU Pronouncing Dictionary."""
    output_path = os.path.join(SCRIPT_DIR, output_dir, 'cmu_lookup.json')

    print(f"Generating cmu_lookup.json from full CMU dictionary...")

    cmu_entries = pronouncing.cmudict.entries()
    lookup = {}
    count = 0

    for word, pronunciation in cmu_entries:
        if not word.isalpha():
            continue
        if word in lookup:
            continue

        # pronunciation is already a list of phoneme strings from cmudict.entries()
        phonemes = pronunciation

        pattern_parts = []
        for i, phone in enumerate(phonemes):
            if re.match(r'^[AEIOU]', phone):
                vowel = re.sub(r'[012]$', '', phone)
                next_class = 'null'
                for j in range(i + 1, len(phonemes)):
                    if not re.match(r'^[AEIOU]', phonemes[j]):
                        next_class = classify_consonant(phonemes[j])
                        break
                pattern_parts.append(f"{vowel}+{next_class}")

        if not pattern_parts:
            continue

        syllable_count = max(1, len([p for p in phonemes if p[-1].isdigit()]))
        pattern_str = '-'.join(pattern_parts)
        lookup[word] = f"{pattern_str}|{syllable_count}"
        count += 1

    print(f"Processed {count} words from CMU dictionary.")
    print(f"Writing to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(lookup, f, separators=(',', ':'), ensure_ascii=False)
    print("Done.")


if __name__ == "__main__":
    args = parse_args()

    if args.all:
        process_word_list(args.input, args.output_dir)
        generate_cmu_lookup(args.output_dir)
    elif args.cmu_full:
        generate_cmu_lookup(args.output_dir)
    else:
        process_word_list(args.input, args.output_dir)
