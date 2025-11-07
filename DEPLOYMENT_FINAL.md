# Final Deployment Checklist

## ✅ Frontend Status
- **Frontend URL**: https://greenstone-resume.vercel.app
- **Status**: ✅ Successfully deployed on Vercel

## 🚀 Backend Deployment on Render

### Step 1: Push Backend Branch
```bash
git checkout backend
git push origin backend
```

### Step 2: Deploy on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repository: `greenstoneResume`
4. Select branch: `backend`

### Step 3: Render Configuration

**Build Command:**
```
pip install --upgrade pip && pip install -r requirements.txt
```

**Pre-Deploy Command:**
```
(Leave EMPTY)
```

**Start Command:**
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Auto-Deploy:**
```
On Commit
```

**Root Directory:**
```
backend
```

**Python Version:**
```
3.11
```

### Step 4: Environment Variables (CRITICAL)

In Render Dashboard → Settings → Environment, add:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | `mongodb+srv://your-connection-string` |
| `GROQ_API_KEY` | `gsk_your-actual-key` |
| `DATABASE_NAME` | `greenstone_talent` |
| `CORS_ORIGINS` | `https://greenstone-resume.vercel.app,https://greenstone-resume-git-main.vercel.app` |
| `DEBUG` | `false` |

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Note your backend URL: `https://your-backend.onrender.com`

### Step 6: Update Vercel Frontend

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `greenstone-resume` project
3. Go to **Settings** → **Environment Variables**
4. Add/Update:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://your-backend.onrender.com/api` (replace with your actual Render URL)
   - **Environment**: Production, Preview, Development
5. **Redeploy** frontend (or wait for auto-deploy)

### Step 7: Verify Everything Works

1. **Test Backend:**
   ```bash
   curl https://your-backend.onrender.com/api/health
   ```
   Should return: `{"status": "ok", ...}`

2. **Test Frontend:**
   - Go to: https://greenstone-resume.vercel.app/login
   - Try to sign up or log in
   - Check browser console (F12) for any errors
   - Should work without CORS errors!

3. **Test Full Flow:**
   - ✅ Login/Signup works
   - ✅ Create job post
   - ✅ Upload candidates
   - ✅ Run AI analysis
   - ✅ View candidate profiles

---

## 🎯 Quick Reference

**Frontend URL:**
```
https://greenstone-resume.vercel.app
```

**Backend URL (after deployment):**
```
https://your-backend.onrender.com
```

**CORS_ORIGINS (for Render):**
```
https://greenstone-resume.vercel.app,https://greenstone-resume-git-main.vercel.app
```

**VITE_API_URL (for Vercel):**
```
https://your-backend.onrender.com/api
```

---

## ⚠️ Common Issues

**CORS Errors:**
- Make sure `CORS_ORIGINS` in Render includes your Vercel URL
- Format: `https://url1.com,https://url2.com` (no spaces)

**Frontend can't connect:**
- Verify `VITE_API_URL` is set in Vercel
- Check backend is running: `curl https://your-backend.onrender.com/api/health`
- Redeploy frontend after setting `VITE_API_URL`

**Backend not starting:**
- Check Render build logs
- Verify all environment variables are set
- Check MongoDB connection string is correct

---

## ✅ Success Criteria

- [ ] Backend deployed on Render
- [ ] Backend health check returns `{"status": "ok"}`
- [ ] `VITE_API_URL` set in Vercel
- [ ] Frontend redeployed with new API URL
- [ ] Login/Signup works on https://greenstone-resume.vercel.app
- [ ] No CORS errors in browser console
- [ ] Full application flow works end-to-end

---

**You're almost there!** Deploy the backend on Render, set the environment variables, update Vercel, and you're done! 🚀

