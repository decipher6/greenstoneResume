import aiosmtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class EmailSender:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.smtp_from_email = os.getenv("SMTP_FROM_EMAIL", self.smtp_user)
        self.smtp_from_name = os.getenv("SMTP_FROM_NAME", "Greenstone Talent Team")
        self.use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        self.enabled = os.getenv("EMAIL_ENABLED", "true").lower() == "true"
    
    def is_configured(self) -> bool:
        """Check if email is properly configured"""
        if not self.enabled:
            return False
        return bool(self.smtp_user and self.smtp_password)
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        is_html: bool = False
    ) -> bool:
        """
        Send an email asynchronously
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            body: Email body (plain text or HTML)
            is_html: Whether the body is HTML format
        
        Returns:
            True if email was sent successfully, False otherwise
        """
        if not self.is_configured():
            logger.warning("Email not configured. Set SMTP_USER and SMTP_PASSWORD environment variables.")
            return False
        
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["From"] = f"{self.smtp_from_name} <{self.smtp_from_email}>"
            message["To"] = to_email
            message["Subject"] = subject
            
            # Add body
            if is_html:
                message.attach(MIMEText(body, "html"))
            else:
                message.attach(MIMEText(body, "plain"))
            
            # Send email
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_password,
                use_tls=self.use_tls,
            )
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

# Global instance
email_sender = EmailSender()
