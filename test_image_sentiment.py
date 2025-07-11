#!/usr/bin/env python3
"""
Test script for image sentiment analysis
"""

import numpy as np
from PIL import Image
import base64
import io

def create_test_image(width=100, height=100, brightness=127, red_bias=0, contrast=30):
    """Create a test image with specific characteristics"""
    
    # Create base image
    img_array = np.full((height, width, 3), brightness, dtype=np.uint8)
    
    # Add color bias (red vs blue)
    img_array = img_array.astype(np.int16)  # Use int16 to handle negative values
    img_array[:, :, 0] = np.clip(img_array[:, :, 0] + red_bias, 0, 255)  # Red channel
    img_array[:, :, 2] = np.clip(img_array[:, :, 2] - red_bias, 0, 255)  # Blue channel
    img_array = img_array.astype(np.uint8)  # Convert back to uint8
    
    # Add contrast (noise)
    noise = np.random.normal(0, contrast, (height, width, 3))
    img_array = np.clip(img_array + noise, 0, 255).astype(np.uint8)
    
    # Convert to PIL Image
    image = Image.fromarray(img_array)
    
    # Convert to base64 data URL
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG')
    img_data = buffer.getvalue()
    base64_data = base64.b64encode(img_data).decode('utf-8')
    data_url = f"data:image/jpeg;base64,{base64_data}"
    
    return data_url, img_array

def analyze_image_sentiment(image_data_url: str):
    """Analyze image sentiment based on brightness and color characteristics."""
    
    try:
        # Extract base64 data from data URL
        if image_data_url.startswith('data:'):
            # Remove data URL prefix
            base64_data = image_data_url.split(',')[1]
            image_data = base64.b64decode(base64_data)
            
            # Open image with PIL
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize for faster processing
            image = image.resize((100, 100))
            
            # Convert to numpy array
            img_array = np.array(image)
            
            # Calculate average brightness (0-255)
            brightness = np.mean(img_array)
            
            # Calculate color temperature (red vs blue dominance)
            red_channel = np.mean(img_array[:, :, 0])
            blue_channel = np.mean(img_array[:, :, 2])
            color_temp = red_channel - blue_channel  # Positive = warm, negative = cool
            
            # Calculate contrast (standard deviation of brightness)
            contrast = np.std(img_array)
            
            # Calculate saturation (distance from gray)
            gray = np.mean(img_array, axis=2)
            saturation = np.mean(np.abs(img_array - gray[:, :, np.newaxis]))
            
            # Combine factors for sentiment score
            # Brightness: 0-255 -> -1 to 1 (dark = negative, bright = positive)
            brightness_score = (brightness - 127.5) / 127.5
            
            # Color temperature: warm = positive, cool = negative
            temp_score = np.clip(color_temp / 50, -1, 1)
            
            # Contrast: high contrast = intense/aggressive, low = calm
            contrast_score = np.clip((contrast - 30) / 50, -1, 1)
            
            # Saturation: high saturation = energetic, low = mellow
            saturation_score = np.clip((saturation - 30) / 50, -1, 1)
            
            # Weighted combination (brightness most important)
            image_sentiment = (
                brightness_score * 0.4 +
                temp_score * 0.2 +
                contrast_score * 0.2 +
                saturation_score * 0.2
            )
            
            # Convert to 1-10 scale
            image_display = int(round((image_sentiment + 1) * 5))
            image_display = max(1, min(10, image_display))
            
            return {
                'brightness': brightness,
                'color_temp': color_temp,
                'contrast': contrast,
                'saturation': saturation,
                'brightness_score': brightness_score,
                'temp_score': temp_score,
                'contrast_score': contrast_score,
                'saturation_score': saturation_score,
                'sentiment': image_sentiment,
                'display': image_display
            }
                
    except Exception as e:
        print(f"Error analyzing image: {e}")
        return None

def test_image_sentiment():
    """Test image sentiment analysis with various image characteristics"""
    
    print("Image Sentiment Analysis Test")
    print("=" * 50)
    
    # Test cases
    test_cases = [
        ("Dark Image", 50, 0, 20),      # Dark, neutral, low contrast
        ("Bright Image", 200, 0, 20),   # Bright, neutral, low contrast
        ("Warm Image", 127, 30, 30),    # Neutral brightness, warm colors
        ("Cool Image", 127, -30, 30),   # Neutral brightness, cool colors
        ("High Contrast", 127, 0, 60),  # Neutral, high contrast
        ("Low Contrast", 127, 0, 10),   # Neutral, low contrast
        ("Dark Warm", 80, 20, 40),      # Dark but warm
        ("Bright Cool", 180, -20, 40),  # Bright but cool
    ]
    
    for name, brightness, red_bias, contrast in test_cases:
        print(f"\n{name}:")
        print(f"  Settings: Brightness={brightness}, Red Bias={red_bias}, Contrast={contrast}")
        
        # Create test image
        data_url, img_array = create_test_image(
            brightness=brightness, 
            red_bias=red_bias, 
            contrast=contrast
        )
        
        # Analyze sentiment
        result = analyze_image_sentiment(data_url)
        
        if result:
            print(f"  Brightness: {result['brightness']:.1f}")
            print(f"  Color Temp: {result['color_temp']:.1f}")
            print(f"  Contrast: {result['contrast']:.1f}")
            print(f"  Saturation: {result['saturation']:.1f}")
            print(f"  Sentiment: {result['sentiment']:.3f} ({result['display']}/10)")
            
            # Interpret sentiment
            if result['display'] <= 2:
                mood = "Very Negative"
            elif result['display'] <= 4:
                mood = "Negative"
            elif result['display'] == 5:
                mood = "Neutral"
            elif result['display'] <= 7:
                mood = "Positive"
            else:
                mood = "Very Positive"
            
            print(f"  Mood: {mood}")

if __name__ == "__main__":
    test_image_sentiment() 