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
    Generate a concise 2-3 word title for a long criterion name using LLM.
    Returns the original name if it's already 8 words or less.
    """
    # Count words (excluding content in parentheses for counting)
    # Extract main text without parentheses
    import re
    main_text = re.sub(r'\([^)]*\)', '', criterion_name).strip()
    word_count = len(main_text.split()) if main_text else len(criterion_name.split())
    
    # If 8 words or less, return as-is
    if word_count <= 8:
        return criterion_name
    
    try:
        prompt = f"""Create a concise 2-3 word title for this evaluation criterion. 
Extract only the most essential keywords that capture the core meaning.

Original criterion: {criterion_name}

Examples:
- "Full-Stack Engineering Proficiency (React/Next.js, Node.js/Python)" → "Full-Stack Engineering"
- "UI/UX Design and Figma Proficiency" → "UI/UX Design"
- "AI/ML Foundations and Practical Data Validation" → "AI/ML Foundations"
- "UAE Residency Visa Status (Dependent or Golden Visa)" → "UAE Visa Status"
- "Academic Background and Portfolio Quality (GitHub/Figma)" → "Academic Portfolio"

Return ONLY the 2-3 word title (no quotes, no explanations, just the title):"""

        if DEBUG:
            print(f"DEBUG: Generating 2-3 word title for criterion: '{criterion_name}' ({word_count} words)")
        
        # Call LLM
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model="gemini-3-flash-preview",
            contents=prompt
        )
        
        if not response or not response.text:
            if DEBUG:
                print("DEBUG: Empty response from LLM, using fallback")
            # Fallback: extract first 2-3 meaningful words
            words = criterion_name.split()
            # Skip common words and take first 2-3 meaningful ones
            skip_words = {'and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for'}
            meaningful_words = [w for w in words if w.lower() not in skip_words][:3]
            return ' '.join(meaningful_words) if meaningful_words else ' '.join(words[:3])
        
        title = response.text.strip()
        
        # Remove quotes if present
        title = title.strip('"\'')
        
        # Validate word count (should be 2-3 words, but allow up to 4 if needed)
        title_words = title.split()
        title_word_count = len(title_words)
        if title_word_count > 4:
            if DEBUG:
                print(f"DEBUG: Generated title too long ({title_word_count} words), truncating to 3")
            # Truncate to first 3 words
            title = ' '.join(title_words[:3])
        elif title_word_count < 2:
            if DEBUG:
                print(f"DEBUG: Generated title too short ({title_word_count} words), using fallback")
            # Use fallback
            words = criterion_name.split()
            skip_words = {'and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for'}
            meaningful_words = [w for w in words if w.lower() not in skip_words][:3]
            title = ' '.join(meaningful_words) if meaningful_words else ' '.join(words[:3])
        
        if DEBUG:
            print(f"DEBUG: Generated title: '{title}' ({len(title.split())} words)")
        
        return title
        
    except Exception as e:
        if DEBUG:
            print(f"DEBUG: Error generating title: {e}")
            import traceback
            traceback.print_exc()
        # Fallback: extract first 2-3 meaningful words
        words = criterion_name.split()
        skip_words = {'and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for'}
        meaningful_words = [w for w in words if w.lower() not in skip_words][:3]
        return ' '.join(meaningful_words) if meaningful_words else ' '.join(words[:3])
