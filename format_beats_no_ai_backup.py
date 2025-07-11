#!/usr/bin/env python3
"""
Format Beats - Automated Beat File Processing (No AI Version)

This script processes your beat files by sanitizing filenames, detecting BPM from audio,
and generating waveform data for real-time display - WITHOUT requiring OpenAI API.

Features:
- Filename sanitization
- BPM detection from audio files
- Waveform generation
- File renaming
- JSON output with metadata
"""

import os
import re
import json
import librosa
import numpy as np
from pathlib import Path
import argparse
from typing import Dict, List, Optional, Tuple
import logging
import base64
from mutagen import File
from mutagen.id3 import ID3
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BeatFormatterNoAI:
    def __init__(self, beats_dir: str = "beats", output_file: str = "beats.json"):
        """
        Initialize the BeatFormatter without AI dependencies.
        
        Args:
            beats_dir: Directory containing beat files
            output_file: Output JSON file name
        """
        self.beats_dir = Path(beats_dir)
        self.output_file = output_file
        self.beats_data = []
        
        # Initialize VADER sentiment analyzer
        self.sentiment_analyzer = SentimentIntensityAnalyzer()
        
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
    
    def extract_metadata_from_filename(self, original_filename: str) -> Dict:
        """
        Extract metadata from the filename using regex patterns.
        
        Args:
            original_filename: Original filename to analyze
            
        Returns:
            Dictionary containing extracted metadata
        """
        # Extract year from filename
        year_match = re.search(r'20\d{2}', original_filename)
        year = year_match.group() if year_match else ""
        
        # Extract BPM if mentioned
        bpm_match = re.search(r'(\d{2,3})BPM', original_filename, re.IGNORECASE)
        bpm = bpm_match.group(1) if bpm_match else ""
        
        # Extract track title (try to find text in quotes)
        title_match = re.search(r'["""]([^"""]+)["""]', original_filename)
        track_title = title_match.group(1) if title_match else ""
        
        # Extract producer (look for "Prod." or "Prod")
        producer_match = re.search(r'\(?Prod\.?\s*([^)]+)\)?', original_filename, re.IGNORECASE)
        producer = producer_match.group(1).strip() if producer_match else ""
        
        # Enhanced type beat and artist detection
        type_beat = ""
        artists = []
        
        # Look for "type beat" patterns
        type_beat_patterns = [
            r'([A-Z][a-z\.\s]+(?:\s+x\s+[A-Z][a-z\.\s]+)*)\s+type\s+beat',
            r'([A-Z][a-z\.\s]+(?:\s+x\s+[A-Z][a-z\.\s]+)*)\s+Type\s+Beat',
            r'([A-Z][a-z\.\s]+(?:\s+x\s+[A-Z][a-z\.\s]+)*)\s+TYPE\s+BEAT'
        ]
        
        for pattern in type_beat_patterns:
            matches = re.findall(pattern, original_filename, re.IGNORECASE)
            if matches:
                # Extract artists from the match
                artist_text = matches[0].strip()
                # Split by 'x' to get individual artists
                if ' x ' in artist_text:
                    artists = [artist.strip() for artist in artist_text.split(' x ')]
                else:
                    artists = [artist_text]
                type_beat = f"{artist_text} Type Beat"
                break
        
        # Fallback type detection if no artist type beat found
        if not type_beat:
            if "instrumental" in original_filename.lower():
                type_beat = "Instrumental"
            elif "hip hop" in original_filename.lower():
                type_beat = "Hip Hop"
            elif "trap" in original_filename.lower():
                type_beat = "Trap"
            elif "boom bap" in original_filename.lower():
                type_beat = "Boom Bap"
            elif "lofi" in original_filename.lower():
                type_beat = "Lo-Fi"
        
        # BPM-based mood detection (will be updated after BPM detection)
        mood = ""  # Will be set based on detected BPM
        
        # Analyze sentiment of the filename
        sentiment_scores = self.sentiment_analyzer.polarity_scores(original_filename)
        sentiment_score = sentiment_scores['compound']  # -1 to 1
        
        # Make VADER more decisive by adjusting thresholds and adding bias
        # Instead of neutral 5/10 being the default, push toward stronger classifications
        if abs(sentiment_score) < 0.1:  # Very neutral scores
            # Look for emotional keywords to push toward stronger classification
            emotional_keywords = {
                'positive': ['hope', 'love', 'dream', 'heaven', 'peaceful', 'gentle', 'happy', 'joy', 'light', 'sun', 'morning', 'feelings'],
                'negative': ['sad', 'alone', 'dark', 'hell', 'angry', 'violent', 'hate', 'aggressive', 'hard', 'rough', 'night', 'evil', 'sinister', 'devious']
            }
            
            filename_lower = original_filename.lower()
            positive_count = sum(1 for word in emotional_keywords['positive'] if word in filename_lower)
            negative_count = sum(1 for word in emotional_keywords['negative'] if word in filename_lower)
            
            if positive_count > negative_count:
                sentiment_score = 0.3  # Push toward positive
            elif negative_count > positive_count:
                sentiment_score = -0.3  # Push toward negative
            # If equal, keep neutral but with slight bias toward negative (more common in hip hop)
            else:
                sentiment_score = -0.1
        
        # Apply additional bias for stronger classifications
        # Make the scale more aggressive - push scores toward extremes
        if sentiment_score > 0.2:
            sentiment_score = min(1.0, sentiment_score * 1.3)  # Amplify positive
        elif sentiment_score < -0.2:
            sentiment_score = max(-1.0, sentiment_score * 1.3)  # Amplify negative
        
        # Convert to 1-10 scale with more decisive distribution
        # Instead of linear mapping, use a more aggressive curve
        if sentiment_score >= 0.5:
            sentiment_display = int(round(8 + (sentiment_score - 0.5) * 4))  # 8-10 range
        elif sentiment_score >= 0.1:
            sentiment_display = int(round(6 + (sentiment_score - 0.1) * 5))  # 6-7 range
        elif sentiment_score >= -0.1:
            sentiment_display = 5  # Neutral
        elif sentiment_score >= -0.5:
            sentiment_display = int(round(3 + (sentiment_score + 0.5) * 5))  # 3-4 range
        else:
            sentiment_display = int(round(1 + (sentiment_score + 1) * 2))  # 1-2 range
        
        # Ensure bounds
        sentiment_display = max(1, min(10, sentiment_display))
        
        return {
            "trackTitle": track_title,
            "producer": producer,
            "type": type_beat,
            "artists": artists,  # Array of individual artists
            "mood": mood,  # Will be set based on BPM
            "genre": "Hip Hop",
            "year": year,
            "bpm": bpm,
            "sentimentScore": sentiment_score,  # Raw VADER score (-1 to 1)
            "sentimentDisplay": sentiment_display  # Display score (1 to 10)
        }
    
    def generate_waveform_and_bpm(self, file_path: Path, max_points: int = 1000) -> Tuple[List[float], Optional[float], Optional[int]]:
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
            detected_bpm_exact = float(tempo)  # Keep exact decimal precision
            detected_bpm_display = int(round(detected_bpm_exact))  # Proper rounding for display
            
            logger.debug(f"Detected BPM: {detected_bpm_exact:.2f} (display: {detected_bpm_display}) for {file_path.name}")
            
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
            return waveform, detected_bpm_exact, detected_bpm_display
            
        except Exception as e:
            logger.error(f"Error processing audio for {file_path.name}: {e}")
            return [], None, None
    
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
        
        # Step 2: Extract metadata from filename
        metadata = self.extract_metadata_from_filename(original_filename)
        
        # Step 3: Generate waveform data and extract BPM
        waveform, detected_bpm_exact, detected_bpm_display = self.generate_waveform_and_bpm(file_path)
        
        # Step 4: Extract album art
        album_art = self.extract_album_art(file_path)
        
        # Step 5: Assemble the complete record
        beat_data = {
            "originalFileName": original_filename,
            "newFileName": sanitized_filename,
            "filePath": f"beats/{sanitized_filename}",
            "fileSize": file_path.stat().st_size,
            "waveform": waveform,
            "detectedBpmExact": detected_bpm_exact,  # Exact BPM for beat tracker
            "detectedBpmDisplay": detected_bpm_display,  # Rounded BPM for display
            "albumArt": album_art,  # Add album art as base64 data URL
            **metadata
        }
        
        # Update BPM in metadata if filename didn't have it but we detected it
        if not metadata.get("bpm") and detected_bpm_display:
            beat_data["bpm"] = str(detected_bpm_display)
            logger.info(f"Updated BPM for {original_filename}: {detected_bpm_display} (exact: {detected_bpm_exact:.2f})")
        
        # Set mood based on detected BPM
        if detected_bpm_display:
            mood = self.determine_mood_from_bpm(detected_bpm_display)
            beat_data["mood"] = mood
            logger.debug(f"Set mood to '{mood}' based on BPM {detected_bpm_display}")
        
        return beat_data
    
    def determine_mood_from_bpm(self, bpm: int) -> str:
        """
        Determine mood based on BPM ranges.
        
        Args:
            bpm: BPM value (integer)
            
        Returns:
            Mood string based on BPM range
        """
        if bpm <= 69:
            return "Chill"
        elif bpm <= 95:
            return "R&B"
        elif bpm <= 125:
            return "Boom Bap"
        else:
            return "Trap"
    
    def extract_album_art(self, file_path: Path) -> Optional[str]:
        """
        Extract album art from MP3 file and convert to base64.
        
        Args:
            file_path: Path to the MP3 file
            
        Returns:
            Base64 encoded album art data URL, or None if not found
        """
        try:
            # Try to load the file with mutagen
            audio = File(str(file_path))
            
            if audio is None:
                return None
            
            # Check if it has ID3 tags
            if hasattr(audio, 'tags') and audio.tags:
                # Look for APIC (album art) frames
                for key in audio.tags.keys():
                    if key.startswith('APIC:'):
                        apic_data = audio.tags[key]
                        if hasattr(apic_data, 'data'):
                            # Convert to base64
                            base64_data = base64.b64encode(apic_data.data).decode('utf-8')
                            # Get MIME type
                            mime_type = apic_data.mime or 'image/jpeg'
                            # Return as data URL
                            return f"data:{mime_type};base64,{base64_data}"
            
            # Alternative: try direct ID3 access
            try:
                id3 = ID3(str(file_path))
                for key in id3.keys():
                    if key.startswith('APIC:'):
                        apic_data = id3[key]
                        if hasattr(apic_data, 'data'):
                            base64_data = base64.b64encode(apic_data.data).decode('utf-8')
                            mime_type = apic_data.mime or 'image/jpeg'
                            return f"data:{mime_type};base64,{base64_data}"
            except Exception:
                pass
                
        except Exception as e:
            logger.debug(f"Could not extract album art from {file_path.name}: {e}")
        
        return None
    
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
                    "version": "1.0",
                    "processingMethod": "filename_analysis_and_audio_detection"
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
            js_code = f"""// Auto-generated playlist from format_beats_no_ai.py
// Generated on: {np.datetime64('now')}
// Total beats: {len(self.beats_data)}
// Processing method: Filename analysis and audio detection

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
    parser = argparse.ArgumentParser(description="Format beat files and extract metadata (No AI version)")
    parser.add_argument("--beats-dir", default="beats", help="Directory containing beat files")
    parser.add_argument("--output", default="beats.json", help="Output JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Don't rename files, just generate metadata")
    parser.add_argument("--update-beat-manager", action="store_true", help="Generate JavaScript playlist file")
    
    args = parser.parse_args()
    
    try:
        # Initialize the formatter
        formatter = BeatFormatterNoAI(
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