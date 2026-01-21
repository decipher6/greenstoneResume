import pdfplumber
import mammoth
import re
from io import BytesIO
from typing import Optional, Dict, Tuple
import tempfile
import os
import convertapi
from dotenv import load_dotenv
import asyncio
import base64
from google import genai

load_dotenv()

# Initialize Gemini client for OCR
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

async def extract_info_from_image_pdf_with_ai(file_content: bytes) -> Tuple[str, Dict[str, Optional[str]]]:
    """
    Use Gemini Vision API to extract text and contact info from image-based PDF.
    Returns (extracted_text, contact_info_dict)
    """
    if not gemini_client:
        return ("Image-based PDF - OCR not available (GEMINI_API_KEY missing).", {})
    
    try:
        import fitz  # PyMuPDF
    except ImportError:
        # Fallback: try to use pdfplumber to get images (limited support)
        return ("Image-based PDF - OCR requires PyMuPDF. Install with: pip install pymupdf", {})
    
    try:
        # Open PDF with PyMuPDF
        pdf_doc = fitz.open(stream=file_content, filetype="pdf")
        all_text_parts = []
        
        # Process first 3 pages (most resumes are 1-2 pages)
        max_pages = min(3, len(pdf_doc))
        
        for page_num in range(max_pages):
            page = pdf_doc[page_num]
            
            # Convert page to image (PNG)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better OCR
            img_bytes = pix.tobytes("png")
            
            # Convert to base64 for Gemini API
            img_base64 = base64.b64encode(img_bytes).decode('utf-8')
            
            # Use Gemini Vision API to extract text
            prompt = """Extract all text from this resume image. Return the complete text content exactly as it appears, preserving line breaks and structure. 
            Also identify and extract:
            1. Candidate's full name (usually at the top)
            2. Email address
            3. Phone number
            
            Format your response as:
            TEXT_CONTENT:
            [all the text from the resume]
            
            CONTACT_INFO:
            Name: [full name]
            Email: [email address]
            Phone: [phone number]"""
            
            try:
                # Use Gemini Vision API
                response = await asyncio.to_thread(
                    gemini_client.models.generate_content,
                    model="gemini-1.5-flash",
                    contents=[
                        prompt,
                        {
                            "mime_type": "image/png",
                            "data": img_base64
                        }
                    ]
                )
                
                if response and response.text:
                    page_text = response.text
                    all_text_parts.append(page_text)
            except Exception as e:
                print(f"Error in Gemini OCR for page {page_num + 1}: {str(e)}")
                continue
        
        pdf_doc.close()
        
        if not all_text_parts:
            return ("Image-based PDF - OCR extraction failed.", {})
        
        # Combine all pages
        combined_text = "\n\n".join(all_text_parts)
        
        # Extract contact info from the OCR text
        contact_info = {}
        
        # Extract name
        name_match = re.search(r'Name:\s*([^\n]+)', combined_text, re.IGNORECASE)
        if name_match:
            contact_info['name'] = name_match.group(1).strip()
        
        # Extract email
        email_match = re.search(r'Email:\s*([^\n]+)', combined_text, re.IGNORECASE)
        if email_match:
            email = email_match.group(1).strip()
            # Validate it's actually an email
            if '@' in email and '.' in email.split('@')[1]:
                contact_info['email'] = email
        
        # Extract phone
        phone_match = re.search(r'Phone:\s*([^\n]+)', combined_text, re.IGNORECASE)
        if phone_match:
            phone = phone_match.group(1).strip()
            # Clean phone number
            cleaned_phone = re.sub(r'[^\d+]', '', phone)
            if len(cleaned_phone) >= 7:
                contact_info['phone'] = cleaned_phone
        
        # Also try to extract from the text content itself (in case AI didn't format it)
        if not contact_info.get('email'):
            email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
            emails = re.findall(email_pattern, combined_text)
            if emails:
                contact_info['email'] = emails[0]
        
        if not contact_info.get('phone'):
            phone_pattern = r'[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,6}(?:[-\s\.\(\)]?[0-9]{1,6}){2,8}'
            phones = re.findall(phone_pattern, combined_text)
            if phones:
                cleaned_phone = re.sub(r'[^\d+]', '', phones[0])
                if len(cleaned_phone) >= 7:
                    contact_info['phone'] = cleaned_phone
        
        # Extract name from first line if not found
        if not contact_info.get('name'):
            lines = combined_text.split('\n')
            for line in lines[:5]:
                line = line.strip()
                if line and len(line.split()) >= 2 and len(line.split()) <= 4:
                    if line.replace(' ', '').isalpha() or (line.replace(' ', '').isalnum() and len(line) < 50):
                        contact_info['name'] = line
                        break
        
        # Clean up the text - remove the CONTACT_INFO section if present
        text_content = re.sub(r'CONTACT_INFO:.*?Phone:.*?\n', '', combined_text, flags=re.DOTALL | re.IGNORECASE)
        text_content = re.sub(r'TEXT_CONTENT:\s*', '', text_content, flags=re.IGNORECASE)
        text_content = text_content.strip()
        
        return (text_content if text_content else combined_text, contact_info)
        
    except Exception as e:
        print(f"Error in OCR extraction: {str(e)}")
        return (f"Image-based PDF - OCR extraction error: {str(e)}", {})

