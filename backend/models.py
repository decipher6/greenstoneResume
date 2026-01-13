from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum

class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    name: str
    password_hash: str
    created_at: Optional[datetime] = None

class EvaluationCriterion(BaseModel):
    name: str
    weight: float  # 0-100

class JobStatus(str, Enum):
    active = "active"
    paused = "paused"
    closed = "closed"

class JobCreate(BaseModel):
    title: str
    department: str
    description: str
    evaluation_criteria: List[EvaluationCriterion]

class Job(JobCreate):
    id: Optional[str] = None
    status: JobStatus = JobStatus.active
    created_at: Optional[datetime] = None
    last_run: Optional[datetime] = None
    candidate_count: int = 0

class ContactInfo(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None

class CandidateStatus(str, Enum):
    uploaded = "uploaded"
    analyzing = "analyzing"
    analyzed = "analyzed"
    shortlisted = "shortlisted"
    rejected = "rejected"

class ScoreBreakdown(BaseModel):
    resume_score: float
    ccat_score: Optional[float] = None
    personality_score: Optional[float] = None
    workstyle_score: Optional[float] = None
    overall_score: float

class CriterionScore(BaseModel):
    criterion_name: str
    score: float
    weight: float

class PersonalityTraits(BaseModel):
    openness: float = 0.0
    conscientiousness: float = 0.0
    extraversion: float = 0.0
    agreeableness: float = 0.0
    neuroticism: float = 0.0

class Candidate(BaseModel):
    id: Optional[str] = None
    job_id: str
    name: str
    contact_info: ContactInfo
    resume_text: Optional[str] = None
    resume_file_path: Optional[str] = None
    linkedin_url: Optional[str] = None
    status: CandidateStatus = CandidateStatus.uploaded
    score_breakdown: Optional[ScoreBreakdown] = None
    criterion_scores: Optional[List[CriterionScore]] = None
    personality_profile: Optional[PersonalityTraits] = None
    ai_justification: Optional[str] = None
    created_at: Optional[datetime] = None
    analyzed_at: Optional[datetime] = None

class CCATResult(BaseModel):
    candidate_id: str
    percentile: float
    raw_score: Optional[float] = None

class PersonalityResult(BaseModel):
    candidate_id: str
    traits: PersonalityTraits

class AssessmentUpload(BaseModel):
    candidate_name: str
    candidate_phone: str
    job_id: str

class EmailTemplate(BaseModel):
    subject: str
    body: str
    template_type: str = "rejection"

class EmailSend(BaseModel):
    candidate_ids: List[str]
    template: EmailTemplate
    job_id: str

class InterviewLinksRequest(BaseModel):
    job_id: str
    candidate_ids: List[str]
    template: EmailTemplate

class ActivityLog(BaseModel):
    id: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    action: str  # e.g., "job_created", "candidate_uploaded", "analysis_run", "email_sent"
    entity_type: str  # e.g., "job", "candidate", "email"
    entity_id: Optional[str] = None
    description: str
    metadata: Optional[Dict] = None
    created_at: Optional[datetime] = None
