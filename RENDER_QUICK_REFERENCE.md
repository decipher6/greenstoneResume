# Render Deployment - Quick Reference

## Render Dashboard Fields (Copy-Paste Values)

### Build Command
```
pip install --upgrade pip && pip install -r requirements.txt
```

### Pre-Deploy Command
```
(Leave EMPTY)
```

### Start Command
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Auto-Deploy
```
On Commit
```

### Root Directory (in Settings)
```
backend
```

### Python Version (in Settings)
```
3.11
```

### Branch
```
backend
```

---

## Environment Variables (Set in Render Dashboard)

Go to **Settings → Environment** and add:

| Key | Value | Notes |
|-----|-------|-------|
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB connection string |
| `GROQ_API_KEY` | `gsk_...` | Your Groq API key |
| `DATABASE_NAME` | `greenstone_talent` | Database name |
| `CORS_ORIGINS` | `https://greenstone-resume.vercel.app,https://greenstone-resume-git-main.vercel.app` | Your Vercel frontend URLs |
| `DEBUG` | `false` | Production mode |

**Important**: 
- Replace `your-frontend.vercel.app` with your actual Vercel URL
- For multiple origins: `https://url1.com,https://url2.com` (comma-separated, no spaces)

---

## Verification

After deployment, test:
```bash
curl https://your-backend.onrender.com/api/health
```

Should return:
```json
{"status": "ok", "routes": [...]}
```

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "Could not open requirements file" | ✅ Fixed - `requirements.txt` in root |
| "metadata-generation-failed" | ✅ Fixed - `sentence-transformers` commented out |
| "ModuleNotFoundError: models" | ✅ Fixed - `models.py` in backend/ |
| CORS errors | Set `CORS_ORIGINS` with your frontend URL |
| Backend not starting | Check environment variables are set |

---

**Ready to deploy!** 🚀

