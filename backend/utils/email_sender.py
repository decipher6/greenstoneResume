import aiosmtplib
import os
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Tuple
import logging
import asyncio

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
        self.use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
        self.timeout = int(os.getenv("SMTP_TIMEOUT", "30"))
        self.enabled = os.getenv("EMAIL_ENABLED", "true").lower() == "true"
    
    def is_configured(self) -> bool:
        """Check if email is properly configured"""
        if not self.enabled:
            return False
        return bool(self.smtp_user and self.smtp_password)
    
    async def _try_send_with_config(
        self,
        message: MIMEMultipart,
        hostname: str,
        port: int,
        use_tls: bool,
        use_ssl: bool
    ) -> Tuple[bool, Optional[str]]:
        """
        Try to send email with specific configuration
        
        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        try:
            # Use the send() helper function which handles SSL/TLS automatically
            # It's simpler and more reliable than manual connection management
            await asyncio.wait_for(
                aiosmtplib.send(
                    message,
                    hostname=hostname,
                    port=port,
                    username=self.smtp_user,
                    password=self.smtp_password,
                    use_tls=use_tls and not (use_ssl or port == 465),  # STARTTLS for port 587
                    start_tls=use_tls and not (use_ssl or port == 465),
                    timeout=self.timeout,
                ),
                timeout=self.timeout + 10  # Add buffer for entire operation
            )
            
            return True, None
            
        except asyncio.TimeoutError:
            if smtp:
                try:
                    await smtp.quit()
                except:
                    pass
            return False, f"Connection timeout after {self.timeout} seconds"
        except Exception as e:
            if smtp:
                try:
                    await smtp.quit()
                except:
                    pass
            error_msg = str(e)
            logger.error(f"SMTP error details: {error_msg}")
            return False, error_msg
    
    async def send_email_with_error(
        self,
        to_email: str,
        subject: str,
        body: str,
        is_html: bool = False
    ) -> Tuple[bool, Optional[str]]:
        """
        Send an email and return success status with error message
        
        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        if not self.is_configured():
            return False, "Email not configured. Set SMTP_USER and SMTP_PASSWORD environment variables."
        
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
        
        # Try primary configuration first
        logger.info(f"Attempting to send email to {to_email} via {self.smtp_host}:{self.smtp_port}")
        success, error = await self._try_send_with_config(
            message,
            self.smtp_host,
            self.smtp_port,
            self.use_tls,
            self.use_ssl
        )
        
        if success:
            logger.info(f"Email sent successfully to {to_email}")
            return True, None
        
        # If primary method failed and it's Gmail, try alternative ports/methods
        if self.smtp_host == "smtp.gmail.com":
            logger.warning(f"Primary method failed: {error}. Trying alternative Gmail configuration...")
            
            # Try port 465 with SSL (alternative Gmail method)
            if self.smtp_port != 465:
                logger.info("Trying Gmail port 465 with SSL...")
                success, error = await self._try_send_with_config(
                    message,
                    "smtp.gmail.com",
                    465,
                    use_tls=False,
                    use_ssl=True
                )
                
                if success:
                    logger.info(f"Email sent successfully to {to_email} using alternative method (port 465)")
                    return True, None
            
            # Try port 587 with STARTTLS (if not already tried)
            if self.smtp_port != 587:
                logger.info("Trying Gmail port 587 with STARTTLS...")
                success, error = await self._try_send_with_config(
                    message,
                    "smtp.gmail.com",
                    587,
                    use_tls=True,
                    use_ssl=False
                )
                
                if success:
                    logger.info(f"Email sent successfully to {to_email} using alternative method (port 587)")
                    return True, None
        
        # All methods failed
        logger.error(f"Failed to send email to {to_email} after trying all methods. Last error: {error}")
        return False, error
    
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
email_sender = EmailSender()