async def parse_pdf(file_content: bytes) -> str:
    """Extract text from PDF file - handles both text-based and image-based PDFs"""
    text_parts = []
    
    try:
        with pdfplumber.open(BytesIO(file_content)) as pdf:
            # Try primary text extraction
            for page in pdf.pages:
                # Method 1: Extract regular text
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    text_parts.append(page_text.strip())
                    continue
                
                # Method 2: Try extracting from tables (sometimes text is in table format)
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        for row in table:
                            if row:
                                row_text = " ".join([str(cell) if cell else "" for cell in row])
                                if row_text.strip():
                                    text_parts.append(row_text.strip())
                
                # Method 3: Try extracting text with layout preservation
                try:
                    page_text_layout = page.extract_text(layout=True)
                    if page_text_layout and page_text_layout.strip() and page_text_layout not in text_parts:
                        text_parts.append(page_text_layout.strip())
                except:
                    pass
                
                # Method 4: Extract any words/chars available
                try:
                    chars = page.chars
                    if chars:
                        words = []
                        current_word = ""
                        for char in chars:
                            if char.get('text'):
                                if char.get('text').strip():
                                    current_word += char.get('text')
                                else:
                                    if current_word.strip():
                                        words.append(current_word.strip())
                                    current_word = ""
                        if current_word.strip():
                            words.append(current_word.strip())
                        if words:
                            text_parts.append(" ".join(words))
                except:
                    pass
            
            # Combine all extracted text
            combined_text = "\n".join(text_parts)
            
            # If we got some text, return it (even if minimal)
            if combined_text and combined_text.strip():
                return combined_text.strip()
            
            # If no text extracted, try to get metadata
            try:
                metadata = pdf.metadata
                if metadata:
                    metadata_text = []
                    if metadata.get('Title'):
                        metadata_text.append(f"Title: {metadata.get('Title')}")
                    if metadata.get('Author'):
                        metadata_text.append(f"Author: {metadata.get('Author')}")
                    if metadata.get('Subject'):
                        metadata_text.append(f"Subject: {metadata.get('Subject')}")
                    if metadata_text:
                        return "\n".join(metadata_text)
            except:
                pass
            
            # Last resort: try OCR for image-based PDF
            # This allows the file to be accepted even if no text is extractable
            ocr_text, _ = await extract_info_from_image_pdf_with_ai(file_content)
            if ocr_text and not ocr_text.startswith("Image-based PDF - OCR"):
                return ocr_text
            # If OCR also failed, return placeholder
            return "Image-based PDF - text extraction not available. File accepted for processing."
            
    except Exception as e:
        # Even if parsing fails completely, try to return something
        # This allows image-based PDFs to be accepted
        error_msg = str(e)
        if "password" in error_msg.lower() or "encrypted" in error_msg.lower():
            raise Exception(f"PDF is password-protected or encrypted: {error_msg}")
        # For other errors (like image-based PDFs), return a placeholder
        return "PDF file - text extraction limited. File accepted for processing."

async def parse_docx(file_content: bytes) -> str:
    """Extract text from DOCX file - handles files with images"""
    try:
        # Try extracting raw text first
        result = mammoth.extract_raw_text(BytesIO(file_content))
        text = result.value.strip()
        
        if text:
            return text
        
        # If no text, try extracting with formatting (sometimes helps)
        try:
            result_formatted = mammoth.extract_text(BytesIO(file_content))
            if result_formatted.value and result_formatted.value.strip():
                return result_formatted.value.strip()
        except:
            pass
        
        # If still no text, return placeholder (file may be image-only)
        return "DOCX file - text extraction limited. File accepted for processing."
    except Exception as e:
        # Even on error, try to return something
        error_msg = str(e)
        if "corrupted" in error_msg.lower() or "invalid" in error_msg.lower():
            raise Exception(f"DOCX file appears corrupted: {error_msg}")
        # For other errors, return placeholder
        return f"DOCX file - extraction had issues: {error_msg}. File accepted for processing."

