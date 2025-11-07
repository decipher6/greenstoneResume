# Security Fix - MongoDB URI

## ✅ Fixed
- Removed hardcoded MongoDB URI from `backend/database.py`
- Now requires `MONGODB_URI` environment variable
- Will raise error if not set (fail fast)

## ⚠️ IMPORTANT: Credentials Were Exposed in Git History

The MongoDB credentials were committed to git history in commit `63239b11db0b8bcea1e2e2e9f403b0af810dac9c`.

### Action Required:

1. **Rotate MongoDB Password** (CRITICAL):
   - Go to MongoDB Atlas Dashboard
   - Database Access → Edit user
   - Change password
   - Update `MONGODB_URI` in:
     - Local `.env` file
     - Render environment variables
     - Any other deployment environments

2. **Verify .env is in .gitignore**:
   - ✅ Already in `.gitignore` (line 23)
   - Never commit `.env` files

3. **Going Forward**:
   - ✅ Code now requires environment variable
   - ✅ No hardcoded credentials
   - ✅ Will fail fast if `MONGODB_URI` not set

## What Changed

**Before:**
```python
raw_uri = os.getenv("MONGODB_URI", "mongodb+srv://yg2810:M@l()n3*D1es@cluster0.uxqqqdj.mongodb.net/")
```

**After:**
```python
raw_uri = os.getenv("MONGODB_URI")

if not raw_uri:
    raise ValueError(
        "MONGODB_URI environment variable is required. "
        "Please set it in your .env file or environment variables."
    )
```

## Next Steps

1. **Rotate MongoDB password** (do this first!)
2. **Update environment variables** everywhere
3. **Commit the fix**:
   ```bash
   git add backend/database.py
   git commit -m "Security: Remove hardcoded MongoDB URI, require environment variable"
   git push origin backend
   ```

---

**Security Note**: Even though the credentials are removed from the code, they remain in git history. Rotating the password is essential.

