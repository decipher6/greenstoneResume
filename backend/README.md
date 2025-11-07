# Backend Setup & Run Instructions

## Prerequisites
- Python 3.11+
- MongoDB connection string
- Groq API key

## Setup

1. **Activate virtual environment** (if not already activated):
   ```bash
   cd backend
   source venv/bin/activate  # On macOS/Linux
   # or
   venv\Scripts\activate  # On Windows
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**:
   Make sure your `.env` file in the `backend/` directory contains:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   GROQ_API_KEY=your_groq_api_key
   DATABASE_NAME=greenstone_talent
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   DEBUG=false
   ```

## Run the Backend

### Option 1: Using uvicorn directly (recommended)
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Option 2: Using Python
```bash
cd backend
python main.py
```

The backend will start on `http://localhost:8000`

## Verify it's running

Visit:
- `http://localhost:8000/` - API root
- `http://localhost:8000/api/health` - Health check
- `http://localhost:8000/docs` - Interactive API documentation (Swagger UI)

## Troubleshooting

- **Import errors**: Make sure you're in the `backend/` directory when running
- **MongoDB connection errors**: Check your `MONGODB_URI` in `.env`
- **GROQ_API_KEY errors**: Make sure your Groq API key is set in `.env`

