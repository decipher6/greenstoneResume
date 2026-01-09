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
   
   # Email Configuration (SMTP)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=your_app_password
   SMTP_FROM_EMAIL=your_email@gmail.com
   SMTP_FROM_NAME=Greenstone Talent Team
   SMTP_USE_TLS=true
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

## Email Configuration

The email functionality uses SMTP to send emails. Here's how to configure it:

### Gmail Setup (Recommended for Development)

1. **Enable 2-Step Verification** on your Google account
2. **Generate an App Password**:
   - Go to Google Account settings → Security
   - Under "2-Step Verification", click "App passwords"
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Set in `.env`**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=your_16_char_app_password
   SMTP_FROM_EMAIL=your_email@gmail.com
   SMTP_FROM_NAME=Greenstone Talent Team
   SMTP_USE_TLS=true
   SMTP_USE_SSL=false
   SMTP_TIMEOUT=30
   EMAIL_ENABLED=true
   ```
   
   **Note**: If you encounter connection timeout errors:
   - Try port 465 with SSL: Set `SMTP_PORT=465` and `SMTP_USE_SSL=true`
   - Increase timeout: Set `SMTP_TIMEOUT=60` (seconds)
   - The system will automatically try alternative Gmail ports if the primary fails

### Other Email Providers

**Outlook/Office 365**:
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your_email@outlook.com
SMTP_PASSWORD=your_password
SMTP_USE_TLS=true
```

**Custom SMTP Server**:
```env
SMTP_HOST=your_smtp_server.com
SMTP_PORT=587
SMTP_USER=your_username
SMTP_PASSWORD=your_password
SMTP_USE_TLS=true
```

**Note**: Set `EMAIL_ENABLED=false` to disable email sending (emails will be logged but not sent).

## Troubleshooting

- **Import errors**: Make sure you're in the `backend/` directory when running
- **MongoDB connection errors**: Check your `MONGODB_URI` in `.env`
- **GROQ_API_KEY errors**: Make sure your Groq API key is set in `.env`
- **Email errors**: 
  - Verify SMTP credentials are correct
  - For Gmail, make sure you're using an App Password, not your regular password
  - Check that `EMAIL_ENABLED=true` in `.env`
  - **Connection timeout errors**:
    - Try using port 465 with SSL: `SMTP_PORT=465` and `SMTP_USE_SSL=true`
    - Increase timeout: `SMTP_TIMEOUT=60`
    - Check if your network/firewall blocks SMTP ports (587, 465)
    - If running on a cloud platform (Render, Heroku, etc.), ensure outbound SMTP is allowed
    - The system will automatically try alternative Gmail ports if primary fails
  - Check server logs for detailed error messages

