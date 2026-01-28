import os
import json
import re
from typing import Optional
from dotenv import load_dotenv
import asyncio
from google import genai

load_dotenv()

# Debug mode
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY missing in .env")

# Initialize Gemini client
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

async def generate_criterion_title(criterion_name: str) -> str:
    """
    Generate a concise title (8 words or less) for a long criterion name using LLM.
    Returns the original name if it's already 8 words or less.
    """
    # Count words
    word_count = len(criterion_name.split())
    
    # If 8 words or less, return as-is
    if word_count <= 8:
        return criterion_name
    
    try:
        prompt = f"""Create a concise title (8 words or less) for this evaluation criterion. 
Keep the essential meaning but make it shorter and more readable.

Original criterion: {criterion_name}

Return ONLY the concise title (no quotes, no explanations, just the title):"""

        if DEBUG:
            print(f"DEBUG: Generating title for criterion: '{criterion_name}' ({word_count} words)")
        
        # Call LLM
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model="gemini-3-flash-preview",
            contents=prompt
        )
        
        if not response or not response.text:
            if DEBUG:
                print("DEBUG: Empty response from LLM, using original")
            return criterion_name
        
        title = response.text.strip()
        
        # Remove quotes if present
        title = title.strip('"\'')
        
        # Validate word count
        title_word_count = len(title.split())
        if title_word_count > 8:
            if DEBUG:
                print(f"DEBUG: Generated title still too long ({title_word_count} words), truncating")
            # Truncate to first 8 words
            words = title.split()[:8]
            title = ' '.join(words)
        
        if DEBUG:
            print(f"DEBUG: Generated title: '{title}' ({len(title.split())} words)")
        
        return title
        
    except Exception as e:
        if DEBUG:
            print(f"DEBUG: Error generating title: {e}")
            import traceback
            traceback.print_exc()
        # Fallback: return original or truncated version
        words = criterion_name.split()[:8]
        return ' '.join(words)
