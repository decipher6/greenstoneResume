import re
from typing import Dict, Optional

async def extract_contact_info(text: str) -> Dict[str, Optional[str]]:
    """Extract email and phone from resume text"""
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    phone_pattern = r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}'
    
    emails = re.findall(email_pattern, text)
    phones = re.findall(phone_pattern, text)
    
    # Clean phone numbers
    cleaned_phones = []
    for phone in phones:
        # Remove common separators and keep digits and +
        cleaned = re.sub(r'[^\d+]', '', phone)
        if len(cleaned) >= 10:  # Basic validation
            cleaned_phones.append(cleaned)
    
    return {
        "email": emails[0] if emails else None,
        "phone": cleaned_phones[0] if cleaned_phones else None
    }

async def extract_name(text: str) -> str:
    """Extract candidate name from resume (simplified - first 2-3 words of first line)"""
    lines = text.split('\n')
    for line in lines[:5]:  # Check first 5 lines
        line = line.strip()
        if len(line) > 0 and len(line.split()) >= 2 and len(line.split()) <= 4:
            # Basic name validation - contains letters, not all caps, not too long
            if line.replace(' ', '').isalpha() or (line.replace(' ', '').isalnum() and len(line) < 50):
                return line
    return "Unknown Candidate"