def clean_doc_text(text: str) -> str:
    """Clean extracted text from .doc files to remove artifacts and binary data"""
    if not text:
        return ""
    
    # Remove common binary artifacts and control characters
    # Remove null bytes and other non-printable control characters (except newlines, tabs, carriage returns)
    text = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]', '', text)
    
    # Remove artifacts that look like binary data (sequences of non-printable or weird characters)
    text = re.sub(r'[^\x20-\x7E\n\r\t]{2,}', ' ', text)  # Remove sequences of 2+ non-printable chars
    
    # Remove common Word document metadata patterns at the start
    text = re.sub(r'^(?:\s*[^\w\s]*\s*)*(?:Microsoft|MS|Word|Document|Version|Created|Modified|Author|Subject|Title)[^\n]*\n?', '', text, flags=re.IGNORECASE | re.MULTILINE)
    
    # Remove email-like artifacts that are clearly not real emails (too many special chars)
    text = re.sub(r'\S*[^\w\s@.-]{3,}\S*', ' ', text)
    
    # Split into lines for processing
    lines = text.split('\n')
    cleaned_lines = []
    
    # First pass: remove obviously bad lines
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Skip lines that are mostly non-alphabetic (likely artifacts)
        alpha_count = sum(1 for c in line if c.isalpha())
        alpha_ratio = alpha_count / len(line) if line else 0
        
        # Keep lines only if they have reasonable alphabetic content
        # (alpha_ratio >= 0.3 OR alpha_count >= 5)
        if alpha_ratio < 0.3 and alpha_count < 5 and len(line) > 5:
            continue
        
        # Skip lines that are just repeated characters or patterns
        if len(set(line.replace(' ', ''))) <= 2 and len(line) > 3:
            continue
        
        # Skip lines that are mostly numbers and special chars (likely binary artifacts)
        if alpha_count < 3 and len(line) > 10:
            continue
        
        cleaned_lines.append(line)
    
    if not cleaned_lines:
        return ""
    
    text = '\n'.join(cleaned_lines)
    
    # Aggressively remove artifacts from the beginning
    # Find the first line that looks like real text (has at least 3 meaningful words)
    lines = text.split('\n')
    start_idx = 0
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        # Check if this looks like real text
        words = line.split()
        if len(words) >= 3:  # At least 3 words
            # Check if it has proper words (not just symbols)
            word_count = sum(1 for w in words if any(c.isalpha() for c in w))
            if word_count >= 3:  # At least 3 meaningful words
                start_idx = i
                break
    
    # Aggressively remove artifacts from the end
    # Find the last line that looks like real text (has at least 3 meaningful words)
    end_idx = len(lines)
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i].strip()
        if not line:
            continue
        words = line.split()
        if len(words) >= 3:  # At least 3 words
            word_count = sum(1 for w in words if any(c.isalpha() for c in w))
            if word_count >= 3:  # At least 3 meaningful words
                end_idx = i + 1
                break
    
    # Extract the cleaned portion
    if start_idx < end_idx:
        text = '\n'.join(lines[start_idx:end_idx])
    else:
        # Fallback: use all lines if we couldn't find good boundaries
        text = '\n'.join(lines)
    
    # More aggressively trim binary artifacts from start and end
    # Remove non-alphabetic characters from the very start
    while text and len(text) > 0:
        first_char = text[0]
        if first_char.isalnum() or first_char in ['\n', '\t']:
            break
        text = text[1:]
    
    # Remove non-alphabetic characters from the very end
    while text and len(text) > 0:
        last_char = text[-1]
        if last_char.isalnum() or last_char in ['\n', '\t', '.', '!', '?', ',', ';', ':']:
            break
        text = text[:-1]
    
    # Clean up excessive whitespace
    text = re.sub(r'[ \t]+', ' ', text)  # Multiple spaces/tabs to single space
    text = re.sub(r'\n{3,}', '\n\n', text)  # Multiple newlines to double newline
    
    # Final cleanup: remove any remaining weird patterns at start/end
    # Remove lines at start that don't look like text (need at least 3 meaningful words)
    lines = text.split('\n')
    while lines and len(lines) > 0:
        first_line = lines[0].strip()
        if not first_line:
            lines.pop(0)
            continue
        words = first_line.split()
        if len(words) >= 3 and sum(1 for w in words if any(c.isalpha() for c in w)) >= 3:
            break
        lines.pop(0)
    
    # Remove lines at end that don't look like text (need at least 3 meaningful words)
    while lines and len(lines) > 0:
        last_line = lines[-1].strip()
        if not last_line:
            lines.pop()
            continue
        words = last_line.split()
        if len(words) >= 3 and sum(1 for w in words if any(c.isalpha() for c in w)) >= 3:
            break
        lines.pop()
    
    text = '\n'.join(lines)
    
    return text.strip()

