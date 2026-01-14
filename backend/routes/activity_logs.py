from fastapi import APIRouter, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from database import get_db
from models import ActivityLog

router = APIRouter()

# Automatic cleanup task - delete logs older than 30 days
async def cleanup_old_logs():
    """Delete activity logs older than 30 days"""
    db = get_db()
    cutoff_date = datetime.now() - timedelta(days=30)
    try:
        result = await db.activity_logs.delete_many({"created_at": {"$lt": cutoff_date}})
        if result.deleted_count > 0:
            print(f"Cleaned up {result.deleted_count} old activity logs")
    except Exception as e:
        print(f"Warning: Failed to cleanup old logs: {e}")

# Helper function to create activity logs
async def log_activity(
    action: str,
    entity_type: str,
    description: str,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    metadata: Optional[dict] = None
):
    """Helper function to create activity log entries"""
    db = get_db()
    log_dict = {
        "action": action,
        "entity_type": entity_type,
        "description": description,
        "entity_id": entity_id,
        "user_id": user_id,
        "metadata": metadata or {},
        "created_at": datetime.now()
    }
    try:
        await db.activity_logs.insert_one(log_dict)
    except Exception as e:
        # Don't fail the main operation if logging fails
        print(f"Warning: Failed to log activity: {e}")

@router.get("/", response_model=List[ActivityLog])
async def get_activity_logs(
    limit: int = Query(30, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type (entity_type)"),
    user_id: Optional[str] = Query(None, description="Filter by user ID")
):
    """Get activity logs with filtering and pagination (30 logs per page)"""
    # Run cleanup before fetching logs
    await cleanup_old_logs()
    
    db = get_db()
    
    # Build query filter
    query = {}
    
    # Date range filter
    if start_date or end_date:
        date_filter = {}
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                date_filter["$gte"] = start_dt
            except ValueError:
                pass
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                # Include the entire end date
                end_dt = end_dt.replace(hour=23, minute=59, second=59)
                date_filter["$lte"] = end_dt
            except ValueError:
                pass
        if date_filter:
            query["created_at"] = date_filter
    
    # Activity type filter
    if activity_type:
        query["entity_type"] = activity_type
    
    # User filter
    if user_id:
        try:
            query["user_id"] = ObjectId(user_id)
        except:
            query["user_id"] = user_id
    
    logs = []
    async for log in db.activity_logs.find(query).sort("created_at", -1).skip(skip).limit(limit):
        log["id"] = str(log["_id"])
        if "created_at" not in log:
            log["created_at"] = datetime.now()
        
        # Fetch user name if user_id exists
        if log.get("user_id"):
            try:
                user = await db.users.find_one({"_id": ObjectId(log["user_id"])})
                if user:
                    log["user_name"] = user.get("name", "Unknown User")
                else:
                    log["user_name"] = "Unknown User"
            except:
                log["user_name"] = "Unknown User"
        else:
            log["user_name"] = None
        
        logs.append(ActivityLog(**log))
    return logs

@router.get("/count")
async def get_activity_logs_count(
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type (entity_type)"),
    user_id: Optional[str] = Query(None, description="Filter by user ID")
):
    """Get total count of activity logs matching filters"""
    db = get_db()
    
    # Build query filter (same as get_activity_logs)
    query = {}
    
    if start_date or end_date:
        date_filter = {}
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                date_filter["$gte"] = start_dt
            except ValueError:
                pass
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                end_dt = end_dt.replace(hour=23, minute=59, second=59)
                date_filter["$lte"] = end_dt
            except ValueError:
                pass
        if date_filter:
            query["created_at"] = date_filter
    
    if activity_type:
        query["entity_type"] = activity_type
    
    if user_id:
        try:
            query["user_id"] = ObjectId(user_id)
        except:
            query["user_id"] = user_id
    
    count = await db.activity_logs.count_documents(query)
    return {"count": count}

@router.get("/types")
async def get_activity_types():
    """Get list of all unique activity types"""
    db = get_db()
    types = await db.activity_logs.distinct("entity_type")
    return {"types": sorted(types)}

@router.get("/users")
async def get_activity_users():
    """Get list of all users who have activity logs"""
    db = get_db()
    user_ids = await db.activity_logs.distinct("user_id")
    users = []
    for user_id in user_ids:
        if user_id:
            try:
                user = await db.users.find_one({"_id": ObjectId(user_id)})
                if user:
                    users.append({
                        "id": str(user["_id"]),
                        "name": user.get("name", "Unknown User")
                    })
            except:
                pass
    return {"users": users}

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
