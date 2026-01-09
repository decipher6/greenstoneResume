import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Brain, Mail, FileText, Upload, RefreshCw, Calendar, Send, Trash2 } from 'lucide-react'
import { getCandidate, uploadCandidateAssessments, reAnalyzeCandidate, deleteCandidate } from '../services/api'
import { BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useModal } from '../context/ModalContext'
import SendEmailModal from '../components/SendEmailModal'
import SendInterviewModal from '../components/SendInterviewModal'

const CandidateProfile = () => {
  const { candidateId } = useParams()
  const navigate = useNavigate()
  const { showConfirm, showAlert } = useModal()
  const [candidate, setCandidate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [reAnalyzing, setReAnalyzing] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showInterviewModal, setShowInterviewModal] = useState(false)

  useEffect(() => {
    fetchCandidate()
  }, [candidateId])

  const fetchCandidate = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getCandidate(candidateId)
      setCandidate(response.data)
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
  const jobTitle = candidate.job_title || 'Senior Software Engineer'

  return (
    <div className="space-y-6 pb-8">
      <Link 
        to={candidate.job_id ? `/jobs/${candidate.job_id}` : '/jobs'} 
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft size={18} />
        Back
      </Link>

      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-3xl font-bold">{candidate.name || 'Unknown Candidate'}</h2>
            <p className="text-lg text-gray-400 mt-1">{jobTitle}</p>
          </div>
          <div className="flex items-start gap-6">
            <div className="text-right">
              <p className="text-sm text-gray-400">Resume Score</p>
              <p className="text-4xl font-bold text-primary-400">{resumeScore.toFixed(1)}/10</p>
            </div>
            <div className="border-l border-glass-200 pl-6 flex flex-col gap-3 min-w-[280px]">
              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowInterviewModal(true)}
                  className="glass-button flex items-center justify-center gap-2 text-sm"
                >
                  <Calendar size={16} />
                  Invite to Interview
                </button>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="glass-button-secondary flex items-center justify-center gap-2 text-sm"
                >
                  <Send size={16} />
                  Send Rejection
                </button>
                <button
                  onClick={handleDelete}
                  className="glass-button-secondary flex items-center justify-center gap-2 text-sm text-red-400 hover:bg-red-500/20 col-span-2"
                >
                  <Trash2 size={16} />
                  Delete Candidate
                </button>
              </div>
              
              {/* Analysis Buttons */}
              <div className="pt-2 border-t border-glass-200 space-y-2">
                <button
                  onClick={handleReAnalyze}
                  disabled={reAnalyzing}
                  className="glass-button w-full flex items-center justify-center gap-2 text-sm"
                  title="Re-analyze candidate with updated AI scoring"
                >
                  <RefreshCw size={16} className={reAnalyzing ? 'animate-spin' : ''} />
                  {reAnalyzing ? 'Re-analyzing...' : 'Re-analyze'}
                </button>
                <label className="glass-button-secondary cursor-pointer w-full flex items-center justify-center gap-2 text-sm" title="Upload CCAT and Personality assessments">
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
                <p className="text-xs text-gray-400 text-center">
                  CSV or PDF with CCAT percentile and personality scores
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-500/20 to-primary-600/20 border border-primary-500/30 flex items-center justify-center">
              <User size={24} className="text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Overall Score</p>
              <p className="text-2xl font-bold">{overallScore.toFixed(1)}/10</p>
            </div>
          </div>
          {/* <p className="text-sm text-gray-300 mt-2">
            {candidate.ai_justification || 'Score based on comprehensive evaluation.'}
          </p> */}
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 flex items-center justify-center">
              <FileText size={24} className="text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Resume Score</p>
              <p className="text-2xl font-bold">{resumeScore.toFixed(1)}/10</p>
            </div>
          </div>
          {ccatScore && (
            <div className="mt-4 pt-4 border-t border-glass-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-purple-400" />
                  <p className="text-sm text-gray-400">CCAT Score</p>
                </div>
                <p className="text-lg font-semibold text-purple-400">{ccatScore.toFixed(1)}/10</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">Cognitive ability assessment (separate from overall)</p>
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Mail size={24} className="text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Contact</p>
              <p className="text-xs text-gray-300">{candidate.contact_info?.email || '-'}</p>
              <p className="text-xs text-gray-300">{candidate.contact_info?.phone || '-'}</p>
            </div>
          </div>
          {candidate.resume_file_path && (
            <a href="#" className="text-sm text-primary-400 hover:underline flex items-center gap-1">
              <FileText size={14} />
              Resume
            </a>
          )}
        </div>
      </div>

      {/* AI Summary */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-3">AI-Generated Summary</h3>
        <p className="text-gray-300">
          {candidate.ai_justification || 'Score calculated using semantic similarity analysis. Click "Re-analyze" to get detailed LLM-generated evaluation.'}
        </p>
        {!candidate.ai_justification && (
          <button
            onClick={handleReAnalyze}
            className="mt-4 glass-button-secondary text-sm"
          >
            Generate AI Summary
          </button>
        )}
      </div>

      {/* Criterion Scores Section */}
      {criterionData.length > 0 && (
        <div className="grid grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold mb-2">Criterion Scores</h3>
            <p className="text-sm text-gray-400 mb-4">Performance across evaluation criteria (1-10 scale)</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={criterionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="name" 
                  stroke="#888" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  tick={{ fill: '#888', fontSize: 12 }}
                />
                <YAxis 
                  stroke="#888" 
                  domain={[0, 10]}
                  tick={{ fill: '#888', fontSize: 12 }}
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
                <Bar dataKey="score" fill="#8EC197" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold mb-4">Criterion Breakdown</h3>
            <div className="space-y-4">
              {candidate.criterion_scores?.map((criterion, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{criterion.criterion_name}</span>
                    <span className="text-sm font-semibold">{parseFloat(criterion.score || 0).toFixed(1)}/10</span>
                  </div>
                  <div className="h-2 bg-glass-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600"
                      style={{ width: `${((parseFloat(criterion.score || 0)) / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Personality Profile Section */}
      {personalityData.length > 0 && (
        <div className="grid grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold mb-2">Personality Profile</h3>
            <p className="text-sm text-gray-400 mb-4">Big Five personality traits (1-10 scale)</p>
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

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold mb-4">Personality Traits</h3>
            <div className="space-y-4">
              {personalityData.map((trait, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{trait.trait}</span>
                    <span className="text-sm font-semibold">{trait.value.toFixed(1)}/10</span>
                  </div>
                  <div className="h-2 bg-glass-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${(trait.value / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Email Modals */}
      {showEmailModal && candidate && (
        <SendEmailModal
          jobId={candidate.job_id}
          candidateIds={[candidateId]}
          onClose={() => {
            setShowEmailModal(false)
            fetchCandidate()
          }}
        />
      )}

      {showInterviewModal && candidate && (
        <SendInterviewModal
          jobId={candidate.job_id}
          candidateIds={[candidateId]}
          onClose={() => {
            setShowInterviewModal(false)
            fetchCandidate()
          }}
        />
      )}
    </div>
  )
}

export default CandidateProfile

