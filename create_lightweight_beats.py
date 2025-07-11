#!/usr/bin/env python3
"""
Create a lightweight version of beats.json without album art data
"""

import json
import os

def create_lightweight_version():
    """Create a lightweight beats.json without album art"""
    
    print("Loading full beats.json...")
    with open('beats.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Original file size: {os.path.getsize('beats.json') / (1024*1024):.2f} MB")
    
    # Create lightweight version
    lightweight_data = {
        "metadata": {
            "totalBeats": data['metadata']['totalBeats'],
            "generatedAt": data['metadata']['generatedAt'],
            "version": "1.0-lightweight",
            "processingMethod": "filename_analysis_and_audio_detection",
            "note": "Album art removed for performance testing"
        },
        "beats": []
    }
    
    # Process each beat, removing album art
    for beat in data['beats']:
        lightweight_beat = {**beat}  # Copy all data
        
        # Remove album art fields
        if 'albumArt' in lightweight_beat:
            del lightweight_beat['albumArt']
        
        # Keep all other data (sentiment, BPM, waveform, etc.)
        lightweight_data['beats'].append(lightweight_beat)
    
    # Save lightweight version
    output_file = 'beats_lightweight.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(lightweight_data, f, indent=2, ensure_ascii=False)
    
    print(f"Lightweight file size: {os.path.getsize(output_file) / (1024*1024):.2f} MB")
    print(f"Size reduction: {((os.path.getsize('beats.json') - os.path.getsize(output_file)) / os.path.getsize('beats.json') * 100):.1f}%")
    
    # Show what's included in lightweight version
    sample_beat = lightweight_data['beats'][0]
    print(f"\nLightweight version includes:")
    print(f"  ✓ BPM data (exact + display)")
    print(f"  ✓ Waveform data ({len(sample_beat['waveform']):,} points)")
    print(f"  ✓ Sentiment scores (text + image + combined)")
    print(f"  ✓ Artist parsing")
    print(f"  ✓ Mood classification")
    print(f"  ✓ All metadata")
    print(f"  ✗ Album art (removed)")
    
    print(f"\nFiles created:")
    print(f"  beats.json - Full version with album art ({os.path.getsize('beats.json') / (1024*1024):.1f} MB)")
    print(f"  beats_lightweight.json - Lightweight version ({os.path.getsize(output_file) / (1024*1024):.1f} MB)")
    
    return output_file

if __name__ == "__main__":
    create_lightweight_version() 