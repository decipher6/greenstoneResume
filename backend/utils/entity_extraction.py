import re
from typing import Dict, Optional

async def extract_contact_info(text: str) -> Dict[str, Optional[str]]:
    """Extract email and phone from resume text"""
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    # More flexible phone pattern to handle various formats:
    # +33 6 31 23 36 43, (+971) 52-719-3918, +971 58 225 5450, +971 52 532 3344, etc.
    # Pattern matches: optional +, optional parentheses around country code, 
    # then multiple groups of digits (1-6 digits each) separated by spaces, dashes, dots, or parentheses
    phone_pattern = r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,6}(?:[-\s\.\(\)]?[0-9]{1,6}){2,8}'
    
    emails = re.findall(email_pattern, text)
    phones = re.findall(phone_pattern, text)
    
    # Clean phone numbers
    cleaned_phones = []
    for phone in phones:
        # Remove common separators and keep digits and +
        cleaned = re.sub(r'[^\d+]', '', phone)
        if len(cleaned) >= 7:  # Minimum 7 digits (reduced from 10 for international numbers)
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
    
    # If no name found, return first 2 words of the text
    words = text.split()
    if len(words) >= 2:
        return ' '.join(words[:2])
    elif len(words) == 1:
        return words[0]
    return "Unknown Candidate"

