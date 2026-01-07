from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from typing import List
from datetime import datetime
from bson import ObjectId

from database import get_db
from models import Job, JobCreate, JobStatus, ActivityType
from utils.ai_scoring import score_resume_with_llm
from routes.candidates import process_candidate_analysis
from routes.activity_logs import create_activity_log

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
    
    # Log activity (don't fail if logging fails)
    try:
        await create_activity_log(
            activity_type=ActivityType.job_created,
            description=f"Job post '{job.title}' created in {job.department} department",
            job_id=job_dict["id"],
            job_title=job.title,
            metadata={"department": job.department}
        )
    except Exception as e:
        print(f"Warning: Failed to log activity for job creation: {e}")
    
    return Job(**job_dict)

@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a job post"""
    db = get_db()
    
    # Get job info before deleting for activity log
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_title = job.get("title", "Unknown Job")
    
    result = await db.jobs.delete_one({"_id": ObjectId(job_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Also delete associated candidates
    deleted_count = await db.candidates.count_documents({"job_id": job_id})
    await db.candidates.delete_many({"job_id": job_id})
    
    # Log activity (don't fail if logging fails)
    try:
        await create_activity_log(
            activity_type=ActivityType.job_deleted,
            description=f"Job post '{job_title}' deleted",
            job_id=job_id,
            job_title=job_title,
            metadata={"candidates_deleted": deleted_count}
        )
    except Exception as e:
        print(f"Warning: Failed to log activity for job deletion: {e}")
    
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
    
    # Log activity (don't fail if logging fails)
    try:
        await create_activity_log(
            activity_type=ActivityType.analysis_run,
            description=f"AI analysis started for {len(candidates)} candidates",
            job_id=job_id,
            job_title=job.get("title"),
            metadata={"candidates_count": len(candidates), "force": force}
        )
    except Exception as e:
        print(f"Warning: Failed to log activity for analysis run: {e}")
    
    return {
        "message": f"Analysis started for {len(candidates)} candidates",
        "candidates_queued": len(candidates),
        "force": force
    }

