import os
import json
import re
from typing import Dict, List, Optional
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

async def check_location_match(candidate_location: Optional[str], job_regions: List[str]) -> Dict[str, str]:
    """
    Check if candidate location matches job regions using LLM.
    Returns: {"status": "match"|"mismatch"|"uncertain", "reason": "brief explanation"}
    """
    try:
        # Handle missing data
        if not candidate_location:
            return {"status": "uncertain", "reason": "Candidate location not available"}
        
        if not job_regions or len(job_regions) == 0:
            return {"status": "uncertain", "reason": "Job regions not specified"}
        
        # Filter out "All" from job regions
        filtered_regions = [r for r in job_regions if r and str(r).strip().lower() != "all"]
        if not filtered_regions:
            return {"status": "match", "reason": "Job accepts candidates from all regions"}
        
        # Clean candidate location
        candidate_location = str(candidate_location).strip()
        if not candidate_location or candidate_location.lower() in ["unknown", "n/a", "none", "null", ""]:
            return {"status": "uncertain", "reason": "Candidate location not specified"}
        
        # Simple, direct prompt
        prompt = f"""Compare these locations and determine if they match:

Candidate Location: {candidate_location}
Job Regions: {', '.join(filtered_regions)}

Regional groupings:
- GCC: UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman (cities: Dubai, Abu Dhabi, Riyadh, Doha, etc.)
- APAC: Asia-Pacific (cities: Singapore, Hong Kong, Tokyo, Sydney, Mumbai, Shanghai, etc.)
- EMEA: Europe, Middle East, Africa (cities: London, Paris, Frankfurt, Dubai, Johannesburg, etc.)
- LATAM: Latin America (cities: Mexico City, São Paulo, Buenos Aires, Bogotá, etc.)
- NA: North America (cities: New York, Toronto, Los Angeles, Chicago, etc.)

Return ONLY valid JSON (no markdown, no explanations):
{{
    "status": "match" or "mismatch" or "uncertain",
    "reason": "Brief one-sentence explanation"
}}"""

        if DEBUG:
            print(f"DEBUG: Checking location match - Candidate: '{candidate_location}', Job Regions: {filtered_regions}")
        
        # Call LLM
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model="gemini-3-flash-preview",
            contents=prompt
        )
        
        if not response or not response.text:
            if DEBUG:
                print("DEBUG: Empty response from LLM")
            return {"status": "uncertain", "reason": "Unable to determine location match"}
        
        content = response.text.strip()
        
        if DEBUG:
            print(f"DEBUG: LLM response: {content[:500]}")
        
        # Extract JSON
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)
        
        # Remove markdown
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        # Parse JSON
        result = json.loads(content)
        status = str(result.get("status", "uncertain")).lower().strip()
        
        # Validate status
        if status not in ["match", "mismatch", "uncertain"]:
            if DEBUG:
                print(f"DEBUG: Invalid status '{status}', defaulting to 'uncertain'")
            status = "uncertain"
        
        reason = str(result.get("reason", "Location comparison completed")).strip()
        if not reason:
            reason = "Location comparison completed"
        
        result_dict = {
            "status": status,
            "reason": reason[:200]
        }
        
        if DEBUG:
            print(f"DEBUG: Location match result: {result_dict}")
        
        return result_dict
        
    except json.JSONDecodeError as e:
        if DEBUG:
            print(f"DEBUG: JSON decode error: {e}")
            print(f"DEBUG: Content: {content[:500] if 'content' in locals() else 'N/A'}")
        return {"status": "uncertain", "reason": "Unable to parse location match result"}
    except Exception as e:
        if DEBUG:
            print(f"DEBUG: Error in location match: {e}")
            import traceback
            traceback.print_exc()
        return {"status": "uncertain", "reason": f"Error: {str(e)[:100]}"}
