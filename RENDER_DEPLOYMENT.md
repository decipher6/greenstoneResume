# Render Deployment Guide

## Quick Setup

### Option 1: Using render.yaml (Recommended)

1. **Connect Repository to Render:**
   - Go to Render Dashboard
   - New → Web Service
   - Connect your GitHub repository
   - Select branch: `backend`
   - Render will auto-detect `render.yaml`

2. **Set Environment Variables in Render Dashboard:**
   - `MONGODB_URI` - Your MongoDB connection string
   - `GROQ_API_KEY` - Your Groq API key
   - `DATABASE_NAME` - `greenstone_talent`
   - `CORS_ORIGINS` - Your frontend URL (set after frontend is deployed)
   - `DEBUG` - `false`

3. **Deploy:**
   - Render will automatically deploy using `render.yaml`

### Option 2: Manual Configuration

If not using `render.yaml`, configure manually:

**Settings:**
- **Name**: `greenstone-backend`
- **Environment**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Root Directory**: `backend`

**Environment Variables:**
```
MONGODB_URI=mongodb+srv://...
GROQ_API_KEY=gsk_...
DATABASE_NAME=greenstone_talent
CORS_ORIGINS=https://your-frontend.vercel.app
DEBUG=false
PYTHON_VERSION=3.11
```

## Important Notes

1. **Root Directory**: Must be set to `backend` in Render settings
2. **Python Version**: Render will use Python 3.11 (specified in render.yaml)
3. **Port**: Use `$PORT` environment variable (Render provides this)
4. **File Storage**: Same limitation as Vercel - need GridFS or external storage

## After Deployment

1. **Get Backend URL**: `https://your-backend.onrender.com`
2. **Update Frontend**: Set `VITE_API_URL` to your Render backend URL
3. **Update CORS**: Add frontend URL to `CORS_ORIGINS` in Render
4. **Test**: `curl https://your-backend.onrender.com/api/health`

## Render vs Vercel

**Render Advantages:**
- ✅ Better for long-running processes
- ✅ More generous free tier limits
- ✅ Better for Python backends
- ✅ Persistent file storage possible

**Vercel Advantages:**
- ✅ Faster cold starts
- ✅ Better for serverless
- ✅ Integrated with frontend deployment

For this project, **Render is better** for the backend due to:
- AI scoring may take 15-30 seconds (Render allows longer timeouts)
- Better Python support
- More suitable for FastAPI

