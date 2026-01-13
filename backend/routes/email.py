from fastapi import APIRouter, HTTPException, Body, Depends
from typing import List, Optional
from bson import ObjectId
from database import get_db
from models import EmailSend
from routes.activity_logs import log_activity
from routes.auth import get_current_user_id
from utils.resend_sender import resend_sender
import logging
import urllib.parse
import os

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/send")
async def send_emails(email_data: EmailSend, user_id: Optional[str] = Depends(get_current_user_id)):
    """Send rejection emails to candidates using Resend API"""
    db = get_db()
    
    # Only allow rejection emails through this endpoint
    if email_data.template.template_type != "rejection":
        raise HTTPException(
            status_code=400,
            detail="This endpoint only handles rejection emails. Use /email/interview-links for interview invitations."
        )
    
    # Verify job exists
    job = await db.jobs.find_one({"_id": ObjectId(email_data.job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if Resend is configured
    if not resend_sender.is_configured():
        raise HTTPException(
            status_code=500,
            detail="Email service is not configured. Please set RESEND_API_KEY environment variable."
        )
    
    sent_count = 0
    failed_count = 0
    candidates_emailed = []
    candidates_failed = []
    
    for candidate_id in email_data.candidate_ids:
        candidate = await db.candidates.find_one({"_id": ObjectId(candidate_id)})
        if not candidate:
            continue
        
        candidate_email = candidate.get("contact_info", {}).get("email")
        if not candidate_email:
            logger.warning(f"Candidate {candidate_id} has no email address")
            failed_count += 1
            candidates_failed.append({
                "candidate_id": candidate_id,
                "email": None,
                "error": "No email address"
            })
            continue
        
        # Replace placeholders in email template
        candidate_name = candidate.get("name", "Candidate")
        job_title = job.get("title", "Position")
        
        subject = email_data.template.subject.replace("[Job Title]", job_title)
        body = email_data.template.body.replace("[Candidate Name]", candidate_name)
        body = body.replace("[Job Title]", job_title)
        
        # Send email using Resend
        success, error_msg = await resend_sender.send_email_with_error(
            to_email=candidate_email,
            subject=subject,
            body=body,
            is_html=False
        )
        
        if success:
            # Update candidate status to rejected
            await db.candidates.update_one(
                {"_id": ObjectId(candidate_id)},
                {"$set": {"status": "rejected"}}
            )
            
            candidates_emailed.append({
                "candidate_id": candidate_id,
                "email": candidate_email,
                "subject": subject
            })
            sent_count += 1
        else:
            failed_count += 1
            candidates_failed.append({
                "candidate_id": candidate_id,
                "email": candidate_email,
                "error": error_msg or "Failed to send email"
            })
            logger.error(f"Failed to send email to {candidate_email}: {error_msg}")
    
    # Log activity
    await log_activity(
        action="email_sent",
        entity_type="email",
        description=f"Sent {sent_count} rejection email(s) for job: {job.get('title', 'Unknown')}",
        entity_id=email_data.job_id,
        user_id=user_id,
        metadata={
            "candidate_count": sent_count,
            "failed_count": failed_count,
            "template_type": email_data.template.template_type,
            "candidate_ids": email_data.candidate_ids
        }
    )
    
    message = f"Successfully sent {sent_count} email(s)"
    if failed_count > 0:
        message += f", {failed_count} failed"
    
    return {
        "message": message,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "candidates": candidates_emailed,
        "failed": candidates_failed if candidates_failed else None
    }

@router.post("/interview-links")
async def get_interview_mailto_links(
    job_id: str = Body(...),
    candidate_ids: List[str] = Body(...),
    template: dict = Body(...),
    user_id: Optional[str] = Depends(get_current_user_id)
):
    """Generate mailto links for interview invitations"""
    db = get_db()
    
    # Verify job exists
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job_title = job.get("title", "Position")
    mailto_links = []
    
    for candidate_id in candidate_ids:
        candidate = await db.candidates.find_one({"_id": ObjectId(candidate_id)})
        if not candidate:
            continue
        
        candidate_email = candidate.get("contact_info", {}).get("email")
        if not candidate_email:
            continue
        
        candidate_name = candidate.get("name", "Candidate")
        
        # Replace placeholders in template
        subject = template.get("subject", "").replace("[Job Title]", job_title)
        body = template.get("body", "").replace("[Candidate Name]", candidate_name)
        body = body.replace("[Job Title]", job_title)
        
        # Create mailto link
        mailto_params = {
            "to": candidate_email,
            "subject": subject,
            "body": body
        }
        
        # Build mailto URL
        mailto_url = "mailto:" + candidate_email
        params = []
        if subject:
            params.append(f"subject={urllib.parse.quote(subject)}")
        if body:
            params.append(f"body={urllib.parse.quote(body)}")
        
        if params:
            mailto_url += "?" + "&".join(params)
        
        mailto_links.append({
            "candidate_id": candidate_id,
            "candidate_name": candidate_name,
            "email": candidate_email,
            "mailto_url": mailto_url
        })
    
    # Log activity
    await log_activity(
        action="interview_links_generated",
        entity_type="email",
        description=f"Generated interview mailto links for {len(mailto_links)} candidate(s) for job: {job.get('title', 'Unknown')}",
        entity_id=job_id,
        user_id=user_id,
        metadata={
            "candidate_count": len(mailto_links),
            "template_type": "interview",
            "candidate_ids": candidate_ids
        }
    )
    
    return {
        "message": f"Generated {len(mailto_links)} mailto link(s)",
        "links": mailto_links
    }

@router.post("/test")
async def test_email():
    """Test Resend email configuration by sending a test email"""
    if not resend_sender.is_configured():
        raise HTTPException(
            status_code=500,
            detail="Email not configured. Set RESEND_API_KEY environment variable."
        )
    
    # Get a test email from environment or use a default
    test_email = os.getenv("TEST_EMAIL", "test@example.com")
    success, error = await resend_sender.send_email_with_error(
        to_email=test_email,
        subject="Test Email from Greenstone Talent",
        body="This is a test email to verify your Resend configuration is working correctly.",
        is_html=False
    )
    
    if success:
        return {
            "message": "Test email sent successfully!",
            "to": test_email,
            "status": "success"
        }
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test email: {error}"
        )

