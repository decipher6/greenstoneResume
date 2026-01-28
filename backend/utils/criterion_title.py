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
    Generate a shorter alias for a long criterion name using LLM.
    Returns a concise version that's shorter than the original.
    """
    try:
        prompt = f"""Create a shorter alias for this evaluation criterion. Make it concise but still meaningful.

Original criterion: {criterion_name}

Return ONLY a shorter alias (no quotes, no explanations, just the shorter name):"""

        if DEBUG:
            print(f"DEBUG: Generating shorter alias for criterion: '{criterion_name}'")
        
        # Call LLM
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model="gemini-3-flash-preview",
            contents=prompt
        )
        
        if not response or not response.text:
            if DEBUG:
                print("DEBUG: Empty response from LLM, using fallback")
            # Fallback: take first 3-4 words
            words = criterion_name.split()[:4]
            return ' '.join(words)
        
        alias = response.text.strip()
        
        # Remove quotes if present
        alias = alias.strip('"\'')
        
        # Ensure it's actually shorter than original
        if len(alias.split()) >= len(criterion_name.split()):
            if DEBUG:
                print(f"DEBUG: Generated alias not shorter, using fallback")
            # Use fallback: take first 3-4 words
            words = criterion_name.split()[:4]
            alias = ' '.join(words)
        
        if DEBUG:
            print(f"DEBUG: Generated alias: '{alias}'")
        
        return alias
        
    except Exception as e:
        if DEBUG:
            print(f"DEBUG: Error generating alias: {e}")
            import traceback
            traceback.print_exc()
        # Fallback: take first 3-4 words
        words = criterion_name.split()[:4]
        return ' '.join(words)
