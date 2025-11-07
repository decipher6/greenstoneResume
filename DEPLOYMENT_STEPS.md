# Render Deployment - Step by Step

## Step 1: Commit and Push Changes

```bash
# Make sure you're on the backend branch
git checkout backend

# Add all the fixed files
git add backend/requirements.txt requirements.txt backend/runtime.txt runtime.txt render.yaml backend/main.py

# Commit the changes
git commit -m "Fix Python 3.13 compatibility: remove pandas, add runtime.txt for Python 3.11"

# Push to GitHub
git push origin backend
```

## Step 2: Go to Render Dashboard

1. Open [Render Dashboard](https://dashboard.render.com)
2. Find your backend service (or create a new one if needed)
3. Click on your service name

## Step 3: Verify/Update Settings

### If Creating New Service:
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `decipher6/greenstoneResume`
3. Select branch: `backend`
4. Render should auto-detect `render.yaml` and pre-fill settings

### If Service Already Exists:
1. Go to **Settings** tab
2. Verify these settings:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Python Version**: Should auto-detect from `runtime.txt` (3.11.9)

## Step 4: Set Environment Variables

Go to **Environment** tab and add/verify:

| Key | Value | Notes |
|-----|-------|-------|
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB connection string |
| `GROQ_API_KEY` | `gsk_...` | Your Groq API key |
| `DATABASE_NAME` | `greenstone_talent` | Database name |
| `CORS_ORIGINS` | `https://greenstone-resume.vercel.app,https://greenstone-resume-git-main.vercel.app` | Your Vercel URLs |
| `DEBUG` | `false` | Production mode |

**Important**: 
- Replace `mongodb+srv://...` with your actual MongoDB URI
- Replace `gsk_...` with your actual Groq API key

## Step 5: Deploy

### If New Service:
1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)

### If Existing Service:
1. Go to **Manual Deploy** tab
2. Click **"Deploy latest commit"**
3. Or wait for auto-deploy (if enabled)

## Step 6: Monitor Build Logs

Watch the build logs. You should see:
- ✅ "Installing Python version 3.11.9" (from runtime.txt)
- ✅ Installing dependencies (no pandas!)
- ✅ "Successfully installed ..."
- ✅ "Starting service with 'uvicorn main:app ...'"
- ✅ "✅ Connected to MongoDB"

## Step 7: Get Backend URL

After successful deployment:
1. Note your backend URL: `https://your-backend.onrender.com`
2. Test it: `curl https://your-backend.onrender.com/api/health`
3. Should return: `{"status": "ok", ...}`

## Step 8: Update Vercel Frontend

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `greenstone-resume` project
3. Go to **Settings** → **Environment Variables**
4. Add/Update:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://your-backend.onrender.com/api` (replace with your actual Render URL)
   - **Environment**: Production, Preview, Development
5. **Redeploy** frontend (or wait for auto-deploy)

## Step 9: Test Everything

1. **Test Backend**:
   ```bash
   curl https://your-backend.onrender.com/api/health
   ```

2. **Test Frontend**:
   - Go to: https://greenstone-resume.vercel.app/login
   - Try to sign up or log in
   - Check browser console (F12) for errors
   - Should work without CORS errors!

3. **Test Full Flow**:
   - ✅ Login/Signup works
   - ✅ Create job post
   - ✅ Upload candidates
   - ✅ Run AI analysis

## Troubleshooting

### Build Still Fails?
- Check build logs for specific errors
- Verify `runtime.txt` is in both root and `backend/` directory
- Make sure Python version shows 3.11.9 in logs

### CORS Errors?
- Verify `CORS_ORIGINS` includes your Vercel URL
- Restart backend after updating CORS

### Backend Not Starting?
- Check environment variables are all set
- Verify MongoDB connection string is correct
- Check Render logs for specific errors

---

## Quick Checklist

- [ ] Committed and pushed changes to `backend` branch
- [ ] Created/updated Render service
- [ ] Set all environment variables in Render
- [ ] Deployment successful (check logs)
- [ ] Backend health check works
- [ ] Updated `VITE_API_URL` in Vercel
- [ ] Frontend redeployed
- [ ] Login/Signup works from deployed frontend
- [ ] No CORS errors in browser console

---

**You're all set!** Follow these steps and your backend should deploy successfully. 🚀

