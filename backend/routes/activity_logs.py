from fastapi import APIRouter, Query
from typing import List
from datetime import datetime

from database import get_db
from models import ActivityLog

router = APIRouter()

@router.get("/", response_model=List[ActivityLog])
async def get_activity_logs(
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0)
):
    """Get activity logs, ordered by most recent first"""
    db = get_db()
    logs = []
    async for log in db.activity_logs.find().sort("created_at", -1).skip(skip).limit(limit):
        log["id"] = str(log["_id"])
        if "created_at" not in log:
            log["created_at"] = datetime.now()
        logs.append(ActivityLog(**log))
    return logs

@router.post("/", response_model=ActivityLog)
async def create_activity_log(log: ActivityLog):
    """Create a new activity log entry"""
    db = get_db()
    
    log_dict = log.dict(exclude={"id"})
    if not log_dict.get("created_at"):
        log_dict["created_at"] = datetime.now()
    
    result = await db.activity_logs.insert_one(log_dict)
    log_dict["id"] = str(result.inserted_id)
    return ActivityLog(**log_dict)
