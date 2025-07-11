#!/usr/bin/env python3
"""
Comprehensive VADER sentiment analysis test on actual beat filenames
"""

import os
from pathlib import Path
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

def get_enhanced_sentiment_score(analyzer, filename):
    """Get enhanced sentiment score with more decisive classification"""
    
    # Get base VADER scores
    scores = analyzer.polarity_scores(filename)
    sentiment_score = scores['compound']  # -1 to 1
    
    # Make VADER more decisive by adjusting thresholds and adding bias
    # Instead of neutral 5/10 being the default, push toward stronger classifications
    if abs(sentiment_score) < 0.1:  # Very neutral scores
        # Look for emotional keywords to push toward stronger classification
        emotional_keywords = {
            'positive': ['hope', 'love', 'dream', 'heaven', 'peaceful', 'gentle', 'happy', 'joy', 'light', 'sun', 'morning', 'feelings'],
            'negative': ['sad', 'alone', 'dark', 'hell', 'angry', 'violent', 'hate', 'aggressive', 'hard', 'rough', 'night', 'evil', 'sinister', 'devious']
        }
        
        filename_lower = filename.lower()
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
    
    return sentiment_score, sentiment_display, scores

def test_all_beat_filenames():
    """Test VADER sentiment analysis on all actual beat filenames"""
    
    # Initialize VADER analyzer
    analyzer = SentimentIntensityAnalyzer()
    
    # Get all MP3 files from beats directory
    beats_dir = Path("beats")
    if not beats_dir.exists():
        print("Beats directory not found!")
        return
    
    mp3_files = list(beats_dir.glob("*.mp3"))
    
    if not mp3_files:
        print("No MP3 files found in beats directory!")
        return
    
    print(f"VADER Sentiment Analysis Test - {len(mp3_files)} Beat Files")
    print("=" * 80)
    
    # Track sentiment ranges for summary
    sentiment_ranges = {
        "Very Negative (1-2)": [],
        "Negative (3-4)": [],
        "Neutral (5)": [],
        "Positive (6-7)": [],
        "Very Positive (8-10)": []
    }
    
    for file_path in sorted(mp3_files):
        filename = file_path.name
        
        # Get sentiment scores
        sentiment_score, sentiment_display, scores = get_enhanced_sentiment_score(analyzer, filename)
        
        # Categorize for summary
        if sentiment_display <= 2:
            category = "Very Negative (1-2)"
        elif sentiment_display <= 4:
            category = "Negative (3-4)"
        elif sentiment_display == 5:
            category = "Neutral (5)"
        elif sentiment_display <= 7:
            category = "Positive (6-7)"
        else:
            category = "Very Positive (8-10)"
        
        sentiment_ranges[category].append(filename)
        
        # Show detailed analysis for interesting cases
        if sentiment_display != 5 or "sad" in filename.lower() or "happy" in filename.lower() or "dark" in filename.lower():
            print(f"\n📁 {filename}")
            print(f"   Raw Score: {sentiment_score:.3f} | Display: {sentiment_display}/10")
            print(f"   Sentiment: {scores}")
            print(f"   Category: {category}")
    
    # Print summary statistics
    print("\n" + "=" * 80)
    print("SENTIMENT DISTRIBUTION SUMMARY")
    print("=" * 80)
    
    total_files = len(mp3_files)
    for category, files in sentiment_ranges.items():
        count = len(files)
        percentage = (count / total_files) * 100
        print(f"{category}: {count} files ({percentage:.1f}%)")
        
        # Show a few examples from each category
        if files:
            examples = files[:3]  # Show first 3 examples
            for example in examples:
                print(f"  • {example}")
            if len(files) > 3:
                print(f"  • ... and {len(files) - 3} more")
        print()

def analyze_specific_keywords():
    """Analyze how VADER interprets common beat title keywords"""
    
    analyzer = SentimentIntensityAnalyzer()
    
    keywords = [
        "sad", "happy", "dark", "light", "aggressive", "chill", "emotional",
        "hope", "alone", "feelings", "love", "hate", "dream", "nightmare",
        "heaven", "hell", "angry", "peaceful", "violent", "gentle",
        "fast", "slow", "hard", "soft", "rough", "smooth"
    ]
    
    print("\n" + "=" * 80)
    print("KEYWORD SENTIMENT ANALYSIS")
    print("=" * 80)
    
    for keyword in keywords:
        sentiment_score, sentiment_display, scores = get_enhanced_sentiment_score(analyzer, keyword)
        
        print(f"{keyword:12} | Raw: {sentiment_score:6.3f} | Display: {sentiment_display}/10 | {scores}")

if __name__ == "__main__":
    test_all_beat_filenames()
    analyze_specific_keywords() 