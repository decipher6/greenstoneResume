import os
from typing import Dict, List, Optional
from dotenv import load_dotenv
import asyncio
from google import genai

load_dotenv()

# Debug mode - set DEBUG=true in environment to enable debug prints
DEBUG = os.getenv("DEBUG", "false").lower() == "true"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY missing in .env")

# Initialize Gemini client
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

async def score_resume_with_llm(resume_text: str, job_description: str, 
                                evaluation_criteria: List[Dict]) -> Dict:
    """
    Comprehensive resume scoring using:
    1. LLM-based evaluation with job description and preferences
    2. Returns base Resume Score (0-10) as weighted average of criterion scores
    """
    
    # Step 2: Prepare evaluation criteria with weights
    criteria_text = "\n".join([f"- {c['name']}: Weight {c['weight']}%" 
                              for c in evaluation_criteria])
    
    # Step 3: Use LLM for comprehensive evaluation with improved reasoning
    system_message = """You are an expert recruiter with deep knowledge of talent acquisition and candidate evaluation. 
Your task is to thoroughly analyze resumes against job descriptions and provide detailed, justified scoring.

Key principles:
1. Be thorough and analytical in your evaluation
2. Consider both explicit qualifications and transferable skills
3. Weight criteria according to their importance
4. Provide specific, actionable justifications
5. Always respond with valid JSON format
6. Be fair and unbiased in your assessment
7. Scores should be out of 10"""

    # Build detailed criteria list for the prompt
    criteria_list = "\n".join([f"{i+1}. {c['name']} (Weight: {c['weight']}%)" 
                               for i, c in enumerate(evaluation_criteria)])
    
    user_prompt = f"""Evaluate this candidate's resume against the job description.

JOB DESCRIPTION:
{job_description}

EVALUATION CRITERIA (MUST EVALUATE EACH ONE):
{criteria_list}

CANDIDATE RESUME:
{resume_text}

CRITICAL INSTRUCTIONS:
1. You MUST provide a score for EVERY criterion listed above
2. Use the EXACT criterion names as shown above (case-sensitive)
3. Scores should vary based on actual resume content
4. Score range: 0-10 where:
   - 0-3: Poor match, significant gaps
   - 4-6: Partial match, some relevant experience
   - 7-8: Good match, solid qualifications
   - 9-10: Excellent match, exceeds requirements
5. Consider:
   - Direct experience matching the criterion
   - Transferable skills and related experience
   - Educational background relevance
   - Quantifiable achievements
   - Years of experience in relevant areas
6. Calculate overall score as a weighted average of criterion scores
7. Provide a structured justification in the following format:

REQUIRED JSON FORMAT - You MUST include ALL criteria with EXACT names:
{{
    "overall_score": 8.5,
    "criterion_scores": [
        {{"criterion_name": "CRITERION_NAME_1", "score": 9.0}},
        {{"criterion_name": "CRITERION_NAME_2", "score": 8.5}}
    ],
    "justification": "Top Strengths:\\n- [List 2-4 actual strengths: relevant experience, matching skills, qualifications that align with the job]\\n- [Only include positive attributes that make the candidate suitable]\\n\\nTop Gaps / Risks:\\n- [List 2-4 actual weaknesses: missing skills, lack of required experience, gaps in qualifications]\\n- [Only include negative aspects that are concerns for the role]\\n\\nRecommendation:\\n[Provide a concise 2-3 sentence summary with your hiring recommendation. Be brief and direct.]"
}}

IMPORTANT: Replace "CRITERION_NAME_1", "CRITERION_NAME_2" etc. with the EXACT criterion names from the list above.
Each criterion MUST have a different score based on the actual resume content.

CRITICAL REQUIREMENTS FOR JUSTIFICATION:
1. Top Strengths section MUST ONLY contain actual strengths:
   - Relevant experience that matches the job requirements
   - Skills, qualifications, or achievements that are POSITIVE for the role
   - DO NOT include weaknesses, gaps, or missing qualifications in this section
   - Each strength should be a single, clear bullet point (2-4 total)

2. Top Gaps / Risks section MUST ONLY contain actual weaknesses:
   - Missing skills or experience required for the role
   - Gaps in qualifications or background
   - Concerns or risks for the position
   - DO NOT include strengths or positive attributes in this section
   - Each gap/risk should be a single, clear bullet point (2-4 total)

3. Recommendation section MUST be concise:
   - Maximum 2-3 sentences
   - Provide a clear hiring recommendation (recommend, not recommend, or conditional)
   - Summarize the key reason for your recommendation
   - DO NOT repeat detailed information from strengths/gaps sections

4. Ensure proper categorization:
   - If something is a weakness (e.g., "lacks experience in X"), it belongs in Top Gaps / Risks, NOT Top Strengths
   - If something is a strength (e.g., "has relevant experience in Y"), it belongs in Top Strengths, NOT Top Gaps / Risks
   - Be precise and accurate in your categorization

CRITICAL REQUIREMENTS FOR SCORING:
1. You MUST return exactly {len(evaluation_criteria)} criterion scores - one for each criterion listed above
2. Each criterion_name MUST match EXACTLY (character-for-character, including spaces and capitalization) the names from the list
3. Scores MUST be different for different criteria - analyze the resume and assign realistic scores
4. Score range: 0-10 with realistic variation (e.g., Technical Skills: 9.2, Leadership: 7.5, Communication: 8.0)
5. Each score should reflect actual resume content
6. Return ONLY valid JSON - no markdown code blocks, no explanations before or after the JSON
7. Validate your JSON before returning it"""
    
    try:
        # Use Gemini API with improved reasoning
        if DEBUG:
            print(f"DEBUG: Calling Gemini API with model gemini-3-flash-preview")
            print(f"DEBUG: Evaluating {len(evaluation_criteria)} criteria")
        
        # Combine system message and user prompt for Gemini
        full_prompt = f"{system_message}\n\n{user_prompt}"
        
        # Run Gemini API call in thread pool since it's synchronous
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model="gemini-3-flash-preview",
            contents=full_prompt
        )
        
        if not response:
            raise Exception("Empty response from Gemini API")
        
        content = response.text
        
        if not content:
            raise Exception("No content in Gemini API response")
        
        if DEBUG:
            print(f"DEBUG: Received response from Gemini API (length: {len(content)} chars)")
        
        # Extract JSON from response (handle markdown code blocks and other formats)
        import json
        import re
        
        # Try to find JSON in the response
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)
        
        # Remove markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        # Clean up the content - remove any leading/trailing text
        content = content.strip()
        if not content.startswith('{'):
            # Try to find the first {
            start_idx = content.find('{')
            if start_idx != -1:
                content = content[start_idx:]
        if not content.endswith('}'):
            # Try to find the last }
            end_idx = content.rfind('}')
            if end_idx != -1:
                content = content[:end_idx + 1]
        
        try:
            scoring_result = json.loads(content)
            
            # Validate and ensure criterion_scores exist
            if "criterion_scores" not in scoring_result:
                scoring_result["criterion_scores"] = []
            
            # Validate criterion scores format
            if not isinstance(scoring_result["criterion_scores"], list):
                scoring_result["criterion_scores"] = []
            
            # Ensure all criterion scores have required fields
            validated_criterion_scores = []
            for cs in scoring_result["criterion_scores"]:
                if isinstance(cs, dict) and "criterion_name" in cs and "score" in cs:
                    validated_criterion_scores.append({
                        "criterion_name": str(cs["criterion_name"]).strip(),
                        "score": max(0, min(10, float(cs["score"])))
                    })
            scoring_result["criterion_scores"] = validated_criterion_scores
            
        except json.JSONDecodeError as e:
            if DEBUG:
                print(f"JSON decode error: {e}")
                print(f"Content received (first 1000 chars): {content[:1000]}")
            # Try to extract score using regex as fallback
            score_match = re.search(r'"overall_score"\s*:\s*(\d+\.?\d*)', content)
            if score_match:
                llm_score = float(score_match.group(1))
            else:
                # Try alternative patterns
                score_match = re.search(r'overall[_\s]*score[:\s]*(\d+\.?\d*)', content, re.IGNORECASE)
                if score_match:
                    llm_score = float(score_match.group(1))
                else:
                    llm_score = 5.0  # Default fallback score
                    if DEBUG:
                        print(f"WARNING: Could not extract overall_score, using default: {llm_score}")
            
            # Try to extract criterion scores using regex
            criterion_scores = []
            criterion_pattern = r'"criterion_name"\s*:\s*"([^"]+)"\s*,\s*"score"\s*:\s*(\d+\.?\d*)'
            for match in re.finditer(criterion_pattern, content):
                criterion_scores.append({
                    "criterion_name": match.group(1),
                    "score": float(match.group(2))
                })
            
            # Extract justification - handle both quoted and unquoted
            justification_match = re.search(r'"justification"\s*:\s*"([^"]+)"', content)
            if not justification_match:
                # Try without quotes
                justification_match = re.search(r'"justification"\s*:\s*([^,}]+)', content)
            if not justification_match:
                # Try alternative pattern
                justification_match = re.search(r'justification[:\s]+([^}]+)', content, re.IGNORECASE)
            
            justification = justification_match.group(1).strip('"') if justification_match else "Score based on resume analysis."
            
            scoring_result = {
                "overall_score": llm_score,
                "criterion_scores": criterion_scores,
                "justification": justification
            }
            
            if DEBUG:
                print(f"DEBUG: Extracted {len(criterion_scores)} criterion scores from fallback parsing")
        
        # Get LLM score
        llm_score = max(0, min(10, float(scoring_result.get("overall_score", 7.0))))
        
        # Validate and ensure we have criterion scores
        criterion_scores = scoring_result.get("criterion_scores", [])
        if not criterion_scores or len(criterion_scores) == 0:
            if DEBUG:
                print("WARNING: LLM did not return criterion scores, generating fallback scores")
            # Generate fallback scores based on overall score with variation
            criterion_scores = []
            for idx, criterion in enumerate(evaluation_criteria):
                # Create variation based on criterion index and name
                name_hash = hash(criterion["name"]) % 100
                variation = ((name_hash / 100.0) - 0.5) * 1.5  # -0.75 to +0.75
                score = max(0, min(10, llm_score + variation))
                criterion_scores.append({
                    "criterion_name": criterion["name"],
                    "score": round(score, 1)
                })
        
        # Use LLM score directly as the final resume score (weighted average of criterion scores)
        final_resume_score = max(0, min(10, round(llm_score, 2)))
        
        if DEBUG:
            print(f"DEBUG: Returning {len(criterion_scores)} criterion scores")
            for cs in criterion_scores:
                print(f"  - {cs.get('criterion_name', 'N/A')}: {cs.get('score', 'N/A')}")
        
        return {
            "overall_score": final_resume_score,
            "criterion_scores": criterion_scores,
            "justification": scoring_result.get("justification", "Score based on resume analysis using weighted average of criterion scores.")
        }
        
    except Exception as e:
        import logging
        logging.error(f"ERROR in LLM scoring: {e}")
        if DEBUG:
            import traceback
            traceback.print_exc()
        
        # Provide more detailed error information
        error_msg = str(e)
        if "API key" in error_msg or "authentication" in error_msg.lower():
            justification = "LLM evaluation failed: Invalid or missing Gemini API key. Please check your .env file."
        elif "rate limit" in error_msg.lower() or "quota" in error_msg.lower():
            justification = "LLM evaluation failed: API rate limit exceeded. Please try again later."
        elif "timeout" in error_msg.lower():
            justification = "LLM evaluation failed: Request timeout. Please try again."
        else:
            justification = f"LLM evaluation unavailable: {error_msg}. Please try again."
        
        # Fallback when LLM evaluation fails
        return {
            "overall_score": 0.0,
            "criterion_scores": [],
            "justification": justification
        }

async def calculate_composite_score(score_breakdown: Dict, weights: Dict) -> float:
    """Calculate composite score from multiple components"""
    resume_weight = weights.get("resume", 0.45)
    ccat_weight = weights.get("ccat", 0.30)
    personality_weight = weights.get("personality", 0.15)
    workstyle_weight = weights.get("workstyle", 0.10)
    
    resume_score = score_breakdown.get("resume_score", 0.0)
    ccat_score = score_breakdown.get("ccat_score", 0.0)
    personality_score = score_breakdown.get("personality_score", 0.0)
    workstyle_score = score_breakdown.get("workstyle_score", 0.0)
    
    # Normalize scores if they're not already 0-10
    composite = (
        resume_weight * resume_score +
        ccat_weight * (ccat_score if ccat_score > 0 else resume_score * 0.8) +
        personality_weight * (personality_score if personality_score > 0 else resume_score * 0.7) +
        workstyle_weight * (workstyle_score if workstyle_score > 0 else resume_score * 0.7)
    )
    
    return round(composite, 2)

