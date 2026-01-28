import os
import json
import re
import asyncio
from typing import Dict, Optional
from dotenv import load_dotenv
from google import genai

load_dotenv()

# Debug mode - set DEBUG=true in environment to enable debug prints
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY missing in .env")

# Initialize Gemini client
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

async def extract_entities_with_llm(resume_text: str) -> Dict[str, Optional[str]]:
    """
    Extract candidate information (name, email, phone, location) from resume text using LLM.
    Uses the same Gemini Flash model as scoring.
    """
    if not resume_text or len(resume_text.strip()) == 0:
        return {
            "name": "Unknown Candidate",
            "email": None,
            "phone": None,
            "location": None
        }
    
    system_message = """Extract candidate information from resume text. Return JSON only.

Format requirements:
- Name: Title Case (e.g., "John Smith" not "JOHN SMITH" or "john smith")
- Phone: International format with + and no spaces (e.g., "+971507888888" or "+15123333333")
- Email: lowercase
- Location: "City, Country" format

Return JSON:
{
    "name": "Title Case Name",
    "email": "email@example.com",
    "phone": "+971507888888",
    "location": "City, Country"
}

Use null if not found. No markdown or explanations."""

    user_prompt = f"""Extract from resume:

{resume_text[:5000]}

Return JSON with name (Title Case), email, phone (international format with + and no spaces), location."""

    try:
        if DEBUG:
            print(f"DEBUG: Calling Gemini API for entity extraction with model gemini-3-flash-preview")
        
        # Combine system message and user prompt
        full_prompt = f"{system_message}\n\n{user_prompt}"
        
        # Run Gemini API call in thread pool since it's synchronous
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model="gemini-3-flash-preview",
            contents=full_prompt
        )
        
        if not response:
            raise Exception("Empty response from Gemini API")
        
        content = response.text
        
        if not content:
            raise Exception("No content in Gemini API response")
        
        if DEBUG:
            print(f"DEBUG: Received entity extraction response (length: {len(content)} chars)")
        
        # Extract JSON from response (handle markdown code blocks and other formats)
        # Try to find JSON in the response
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)
        
        # Remove markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        # Clean up the content - remove any leading/trailing text
        content = content.strip()
        if not content.startswith('{'):
            # Try to find the first {
            start_idx = content.find('{')
            if start_idx != -1:
                content = content[start_idx:]
        if not content.endswith('}'):
            # Try to find the last }
            end_idx = content.rfind('}')
            if end_idx != -1:
                content = content[:end_idx + 1]
        
        try:
            result = json.loads(content)
            
            # Validate and clean the extracted data
            name = result.get("name")
            if name:
                name = str(name).strip()
                if not name or name.lower() in ["null", "none", "n/a", "unknown"]:
                    name = None
                else:
                    # Format name to Title Case (capital first letter, rest lowercase)
                    name = ' '.join(word.capitalize() if word else '' for word in name.split())
            
            email = result.get("email")
            if email:
                email = str(email).strip().lower()
                # Basic email validation
                if "@" not in email or email.lower() in ["null", "none", "n/a"]:
                    email = None
            
            phone = result.get("phone")
            if phone:
                phone = str(phone).strip()
                if phone.lower() in ["null", "none", "n/a"]:
                    phone = None
                else:
                    # Format phone to uniform international format: +[country][number] (no spaces)
                    # Remove all non-digit characters except +
                    cleaned_phone = re.sub(r'[^\d+]', '', phone)
                    if len(cleaned_phone) >= 7:  # Minimum 7 digits for valid phone
                        # Ensure it starts with +
                        if not cleaned_phone.startswith('+'):
                            cleaned_phone = '+' + cleaned_phone
                        # Format: +[country code][number] (no spaces)
                        # Extract country code (1-4 digits after +)
                        match = re.match(r'^\+(\d{1,4})(\d+)$', cleaned_phone)
                        if match:
                            country_code = match.group(1)
                            number = match.group(2)
                            # Format: +country_code + number (no spaces)
                            phone = f"+{country_code}{number}"
                        else:
                            phone = cleaned_phone
                    else:
                        phone = None
            
            location = result.get("location")
            if location:
                location = str(location).strip()
                if not location or location.lower() in ["null", "none", "n/a", "unknown"]:
                    location = None
            
            return {
                "name": name or "Unknown Candidate",
                "email": email,
                "phone": phone,
                "location": location
            }
            
        except json.JSONDecodeError as e:
            if DEBUG:
                print(f"JSON decode error in entity extraction: {e}")
                print(f"Content received (first 500 chars): {content[:500]}")
            
            # Fallback: try to extract fields using regex patterns
            name_match = re.search(r'"name"\s*:\s*"([^"]+)"', content)
            email_match = re.search(r'"email"\s*:\s*"([^"]+)"', content)
            phone_match = re.search(r'"phone"\s*:\s*"([^"]+)"', content)
            location_match = re.search(r'"location"\s*:\s*"([^"]+)"', content)
            
            name = name_match.group(1) if name_match else None
            email = email_match.group(1) if email_match else None
            phone = phone_match.group(1) if phone_match else None
            location = location_match.group(1) if location_match else None
            
            # Format name to Title Case
            if name:
                name = ' '.join(word.capitalize() if word else '' for word in name.split())
            
            # Format phone to uniform format (no spaces)
            if phone:
                cleaned_phone = re.sub(r'[^\d+]', '', phone)
                if len(cleaned_phone) >= 7:
                    if not cleaned_phone.startswith('+'):
                        cleaned_phone = '+' + cleaned_phone
                    match = re.match(r'^\+(\d{1,4})(\d+)$', cleaned_phone)
                    if match:
                        country_code = match.group(1)
                        number = match.group(2)
                        # Format: +country_code + number (no spaces)
                        phone = f"+{country_code}{number}"
                    else:
                        phone = cleaned_phone
                else:
                    phone = None
            
            return {
                "name": name or "Unknown Candidate",
                "email": email,
                "phone": phone,
                "location": location
            }
            
    except Exception as e:
        error_msg = str(e)
        if DEBUG:
            print(f"ERROR in LLM entity extraction: {error_msg}")
            import traceback
            traceback.print_exc()
        
        # Fallback to basic extraction on error
        return await _fallback_extraction(resume_text)

