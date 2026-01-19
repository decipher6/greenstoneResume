import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Brain, Mail, Upload, RefreshCw, Calendar, Send, Trash2, CheckCircle, XCircle, HelpCircle, Star } from 'lucide-react'
import { getCandidate, uploadCandidateAssessments, reAnalyzeCandidate, deleteCandidate, getJob, getCandidates, updateCandidate } from '../services/api'
import { BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useModal } from '../context/ModalContext'
import SendEmailModal from '../components/SendEmailModal'
import SendInterviewModal from '../components/SendInterviewModal'

const CandidateProfile = () => {
  const { candidateId } = useParams()
  const navigate = useNavigate()
  const { showConfirm, showAlert } = useModal()
  const [candidate, setCandidate] = useState(null)
  const [job, setJob] = useState(null)
  const [allCandidates, setAllCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [reAnalyzing, setReAnalyzing] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showInterviewModal, setShowInterviewModal] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchCandidate()
  }, [candidateId])

  const fetchCandidate = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getCandidate(candidateId)
      const candidateData = response.data
      setCandidate(candidateData)
      
      // Fetch job data and all candidates for percentile calculation
      if (candidateData.job_id) {
        const [jobResponse, candidatesResponse] = await Promise.all([
          getJob(candidateData.job_id),
          getCandidates(candidateData.job_id)
        ])
        setJob(jobResponse.data)
        setAllCandidates(candidatesResponse.data || [])
      }
    } catch (error) {
      console.error('Error fetching candidate:', error)
      setError('Failed to load candidate data')
    } finally {
      setLoading(false)
    }
  }

  const handleAssessmentUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    try {
      const response = await uploadCandidateAssessments(candidateId, file)
      const { ccat_uploaded, personality_uploaded } = response.data
      
      let message = 'Assessment results uploaded: '
      const parts = []
      if (ccat_uploaded) parts.push('CCAT')
      if (personality_uploaded) parts.push('Personality')
      message += parts.join(' and ')
      
      await showAlert('Success', message, 'success')
      fetchCandidate() // Refresh candidate data
    } catch (error) {
      console.error('Error uploading assessments:', error)
      await showAlert(
        'Upload Error',
        'Error uploading assessment results. Please check the file format.\n\nCSV format: percentile, raw_score, openness, conscientiousness, extraversion, agreeableness, neuroticism\nPDF: Should contain CCAT percentile and personality scores.',
        'error'
      )
    } finally {
      setUploading(false)
      e.target.value = '' // Reset input
    }
  }

  const handleReAnalyze = async () => {
    const confirmed = await showConfirm({
      title: 'Re-analyze Candidate',
      message: 'Re-analyze this candidate with updated AI scoring? This will update all scores and justifications.',
      type: 'info',
      confirmText: 'Re-analyze',
      cancelText: 'Cancel'
    })
    
    if (!confirmed) {
      return
    }

    setReAnalyzing(true)
    try {
      await reAnalyzeCandidate(candidateId)
      await showAlert('Re-analysis Started', 'Re-analysis started! The page will auto-refresh to show updated scores.', 'success')
      
      // Poll for updates every 2 seconds
      const refreshInterval = setInterval(async () => {
        try {
          await fetchCandidate()
          // Check if analysis is complete
          const currentCandidate = await getCandidate(candidateId).then(r => r.data)
          if (currentCandidate.status === 'analyzed') {
            clearInterval(refreshInterval)
            setReAnalyzing(false)
            // Final refresh to show updated data
            await fetchCandidate()
          }
        } catch (error) {
          console.error('Error polling for updates:', error)
        }
      }, 2000)
      
      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(refreshInterval)
        setReAnalyzing(false)
        fetchCandidate()
      }, 120000)
    } catch (error) {
      console.error('Error re-analyzing candidate:', error)
      await showAlert('Error', 'Error starting re-analysis. Please try again.', 'error')
      setReAnalyzing(false)
    }
  }

  const handleRating = async (rating) => {
    // Optimistic update - update UI immediately
    const previousCandidate = candidate
    const newRating = candidate?.rating === rating ? null : rating
    
    // Prepare update data
    const updateData = { rating: newRating }
    
    // Auto-shortlist if highly rated (4 or 5 stars), otherwise revert to analyzed
    if (newRating >= 4) {
      updateData.status = 'shortlisted'
    } else {
      updateData.status = 'analyzed'
    }
    
    // Update UI immediately (optimistic update)
    setCandidate(prev => prev ? { ...prev, ...updateData } : prev)
    
    // Then update in background
    try {
      await updateCandidate(candidateId, updateData)
    } catch (error) {
      console.error('Error updating rating:', error)
      // Revert on error
      setCandidate(previousCandidate)
      await showAlert('Error', 'Failed to update rating. Please try again.', 'error')
    }
  }

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: 'Delete Candidate',
      message: 'Are you sure you want to delete this candidate? This action cannot be undone.',
      type: 'confirm',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })
    
    if (confirmed) {
      try {
        await deleteCandidate(candidateId)
        await showAlert('Success', 'Candidate deleted successfully.', 'success')
        navigate(candidate.job_id ? `/jobs/${candidate.job_id}` : '/jobs')
      } catch (error) {
        console.error('Error deleting candidate:', error)
        await showAlert('Error', 'Failed to delete candidate. Please try again.', 'error')
      }
    }
  }

  // Parse AI justification into structured format
  const parseAISummary = (justification) => {
    if (!justification) {
      return {
        strengths: [],
        weaknesses: [],
        recommendation: ''
      }
    }

    const strengths = []
    const weaknesses = []
    let recommendation = ''

    // Split by sections more precisely
    const text = justification.trim()
    
    // Extract Top Strengths section
    const strengthsMatch = text.match(/(?:top\s+)?strengths?[:\-]?\s*\n?(.*?)(?:\n\s*(?:top\s+)?(?:gaps?|risks?|weaknesses?)|recommendation|$)/is)
    if (strengthsMatch) {
      const strengthsText = strengthsMatch[1].trim()
      // Split by bullet points (lines starting with -, •, or numbered)
      const strengthItems = strengthsText
        .split(/\n/)
        .map(line => line.replace(/^[\s\-•\d+\.\)]+/, '').trim())
        .filter(line => line.length > 0 && !line.toLowerCase().includes('lack') && !line.toLowerCase().includes('missing') && !line.toLowerCase().includes('no experience'))
      
      strengths.push(...strengthItems)
    }

    // Extract Top Gaps / Risks section
    const weaknessesMatch = text.match(/(?:top\s+)?(?:gaps?|risks?|weaknesses?)[:\-]?\s*\n?(.*?)(?:\n\s*recommendation|$)/is)
    if (weaknessesMatch) {
      const weaknessesText = weaknessesMatch[1].trim()
      // Split by bullet points
      const weaknessItems = weaknessesText
        .split(/\n/)
        .map(line => line.replace(/^[\s\-•\d+\.\)]+/, '').trim())
        .filter(line => line.length > 0)
      
      weaknesses.push(...weaknessItems)
    }

    // Extract Recommendation section
    const recommendationMatch = text.match(/(?:recommendation|summary|conclusion)[:\-]?\s*\n?(.*?)$/is)
    if (recommendationMatch) {
      recommendation = recommendationMatch[1]
        .trim()
        .split(/\n/)
        .map(line => line.replace(/^[\s\-•\d+\.\)]+/, '').trim())
        .filter(line => line.length > 0)
        .join(' ')
        .substring(0, 500) // Limit to reasonable length
    }

    // Filter out items that are clearly in the wrong section
    const filteredStrengths = strengths.filter(item => {
      const lower = item.toLowerCase()
      // Remove items that are clearly weaknesses
      return !lower.includes('lack') && 
             !lower.includes('missing') && 
             !lower.includes('no experience') && 
             !lower.includes('gap') &&
             !lower.includes('risk') &&
             !lower.includes('not qualified') &&
             item.length > 10 // Minimum length
    })

    const filteredWeaknesses = weaknesses.filter(item => {
      const lower = item.toLowerCase()
      // Keep items that are clearly weaknesses or concerns
      return (lower.includes('lack') || 
              lower.includes('missing') || 
              lower.includes('no experience') || 
              lower.includes('gap') ||
              lower.includes('risk') ||
              lower.includes('not') ||
              lower.includes('limited')) &&
             item.length > 10 // Minimum length
    })

    return {
      strengths: filteredStrengths.length > 0 ? filteredStrengths : ['No specific strengths identified'],
      weaknesses: filteredWeaknesses.length > 0 ? filteredWeaknesses : ['No specific weaknesses identified'],
      recommendation: recommendation || 'No recommendation available'
    }
  }

  // Calculate percentile ranking
  const calculatePercentile = () => {
    if (!allCandidates || allCandidates.length === 0 || !candidate?.score_breakdown?.overall_score) {
      return null
    }

    const currentScore = parseFloat(candidate.score_breakdown.overall_score)
    const scores = allCandidates
      .map(c => parseFloat(c.score_breakdown?.overall_score || 0))
      .filter(s => !isNaN(s))
      .sort((a, b) => b - a) // Sort descending

    if (scores.length === 0) return null

    const rank = scores.findIndex(s => s <= currentScore)
    const percentile = rank === -1 ? 0 : ((scores.length - rank) / scores.length) * 100

    return Math.round(percentile)
  }

  // Check job requirements match
  const checkRequirementsMatch = () => {
    if (!job?.evaluation_criteria || !candidate?.criterion_scores) {
      return []
    }

    return job.evaluation_criteria.map(criterion => {
      const criterionScore = candidate.criterion_scores?.find(
        cs => cs.criterion_name.toLowerCase() === criterion.name.toLowerCase()
      )
      const score = criterionScore ? parseFloat(criterionScore.score || 0) : 0
      const isMet = score >= 6.0 // Consider 6+ as meeting requirement

      return {
        name: criterion.name,
        score,
        isMet,
        weight: criterion.weight
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading candidate profile...</p>
        </div>
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-red-400 mb-4">{error || 'Candidate not found'}</p>
        <Link to="/jobs" className="glass-button inline-flex items-center gap-2">
          <ArrowLeft size={18} />
          Back to Jobs
        </Link>
      </div>
    )
  }

  const criterionData = candidate.criterion_scores?.map(c => {
    const score = parseFloat(c.score || 0)
    return {
      name: c.criterion_name || 'Unknown',
      score: isNaN(score) ? 0 : Math.max(0, Math.min(10, score))
    }
  }).filter(c => c.score > 0) || []

  const personalityData = candidate.personality_profile ? [
    { trait: 'Openness', value: parseFloat(candidate.personality_profile.openness) || 0 },
    { trait: 'Conscientiousness', value: parseFloat(candidate.personality_profile.conscientiousness) || 0 },
    { trait: 'Extraversion', value: parseFloat(candidate.personality_profile.extraversion) || 0 },
    { trait: 'Agreeableness', value: parseFloat(candidate.personality_profile.agreeableness) || 0 },
    { trait: 'Neuroticism', value: parseFloat(candidate.personality_profile.neuroticism) || 0 }
  ] : []

  const overallScore = candidate.score_breakdown?.overall_score 
    ? parseFloat(candidate.score_breakdown.overall_score) 
    : 0
  const resumeScore = candidate.score_breakdown?.resume_score 
    ? parseFloat(candidate.score_breakdown.resume_score) 
    : 0
  const ccatScore = candidate.score_breakdown?.ccat_score 
    ? parseFloat(candidate.score_breakdown.ccat_score) 
    : null
  const personalityScore = candidate.score_breakdown?.personality_score 
    ? parseFloat(candidate.score_breakdown.personality_score) 
    : null

  // Get job title from candidate data or use default
  const jobTitle = candidate.job_title || job?.title || 'Senior Software Engineer'
  const statusBadge = candidate.status === 'shortlisted' ? 'Shortlisted' : 
                     candidate.status === 'rejected' ? 'Rejected' : 
                     candidate.status === 'analyzed' ? 'Analyzed' : 'Uploaded'
  
  const aiSummary = parseAISummary(candidate.ai_justification)
  const percentile = calculatePercentile()
  const requirementsMatch = checkRequirementsMatch()

  return (
    <div className="space-y-6 pb-8">
      <Link 
        to={candidate.job_id ? `/jobs/${candidate.job_id}` : '/jobs'} 
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft size={18} />
        Back
      </Link>

      {/* Header with Candidate Name and Job Title */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold">{candidate.name || 'Unknown Candidate'}</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                candidate.status === 'shortlisted' ? 'bg-green-400/40 text-green-300 border border-green-400/60' :
                candidate.status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {statusBadge}
              </span>
            </div>
            <p className="text-lg text-gray-400">{jobTitle}</p>
          </div>
          
        </div>

        {/* Job Requirements Match Checklist */}
        {requirementsMatch.length > 0 && (
          <div className="mt-4 pt-4 border-t border-glass-200">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">Job Requirements Match</h3>
              <HelpCircle size={16} className="text-gray-400" />
            </div>
            <div className="flex flex-wrap gap-2">
              {requirementsMatch.map((req, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                    req.isMet
                      ? 'bg-green-400/40 text-green-300 border border-green-400/60'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {req.isMet ? (
                    <CheckCircle size={16} className="flex-shrink-0" />
                  ) : (
                    <XCircle size={16} className="flex-shrink-0" />
                  )}
                  <span>{req.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="glass-card">
        <div className="border-b border-glass-200">
          <div className="flex gap-6 px-6">
            {['overview', 'resume', 'assessments', 'notes'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-green-300 text-green-300'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'notes' && ' & Activity'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-3 gap-6">
              {/* Left Column - AI Summary and Scores */}
              <div className="col-span-2 space-y-6">
                {/* AI Summary Section */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-4">AI Summary</h3>
                  
                  {/* Overall Score */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">Software Core</span>
                      <span className="text-2xl font-bold text-green-200">{overallScore.toFixed(1)}/10</span>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs text-gray-300">Medium confidence</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Resume</span>
                        <span className="font-medium text-gray-200">{resumeScore.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Assessment</span>
                        <span className="font-medium text-gray-200">{ccatScore ? ccatScore.toFixed(1) : 'Not uploaded yet'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Culture Fit</span>
                        <span className="font-medium text-gray-200">{personalityScore ? personalityScore.toFixed(1) : 'Not uploaded yet'}</span>
                      </div>
                    </div>
                    {(!ccatScore || !personalityScore) && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-xs text-yellow-400">
                          Upload assessments to complete scoring.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Percentile Ranking */}
                  {percentile !== null && (
                    <div className="mb-6 pt-6 border-t border-glass-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Percentile Ranking</span>
                        <span className="text-xl font-bold text-green-200">{percentile}th</span>
                      </div>
                      <p className="text-xs text-gray-300 mt-1">
                        This candidate ranks in the {percentile}th percentile among all applicants for this position.
                      </p>
                    </div>
                  )}

                  {/* AI-Generated Summary */}
                  <div className="pt-6 border-t border-glass-200">
                    <h4 className="text-md font-semibold mb-4">AI-Generated Summary</h4>
                    
                    {/* Top Strengths */}
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-300 mb-2">Top Strengths</h5>
                      <ul className="space-y-1">
                        {aiSummary.strengths.map((strength, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                            <CheckCircle size={16} className="text-green-200 flex-shrink-0 mt-0.5" />
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Top Gaps / Risks */}
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-300 mb-2">Top Gaps / Risks</h5>
                      <ul className="space-y-1">
                        {aiSummary.weaknesses.map((weakness, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                            <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                            <span>{weakness}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Recommendation */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-300 mb-2">Recommendation</h5>
                      <p className="text-sm text-gray-300 flex items-start gap-2">
                        <CheckCircle size={16} className="text-green-200 flex-shrink-0 mt-0.5" />
                        <span>{aiSummary.recommendation}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Contact Info, Action Buttons, Criterion Breakdown */}
              <div className="space-y-6">
                {/* Contact Information */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Mail size={20} className="text-gray-400 flex-shrink-0" />
                      <span className="text-base font-medium text-white">{candidate.contact_info?.email || '-'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <User size={20} className="text-gray-400 flex-shrink-0" />
                      <span className="text-base font-medium text-white">{candidate.contact_info?.phone || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-4">Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowInterviewModal(true)}
                      className="glass-button w-full flex items-center justify-center gap-2 text-sm bg-green-500/40 hover:bg-green-500/50 border-green-500/60"
                    >
                      <Calendar size={16} />
                      Invite to Interview
                    </button>
                    <div className="glass-button-secondary w-full p-3">
                      <div className="text-xs text-gray-400 mb-2 text-center">Rating</div>
                      <div className="flex items-center justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRating(star)}
                            className="transition-all hover:scale-110"
                            title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                          >
                            <Star 
                              size={20} 
                              className={`${
                                candidate?.rating >= star 
                                  ? 'text-yellow-400 fill-yellow-400' 
                                  : 'text-gray-500 fill-none'
                              } transition-colors`}
                            />
                          </button>
                        ))}
                      </div>
                      {candidate?.rating && (
                        <div className="text-xs text-gray-400 mt-1 text-center">
                          {candidate.rating} star{candidate.rating !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleReAnalyze}
                      disabled={reAnalyzing}
                      className="glass-button-secondary w-full flex items-center justify-center gap-2 text-sm text-primary-400 hover:bg-primary-500/20 border-primary-500/30"
                    >
                      <RefreshCw size={16} className={reAnalyzing ? 'animate-spin' : ''} />
                      {reAnalyzing ? 'Re-analyzing...' : 'Re-analyze'}
                    </button>
                    <button
                      onClick={() => setShowEmailModal(true)}
                      className="glass-button-secondary w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:bg-red-500/20 border-red-500/30"
                    >
                      <Send size={16} />
                      Reject
                    </button>
                    <button
                      onClick={handleDelete}
                      className="glass-button-secondary w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:bg-red-500/20 border-red-500/30"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Criterion Breakdown - Bottom Right */}
                {candidate.criterion_scores && candidate.criterion_scores.length > 0 && (
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Criterion Breakdown</h3>
                    <div className="space-y-4">
                      {candidate.criterion_scores.map((criterion, index) => {
                        const score = parseFloat(criterion.score || 0)
                        const scoreText = score >= 7 ? 'Strong performance' : 
                                         score >= 5 ? 'Moderate performance' : 
                                         'Needs improvement'
                        return (
                          <div key={index}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{criterion.criterion_name}</span>
                              <span className="text-sm font-semibold text-emerald-400">{score.toFixed(1)}/10</span>
                            </div>
                            <div className="h-2 bg-glass-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                                style={{ width: `${(score / 10) * 100}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{scoreText}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'resume' && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4">Resume</h3>
              {candidate.resume_text ? (
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-300 bg-glass-100 p-4 rounded-lg">
                    {candidate.resume_text}
                  </pre>
                </div>
              ) : (
                <p className="text-gray-400">No resume text available.</p>
              )}
            </div>
          )}

          {activeTab === 'assessments' && (
            <div className="space-y-6">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Assessments</h3>
                  <label className="glass-button-secondary cursor-pointer flex items-center gap-2 text-sm" title="Upload CCAT and Personality assessments">
                    <Upload size={16} />
                    {uploading ? 'Uploading...' : 'Upload Assessments'}
                    <input
                      type="file"
                      accept=".csv,.pdf"
                      onChange={handleAssessmentUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>
                
                {ccatScore && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">CCAT Score</span>
                      <span className="text-lg font-semibold text-purple-400">{ccatScore.toFixed(1)}/10</span>
                    </div>
                    <p className="text-xs text-gray-500">Cognitive ability assessment</p>
                  </div>
                )}

                {personalityData.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold mb-4">Personality Profile</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={personalityData}>
                        <PolarGrid stroke="rgba(255,255,255,0.2)" />
                        <PolarAngleAxis 
                          dataKey="trait" 
                          stroke="#888"
                          tick={{ fill: '#888', fontSize: 12 }}
                        />
                        <PolarRadiusAxis 
                          angle={90} 
                          domain={[0, 10]} 
                          stroke="#888"
                          tick={{ fill: '#888', fontSize: 12 }}
                        />
                        <Radar
                          name="Personality"
                          dataKey="value"
                          stroke="#9333ea"
                          fill="#9333ea"
                          fillOpacity={0.6}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(10, 10, 15, 0.95)', 
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                          labelStyle={{ color: '#fff' }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {!ccatScore && personalityData.length === 0 && (
                  <p className="text-gray-400 text-sm">No assessment data available. Upload assessments to see results.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4">Notes & Activity</h3>
              <p className="text-gray-400 text-sm">Activity log and notes feature coming soon.</p>
            </div>
          )}
        </div>
      </div>

      {/* Email Modals */}
      {showEmailModal && candidate && (
        <SendEmailModal
          jobId={candidate.job_id}
          candidateIds={[candidateId]}
          onClose={() => {
            setShowEmailModal(false)
          }}
        />
      )}

      {showInterviewModal && candidate && (
        <SendInterviewModal
          jobId={candidate.job_id}
          candidateIds={[candidateId]}
          onClose={() => {
            setShowInterviewModal(false)
          }}
        />
      )}
    </div>
  )
}

export default CandidateProfile

