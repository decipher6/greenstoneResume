import pdfplumber
import mammoth
import re
from io import BytesIO
from typing import Optional

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
            
            # Last resort: return a minimal placeholder indicating image-based PDF
            # This allows the file to be accepted even if no text is extractable
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

async def parse_doc(file_content: bytes) -> str:
    """Extract text from DOC file (basic implementation) - accepts whatever is available"""
    # DOC files are more complex, for now we'll try to extract raw text
    try:
        # This is a simplified approach - for production, consider using antiword or LibreOffice
        text = file_content.decode('utf-8', errors='ignore')
        # Remove binary characters but keep readable text
        text = ''.join(char for char in text if ord(char) < 128 and (char.isprintable() or char.isspace()))
        # Clean up excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        if text and len(text) > 10:  # Only return if we got meaningful text
            return text
        
        # If minimal text, return placeholder
        return "DOC file - text extraction limited. File accepted for processing."
    except Exception as e:
        # Even on error, return placeholder to accept the file
        return f"DOC file - extraction had issues: {str(e)}. File accepted for processing."

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