async def _fallback_extraction(text: str) -> Dict[str, Optional[str]]:
    """Fallback extraction using regex patterns if LLM fails"""
    # Basic email extraction
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    emails = re.findall(email_pattern, text)
    email = emails[0] if emails else None
    
    # Basic phone extraction
    phone_pattern = r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,6}(?:[-\s\.\(\)]?[0-9]{1,6}){2,8}'
    phones = re.findall(phone_pattern, text)
    phone = None
    if phones:
        cleaned = re.sub(r'[^\d+]', '', phones[0])
        if len(cleaned) >= 7:
            # Ensure it starts with + and has no spaces
            if not cleaned.startswith('+'):
                phone = '+' + cleaned
            else:
                phone = cleaned
    
    # Basic name extraction (first line that looks like a name)
    lines = text.split('\n')
    name = "Unknown Candidate"
    for line in lines[:5]:
        line = line.strip()
        if len(line) > 0 and 2 <= len(line.split()) <= 4:
            if line.replace(' ', '').isalpha() or (line.replace(' ', '').isalnum() and len(line) < 50):
                name = line
                break
    
    # Basic location extraction
    location = None
    for line in lines[:20]:
        line = line.strip()
        if not line or len(line) < 3:
            continue
        if '@' in line or 'http' in line.lower():
            continue
        location_pattern = r'^[A-Z][a-zA-Z\s]+,\s*[A-Z]{2,}'
        if re.match(location_pattern, line):
            location = line
            break
    
    return {
        "name": name,
        "email": email,
        "phone": phone,
        "location": location
    }

async def extract_contact_info(text: str) -> Dict[str, Optional[str]]:
    """Extract email and phone from resume text using LLM"""
    entities = await extract_entities_with_llm(text)
    return {
        "email": entities.get("email"),
        "phone": entities.get("phone")
    }

async def extract_name(text: str, contact_info: Optional[Dict[str, Optional[str]]] = None) -> str:
    """Extract candidate name from resume using LLM"""
    entities = await extract_entities_with_llm(text)
    name = entities.get("name")
    
    # Fallback if LLM didn't extract name
    if not name or name == "Unknown Candidate":
        # Try email username as fallback
        if contact_info and contact_info.get("email"):
            email = contact_info["email"]
            email_username = email.split('@')[0]
            name_from_email = email_username.replace('.', ' ').replace('_', ' ').replace('-', ' ')
            name_from_email = ' '.join(word.capitalize() for word in name_from_email.split() if word)
            if name_from_email and len(name_from_email) > 1:
                return name_from_email
        
        # Last resort: first 2 words of text
        words = text.split()
        if len(words) >= 2:
            return ' '.join(words[:2])
        elif len(words) == 1:
            return words[0]
    
    return name or "Unknown Candidate"

async def extract_location(text: str) -> Optional[str]:
    """Extract location information from resume text using LLM"""
    entities = await extract_entities_with_llm(text)
    return entities.get("location")

