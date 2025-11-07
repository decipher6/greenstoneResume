# CORS Fix for Deployed Frontend

## Problem
Getting `400 Bad Request` on OPTIONS requests when logging in from deployed frontend.

## Solution Applied
Updated `backend/main.py` to include Vercel frontend URLs in default CORS origins.

## What Changed
- Added `https://greenstone-resume.vercel.app` to allowed origins
- Added `https://greenstone-resume-git-main.vercel.app` for preview deployments
- Improved origin parsing to filter out empty strings

## Next Steps

### If Backend is Running Locally:
1. **Restart your backend**:
   ```bash
   cd backend
   python main.py
   ```
   Or if using uvicorn:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Test**: Try logging in from https://greenstone-resume.vercel.app again

### If Backend is Deployed on Render:
1. **Commit and push the changes**:
   ```bash
   git add backend/main.py
   git commit -m "Fix CORS for Vercel frontend"
   git push origin backend
   ```

2. **Render will auto-deploy** (if auto-deploy is enabled)

3. **Verify CORS_ORIGINS in Render**:
   - Go to Render Dashboard → Your Backend Service
   - Settings → Environment
   - Make sure `CORS_ORIGINS` includes:
     ```
     https://greenstone-resume.vercel.app,https://greenstone-resume-git-main.vercel.app
     ```

4. **Test**: Try logging in from https://greenstone-resume.vercel.app

## Verification
After restarting/redeploying, check:
- ✅ No more 400 errors on OPTIONS requests
- ✅ Login/Signup works from deployed frontend
- ✅ No CORS errors in browser console

