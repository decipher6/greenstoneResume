from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import csv
from io import StringIO
import re

from database import get_db
from models import CCATResult, PersonalityResult, PersonalityTraits
from utils.cv_parser import parse_pdf

router = APIRouter()

@router.post("/candidate/{candidate_id}/upload")
async def upload_candidate_assessments(
    candidate_id: str,
    file: UploadFile = File(...)
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
    
    return {
        "message": "Assessment results uploaded successfully",
        "ccat_uploaded": ccat_uploaded,
        "personality_uploaded": personality_uploaded
    }

@router.post("/ccat/upload")
async def upload_ccat_results(
    job_id: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload CCAT results from CSV"""
    db = get_db()
    
    # Verify job exists
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    content = await file.read()
    csv_content = content.decode('utf-8')
    reader = csv.DictReader(StringIO(csv_content))
    
    uploaded_count = 0
    
    for row in reader:
        try:
            candidate_name = row.get("name", "").strip()
            candidate_phone = row.get("phone", "").strip()
            percentile = float(row.get("percentile", 0))
            raw_score = float(row.get("raw_score", 0)) if row.get("raw_score") else None
            
            # Find candidate by name and phone
            candidate = await db.candidates.find_one({
                "job_id": job_id,
                "name": {"$regex": candidate_name, "$options": "i"},
                "contact_info.phone": {"$regex": candidate_phone, "$options": "i"}
            })
            
            if candidate:
                # Store CCAT result
                ccat_result = {
                    "candidate_id": str(candidate["_id"]),
                    "percentile": percentile,
                    "raw_score": raw_score,
                    "created_at": datetime.now()
                }
                
                await db.ccat_results.insert_one(ccat_result)
                
                # Update candidate score breakdown
                candidate_score = percentile / 10.0  # Convert percentile to 0-10 scale
                
                existing_breakdown = candidate.get("score_breakdown", {}) or {}
                existing_breakdown["ccat_score"] = candidate_score
                
                # Overall score = resume_score only (CCAT is separate, not included)
                if "resume_score" in existing_breakdown:
                    existing_breakdown["overall_score"] = existing_breakdown["resume_score"]
                
                await db.candidates.update_one(
                    {"_id": candidate["_id"]},
                    {"$set": {"score_breakdown": existing_breakdown}}
                )
                
                uploaded_count += 1
                
        except Exception as e:
            print(f"Error processing CCAT row: {e}")
            continue
    
    return {"message": f"Uploaded {uploaded_count} CCAT results", "count": uploaded_count}

@router.post("/personality/upload")
async def upload_personality_results(
    job_id: str = Form(...),
    file: UploadFile = File(...)
):
    """Upload personality test results from CSV or PDF"""
    db = get_db()
    
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    content = await file.read()
    file_ext = file.filename.lower().split('.')[-1] if file.filename else ""
    
    uploaded_count = 0
    
    if file_ext == "pdf":
        # Parse PDF personality test results
        try:
            pdf_text = await parse_pdf(content)
            # Extract personality scores from PDF text using regex
            # This is a basic implementation - adjust patterns based on your PDF format
            traits = {}
            
            # Look for patterns like "Openness: 7.5" or "Openness Score: 8"
            trait_names = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]
            for trait in trait_names:
                # Try multiple patterns
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
            
            # Try to extract candidate name from PDF
            # Look for common patterns
            name_patterns = [
                r"Name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
                r"Candidate[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
            ]
            candidate_name = None
            for pattern in name_patterns:
                match = re.search(pattern, pdf_text, re.IGNORECASE)
                if match:
                    candidate_name = match.group(1).strip()
                    break
            
            if not candidate_name:
                raise HTTPException(status_code=400, detail="Could not extract candidate name from PDF. Please ensure the PDF contains the candidate's name.")
            
            # Find candidate by name (fuzzy match)
            candidate = await db.candidates.find_one({
                "job_id": job_id,
                "name": {"$regex": candidate_name.split()[0] if candidate_name else "", "$options": "i"}
            })
            
            if not candidate:
                raise HTTPException(status_code=404, detail=f"Candidate '{candidate_name}' not found for this job")
            
            personality_traits = PersonalityTraits(
                openness=traits.get("openness", 0.0),
                conscientiousness=traits.get("conscientiousness", 0.0),
                extraversion=traits.get("extraversion", 0.0),
                agreeableness=traits.get("agreeableness", 0.0),
                neuroticism=traits.get("neuroticism", 0.0)
            )
            
            # Store personality result
            personality_result = {
                "candidate_id": str(candidate["_id"]),
                "traits": personality_traits.dict(),
                "created_at": datetime.now()
            }
            
            await db.personality_results.insert_one(personality_result)
            
            # Calculate personality score
            personality_score = (
                personality_traits.openness + 
                personality_traits.conscientiousness + 
                personality_traits.extraversion + 
                personality_traits.agreeableness + 
                (10 - personality_traits.neuroticism)
            ) / 5.0
            
            # Update candidate
            existing_breakdown = candidate.get("score_breakdown", {}) or {}
            existing_breakdown["personality_score"] = personality_score
            
            # Overall score = resume_score only (CCAT is separate, not included)
            if "resume_score" in existing_breakdown:
                existing_breakdown["overall_score"] = existing_breakdown["resume_score"]
            
            await db.candidates.update_one(
                {"_id": candidate["_id"]},
                {
                    "$set": {
                        "score_breakdown": existing_breakdown,
                        "personality_profile": personality_traits.dict()
                    }
                }
            )
            
            uploaded_count = 1
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error parsing personality PDF: {str(e)}")
    
    else:
        # Parse CSV personality test results
        try:
            csv_content = content.decode('utf-8')
            reader = csv.DictReader(StringIO(csv_content))
            
            for row in reader:
                try:
                    candidate_name = row.get("name", "").strip()
                    candidate_phone = row.get("phone", "").strip()
                    
                    # Find candidate
                    candidate = await db.candidates.find_one({
                        "job_id": job_id,
                        "name": {"$regex": candidate_name, "$options": "i"},
                        "contact_info.phone": {"$regex": candidate_phone, "$options": "i"}
                    })
                    
                    if candidate:
                        traits = PersonalityTraits(
                            openness=float(row.get("openness", 0)),
                            conscientiousness=float(row.get("conscientiousness", 0)),
                            extraversion=float(row.get("extraversion", 0)),
                            agreeableness=float(row.get("agreeableness", 0)),
                            neuroticism=float(row.get("neuroticism", 0))
                        )
                        
                        # Store personality result
                        personality_result = {
                            "candidate_id": str(candidate["_id"]),
                            "traits": traits.dict(),
                            "created_at": datetime.now()
                        }
                        
                        await db.personality_results.insert_one(personality_result)
                        
                        # Calculate personality score
                        personality_score = (
                            traits.openness + 
                            traits.conscientiousness + 
                            traits.extraversion + 
                            traits.agreeableness + 
                            (10 - traits.neuroticism)
                        ) / 5.0
                        
                        # Update candidate
                        existing_breakdown = candidate.get("score_breakdown", {}) or {}
                        existing_breakdown["personality_score"] = personality_score
                        
                        # Overall score = resume_score only (CCAT is separate, not included)
                        if "resume_score" in existing_breakdown:
                            existing_breakdown["overall_score"] = existing_breakdown["resume_score"]
                        
                        await db.candidates.update_one(
                            {"_id": candidate["_id"]},
                            {
                                "$set": {
                                    "score_breakdown": existing_breakdown,
                                    "personality_profile": traits.dict()
                                }
                            }
                        )
                        
                        uploaded_count += 1
                        
                except Exception as e:
                    print(f"Error processing personality row: {e}")
                    continue
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error parsing CSV: {str(e)}")
    
    return {"message": f"Uploaded {uploaded_count} personality results", "count": uploaded_count}

