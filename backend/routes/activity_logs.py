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
    try:
        db = get_db()
        if not db:
            print("ERROR: Database not initialized")
            return None
        
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
        print(f"✅ Activity log created: {activity_type.value} - {description}")
        return log_dict
    except Exception as e:
        print(f"❌ Error creating activity log: {e}")
        import traceback
        traceback.print_exc()
        return None

@router.get("/", response_model=List[ActivityLog])
async def get_activity_logs(
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0),
    activity_type: Optional[str] = None,
    job_id: Optional[str] = None
):
    """Get activity logs with optional filtering"""
    try:
        db = get_db()
        if not db:
            print("ERROR: Database not initialized in get_activity_logs")
            return []
        
        query = {}
        if activity_type:
            query["activity_type"] = activity_type
        if job_id:
            query["job_id"] = job_id
        
        logs = []
        async for log in db.activity_logs.find(query).sort("created_at", -1).skip(skip).limit(limit):
            try:
                log["id"] = str(log["_id"])
                logs.append(ActivityLog(**log))
            except Exception as e:
                print(f"Error processing log {log.get('_id')}: {e}")
                continue
        
        print(f"✅ Retrieved {len(logs)} activity logs (query: {query})")
        return logs
    except Exception as e:
        print(f"❌ Error fetching activity logs: {e}")
        import traceback
        traceback.print_exc()
        return []

@router.get("/test")
async def test_activity_log():
    """Test endpoint to create a sample activity log"""
    try:
        test_log = await create_activity_log(
            activity_type=ActivityType.job_created,
            description="Test activity log - system is working",
            metadata={"test": True}
        )
        return {"message": "Test log created successfully", "log": test_log}
    except Exception as e:
        return {"error": str(e), "message": "Failed to create test log"}
