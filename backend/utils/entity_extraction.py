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
    
    system_message = """You are an expert at extracting structured information from resumes. 
Your task is to extract the candidate's name, email address, phone number, and location from the resume text.

Extract the following information:
1. **Name**: The candidate's full name (first name and last name). This is typically at the top of the resume.
2. **Email**: The candidate's email address (format: user@domain.com)
3. **Phone**: The candidate's phone number (can be in various formats: +1-xxx-xxx-xxxx, (xxx) xxx-xxxx, etc.)
4. **Location**: The candidate's current location (city, state/country format preferred, e.g., "New York, NY" or "London, UK")

Return ONLY a valid JSON object with this exact structure:
{
    "name": "Full Name Here",
    "email": "email@example.com",
    "phone": "+1-xxx-xxx-xxxx",
    "location": "City, State/Country"
}

If any information is not found, use null for that field. Do not include any additional text, explanations, or markdown formatting."""

    user_prompt = f"""Extract the candidate's information from this resume:

{resume_text[:5000]}

Return the information as a JSON object with name, email, phone, and location fields."""

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
            
            email = result.get("email")
            if email:
                email = str(email).strip()
                # Basic email validation
                if "@" not in email or email.lower() in ["null", "none", "n/a"]:
                    email = None
            
            phone = result.get("phone")
            if phone:
                phone = str(phone).strip()
                if phone.lower() in ["null", "none", "n/a"]:
                    phone = None
                # Clean phone number - keep digits and + only
                if phone:
                    cleaned_phone = re.sub(r'[^\d+]', '', phone)
                    if len(cleaned_phone) >= 7:  # Minimum 7 digits for valid phone
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
            
            # Clean phone if found
            if phone:
                cleaned_phone = re.sub(r'[^\d+]', '', phone)
                phone = cleaned_phone if len(cleaned_phone) >= 7 else None
            
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

