# Vercel Deployment Guide

## Changes Made for Vercel Compatibility

1. **Created `vercel.json`** - Configuration file for Vercel routing
2. **Updated `main.py`** - Added serverless-friendly database initialization
3. **Updated `database.py`** - Added timeout and graceful error handling
4. **Added `mangum`** - ASGI adapter for better serverless compatibility

## Vercel Configuration Steps

### 1. In Vercel Dashboard - Project Settings:

**Framework Preset:** `FastAPI` (auto-detected)

**Root Directory:** `backend`

**Build Command:** `None` (leave empty)

**Output Directory:** `N/A` (leave empty)

**Install Command:** `pip install -r requirements.txt`

### 2. Environment Variables (CRITICAL - Add all of these):

#### Required:
- `MONGODB_URI` - Your MongoDB connection string
- `GEMINI_API_KEY` - Your Google Gemini API key

#### Recommended:
- `DATABASE_NAME` - Defaults to `greenstone_talent` if not set
- `JWT_SECRET` - A secure random string (change from default!)
- `CORS_ORIGINS` - Your frontend URL, e.g., `https://your-frontend.vercel.app`
- `DEBUG` - Set to `false` for production

#### Email Configuration (choose one):

**Option A - SMTP:**
- `SMTP_HOST` - e.g., `smtp.gmail.com`
- `SMTP_PORT` - e.g., `587`
- `SMTP_USER` - Your email
- `SMTP_PASSWORD` - Your app password
- `SMTP_FROM_EMAIL` - Sender email
- `SMTP_FROM_NAME` - Sender name
- `SMTP_USE_TLS` - `true`
- `EMAIL_ENABLED` - `true`

**Option B - Resend:**
- `RESEND_API_KEY` - Your Resend API key
- `RESEND_FROM_EMAIL` - Sender email
- `RESEND_FROM_NAME` - Sender name
- `EMAIL_ENABLED` - `true`

### 3. Deploy

Click "Deploy" after setting all environment variables.

## Troubleshooting

### If you get "FUNCTION_INVOCATION_FAILED":

1. **Check Vercel Function Logs:**
   - Go to your deployment → "Functions" tab
   - Click on the function to see error logs
   - Look for import errors, missing env vars, or database connection issues

2. **Common Issues:**

   **Missing Environment Variables:**
   - Make sure `MONGODB_URI` and `GEMINI_API_KEY` are set
   - Check that all required variables are added in Vercel dashboard

   **Database Connection:**
   - Verify your MongoDB URI is correct
   - Check if MongoDB allows connections from Vercel's IPs
   - The code now handles connection failures gracefully

   **Import Errors:**
   - Check that all dependencies in `requirements.txt` are installable
   - Some packages might need system dependencies

3. **Test the Health Endpoint:**
   - After deployment, visit: `https://your-backend.vercel.app/api/health`
   - Should return: `{"status": "ok", ...}`

4. **Check Build Logs:**
   - In Vercel dashboard, check the "Build Logs" tab
   - Look for any errors during `pip install`

## Notes

- The database now initializes lazily (on first request) for better serverless compatibility
- All routes are prefixed with `/api/` (e.g., `/api/jobs`, `/api/candidates`)
- CORS is configured to allow your frontend domain
- The app uses Mangum adapter for better ASGI compatibility in serverless environments
