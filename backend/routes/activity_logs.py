from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from database import get_db
from models import ActivityLog, ActivityType

router = APIRouter()

async def create_activity_log(
    activity_type: ActivityType,
    description: str,
    job_id: Optional[str] = None,
    job_title: Optional[str] = None,
    candidate_id: Optional[str] = None,
    candidate_name: Optional[str] = None,
    metadata: Optional[dict] = None
):
    """Helper function to create an activity log entry"""
    db = get_db()
    log_dict = {
        "activity_type": activity_type.value,
        "description": description,
        "job_id": job_id,
        "job_title": job_title,
        "candidate_id": candidate_id,
        "candidate_name": candidate_name,
        "metadata": metadata or {},
        "created_at": datetime.now()
    }
    result = await db.activity_logs.insert_one(log_dict)
    log_dict["id"] = str(result.inserted_id)
    return log_dict

@router.get("/", response_model=List[ActivityLog])
async def get_activity_logs(
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    activity_type: Optional[str] = None,
    job_id: Optional[str] = None
):
    """Get activity logs with optional filtering"""
    db = get_db()
    
    query = {}
    if activity_type:
        query["activity_type"] = activity_type
    if job_id:
        query["job_id"] = job_id
    
    logs = []
    async for log in db.activity_logs.find(query).sort("created_at", -1).skip(skip).limit(limit):
        log["id"] = str(log["_id"])
        logs.append(ActivityLog(**log))
    
    return logs
