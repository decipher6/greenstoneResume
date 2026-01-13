from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import csv
from io import StringIO
import re

from database import get_db
from models import CCATResult, PersonalityResult, PersonalityTraits
from utils.cv_parser import parse_pdf
from routes.activity_logs import log_activity
from routes.auth import get_current_user_id

router = APIRouter()

@router.post("/candidate/{candidate_id}/upload")
async def upload_candidate_assessments(
    candidate_id: str,
    file: UploadFile = File(...),
    user_id: Optional[str] = Depends(get_current_user_id)
):
    """Upload combined CCAT and Personality test results for a specific candidate (CSV or PDF)"""
    db = get_db()
    
    # Verify candidate exists
    try:
        candidate = await db.candidates.find_one({"_id": ObjectId(candidate_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid candidate ID")
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    content = await file.read()
    file_ext = file.filename.lower().split('.')[-1] if file.filename else ""
    
    ccat_uploaded = False
    personality_uploaded = False
    
    if file_ext == "pdf":
        # Parse PDF assessment results
        try:
            pdf_text = await parse_pdf(content)
            
            # Extract CCAT scores
            ccat_percentile = None
            ccat_raw_score = None
            
            # Look for CCAT patterns
            ccat_patterns = [
                r"CCAT[:\s]+Percentile[:\s]+(\d+\.?\d*)",
                r"Percentile[:\s]+(\d+\.?\d*)",
                r"CCAT[:\s]+Score[:\s]+(\d+\.?\d*)",
            ]
            for pattern in ccat_patterns:
                match = re.search(pattern, pdf_text, re.IGNORECASE)
                if match:
                    ccat_percentile = float(match.group(1))
                    break
            
            # Extract personality traits
            traits = {}
            trait_names = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]
            for trait in trait_names:
                patterns = [
                    rf"{trait.capitalize()}[:\s]+(\d+\.?\d*)",
                    rf"{trait.capitalize()}\s+Score[:\s]+(\d+\.?\d*)",
                    rf"{trait}[:\s]+(\d+\.?\d*)",
                ]
                for pattern in patterns:
                    match = re.search(pattern, pdf_text, re.IGNORECASE)
                    if match:
                        traits[trait] = float(match.group(1))
                        break
                if trait not in traits:
                    traits[trait] = 0.0
            
            # Store CCAT result if found
            if ccat_percentile is not None:
                # Delete existing CCAT result for this candidate
                await db.ccat_results.delete_many({"candidate_id": candidate_id})
                
                ccat_result = {
                    "candidate_id": candidate_id,
                    "percentile": ccat_percentile,
                    "raw_score": ccat_raw_score,
                    "created_at": datetime.now()
                }
                await db.ccat_results.insert_one(ccat_result)
                ccat_uploaded = True
            
            # Store personality result if found
            if any(traits.values()):
                # Delete existing personality result for this candidate
                await db.personality_results.delete_many({"candidate_id": candidate_id})
                
                personality_traits = PersonalityTraits(
                    openness=traits.get("openness", 0.0),
                    conscientiousness=traits.get("conscientiousness", 0.0),
                    extraversion=traits.get("extraversion", 0.0),
                    agreeableness=traits.get("agreeableness", 0.0),
                    neuroticism=traits.get("neuroticism", 0.0)
                )
                
                personality_result = {
                    "candidate_id": candidate_id,
                    "traits": personality_traits.dict(),
                    "created_at": datetime.now()
                }
                await db.personality_results.insert_one(personality_result)
                personality_uploaded = True
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error parsing PDF: {str(e)}")
    
    else:
        # Parse CSV assessment results
        try:
            csv_content = content.decode('utf-8')
            reader = csv.DictReader(StringIO(csv_content))
            
            # Read first row (since it's for a specific candidate)
            row = next(reader, None)
            if not row:
                raise HTTPException(status_code=400, detail="CSV file is empty")
            
            # Extract CCAT data
            if "percentile" in row or "ccat_percentile" in row:
                ccat_percentile = float(row.get("percentile") or row.get("ccat_percentile") or 0)
                ccat_raw_score = float(row.get("raw_score") or row.get("ccat_raw_score") or 0) if row.get("raw_score") or row.get("ccat_raw_score") else None
                
                # Delete existing CCAT result
                await db.ccat_results.delete_many({"candidate_id": candidate_id})
                
                ccat_result = {
                    "candidate_id": candidate_id,
                    "percentile": ccat_percentile,
                    "raw_score": ccat_raw_score,
                    "created_at": datetime.now()
                }
                await db.ccat_results.insert_one(ccat_result)
                ccat_uploaded = True
            
            # Extract personality data
            if any(key in row for key in ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]):
                personality_traits = PersonalityTraits(
                    openness=float(row.get("openness", 0)),
                    conscientiousness=float(row.get("conscientiousness", 0)),
                    extraversion=float(row.get("extraversion", 0)),
                    agreeableness=float(row.get("agreeableness", 0)),
                    neuroticism=float(row.get("neuroticism", 0))
                )
                
                # Delete existing personality result
                await db.personality_results.delete_many({"candidate_id": candidate_id})
                
                personality_result = {
                    "candidate_id": candidate_id,
                    "traits": personality_traits.dict(),
                    "created_at": datetime.now()
                }
                await db.personality_results.insert_one(personality_result)
                personality_uploaded = True
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")
    
    # Update candidate score breakdown
    existing_breakdown = candidate.get("score_breakdown", {}) or {}
    
    if ccat_uploaded:
        ccat_result = await db.ccat_results.find_one({"candidate_id": candidate_id})
        if ccat_result:
            existing_breakdown["ccat_score"] = ccat_result.get("percentile", 0) / 10.0
    
    if personality_uploaded:
        personality_result = await db.personality_results.find_one({"candidate_id": candidate_id})
        if personality_result:
            traits = personality_result.get("traits", {})
            personality_score = (
                traits.get("openness", 0) +
                traits.get("conscientiousness", 0) +
                traits.get("extraversion", 0) +
                traits.get("agreeableness", 0) +
                (10 - traits.get("neuroticism", 5))
            ) / 5.0
            existing_breakdown["personality_score"] = personality_score
            existing_breakdown["personality_profile"] = traits
    
    # Overall score = resume_score only (CCAT is separate, not included)
    # If resume_score doesn't exist, keep existing overall_score
    if "resume_score" in existing_breakdown:
        existing_breakdown["overall_score"] = existing_breakdown["resume_score"]
    # If no resume_score, overall_score remains unchanged
    
    await db.candidates.update_one(
        {"_id": ObjectId(candidate_id)},
        {"$set": {"score_breakdown": existing_breakdown}}
    )
    
    # Log activity
    assessment_types = []
    if ccat_uploaded:
        assessment_types.append("CCAT")
    if personality_uploaded:
        assessment_types.append("Personality")
    
    if assessment_types:
        await log_activity(
            action="assessment_uploaded",
            entity_type="assessment",
            description=f"Uploaded {', '.join(assessment_types)} assessment(s) for candidate: {candidate.get('name', 'Unknown')}",
            entity_id=candidate_id,
            user_id=user_id,
            metadata={
                "ccat_uploaded": ccat_uploaded,
                "personality_uploaded": personality_uploaded,
                "job_id": candidate.get("job_id")
            }
        )
    
    return {
        "message": "Assessment results uploaded successfully",
        "ccat_uploaded": ccat_uploaded,
        "personality_uploaded": personality_uploaded
    }

