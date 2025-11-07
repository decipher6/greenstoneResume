import pdfplumber
import mammoth
from io import BytesIO
from typing import Optional

async def parse_pdf(file_content: bytes) -> str:
    """Extract text from PDF file"""
    try:
        with pdfplumber.open(BytesIO(file_content)) as pdf:
            text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"Error parsing PDF: {str(e)}")

async def parse_docx(file_content: bytes) -> str:
    """Extract text from DOCX file"""
    try:
        result = mammoth.extract_raw_text(BytesIO(file_content))
        return result.value.strip()
    except Exception as e:
        raise Exception(f"Error parsing DOCX: {str(e)}")

async def parse_doc(file_content: bytes) -> str:
    """Extract text from DOC file (basic implementation)"""
    # DOC files are more complex, for now we'll try to extract raw text
    try:
        # This is a simplified approach - for production, consider using antiword or LibreOffice
        text = file_content.decode('utf-8', errors='ignore')
        # Remove binary characters
        text = ''.join(char for char in text if ord(char) < 128)
        return text.strip()
    except Exception as e:
        raise Exception(f"Error parsing DOC: {str(e)}")

async def parse_resume(file_content: bytes, filename: str) -> str:
    """Parse resume based on file extension"""
    ext = filename.lower().split('.')[-1]
    
    if ext == 'pdf':
        return await parse_pdf(file_content)
    elif ext in ['docx']:
        return await parse_docx(file_content)
    elif ext in ['doc']:
        return await parse_doc(file_content)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

