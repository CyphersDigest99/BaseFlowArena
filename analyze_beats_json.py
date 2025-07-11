#!/usr/bin/env python3
"""
Analyze the beats.json file to see what's taking up space
"""

import json
import os

def analyze_beats_json():
    """Analyze the beats.json file structure and size"""
    
    # Get file size
    file_size = os.path.getsize('beats.json')
    print(f"beats.json file size: {file_size / (1024*1024):.2f} MB")
    
    # Load the data
    with open('beats.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"\nMetadata:")
    print(f"  Total beats: {data['metadata']['totalBeats']}")
    print(f"  Generated: {data['metadata']['generatedAt']}")
    
    # Analyze first beat
    first_beat = data['beats'][0]
    print(f"\nFirst beat analysis:")
    print(f"  Original filename: {first_beat['originalFileName']}")
    print(f"  New filename: {first_beat['newFileName']}")
    print(f"  BPM: {first_beat['detectedBpmDisplay']} (exact: {first_beat['detectedBpmExact']:.2f})")
    print(f"  Mood: {first_beat['mood']}")
    print(f"  Artists: {first_beat['artists']}")
    
    # Check for album art
    if 'albumArt' in first_beat and first_beat['albumArt']:
        album_art_size = len(first_beat['albumArt'])
        print(f"  Album art: YES ({album_art_size:,} characters)")
        print(f"    This is a base64 encoded image data URL")
        print(f"    Format: data:image/jpeg;base64,<huge_string>")
    else:
        print(f"  Album art: NO")
    
    # Check waveform
    if 'waveform' in first_beat:
        waveform_size = len(first_beat['waveform'])
        print(f"  Waveform: {waveform_size:,} data points")
    
    # Check sentiment scores
    print(f"  Sentiment scores:")
    print(f"    Text: {first_beat.get('textSentimentScore', 'N/A')} ({first_beat.get('textSentimentDisplay', 'N/A')}/10)")
    print(f"    Image: {first_beat.get('imageSentimentScore', 'N/A')} ({first_beat.get('imageSentimentDisplay', 'N/A')}/10)")
    print(f"    Combined: {first_beat.get('combinedSentimentScore', 'N/A')} ({first_beat.get('combinedSentimentDisplay', 'N/A')}/10)")
    
    # Count album art across all beats
    beats_with_art = sum(1 for beat in data['beats'] if beat.get('albumArt'))
    print(f"\nAlbum art summary:")
    print(f"  Beats with album art: {beats_with_art}/{len(data['beats'])}")
    
    # Show sample of what the album art looks like
    if beats_with_art > 0:
        sample_beat = next(beat for beat in data['beats'] if beat.get('albumArt'))
        album_art = sample_beat['albumArt']
        print(f"\nSample album art data URL (first 100 chars):")
        print(f"  {album_art[:100]}...")
        print(f"  Total length: {len(album_art):,} characters")

if __name__ == "__main__":
    analyze_beats_json() 