from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from bson import ObjectId
from jose import jwt, JWTError
from typing import Optional
import os
import secrets
import re

from database import get_db
from models import OTPRequest, OTPVerify
from routes.activity_logs import log_activity
from utils.resend_sender import resend_sender

router = APIRouter()
security = HTTPBearer()

# Simple JWT secret (in production, use environment variable)
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
OTP_EXPIRY_MINUTES = 10
LOGIN_TOKEN_EXPIRY_DAYS = 7
ALLOWED_LOGIN_DOMAIN = "gsequity.com"

def create_token(user_id: str, email: str) -> str:
    """Create JWT token"""
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=LOGIN_TOKEN_EXPIRY_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def is_allowed_email(email: str) -> bool:
    """Allow login OTP delivery only to gsequity.com accounts."""
    return email.lower().endswith(f"@{ALLOWED_LOGIN_DOMAIN}")

def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return f"{secrets.randbelow(1000000):06d}"

async def find_user_by_email(db, email: str):
    """Lookup user in a case-insensitive way."""
    return await db.users.find_one({
        "email": {
            "$regex": f"^{re.escape(email)}$",
            "$options": "i"
        }
    })

def decode_token(token: str) -> dict:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@router.post("/login")
async def login(user_data: OTPVerify):
    """Login user using email + OTP verification."""
    db = get_db()

    email = user_data.email.lower()
    if not is_allowed_email(email):
        raise HTTPException(status_code=403, detail="Only @gsequity.com email logins are allowed")

    user = await find_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or OTP")

    otp_code = user.get("login_otp_code")
    otp_expires_at = user.get("login_otp_expires_at")
    if not otp_code or not otp_expires_at:
        raise HTTPException(status_code=401, detail="Invalid email or OTP")

    if datetime.utcnow() > otp_expires_at:
        raise HTTPException(status_code=401, detail="OTP expired. Please request a new one.")

    if user_data.otp != otp_code:
        raise HTTPException(status_code=401, detail="Invalid email or OTP")

    # Invalidate OTP after successful login
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$unset": {"login_otp_code": "", "login_otp_expires_at": ""}}
    )

    token = create_token(str(user["_id"]), user["email"])
    user_id = str(user["_id"])

    await log_activity(
        action="user_logged_in",
        entity_type="user",
        description=f"User logged in: {user.get('name', user['email'])}",
        entity_id=user_id,
        user_id=user_id
    )
    
    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user_id,
            "email": user["email"],
            "name": user.get("name", user["email"].split("@")[0])
        }
    }

@router.post("/request-otp")
async def request_otp(request_data: OTPRequest):
    """Request a login OTP sent via Resend."""
    db = get_db()

    email = request_data.email.lower()
    if not is_allowed_email(email):
        raise HTTPException(status_code=403, detail="Only @gsequity.com email logins are allowed")

    user = await find_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="No user found with this email")

    otp = generate_otp()
    otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"login_otp_code": otp, "login_otp_expires_at": otp_expires_at}}
    )

    subject = "Your Greenstone Login OTP"
    body = (
        f"Your one-time login code is: {otp}\n\n"
        f"This OTP is valid for {OTP_EXPIRY_MINUTES} minutes.\n"
        "If you did not request this code, you can ignore this email."
    )
    sent, error = await resend_sender.send_email_with_error(
        to_email=email,
        subject=subject,
        body=body
    )
    if not sent:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP email: {error}")

    return {
        "message": "OTP sent successfully",
        "expires_in_minutes": OTP_EXPIRY_MINUTES
    }

async def get_current_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[str]:
    """Get current user ID from token (optional dependency - returns None if no token)"""
    if not credentials:
        return None
    try:
        token = credentials.credentials
        payload = decode_token(token)
        return payload.get("user_id")
    except:
        return None

@router.get("/me")
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user info"""
    db = get_db()
    
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload["user_id"]
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"]
    }

