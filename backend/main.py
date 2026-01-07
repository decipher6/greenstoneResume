from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from database import init_db
from routes import jobs, candidates, assessments, analytics, email, auth

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="Greenstone Talent AI",
    description="Intelligent candidate screening platform",
    lifespan=lifespan
)

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

@app.get("/")
async def root():
    return {"message": "Greenstone Talent AI API"}

@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "routes": ["/api/auth", "/api/jobs", "/api/candidates", "/api/assessments", "/api/analytics", "/api/email"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

