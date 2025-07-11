#!/usr/bin/env python3
import json

# Load the beats data
with open('beats.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("🎵 Enhanced Beat Metadata Results")
print("=" * 50)
print(f"Total beats processed: {data['metadata']['totalBeats']}")
print(f"Processing method: {data['metadata']['processingMethod']}")
print()

# Show sample beats with different moods
print("📊 Sample Beats with BPM-Based Moods:")
print("-" * 50)

sample_indices = [0, 10, 20, 30, 40]
for i in sample_indices:
    if i < len(data['beats']):
        beat = data['beats'][i]
        filename = beat['originalFileName'][:60] + "..." if len(beat['originalFileName']) > 60 else beat['originalFileName']
        
        print(f"\n{i+1}. {filename}")
        print(f"   BPM: {beat.get('detectedBpmDisplay', 'N/A')} (exact: {beat.get('detectedBpmExact', 'N/A')})")
        print(f"   Mood: {beat.get('mood', 'N/A')}")
        print(f"   Artists: {beat.get('artists', [])}")
        print(f"   Type: {beat.get('type', 'N/A')}")

print("\n" + "=" * 50)
print("🎯 Mood Distribution:")
print("-" * 50)

# Count moods
mood_counts = {}
for beat in data['beats']:
    mood = beat.get('mood', 'Unknown')
    mood_counts[mood] = mood_counts.get(mood, 0) + 1

for mood, count in sorted(mood_counts.items()):
    print(f"{mood}: {count} beats")

print("\n🎵 Artist Type Beat Examples:")
print("-" * 50)

# Find beats with artist information
artist_beats = [beat for beat in data['beats'] if beat.get('artists')]
for i, beat in enumerate(artist_beats[:10]):  # Show first 10
    print(f"{i+1}. {beat.get('artists')} -> {beat.get('type')}")

print(f"\nTotal beats with artist info: {len(artist_beats)} out of {len(data['beats'])}") 