async def parse_doc(file_content: bytes) -> str:
    """Extract text from DOC file by converting to DOCX using ConvertAPI, then parsing with mammoth"""
    text = None
    
    # Strategy 1: Convert .doc to .docx using ConvertAPI, then parse with mammoth
    try:
        # Get ConvertAPI credentials from environment variable
        convertapi_key = os.getenv("CONVERTAPI_KEY")
        if not convertapi_key:
            raise ValueError("CONVERTAPI_KEY environment variable is not set")
        
        # Set ConvertAPI credentials
        convertapi.api_credentials = convertapi_key
        
        # Create temporary directory for conversion output
        with tempfile.TemporaryDirectory() as temp_dir:
            # Write .doc file to temporary location
            doc_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix='.doc', dir=temp_dir) as tmp_doc:
                    tmp_doc.write(file_content)
                    doc_path = tmp_doc.name
                
                # Convert .doc to .docx using ConvertAPI
                result = convertapi.convert('docx', {
                    'File': doc_path
                }, from_format='doc')
                
                # Save converted file(s) to temp directory
                result.save_files(temp_dir)
                
                # Find the converted .docx file (ConvertAPI may name it differently)
                converted_files = [f for f in os.listdir(temp_dir) if f.endswith('.docx') and f != os.path.basename(doc_path)]
                
                if converted_files:
                    # Use the first .docx file found
                    docx_path = os.path.join(temp_dir, converted_files[0])
                    
                    # Read the converted .docx file
                    with open(docx_path, 'rb') as f:
                        docx_content = f.read()
                    
                    # Parse the .docx file using mammoth
                    mammoth_result = mammoth.extract_raw_text(BytesIO(docx_content))
                    text = mammoth_result.value.strip()
                    
                    if text and len(text.strip()) > 50:
                        # Clean the extracted text
                        cleaned = clean_doc_text(text)
                        if cleaned and len(cleaned.strip()) > 50:
                            return cleaned
            finally:
                # Cleanup temporary files
                try:
                    if doc_path and os.path.exists(doc_path):
                        os.unlink(doc_path)
                except:
                    pass
    except Exception as e:
        # ConvertAPI conversion failed, continue to fallback
        # Log error for debugging but don't fail
        print(f"ConvertAPI conversion failed: {str(e)}")
        pass
    
    # Strategy 2: Only use binary decoding as last resort
    try:
        # Try multiple encodings
        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        for encoding in encodings:
            try:
                decoded = file_content.decode(encoding, errors='ignore')
                # Extract readable text more carefully
                # Look for sequences of words (more than just random characters)
                words = re.findall(r'\b[A-Za-z]{2,}\b', decoded)
                if len(words) > 10:  # Found meaningful words
                    # Reconstruct text around word positions
                    text_parts = []
                    last_pos = 0
                    for word in words[:100]:  # Limit to first 100 words to avoid too much noise
                        pos = decoded.find(word, last_pos)
                        if pos != -1:
                            # Extract context around the word
                            start = max(0, pos - 50)
                            end = min(len(decoded), pos + len(word) + 50)
                            text_parts.append(decoded[start:end])
                            last_pos = pos + len(word)
                    
                    if text_parts:
                        text = ' '.join(text_parts)
                        # Extract only readable portions
                        text = ''.join(char for char in text if char.isprintable() or char.isspace())
                        text = re.sub(r'\s+', ' ', text)
                        if text and len(text.strip()) > 50:
                            cleaned = clean_doc_text(text)
                            if cleaned and len(cleaned.strip()) > 50:
                                return cleaned
                    break
            except:
                continue
    except Exception as e:
        pass
    
    # If all strategies failed, return a placeholder
    if text and len(text.strip()) > 10:
        cleaned = clean_doc_text(text)
        if cleaned and len(cleaned.strip()) > 10:
            return cleaned
    
    return "DOC file - text extraction limited. File accepted for processing."

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

