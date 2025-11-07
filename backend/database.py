from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import os
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

def get_mongodb_uri():
    """Get MongoDB URI with properly encoded credentials"""
    raw_uri = os.getenv("MONGODB_URI")
    
    if not raw_uri:
        raise ValueError(
            "MONGODB_URI environment variable is required. "
            "Please set it in your .env file or environment variables."
        )
    
    try:
        # If URI already contains @, parse it and encode credentials
        if "@" in raw_uri and "://" in raw_uri:
            # Extract parts: mongodb+srv://username:password@host
            parts = raw_uri.split("://", 1)
            if len(parts) == 2:
                scheme = parts[0]  # mongodb+srv
                rest = parts[1]  # username:password@host/database
                
                # Use rsplit to split from right - in case password contains @
                if "@" in rest:
                    credentials, host = rest.rsplit("@", 1)
                    if ":" in credentials:
                        username, password = credentials.split(":", 1)
                        # URL encode username and password
                        encoded_username = quote_plus(username)
                        encoded_password = quote_plus(password)
                        # Reconstruct URI with encoded credentials
                        encoded_uri = f"{scheme}://{encoded_username}:{encoded_password}@{host}"
                        print(f"🔧 MongoDB URI encoded successfully")
                        return encoded_uri
    except Exception as e:
        print(f"⚠️  Warning: Could not encode MongoDB URI: {e}")
        print(f"   Using raw URI (may fail if password has special characters)")
    
    return raw_uri

MONGODB_URI = get_mongodb_uri()
DATABASE_NAME = os.getenv("DATABASE_NAME", "greenstone_talent")

client = None
db = None

async def init_db():
    global client, db
    try:
        client = AsyncIOMotorClient(MONGODB_URI)
        db = client[DATABASE_NAME]
        # Test connection
        await client.admin.command('ping')
        print("✅ Connected to MongoDB")
        
        # Create indexes (collections will be created automatically if they don't exist)
        try:
            await db.users.create_index("email", unique=True)
            await db.jobs.create_index("title")
            await db.candidates.create_index("job_id")
            await db.candidates.create_index([("name", 1), ("phone", 1)])
            # Note: assessments collections will be created when needed
            print("✅ Database indexes created")
        except Exception as idx_error:
            print(f"⚠️  Warning: Some indexes could not be created: {idx_error}")
        
    except Exception as e:
        print(f"❌ MongoDB connection error: {e}")
        raise

def get_db():
    return db

