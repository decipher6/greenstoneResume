from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from database import init_db
from routes import jobs, candidates, assessments, analytics, email, auth, activity_logs

load_dotenv()

# For serverless (Vercel), use lazy database initialization
# Initialize DB on first request instead of at startup
_db_initialized = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Try to initialize DB, but don't fail if it doesn't work in serverless
    global _db_initialized
    try:
        await init_db()
        _db_initialized = True
    except Exception as e:
        print(f"⚠️  Database initialization deferred (serverless): {e}")
        # In serverless, we'll initialize on first request
        _db_initialized = False
    yield
    # Cleanup if needed
    try:
        from database import client
        if client:
            client.close()
    except:
        pass

app = FastAPI(
    title="Greenstone Talent AI",
    description="Intelligent candidate screening platform",
    lifespan=lifespan
)

# Middleware to ensure DB is initialized on first request (for serverless)
@app.middleware("http")
async def ensure_db_initialized(request, call_next):
    global _db_initialized
    if not _db_initialized:
        try:
            await init_db()
            _db_initialized = True
        except Exception as e:
            print(f"⚠️  Database initialization failed: {e}")
    return await call_next(request)

# CORS configuration - use environment variable in production
# Default includes localhost for development and Vercel frontend for production
default_origins = "http://localhost:5173,http://localhost:3000,https://greenstone-resume.vercel.app,https://greenstone-resume-git-main.vercel.app"
allowed_origins_str = os.getenv("CORS_ORIGINS", default_origins)
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(candidates.router, prefix="/api/candidates", tags=["candidates"])
app.include_router(assessments.router, prefix="/api/assessments", tags=["assessments"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(email.router, prefix="/api/email", tags=["email"])
app.include_router(activity_logs.router, prefix="/api/activity-logs", tags=["activity-logs"])

@app.get("/")
async def root():
    return {"message": "Greenstone Talent AI API"}

@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "routes": ["/api/auth", "/api/jobs", "/api/candidates", "/api/assessments", "/api/analytics", "/api/email"]}

# Export app for Vercel
# Vercel's @vercel/python automatically detects FastAPI apps exported as 'app'
# Do NOT export as 'handler' unless it's a BaseHTTPRequestHandler subclass

if __name__ == "__main__":
    import uvicorn
    # Increase max request body size to 100MB for bulk file uploads
    uvicorn.run(app, host="0.0.0.0", port=8000, limit_max_requests=1000, limit_concurrency=100)

