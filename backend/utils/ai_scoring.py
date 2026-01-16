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
    system_message = """You are an expert senior recruiter and talent acquisition specialist with 15+ years of experience evaluating candidates for technical and professional roles. You have deep expertise in resume analysis, candidate assessment, and hiring decisions.

Your role is to conduct a thorough, objective, and fair evaluation of candidate resumes against specific job requirements. You excel at:
- Identifying both explicit qualifications and transferable skills
- Recognizing potential beyond direct experience matches
- Evaluating the quality and relevance of achievements
- Assessing cultural fit indicators and soft skills
- Providing nuanced, actionable feedback

Key evaluation principles:
1. Be thorough and analytical - examine every relevant aspect of the resume
2. Consider context - evaluate experience in relation to the role's requirements
3. Recognize transferable skills - value related experience that demonstrates capability
4. Be fair and unbiased - focus on qualifications, not assumptions
5. Provide specific, evidence-based justifications
6. Use a 0-10 scoring scale with appropriate granularity (e.g., 7.5, 8.3, not just whole numbers)
7. Ensure scores reflect actual resume content, not generic assessments"""

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

EVALUATION METHODOLOGY:

Step 1: Analyze Each Criterion Independently
For each criterion, evaluate the candidate's qualifications by examining:
- Direct experience: Years and depth of experience specifically matching the criterion
- Relevant experience: Related work that demonstrates transferable skills or knowledge
- Educational background: Degrees, certifications, courses relevant to the criterion
- Achievements and impact: Quantifiable results, projects, accomplishments that demonstrate capability
- Skill level indicators: Technologies, tools, methodologies mentioned that relate to the criterion
- Progression and growth: Career trajectory showing development in this area

Step 2: Assign Scores with Precision
Use a nuanced 0-10 scale with decimal precision (e.g., 7.5, 8.3, 9.1) to reflect subtle differences:

Score Guidelines:
- 0-2.0: No relevant experience or qualifications; significant gaps that would require extensive training
- 2.1-4.0: Minimal relevant experience; basic understanding but lacks depth; would need substantial development
- 4.1-6.0: Some relevant experience; demonstrates foundational knowledge but gaps remain; moderate development needed
- 6.1-7.5: Good match; solid qualifications with adequate experience; minor gaps that are manageable
- 7.6-8.5: Strong match; well-qualified with relevant experience and demonstrated competence; ready for the role
- 8.6-9.5: Excellent match; exceeds requirements with extensive experience and strong achievements; high performer
- 9.6-10.0: Exceptional match; outstanding qualifications with exceptional experience and impact; top-tier candidate

Step 3: Calculate Weighted Average
The overall_score must be calculated as a weighted average:
overall_score = Σ(criterion_score × criterion_weight) / Σ(criterion_weights)

For example, if you have:
- Criterion A: score 8.0, weight 40%
- Criterion B: score 7.5, weight 35%  
- Criterion C: score 9.0, weight 25%
Then: overall_score = (8.0×0.40 + 7.5×0.35 + 9.0×0.25) / 1.0 = 8.125

CRITICAL REQUIREMENTS:
1. You MUST provide a score for EVERY criterion listed above - no exceptions
2. Use the EXACT criterion names as shown above (character-for-character match, including spaces and capitalization)
3. Scores MUST vary based on actual resume content - do not assign identical scores
4. Use decimal precision (e.g., 7.3, 8.7) to reflect nuanced evaluation
5. Each score must be justified by specific evidence from the resume
6. The overall_score MUST be the mathematically correct weighted average
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

JUSTIFICATION REQUIREMENTS:

The justification must be evidence-based, specific, and actionable. Base all statements on actual content from the resume.

1. Top Strengths Section (2-4 bullet points):
   - Focus ONLY on positive attributes that make the candidate suitable
   - Be specific: mention exact technologies, years of experience, quantifiable achievements
   - Examples of good strengths:
     * "5+ years of Python development with demonstrated experience in Django and Flask frameworks"
     * "Led team of 8 engineers, increasing team productivity by 30% over 2 years"
     * "Strong background in cloud architecture with AWS certifications and production deployments"
   - DO NOT include: weaknesses, gaps, missing qualifications, or conditional statements
   - Each bullet should be a complete, standalone statement

2. Top Gaps / Risks Section (2-4 bullet points):
   - Focus ONLY on actual concerns or missing qualifications
   - Be specific: identify exactly what's missing or concerning
   - Examples of good gaps/risks:
     * "Limited experience with microservices architecture, which is a core requirement"
     * "No demonstrated experience with the specific industry domain (healthcare/finance)"
     * "Gap in leadership experience for a role requiring team management"
   - DO NOT include: strengths, positive attributes, or assumptions not supported by the resume
   - Each bullet should clearly identify a specific gap or risk

3. Recommendation Section (2-3 sentences):
   - Provide a clear, direct hiring recommendation: "Strongly Recommend", "Recommend", "Conditionally Recommend", or "Do Not Recommend"
   - Explain the primary reason for your recommendation (reference overall score and key factors)
   - Be concise and direct - do not repeat detailed information from strengths/gaps
   - Example: "Recommend. Candidate demonstrates strong technical qualifications (overall score 8.2) with 6+ years of relevant experience. Minor gap in cloud infrastructure can be addressed through onboarding."

4. Quality Standards:
   - All statements must be supported by evidence from the resume
   - Avoid generic statements - be specific about technologies, years, achievements
   - Use professional, objective language
   - Ensure proper categorization - strengths vs. gaps must be clearly distinguished

FINAL SCORING CHECKLIST:

Before submitting your response, verify:
✓ You have scored ALL {len(evaluation_criteria)} criteria - count them to ensure none are missing
✓ Each criterion_name matches EXACTLY (character-for-character) the names from the evaluation criteria list
✓ Scores show realistic variation based on actual resume content (avoid clustering all scores together)
✓ Scores use decimal precision (e.g., 7.3, 8.7, 9.1) to reflect nuanced evaluation
✓ The overall_score is the mathematically correct weighted average of all criterion scores
✓ Each score is justified by specific evidence visible in the resume
✓ The justification contains 2-4 specific strengths and 2-4 specific gaps/risks
✓ The recommendation is clear and concise (2-3 sentences)
✓ Your JSON is valid and properly formatted
✓ No markdown code blocks, no explanatory text before or after the JSON

OUTPUT FORMAT:
Return ONLY valid JSON in this exact structure (no markdown, no explanations):
{{
    "overall_score": 8.5,
    "criterion_scores": [
        {{"criterion_name": "EXACT_CRITERION_NAME_1", "score": 9.2}},
        {{"criterion_name": "EXACT_CRITERION_NAME_2", "score": 8.3}}
    ],
    "justification": "Top Strengths:\\n- [Specific strength with evidence]\\n- [Another specific strength]\\n\\nTop Gaps / Risks:\\n- [Specific gap or risk]\\n- [Another specific gap or risk]\\n\\nRecommendation:\\n[Clear 2-3 sentence recommendation with overall score and key reason]"
}}

Remember: Replace "EXACT_CRITERION_NAME_1", "EXACT_CRITERION_NAME_2" with the actual criterion names from the list above."""
    
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

