from fastapi import APIRouter, HTTPException, Body
from typing import List
from bson import ObjectId
from database import get_db
from models import EmailSend
from routes.activity_logs import log_activity
from utils.email_sender import email_sender
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/send")
async def send_emails(email_data: EmailSend):
    """Send emails to candidates"""
    db = get_db()
    
    # Verify job exists
    job = await db.jobs.find_one({"_id": ObjectId(email_data.job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if email is configured
    if not email_sender.is_configured():
        raise HTTPException(
            status_code=500,
            detail="Email service is not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables."
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
        
        # Send actual email
        success, error_msg = await email_sender.send_email_with_error(
            to_email=candidate_email,
            subject=subject,
            body=body,
            is_html=False
        )
        
        if success:
            # Update candidate status if rejection email
            if email_data.template.template_type == "rejection":
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
        description=f"Sent {sent_count} email(s) for job: {job.get('title', 'Unknown')}",
        entity_id=email_data.job_id,
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

@router.post("/test")
async def test_email():
    """Test email configuration by sending a test email"""
    from utils.email_sender import email_sender
    
    if not email_sender.is_configured():
        raise HTTPException(
            status_code=500,
            detail="Email not configured. Set SMTP_USER and SMTP_PASSWORD environment variables."
        )
    
    test_email = email_sender.smtp_user  # Send test email to the configured user
    success, error = await email_sender.send_email_with_error(
        to_email=test_email,
        subject="Test Email from Greenstone Talent",
        body="This is a test email to verify your SMTP configuration is working correctly.",
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
