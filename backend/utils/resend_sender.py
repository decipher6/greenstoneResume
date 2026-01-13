import os
from typing import Optional, Tuple
import logging
import resend

logger = logging.getLogger(__name__)

class ResendEmailSender:
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
        self.from_name = os.getenv("RESEND_FROM_NAME", "Greenstone Talent Team")
        self.enabled = os.getenv("EMAIL_ENABLED", "true").lower() == "true"
        
        if self.api_key:
            try:
                resend.api_key = self.api_key
            except Exception as e:
                logger.error(f"Failed to set Resend API key: {e}")
    
    def is_configured(self) -> bool:
        """Check if Resend is properly configured"""
        if not self.enabled:
            return False
        return bool(self.api_key)
    
    async def send_email_with_error(
        self,
        to_email: str,
        subject: str,
        body: str,
        is_html: bool = False
    ) -> Tuple[bool, Optional[str]]:
        """
        Send an email using Resend API and return success status with error message
        
        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        if not self.is_configured():
            return False, "Resend email not configured. Set RESEND_API_KEY environment variable."
        
        try:
            params = {
                "from": f"{self.from_name} <{self.from_email}>",
                "to": [to_email],
                "subject": subject,
            }
            
            if is_html:
                params["html"] = body
            else:
                params["text"] = body
            
            # Resend API is synchronous, so we run it in a thread pool
            import asyncio
            loop = asyncio.get_event_loop()
            
            def send_email():
                try:
                    # Set API key before sending (in case it wasn't set during init)
                    resend.api_key = self.api_key
                    return resend.Emails.send(params)
                except Exception as e:
                    raise e
            
            result = await loop.run_in_executor(None, send_email)
            
            # Resend returns a dict with 'id' key on success
            if result and isinstance(result, dict) and result.get('id'):
                logger.info(f"Email sent successfully to {to_email} via Resend (ID: {result.get('id')})")
                return True, None
            else:
                error_msg = result.get('message', 'Unknown error from Resend API') if isinstance(result, dict) else "Unknown error from Resend API"
                logger.error(f"Failed to send email to {to_email}: {error_msg}")
                return False, error_msg
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Resend API error sending to {to_email}: {error_msg}")
            return False, error_msg
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        is_html: bool = False
    ) -> bool:
        """
        Send an email asynchronously (backward compatibility wrapper)
        
        Returns:
            True if email was sent successfully, False otherwise
        """
        success, _ = await self.send_email_with_error(to_email, subject, body, is_html)
        return success

# Global instance
resend_sender = ResendEmailSender()
