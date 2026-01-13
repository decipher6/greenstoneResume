from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from bson import ObjectId
from jose import jwt, JWTError
from typing import Optional
import os

from database import get_db
from models import UserSignup, UserLogin, User
from routes.activity_logs import log_activity

router = APIRouter()
security = HTTPBearer()

# Simple JWT secret (in production, use environment variable)
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    """Store password as-is (basic implementation)"""
    return password

def verify_password(plain_password: str, stored_password: str) -> bool:
    """Verify a password by simple comparison"""
    return plain_password == stored_password

def create_token(user_id: str, email: str) -> str:
    """Create JWT token"""
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=7)  # 7 days expiry
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@router.post("/signup")
async def signup(user_data: UserSignup):
    """Create a new user account"""
    db = get_db()
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists. Please sign in instead.")
    
    # Store password as-is (no hashing as requested)
    password_hash = hash_password(user_data.password)
    
    # Create user
    user_dict = {
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": password_hash,
        "created_at": datetime.now()
    }
    
    result = await db.users.insert_one(user_dict)
    user_id = str(result.inserted_id)
    
    # Create token
    token = create_token(user_id, user_data.email)
    
    # Log activity
    await log_activity(
        action="user_signed_up",
        entity_type="user",
        description=f"New user signed up: {user_data.name} ({user_data.email})",
        entity_id=user_id,
        user_id=user_id
    )
    
    return {
        "message": "User created successfully",
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email,
            "name": user_data.name
        }
    }

@router.post("/login")
async def login(user_data: UserLogin):
    """Login user - verify email and password"""
    db = get_db()
    
    # Find user
    user = await db.users.find_one({"email": user_data.email})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password (plain text comparison, no hashing)
    stored_password = user.get("password_hash", "")
    if not verify_password(user_data.password, stored_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create token
    token = create_token(str(user["_id"]), user["email"])
    user_id = str(user["_id"])
    
    # Log activity
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

