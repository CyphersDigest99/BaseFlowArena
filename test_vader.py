#!/usr/bin/env python3
"""
Test script for VADER sentiment analysis on beat filenames
"""

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

def test_vader_sentiment():
    """Test VADER sentiment analysis on sample beat filenames"""
    
    # Initialize VADER analyzer
    analyzer = SentimentIntensityAnalyzer()
    
    # Sample beat filenames to test
    test_filenames = [
        "20191109_｜ FREE ｜ Sad Guitar Hip Hop Beat ⧹⧹ ＂Hope＂ (Prod. Aksil).mp3",
        "20200430_[FREE] Fast Aggressive 808 Rap Beat ＂JAWS＂ ｜ Dark Hip Hop Instrumental ｜ Free Type Beat ｜.mp3",
        "20210501_Tundra Beats - ＂Feelings＂ ｜｜ Lofi Type Beat ｜｜ Chill Instrumental.mp3",
        "20230206_Free Sad Type Beat - ＂Alone＂ ｜ Emotional Piano Instrumental 2023.mp3",
        "20230811_[FREE] J Cole Type Beat x Kendrick Lamar Type Beat ｜ ＂Somber＂.mp3",
        "20231013_＂HALLELUJAH＂ - (Instrumental⧸Beat).mp3",
        "20241116_(FREE) Westside Gunn x Griselda Type Beat - 'Fever Dream'.mp3"
    ]
    
    print("VADER Sentiment Analysis Test")
    print("=" * 50)
    
    for filename in test_filenames:
        # Get sentiment scores
        scores = analyzer.polarity_scores(filename)
        sentiment_score = scores['compound']  # -1 to 1
        
        # Convert to 1-10 scale
        sentiment_display = int(round((sentiment_score + 1) * 5))
        
        print(f"\nFilename: {filename}")
        print(f"Raw VADER Score: {sentiment_score:.3f} (-1 to 1)")
        print(f"Display Score: {sentiment_display}/10")
        print(f"Sentiment: {scores}")
        
        # Show sentiment range interpretation
        if sentiment_score <= -0.51:
            mood = "Dark/Aggressive"
        elif sentiment_score <= -0.01:
            mood = "Melancholic/Somber"
        elif sentiment_score <= 0.49:
            mood = "Neutral/Balanced"
        else:
            mood = "Upbeat/Positive"
        
        print(f"Mood Category: {mood}")

if __name__ == "__main__":
    test_vader_sentiment() 