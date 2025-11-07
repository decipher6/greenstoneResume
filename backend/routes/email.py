from fastapi import APIRouter, HTTPException, Body
from typing import List
from bson import ObjectId
from database import get_db
from models import EmailSend

router = APIRouter()

@router.post("/send")
async def send_emails(email_data: EmailSend):
    """Send emails to candidates (mock implementation)"""
    db = get_db()
    
    # Verify job exists
    job = await db.jobs.find_one({"_id": ObjectId(email_data.job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    sent_count = 0
    candidates_emailed = []
    
    for candidate_id in email_data.candidate_ids:
        candidate = await db.candidates.find_one({"_id": ObjectId(candidate_id)})
        if not candidate:
            continue
        
        # Replace placeholders in email template
        candidate_name = candidate.get("name", "Candidate")
        job_title = job.get("title", "Position")
        
        subject = email_data.template.subject.replace("[Job Title]", job_title)
        body = email_data.template.body.replace("[Candidate Name]", candidate_name)
        body = body.replace("[Job Title]", job_title)
        
        # In production, this would send actual emails
        # For now, we'll just log and update status
        print(f"Email to {candidate.get('contact_info', {}).get('email')}: {subject}")
        
        # Update candidate status if rejection email
        if email_data.template.template_type == "rejection":
            await db.candidates.update_one(
                {"_id": ObjectId(candidate_id)},
                {"$set": {"status": "rejected"}}
            )
        
        candidates_emailed.append({
            "candidate_id": candidate_id,
            "email": candidate.get("contact_info", {}).get("email"),
            "subject": subject
        })
        sent_count += 1
    
    return {
        "message": f"Emails sent to {sent_count} candidates",
        "sent_count": sent_count,
        "candidates": candidates_emailed
    }

