#!/usr/bin/env python3
"""
Test script for format_beats.py dependencies and basic functionality.
Run this before using the main script to ensure everything is set up correctly.
"""

import sys
import os
from pathlib import Path

def test_imports():
    """Test that all required modules can be imported."""
    print("Testing imports...")
    
    try:
        import openai
        print("✓ openai imported successfully")
    except ImportError as e:
        print(f"✗ openai import failed: {e}")
        return False
    
    try:
        import librosa
        print("✓ librosa imported successfully")
    except ImportError as e:
        print(f"✗ librosa import failed: {e}")
        return False
    
    try:
        import numpy as np
        print("✓ numpy imported successfully")
    except ImportError as e:
        print(f"✗ numpy import failed: {e}")
        return False
    
    try:
        from pathlib import Path
        print("✓ pathlib imported successfully")
    except ImportError as e:
        print(f"✗ pathlib import failed: {e}")
        return False
    
    try:
        import json
        print("✓ json imported successfully")
    except ImportError as e:
        print(f"✗ json import failed: {e}")
        return False
    
    try:
        import re
        print("✓ re imported successfully")
    except ImportError as e:
        print(f"✗ re import failed: {e}")
        return False
    
    return True

def test_beats_directory():
    """Test that the beats directory exists and contains MP3 files."""
    print("\nTesting beats directory...")
    
    beats_dir = Path("beats")
    if not beats_dir.exists():
        print(f"✗ Beats directory '{beats_dir}' not found")
        return False
    
    print(f"✓ Beats directory found: {beats_dir}")
    
    mp3_files = list(beats_dir.glob("*.mp3"))
    if not mp3_files:
        print("✗ No MP3 files found in beats directory")
        return False
    
    print(f"✓ Found {len(mp3_files)} MP3 files")
    return True

def test_format_beats_import():
    """Test that format_beats.py can be imported."""
    print("\nTesting format_beats.py import...")
    
    try:
        # Add current directory to path
        sys.path.insert(0, os.getcwd())
        
        # Try to import the BeatFormatter class
        from format_beats import BeatFormatter
        print("✓ BeatFormatter class imported successfully")
        return True
    except ImportError as e:
        print(f"✗ format_beats import failed: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected error importing format_beats: {e}")
        return False

def test_sample_processing():
    """Test basic processing functionality with a sample filename."""
    print("\nTesting sample processing...")
    
    try:
        from format_beats import BeatFormatter
        
        # Create a mock formatter (without API key for testing)
        formatter = BeatFormatter("test_key", "beats", "test_output.json")
        
        # Test filename sanitization
        original = "20170904_A Storytelling Hip-Hop Beat ｜｜ ＂Symphony＂ (Prod. Flakron).mp3"
        sanitized = formatter.sanitize_filename(original)
        
        print(f"Original: {original}")
        print(f"Sanitized: {sanitized}")
        print("✓ Filename sanitization working")
        
        return True
    except Exception as e:
        print(f"✗ Sample processing failed: {e}")
        return False

def main():
    """Run all tests."""
    print("Format Beats - Dependency and Setup Test")
    print("=" * 50)
    
    tests = [
        test_imports,
        test_beats_directory,
        test_format_beats_import,
        test_sample_processing
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All tests passed! You're ready to use format_beats.py")
        print("\nNext steps:")
        print("1. Get an OpenAI API key from https://platform.openai.com/api-keys")
        print("2. Run: python format_beats.py --openai-key YOUR_API_KEY")
        print("3. Or test with: python format_beats.py --openai-key YOUR_API_KEY --dry-run")
    else:
        print("✗ Some tests failed. Please fix the issues above before proceeding.")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 