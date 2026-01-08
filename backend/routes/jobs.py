from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Body
from typing import List
from datetime import datetime
from bson import ObjectId

from database import get_db
from models import Job, JobCreate, JobStatus
from utils.ai_scoring import score_resume_with_llm
from routes.candidates import process_candidate_analysis

router = APIRouter()

@router.get("/", response_model=List[Job])
async def get_jobs():
    """Get all job posts"""
    db = get_db()
    jobs = []
    async for job in db.jobs.find().sort("created_at", -1):
        job["id"] = str(job["_id"])
        job["created_at"] = job.get("created_at", datetime.now())
        jobs.append(Job(**job))
    return jobs

@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: str):
    """Get a specific job"""
    db = get_db()
    try:
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid job ID")
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job["id"] = str(job["_id"])
    # Convert ObjectId fields to strings
    if "created_at" in job and job["created_at"]:
        pass  # Keep datetime as is
    return Job(**job)

@router.post("/", response_model=Job)
async def create_job(job: JobCreate):
    """Create a new job post"""
    db = get_db()
    
    # Validate weights sum to ~100
    total_weight = sum(c.weight for c in job.evaluation_criteria)
    if abs(total_weight - 100) > 5:  # Allow 5% tolerance
        raise HTTPException(
            status_code=400, 
            detail=f"Evaluation criteria weights should sum to approximately 100% (current: {total_weight}%)"
        )
    
    job_dict = job.dict()
    job_dict["created_at"] = datetime.now()
    job_dict["status"] = "active"
    job_dict["candidate_count"] = 0
    
    result = await db.jobs.insert_one(job_dict)
    job_dict["id"] = str(result.inserted_id)
    return Job(**job_dict)

@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a job post"""
    db = get_db()
    
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_title = job.get("title", "Unknown Job")
    
    result = await db.jobs.delete_one({"_id": ObjectId(job_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Also delete associated candidates
    await db.candidates.delete_many({"job_id": job_id})
    
    return {"message": "Job deleted successfully"}

@router.post("/{job_id}/run-analysis", response_model=dict)
async def run_ai_analysis(job_id: str, background_tasks: BackgroundTasks, force: bool = Query(False)):
    """Run AI analysis on all uploaded candidates for a job. Set force=True to re-analyze already analyzed candidates."""
    db = get_db()
    
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get all candidates that need analysis
    if force:
        # Re-analyze all candidates (including already analyzed ones)
        query = {"job_id": job_id}
    else:
        # Only analyze new/uploaded candidates
        query = {"job_id": job_id, "status": {"$in": ["uploaded", "analyzing"]}}
    
    candidates = []
    async for candidate in db.candidates.find(query):
        candidates.append(candidate)
    
    # Update job last_run
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {"last_run": datetime.now()}}
    )
    
    # Process candidates in background
    for candidate in candidates:
        background_tasks.add_task(process_candidate_analysis, job_id, str(candidate["_id"]))
    
    return {
        "message": f"Analysis started for {len(candidates)} candidates",
        "candidates_queued": len(candidates),
        "force": force
    }

@router.patch("/{job_id}/status", response_model=Job)
async def update_job_status(job_id: str, status: str = Body(..., embed=True)):
    """Update job status"""
    db = get_db()
    
    # Validate status
    if status not in ["active", "paused", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'active', 'paused', or 'closed'")
    
    try:
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid job ID")
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Update status
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {"status": status}}
    )
    
    # Fetch updated job
    updated_job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    updated_job["id"] = str(updated_job["_id"])
    
    return Job(**updated_job)
