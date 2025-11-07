# Render Python 3.13 Fix

## Problem
Render was using Python 3.13.4 by default, but `pandas==2.1.3` is not compatible with Python 3.13, causing build failures.

## Solution Applied

1. **Removed pandas** - Not used anywhere in the codebase
2. **Created `runtime.txt` files** - Forces Render to use Python 3.11.9
3. **Kept numpy** - Required by `backend/utils/ai_scoring.py`

## Files Changed

- ✅ `backend/requirements.txt` - Removed pandas
- ✅ `requirements.txt` - Removed pandas  
- ✅ `backend/runtime.txt` - Created (Python 3.11.9)
- ✅ `runtime.txt` - Created (Python 3.11.9)
- ✅ `render.yaml` - Cleaned up

## Next Steps

1. **Commit and push**:
   ```bash
   git add backend/requirements.txt requirements.txt backend/runtime.txt runtime.txt render.yaml
   git commit -m "Fix Python version and remove unused pandas dependency"
   git push origin backend
   ```

2. **In Render Dashboard**:
   - Go to your service settings
   - Verify **Python Version** is set to **3.11** (or let runtime.txt handle it)
   - The `runtime.txt` file will automatically set Python 3.11.9

3. **Redeploy** - Render should now:
   - Use Python 3.11.9 (from runtime.txt)
   - Skip pandas installation
   - Successfully build with numpy

## Verification

After deployment, check build logs:
- ✅ Should see: "Installing Python version 3.11.9"
- ✅ Should NOT see pandas in installation
- ✅ Should successfully install numpy
- ✅ Build should complete successfully

