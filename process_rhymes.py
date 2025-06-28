import pronouncing
import json
import re
import os

# --- Configuration ---
# Input word list file (assumed to be in the same directory as this script)
WORD_LIST_FILE = 'random word list.txt'
# Output JSON file (will be created/overwritten in the same directory)
OUTPUT_JSON_FILE = 'rhyme_data.json'

# --- Determine Paths Based on Script Location ---
SCRIPT_DIR = os.path.dirname(__file__)
INPUT_PATH = os.path.join(SCRIPT_DIR, WORD_LIST_FILE)
OUTPUT_PATH = os.path.join(SCRIPT_DIR, OUTPUT_JSON_FILE)


# --- Helper Function to Extract ALL Vowel Sounds in Sequence ---
def get_all_vowel_pattern(word):
    """
    Finds the sequence of ALL vowel sounds for a word, regardless of stress.
    Uses the CMU Pronouncing Dictionary via the 'pronouncing' library.
    Returns a list of vowel phonemes (e.g., ['UW', 'IY']) or None if not found.
    """
    # Ensure the word is lowercase for lookup, as CMUdict keys are often lowercase
    word_lower = word.lower()
    phones_list = pronouncing.phones_for_word(word_lower)

    if not phones_list:
        return None # Word not found in the dictionary

    # Use the first pronunciation found in the list
    pronunciation = phones_list[0]
    phonemes = pronunciation.split(' ')

    all_vowels = []
    for phone in phonemes:
        # Check if the phoneme starts with a standard English vowel character
        # (This is a heuristic based on Arpabet vowel symbols like AA, AE, AH, AO, etc.)
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
    """
    word_lower = word.lower()
    phones_list = pronouncing.phones_for_word(word_lower)
    if not phones_list:
        return None  # Word not found in dictionary

    # Use the first pronunciation
    pronunciation = phones_list[0]
    # Count all phonemes that end with a digit (0, 1, or 2)
    syllable_count = len([ph for ph in pronunciation.split() if ph[-1].isdigit()])
    return max(1, syllable_count)


# --- Main Processing Logic ---
def process_word_list():
    """
    Reads the input word list, processes each word to find its vowel pattern and syllable count,
    and writes the results to the output JSON file.
    """
    rhyme_patterns = {}
    not_found_count = 0
    processed_count = 0
    word_count = 0

    print(f"Starting rhyme pattern and syllable processing...")
    print(f"Reading words from: {INPUT_PATH}")

    # Check if the input file exists
    if not os.path.exists(INPUT_PATH):
         print(f"\n--- ERROR ---")
         print(f"Input file '{WORD_LIST_FILE}' not found in the directory:")
         print(f"'{SCRIPT_DIR}'")
         print(f"Please create this file with one word per line and run the script again.")
         return # Stop execution if file not found

    # Read words from the input file
    try:
        with open(INPUT_PATH, 'r', encoding='utf-8') as f:
            # Read lines, strip whitespace, filter out empty lines
            words = [line.strip() for line in f if line.strip()]
            word_count = len(words)
    except Exception as e:
         print(f"Error reading file '{INPUT_PATH}': {e}")
         return # Stop execution if file cannot be read

    print(f"Found {word_count} words/phrases in the list.")
    print(f"Processing phonetic patterns and syllable counts (this may take a moment for large lists)...")

    # Process each word
    for word in words:
        # Get the vowel pattern using the helper function
        pattern = get_all_vowel_pattern(word)
        # Get the syllable count
        syllable_count = get_syllable_count(word)

        if pattern and syllable_count is not None:
            # Store both pattern and syllable count with the original (case preserved) word as the key
            rhyme_patterns[word] = {
                "rhyme_pattern": pattern,
                "syllables": syllable_count
            }
            processed_count += 1
        else:
            # Word's pronunciation not found in the CMU dictionary
            # Optionally print a warning for each missing word:
            # print(f" - Warning: Phonetic data not found for '{word}'")
            not_found_count += 1

    # --- Summary ---
    print(f"\n--- Processing Complete ---")
    print(f"Successfully processed: {processed_count} words")
    if not_found_count > 0:
        print(f"Phonetic data not found for: {not_found_count} words (excluded from rhyme data)")
    print(f"Total words from list processed/attempted: {word_count}")

    # --- Write Output JSON ---
    print(f"\nWriting {len(rhyme_patterns)} patterns to: {OUTPUT_PATH}")
    try:
        # Write the dictionary to a JSON file with pretty printing (indent=2)
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(rhyme_patterns, f, indent=2, ensure_ascii=False) # ensure_ascii=False for wider character support
        print("Successfully wrote JSON file.")
    except Exception as e:
        print(f"--- ERROR ---")
        print(f"Error writing JSON file '{OUTPUT_PATH}': {e}")


# --- Script Execution Entry Point ---
if __name__ == "__main__":
    # This block ensures the code runs only when the script is executed directly
    # (not when imported as a module)
    process_word_list()