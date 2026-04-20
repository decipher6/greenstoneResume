# Backend Setup & Run Instructions

## Prerequisites
- Python 3.11+
- MongoDB connection string
- Google Gemini API key

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
   GEMINI_API_KEY=your_gemini_api_key
   DATABASE_NAME=greenstone_talent
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   DEBUG=false
   
   # Email Configuration (Resend)
   RESEND_API_KEY=your_resend_api_key
   RESEND_FROM_EMAIL=onboarding@resend.dev
   RESEND_FROM_NAME=Greenstone Talent Team
   EMAIL_ENABLED=true
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

## Email + OTP Login Configuration

The login flow is OTP-based:
- Request OTP via `/api/auth/request-otp`
- OTP is valid for 10 minutes
- Successful login session token is valid for 7 days
- OTP emails are sent to any valid email address
- If an email is new, the user is created automatically on OTP request

Configure Resend in `.env`:
```env
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_FROM_NAME=Greenstone Talent Team
EMAIL_ENABLED=true
```

Set `EMAIL_ENABLED=false` to disable email sending.

## Troubleshooting

- **Import errors**: Make sure you're in the `backend/` directory when running
- **MongoDB connection errors**: Check your `MONGODB_URI` in `.env`
- **GEMINI_API_KEY errors**: Make sure your Gemini API key is set in `.env`
- **Email errors**: 
  - Verify `RESEND_API_KEY` and sender email/domain are configured correctly
  - Check that `EMAIL_ENABLED=true` in `.env`
  - Ensure the recipient email can receive external mail from your Resend sender
  - Check server logs for detailed error messages

