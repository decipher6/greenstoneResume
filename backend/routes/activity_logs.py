from fastapi import APIRouter, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from database import get_db, get_client

router = APIRouter()

def parse_oplog_entry(oplog_entry):
    """Parse oplog entry into a simple activity log format"""
    op = oplog_entry.get('op', '')  # i=insert, u=update, d=delete
    ns = oplog_entry.get('ns', '')  # namespace (database.collection)
    ts = oplog_entry.get('ts', None)
    o = oplog_entry.get('o', {})  # document
    
    # Determine activity type
    activity_type = 'unknown'
    description = ''
    
    if 'jobs' in ns:
        if op == 'i':
            activity_type = 'job_created'
            description = f"Job created: {o.get('title', 'Unknown')}"
        elif op == 'd':
            activity_type = 'job_deleted'
            description = f"Job deleted"
    elif 'candidates' in ns:
        if op == 'i':
            activity_type = 'candidate_uploaded'
            description = f"Resume uploaded: {o.get('name', 'Unknown')}"
        elif op == 'd':
            activity_type = 'candidate_deleted'
            description = f"Candidate deleted"
        elif op == 'u':
            activity_type = 'candidate_analyzed'
            description = f"Candidate updated: {o.get('name', 'Unknown')}"
    
    # Convert timestamp
    created_at = None
    if ts:
        try:
            # MongoDB timestamp can be Timestamp object or tuple
            if hasattr(ts, 'time'):
                # Timestamp object
                created_at = datetime.fromtimestamp(ts.time)
            elif isinstance(ts, tuple) and len(ts) >= 1:
                # Tuple format (seconds, increment)
                created_at = datetime.fromtimestamp(ts[0])
            elif isinstance(ts, (int, float)):
                # Unix timestamp
                created_at = datetime.fromtimestamp(ts)
            else:
                created_at = datetime.now()
        except:
            created_at = datetime.now()
    else:
        created_at = datetime.now()
    
    return {
        "id": str(oplog_entry.get('_id', ObjectId())),
        "activity_type": activity_type,
        "description": description,
        "job_id": o.get('job_id'),
        "job_title": o.get('title'),
        "candidate_id": str(o.get('_id', '')) if 'candidates' in ns else None,
        "candidate_name": o.get('name'),
        "metadata": {"operation": op, "namespace": ns},
        "created_at": created_at.isoformat() if created_at else datetime.now().isoformat()
    }

@router.get("/")
async def get_activity_logs(
    limit: int = Query(30, ge=1, le=500),
    skip: int = Query(0, ge=0)
):
    """Get activity logs from MongoDB oplog - basic version"""
    try:
        client = get_client()
        if not client:
            return []
        
        # Access oplog from local database
        local_db = client.local
        oplog = local_db.oplog.rs
        
        logs = []
        count = 0
        
        # Read from oplog in reverse order (newest first)
        async for entry in oplog.find().sort("ts", -1).skip(skip).limit(limit):
            # Only include operations on our collections
            ns = entry.get('ns', '')
            if 'greenstone_talent' in ns or 'jobs' in ns or 'candidates' in ns:
                parsed = parse_oplog_entry(entry)
                logs.append(parsed)
                count += 1
                if count >= limit:
                    break
        
        return logs
    except Exception as e:
        print(f"❌ Error reading oplog: {e}")
        # Fallback: return empty list
        return []

@router.get("/count")
async def get_activity_logs_count():
    """Get total count from oplog"""
    try:
        client = get_client()
        if not client:
            return {"count": 0}
        
        local_db = client.local
        oplog = local_db.oplog.rs
        
        # Count operations on our collections
        count = 0
        async for entry in oplog.find().sort("ts", -1).limit(1000):
            ns = entry.get('ns', '')
            if 'greenstone_talent' in ns or 'jobs' in ns or 'candidates' in ns:
                count += 1
        
        return {"count": count}
    except Exception as e:
        print(f"❌ Error counting oplog: {e}")
        return {"count": 0}
