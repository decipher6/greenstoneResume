import pdfplumber
import mammoth
import re
from io import BytesIO
from typing import Optional
import subprocess
import tempfile
import os

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
    """Extract text from DOC file using antiword (primary) with binary decoding fallback"""
    text = None
    
    # Strategy 1: Use antiword subprocess for .doc files (most reliable)
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.doc') as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name
        
        try:
            result = subprocess.run(
                ['antiword', tmp_path],
                capture_output=True,
                text=True,
                timeout=30,
                errors='ignore'
            )
            if result.returncode == 0 and result.stdout:
                text = result.stdout
                if text and len(text.strip()) > 50:
                    cleaned = clean_doc_text(text)
                    if cleaned and len(cleaned.strip()) > 50:
                        return cleaned
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            # antiword not available or failed
            pass
        finally:
            try:
                os.unlink(tmp_path)
            except:
                pass
    except Exception as e:
        pass
    
    # Strategy 2: Only use binary decoding as last resort (if antiword unavailable)
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

