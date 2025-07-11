#!/usr/bin/env python3
"""
Format Beats - Automated Beat File Processing and Metadata Extraction

This script performs the following operations:
1. Scans the /beats directory for MP3 files
2. Sanitizes filenames (removes special characters, replaces spaces with hyphens)
3. Uses OpenAI API to extract metadata from original filenames
4. Renames files to sanitized versions
5. Generates waveform data for real-time display
6. Creates a structured beats.json file with all metadata

Requirements:
- openai
- librosa (for audio processing)
- numpy
- json
- os
- re
- requests
"""

import os
import re
import json
import openai
import librosa
import numpy as np
from pathlib import Path
import argparse
from typing import Dict, List, Optional, Tuple
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BeatFormatter:
    def __init__(self, openai_api_key: str, beats_dir: str = "beats", output_file: str = "beats.json"):
        """
        Initialize the BeatFormatter with OpenAI API key and configuration.
        
        Args:
            openai_api_key: OpenAI API key for metadata extraction
            beats_dir: Directory containing beat files
            output_file: Output JSON file name
        """
        self.beats_dir = Path(beats_dir)
        self.output_file = output_file
        self.beats_data = []
        
        # Initialize OpenAI client
        openai.api_key = openai_api_key
        
        # Ensure beats directory exists
        if not self.beats_dir.exists():
            raise FileNotFoundError(f"Beats directory '{self.beats_dir}' not found")
    
    def scan_mp3_files(self) -> List[Path]:
        """Scan the beats directory for MP3 files."""
        mp3_files = list(self.beats_dir.glob("*.mp3"))
        logger.info(f"Found {len(mp3_files)} MP3 files in {self.beats_dir}")
        return mp3_files
    
    def sanitize_filename(self, original_filename: str) -> str:
        """
        Sanitize filename by removing special characters and replacing spaces with hyphens.
        
        Args:
            original_filename: Original filename with extension
            
        Returns:
            Sanitized filename
        """
        # Remove file extension
        name_without_ext = Path(original_filename).stem
        
        # Remove date prefixes (YYYYMMDD_)
        name_without_date = re.sub(r'^\d{8}_', '', name_without_ext)
        
        # Remove common prefixes like [FREE], (FREE), etc.
        name_cleaned = re.sub(r'^\[?\(?FREE\)?\]?\s*', '', name_without_date, flags=re.IGNORECASE)
        
        # Remove special characters but keep alphanumeric, spaces, and hyphens
        name_cleaned = re.sub(r'[^\w\s\-]', '', name_cleaned)
        
        # Replace multiple spaces with single space
        name_cleaned = re.sub(r'\s+', ' ', name_cleaned)
        
        # Replace spaces with hyphens
        name_cleaned = name_cleaned.replace(' ', '-')
        
        # Remove multiple consecutive hyphens
        name_cleaned = re.sub(r'-+', '-', name_cleaned)
        
        # Remove leading/trailing hyphens
        name_cleaned = name_cleaned.strip('-')
        
        # Add .mp3 extension
        sanitized_filename = f"{name_cleaned}.mp3"
        
        logger.debug(f"Sanitized: '{original_filename}' -> '{sanitized_filename}'")
        return sanitized_filename
    
    def extract_metadata_with_ai(self, original_filename: str) -> Dict:
        """
        Use OpenAI API to extract metadata from the original filename.
        
        Args:
            original_filename: Original filename to analyze
            
        Returns:
            Dictionary containing extracted metadata
        """
        prompt = f"""You are a music librarian. Analyze the following filename: {original_filename}

Extract the following information and return a single, clean JSON object with these keys:
- trackTitle: The main title of the track (without quotes or special formatting)
- producer: The producer name if mentioned
- type: The type of beat (e.g., "J. Cole Type Beat", "Hip Hop", "Trap", etc.)
- mood: The inferred mood/emotion of the track
- genre: The primary genre
- year: The year if mentioned in the filename
- bpm: The BPM if mentioned in the filename (as integer)

Use empty strings for missing fields. Return ONLY the JSON object, no additional text."""

        try:
            client = openai.OpenAI(api_key=openai.api_key)
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a music metadata expert. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=300
            )
            
            # Extract JSON from response
            content = response.choices[0].message.content.strip()
            
            # Try to parse JSON
            try:
                metadata = json.loads(content)
                logger.debug(f"AI extracted metadata: {metadata}")
                return metadata
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse AI response as JSON: {e}")
                return self._fallback_metadata(original_filename)
                
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return self._fallback_metadata(original_filename)
    
    def _fallback_metadata(self, original_filename: str) -> Dict:
        """
        Fallback metadata extraction when AI fails.
        
        Args:
            original_filename: Original filename
            
        Returns:
            Basic metadata dictionary
        """
        # Extract year from filename
        year_match = re.search(r'20\d{2}', original_filename)
        year = year_match.group() if year_match else ""
        
        # Extract BPM if mentioned
        bpm_match = re.search(r'(\d{2,3})BPM', original_filename, re.IGNORECASE)
        bpm = bpm_match.group(1) if bpm_match else ""
        
        # Basic type detection
        type_beat = ""
        if "type beat" in original_filename.lower():
            type_beat = "Type Beat"
        elif "instrumental" in original_filename.lower():
            type_beat = "Instrumental"
        elif "hip hop" in original_filename.lower():
            type_beat = "Hip Hop"
        
        return {
            "trackTitle": "",
            "producer": "",
            "type": type_beat,
            "mood": "",
            "genre": "Hip Hop",
            "year": year,
            "bpm": bpm
        }
    
    def generate_waveform_and_bpm(self, file_path: Path, max_points: int = 1000) -> Tuple[List[float], Optional[int]]:
        """
        Generate waveform data and extract BPM from the audio file.
        
        Args:
            file_path: Path to the audio file
            max_points: Maximum number of points to generate
            
        Returns:
            Tuple of (waveform_data, detected_bpm)
        """
        try:
            # Load audio file
            y, sr = librosa.load(file_path, sr=None, mono=True)
            
            # Extract BPM using librosa's tempo detection
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            detected_bpm = int(round(tempo))
            
            logger.debug(f"Detected BPM: {detected_bpm} for {file_path.name}")
            
            # Calculate RMS energy for each frame (for waveform)
            frame_length = int(sr * 0.1)  # 100ms frames
            hop_length = frame_length // 2
            
            rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
            
            # Normalize RMS values
            rms_normalized = rms / np.max(rms) if np.max(rms) > 0 else rms
            
            # Downsample to desired number of points
            if len(rms_normalized) > max_points:
                indices = np.linspace(0, len(rms_normalized) - 1, max_points, dtype=int)
                waveform = rms_normalized[indices].tolist()
            else:
                waveform = rms_normalized.tolist()
            
            logger.debug(f"Generated waveform with {len(waveform)} points for {file_path.name}")
            return waveform, detected_bpm
            
        except Exception as e:
            logger.error(f"Error processing audio for {file_path.name}: {e}")
            return [], None
    
    def process_single_file(self, file_path: Path) -> Dict:
        """
        Process a single MP3 file: extract metadata, generate waveform, and prepare for renaming.
        
        Args:
            file_path: Path to the MP3 file
            
        Returns:
            Dictionary containing all file data
        """
        original_filename = file_path.name
        logger.info(f"Processing: {original_filename}")
        
        # Step 1: Sanitize filename
        sanitized_filename = self.sanitize_filename(original_filename)
        
        # Step 2: Extract metadata using AI
        metadata = self.extract_metadata_with_ai(original_filename)
        
        # Step 3: Generate waveform data and extract BPM
        waveform, detected_bpm = self.generate_waveform_and_bpm(file_path)
        
        # Step 4: Assemble the complete record
        beat_data = {
            "originalFileName": original_filename,
            "newFileName": sanitized_filename,
            "filePath": f"beats/{sanitized_filename}",
            "fileSize": file_path.stat().st_size,
            "waveform": waveform,
            "detectedBpm": detected_bpm,  # Add detected BPM
            **metadata
        }
        
        # Update BPM in metadata if AI didn't find it but we detected it
        if not metadata.get("bpm") and detected_bpm:
            beat_data["bpm"] = str(detected_bpm)
            logger.info(f"Updated BPM for {original_filename}: {detected_bpm}")
        
        return beat_data
    
    def rename_file(self, old_path: Path, new_filename: str) -> bool:
        """
        Rename a file to its sanitized name.
        
        Args:
            old_path: Current file path
            new_filename: New sanitized filename
            
        Returns:
            True if successful, False otherwise
        """
        try:
            new_path = old_path.parent / new_filename
            
            # Check if target file already exists
            if new_path.exists():
                logger.warning(f"Target file {new_filename} already exists, skipping rename")
                return False
            
            # Rename the file
            old_path.rename(new_path)
            logger.info(f"Renamed: {old_path.name} -> {new_filename}")
            return True
            
        except Exception as e:
            logger.error(f"Error renaming {old_path.name}: {e}")
            return False
    
    def process_all_files(self, dry_run: bool = False) -> None:
        """
        Process all MP3 files in the beats directory.
        
        Args:
            dry_run: If True, don't actually rename files, just generate metadata
        """
        # Step 1: Scan for MP3 files
        mp3_files = self.scan_mp3_files()
        
        if not mp3_files:
            logger.warning("No MP3 files found in beats directory")
            return
        
        # Step 2: Process each file
        for file_path in mp3_files:
            try:
                # Process the file
                beat_data = self.process_single_file(file_path)
                
                # Add to master list
                self.beats_data.append(beat_data)
                
                # Step 3: Rename the file (unless dry run)
                if not dry_run:
                    success = self.rename_file(file_path, beat_data["newFileName"])
                    if success:
                        # Update the file path in our data
                        beat_data["filePath"] = f"beats/{beat_data['newFileName']}"
                
            except Exception as e:
                logger.error(f"Error processing {file_path.name}: {e}")
                continue
        
        # Step 4: Save the JSON output
        self.save_beats_json()
        
        logger.info(f"Processing complete. Processed {len(self.beats_data)} files.")
    
    def save_beats_json(self) -> None:
        """Save the beats data to JSON file."""
        try:
            output_data = {
                "metadata": {
                    "totalBeats": len(self.beats_data),
                    "generatedAt": str(np.datetime64('now')),
                    "version": "1.0"
                },
                "beats": self.beats_data
            }
            
            with open(self.output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved beats data to {self.output_file}")
            
        except Exception as e:
            logger.error(f"Error saving JSON file: {e}")
    
    def update_beat_manager(self) -> None:
        """
        Update the beatManager.js file with the new playlist data.
        This creates a new playlist array that can be imported into the existing system.
        """
        try:
            # Create the playlist array for beatManager.js
            playlist_entries = []
            for beat in self.beats_data:
                playlist_entries.append({
                    "name": beat.get("trackTitle", beat.get("newFileName", "").replace(".mp3", "")),
                    "file": beat["filePath"]
                })
            
            # Generate the JavaScript code
            js_code = f"""// Auto-generated playlist from format_beats.py
// Generated on: {np.datetime64('now')}
// Total beats: {len(self.beats_data)}

export const BEAT_PLAYLIST = {json.dumps(playlist_entries, indent=4)};

// Individual beat metadata for advanced features
export const BEAT_METADATA = {json.dumps(self.beats_data, indent=4)};
"""
            
            # Save to a new file
            with open("js/generated_playlist.js", 'w', encoding='utf-8') as f:
                f.write(js_code)
            
            logger.info("Generated js/generated_playlist.js for integration with beatManager.js")
            
        except Exception as e:
            logger.error(f"Error updating beat manager: {e}")

def main():
    """Main function to run the beat formatter."""
    parser = argparse.ArgumentParser(description="Format beat files and extract metadata")
    parser.add_argument("--openai-key", required=True, help="OpenAI API key")
    parser.add_argument("--beats-dir", default="beats", help="Directory containing beat files")
    parser.add_argument("--output", default="beats.json", help="Output JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Don't rename files, just generate metadata")
    parser.add_argument("--update-beat-manager", action="store_true", help="Generate JavaScript playlist file")
    
    args = parser.parse_args()
    
    try:
        # Initialize the formatter
        formatter = BeatFormatter(
            openai_api_key=args.openai_key,
            beats_dir=args.beats_dir,
            output_file=args.output
        )
        
        # Process all files
        formatter.process_all_files(dry_run=args.dry_run)
        
        # Update beat manager if requested
        if args.update_beat_manager:
            formatter.update_beat_manager()
        
        logger.info("Beat formatting completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during beat formatting: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 