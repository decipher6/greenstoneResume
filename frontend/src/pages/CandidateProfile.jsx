import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Brain, Mail, Upload, Calendar, Send, Trash2, CheckCircle, XCircle, HelpCircle, Star, Copy, Check, Download } from 'lucide-react'
import { getCandidate, uploadCandidateAssessments, deleteCandidate, getJob, getCandidates, updateCandidate, downloadCandidateResume, viewCandidateResume, getCandidateResumeFileInfo, calculateLocationMatch } from '../services/api'
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
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showInterviewModal, setShowInterviewModal] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Reset to overview if assessments tab was active (since it's removed)
  useEffect(() => {
    if (activeTab === 'assessments') {
      setActiveTab('overview')
    }
  }, [activeTab])
  const [copiedField, setCopiedField] = useState(null) // Track which field was copied
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [resumeFileInfo, setResumeFileInfo] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchCandidate()
  }, [candidateId])

  useEffect(() => {
    // Fetch resume file info when candidate is loaded
    if (candidate && (candidate.resume_file_path || candidate.resume_file_id)) {
      fetchResumeFileInfo()
    } else {
      setResumeFileInfo(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate])

  const fetchResumeFileInfo = async () => {
    if (!candidateId) return
    try {
      const response = await getCandidateResumeFileInfo(candidateId)
      setResumeFileInfo(response.data)
    } catch (error) {
      console.error('Error fetching resume file info:', error)
      // Don't show error to user, just log it
      setResumeFileInfo(null)
    }
  }

  const fetchCandidate = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getCandidate(candidateId)
      const candidateData = response.data
      setCandidate(candidateData)
      setNotes(candidateData.notes || '')
      
      // Fetch job data and all candidates for percentile calculation
      if (candidateData.job_id) {
        const [jobResponse, candidatesResponse] = await Promise.all([
          getJob(candidateData.job_id),
          getCandidates(candidateData.job_id)
        ])
        setJob(jobResponse.data)
        setAllCandidates(candidatesResponse.data || [])
      }
      
      // Calculate location match if missing
      if (!candidateData.location_match || !candidateData.location_match.status) {
        try {
          const locationMatchResponse = await calculateLocationMatch(candidateId)
          if (locationMatchResponse.data && locationMatchResponse.data.location_match) {
            setCandidate(prev => ({
              ...prev,
              location_match: locationMatchResponse.data.location_match
            }))
          }
        } catch (error) {
          console.error('Error calculating location match:', error)
          // Don't show error to user, just log it
        }
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

  const handleDownloadResume = async () => {
    try {
      const response = await downloadCandidateResume(candidateId)
      
      // Create a blob from the response
      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' })
      
      // Get filename from Content-Disposition header or use default
      let filename = 'resume.pdf'
      const contentDisposition = response.headers['content-disposition']
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      // Create a temporary URL and trigger download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      await showAlert('Success', 'Resume downloaded successfully', 'success')
    } catch (error) {
      console.error('Error downloading resume:', error)
      await showAlert('Error', 'Failed to download resume. The file may not exist.', 'error')
    }
  }

  const handleRating = async (rating) => {
    // Optimistic update - update UI immediately
    const previousCandidate = candidate
    const newRating = candidate?.rating === rating ? null : rating
    
    // Prepare update data
    const updateData = { rating: newRating }
    
    // Rating doesn't change status anymore - status is managed separately
    
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
        .filter(line => {
          // Filter out empty lines and header text
          if (line.length === 0) return false
          const lower = line.toLowerCase()
          // Exclude lines that are clearly headers or section labels
          if (lower.includes('top gaps') || lower.includes('top risks') || 
              lower.includes('gaps / risks') || lower === 'risks' || 
              lower === 'gaps' || lower.startsWith('top ')) {
            return false
          }
          return true
        })
      
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

  // Helper function to get ordinal suffix (st, nd, rd, th)
  const getOrdinalSuffix = (num) => {
    const j = num % 10
    const k = num % 100
    if (j === 1 && k !== 11) {
      return 'st'
    }
    if (j === 2 && k !== 12) {
      return 'nd'
    }
    if (j === 3 && k !== 13) {
      return 'rd'
    }
    return 'th'
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

  // Calculate rank (1-based position)
  const calculateRank = () => {
    if (!allCandidates || allCandidates.length === 0 || !candidate?.score_breakdown?.overall_score) {
      return null
    }

    const currentScore = parseFloat(candidate.score_breakdown.overall_score)
    const scores = allCandidates
      .map(c => parseFloat(c.score_breakdown?.overall_score || 0))
      .filter(s => !isNaN(s))
      .sort((a, b) => b - a) // Sort descending

    if (scores.length === 0) return null

    // Find the rank (1-based)
    const rank = scores.findIndex(s => s <= currentScore)
    return rank === -1 ? scores.length : rank + 1
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
  const statusBadge = candidate.status === 'rejected' ? 'Rejected' : 
                     candidate.status === 'interview' ? 'Interview' :
                     candidate.status === 'reviewed' ? 'Reviewed' :
                     candidate.status === 'analyzing' ? 'Analyzing' : 'New'
  
  const aiSummary = parseAISummary(candidate.ai_justification)
  const percentile = calculatePercentile()
  const rank = calculateRank()
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
                candidate.status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                candidate.status === 'interview' ? 'bg-purple-400/40 text-purple-300 border border-purple-400/60' :
                candidate.status === 'reviewed' ? 'bg-blue-400/40 text-blue-300 border border-blue-400/60' :
                candidate.status === 'analyzing' ? 'bg-yellow-400/40 text-yellow-300 border border-yellow-400/60' :
                'bg-gray-400/40 text-gray-300 border border-gray-400/60'
              }`}>
                {statusBadge}
              </span>
              {percentile !== null && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-500/30 text-gray-400 border border-gray-500/40">
                  {percentile}{getOrdinalSuffix(percentile)} percentile
                </span>
              )}
              {rank && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-400/40 text-purple-300 border border-purple-400/60">
                  Rank #{rank} of {allCandidates.length}
                </span>
              )}
            </div>
            <p className="text-lg text-gray-400 mb-3">{jobTitle}</p>
            
            {/* Rating Section */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(star)}
                    className="transition-all hover:scale-110"
                    title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                  >
                    <Star 
                      size={24} 
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
                <span className="text-sm text-gray-400">
                  ({candidate.rating} star{candidate.rating !== 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
          
          {/* Action Buttons - Right Side */}
          <div className="flex flex-col gap-2 ml-4">
            <button
              onClick={() => setShowInterviewModal(true)}
              className="glass-button flex items-center justify-center gap-2 text-sm whitespace-nowrap"
            >
              <Calendar size={16} />
              Invite to Interview
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              className="glass-button-secondary flex items-center justify-center gap-2 text-sm text-red-400 hover:bg-red-500/20 border-red-500/30 whitespace-nowrap"
            >
              <Send size={16} />
              Reject
            </button>
            <button
              onClick={handleDelete}
              className="glass-button-secondary flex items-center justify-center gap-2 text-sm text-red-400 hover:bg-red-500/20 border-red-500/30 whitespace-nowrap"
            >
              <Trash2 size={16} />
              Delete
            </button>
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
            {['overview', 'resume', 'notes'].map((tab) => (
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
                      <span className="text-2xl font-bold text-green-200">{overallScore.toFixed(1)}/10</span>
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Resume</span>
                        <span className="font-medium text-gray-200">{resumeScore.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">CCAT</span>
                        <span className="font-medium text-gray-200">{ccatScore ? ccatScore.toFixed(1) : 'Not uploaded yet'}</span>
                      </div>
                    </div>
                    {(!ccatScore || !personalityScore) && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-yellow-400">
                            Upload CCAT assessment to complete scoring.
                          </p>
                          <label className="cursor-pointer flex items-center gap-2 text-xs px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors" title="Upload CCAT and Personality assessments">
                            <Upload size={14} />
                            {uploading ? 'Uploading...' : 'Upload'}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".csv,.pdf"
                              onChange={handleAssessmentUpload}
                              className="hidden"
                              disabled={uploading}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rank Display */}
                  {rank && (
                    <div className="mb-6 pt-6 border-t border-glass-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300">Rank</span>
                        <span className="text-3xl font-bold text-purple-300">#{rank} of {allCandidates.length}</span>
                      </div>
                      <p className="text-xs text-gray-300 mt-1">
                        This candidate is ranked #{rank} out of {allCandidates.length} applicants for this position.
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
                    {candidate.location && (
                      <div className="flex items-center gap-3">
                        <User size={20} className="text-gray-400 flex-shrink-0" />
                        <span className="text-base font-medium text-white flex-1">{candidate.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Mail size={20} className="text-gray-400 flex-shrink-0" />
                      <span className="text-base font-medium text-white flex-1">{candidate.contact_info?.email || '-'}</span>
                      {candidate.contact_info?.email && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await navigator.clipboard.writeText(candidate.contact_info.email)
                              setCopiedField('email')
                              await showAlert('Copied', 'Email copied to clipboard', 'success')
                              setTimeout(() => setCopiedField(null), 2000)
                            } catch (err) {
                              await showAlert('Error', 'Failed to copy email', 'error')
                            }
                          }}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
                          title="Copy email"
                        >
                          {copiedField === 'email' ? (
                            <Check size={16} className="text-green-400" />
                          ) : (
                            <Copy size={16} className="text-gray-400 group-hover:text-white transition-colors" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <User size={20} className="text-gray-400 flex-shrink-0" />
                      <span className="text-base font-medium text-white flex-1">{candidate.contact_info?.phone || '-'}</span>
                      {candidate.contact_info?.phone && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await navigator.clipboard.writeText(candidate.contact_info.phone)
                              setCopiedField('phone')
                              await showAlert('Copied', 'Phone number copied to clipboard', 'success')
                              setTimeout(() => setCopiedField(null), 2000)
                            } catch (err) {
                              await showAlert('Error', 'Failed to copy phone number', 'error')
                            }
                          }}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
                          title="Copy phone number"
                        >
                          {copiedField === 'phone' ? (
                            <Check size={16} className="text-green-400" />
                          ) : (
                            <Copy size={16} className="text-gray-400 group-hover:text-white transition-colors" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location Match */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-4">Location Match</h3>
                  {candidate.location_match && candidate.location_match.status ? (
                    <div className="space-y-3">
                      <div className={`text-center py-6 rounded-lg ${
                        candidate.location_match.status === 'match'
                          ? 'bg-green-500/20 border-2 border-green-400/60'
                          : candidate.location_match.status === 'mismatch'
                          ? 'bg-red-500/20 border-2 border-red-400/60'
                          : 'bg-yellow-500/20 border-2 border-yellow-400/60'
                      }`}>
                        <div className={`text-4xl font-bold mb-2 ${
                          candidate.location_match.status === 'match'
                            ? 'text-green-300'
                            : candidate.location_match.status === 'mismatch'
                            ? 'text-red-400'
                            : 'text-yellow-400'
                        }`}>
                          {candidate.location_match.status === 'match' 
                            ? 'Location Match' 
                            : candidate.location_match.status === 'mismatch'
                            ? 'Location Mismatch'
                            : 'Location Uncertain'}
                        </div>
                        {candidate.location && (
                          <p className="text-sm text-gray-300 mb-1">
                            Candidate: {candidate.location}
                          </p>
                        )}
                        {job?.regions && job.regions.length > 0 && (
                          <p className="text-sm text-gray-300">
                            Job Regions: {job.regions.join(', ')}
                          </p>
                        )}
                      </div>
                      {candidate.location_match.reason && (
                        <p className="text-sm text-gray-400 text-center">
                          {candidate.location_match.reason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <p className="mb-2">Calculating location match...</p>
                      <p className="text-xs">If this persists, location match may not be available for this candidate.</p>
                    </div>
                  )}
                </div>

                {/* Criterion Breakdown - Bottom Right */}
                {candidate.criterion_scores && candidate.criterion_scores.length > 0 && (
                  <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Criterion Breakdown</h3>
                    <div className="space-y-4">
                      {candidate.criterion_scores.map((criterion, index) => {
                        const score = parseFloat(criterion.score || 0)
                        const displayName = criterion.short_name || criterion.criterion_name
                        return (
                          <div key={index}>
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className="text-sm font-medium"
                                title={criterion.criterion_name}
                              >
                                {displayName}
                              </span>
                              <span className="text-sm font-semibold text-emerald-400">{score.toFixed(1)}/10</span>
                            </div>
                            <div className="h-2 bg-glass-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                                style={{ width: `${(score / 10) * 100}%` }}
                              />
                            </div>
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Resume</h3>
                {/* Show download button for DOCX files */}
                {resumeFileInfo?.is_docx && (
                  <button
                    onClick={handleDownloadResume}
                    className="glass-button flex items-center gap-2"
                    title="Download original DOCX resume file"
                  >
                    <Download size={18} />
                    Download Original
                  </button>
                )}
              </div>
              {(candidate.resume_file_path || candidate.resume_file_id) ? (
                <div className="w-full">
                  <ResumeViewer candidateId={candidateId} />
                </div>
              ) : candidate.resume_text ? (
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-300 bg-glass-100 p-4 rounded-lg">
                    {candidate.resume_text}
                  </pre>
                </div>
              ) : (
                <p className="text-gray-400">No resume available.</p>
              )}
            </div>
          )}


          {activeTab === 'notes' && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4">Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                }}
                onBlur={async () => {
                  if (notes !== (candidate?.notes || '')) {
                    setSavingNotes(true)
                    try {
                      await updateCandidate(candidateId, { notes })
                      setCandidate(prev => prev ? { ...prev, notes } : prev)
                    } catch (error) {
                      console.error('Error saving notes:', error)
                      await showAlert('Error', 'Failed to save notes. Please try again.', 'error')
                      // Revert to original notes
                      setNotes(candidate?.notes || '')
                    } finally {
                      setSavingNotes(false)
                    }
                  }
                }}
                placeholder="Add your notes about this candidate..."
                className="w-full min-h-[300px] glass-input resize-y p-4 text-sm text-white placeholder-gray-500"
                disabled={savingNotes}
              />
              {savingNotes && (
                <p className="text-xs text-gray-400 mt-2">Saving notes...</p>
              )}
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

// Resume Viewer Component
const ResumeViewer = ({ candidateId }) => {
  const viewUrl = viewCandidateResume(candidateId)
  
  return (
    <div className="w-full h-[800px] border border-glass-200 rounded-lg overflow-hidden bg-glass-100">
      <iframe
        src={viewUrl}
        className="w-full h-full"
        title="Resume Viewer"
        style={{ border: 'none' }}
      />
    </div>
  )
}

export default CandidateProfile

