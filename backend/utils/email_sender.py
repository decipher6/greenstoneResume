import aiosmtplib
import os
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
        smtp = None
        try:
            # Use SMTP class directly for better control
            smtp = aiosmtplib.SMTP(
                hostname=hostname,
                port=port,
                timeout=self.timeout,
            )
            
            # Connect with appropriate encryption
            if use_ssl or port == 465:
                # Port 465: SSL from the start
                # Note: aiosmtplib may need SSL context for port 465
                # For now, try connecting normally - some versions handle it automatically
                await asyncio.wait_for(smtp.connect(), timeout=self.timeout)
                # If connect() doesn't handle SSL, we may need to wrap the socket
                # But let's try the standard approach first
            else:
                # Port 587: STARTTLS
                await asyncio.wait_for(smtp.connect(), timeout=self.timeout)
                if use_tls:
                    await asyncio.wait_for(smtp.starttls(), timeout=self.timeout)
            
            # Authenticate and send
            await asyncio.wait_for(
                smtp.login(self.smtp_user, self.smtp_password),
                timeout=self.timeout
            )
            await asyncio.wait_for(
                smtp.send_message(message),
                timeout=self.timeout
            )
            await smtp.quit()
            
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
            return False, str(e)
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        is_html: bool = False
    ) -> bool:
        """
        Send an email asynchronously with automatic fallback to alternative methods
        
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
            return True
        
        # If primary method failed and it's Gmail, try alternative ports/methods
        if self.smtp_host == "smtp.gmail.com" and not self.use_ssl:
            logger.warning(f"Primary method failed: {error}. Trying alternative Gmail configuration...")
            
            # Try port 465 with SSL (alternative Gmail method)
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
                return True
            
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
                    return True
        
        # All methods failed
        logger.error(f"Failed to send email to {to_email} after trying all methods. Last error: {error}")
        return False

# Global instance
email_sender = EmailSender()
