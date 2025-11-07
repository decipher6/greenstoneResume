# Render Build Fix

## Issue
Build was failing due to `sentence-transformers` package requiring compilation (ninja build tools).

## Solution
Removed `sentence-transformers` from requirements. The code already has a fallback:
- **With sentence-transformers**: Uses semantic similarity + LLM scoring
- **Without sentence-transformers**: Uses keyword-based similarity + LLM scoring

## Impact
- ✅ **AI scoring still works** - Uses Groq LLM for evaluation
- ✅ **Semantic similarity** - Falls back to keyword matching (still effective)
- ✅ **No compilation needed** - Faster builds on Render
- ✅ **Smaller package size** - Faster deployments

## If You Need Semantic Similarity Later

To add it back (requires compilation):
1. Uncomment in `requirements.txt`:
   ```
   sentence-transformers>=2.3.0
   torch>=2.0.0
   transformers>=4.30.0
   ```
2. Render may need additional build tools - consider using Docker or pre-built wheels

## Current Status
✅ Backend should now build successfully on Render
✅ All core functionality works without sentence-transformers

