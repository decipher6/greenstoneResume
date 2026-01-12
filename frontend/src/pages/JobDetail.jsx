import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Upload, Sparkles, Eye, Trash2, CheckCircle, Send, Filter, Calendar, Search, X } from 'lucide-react'
import { 
  getJob, getCandidates, uploadCandidatesBulk, 
  runAnalysis, deleteCandidate, getTopCandidates
} from '../services/api'
import api from '../services/api'
import SendEmailModal from '../components/SendEmailModal'
import SendInterviewModal from '../components/SendInterviewModal'
import { useModal } from '../context/ModalContext'

const JobDetail = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { showConfirm, showAlert } = useModal()
  const [job, setJob] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [topCandidates, setTopCandidates] = useState([])
  const [topCandidatesLimit, setTopCandidatesLimit] = useState(5)
  const [selectedCandidates, setSelectedCandidates] = useState([])
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showInterviewModal, setShowInterviewModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [nameSearch, setNameSearch] = useState('')
  const [filters, setFilters] = useState({
    min_resume_score: '',
    min_ccat_score: '',
    min_overall_score: '',
    sort_by: 'overall_score'
  })
  const [autoAnalyze, setAutoAnalyze] = useState(true)

  // Load autoAnalyze setting from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('appSettings')
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        setAutoAnalyze(settings.autoAnalyze ?? true)
      } catch (e) {
        console.error('Error loading settings:', e)
      }
    }
  }, [])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, topCandidatesLimit, filters])

  const fetchData = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.min_resume_score) params.append('min_resume_score', filters.min_resume_score)
      if (filters.min_ccat_score) params.append('min_ccat_score', filters.min_ccat_score)
      if (filters.min_overall_score) params.append('min_overall_score', filters.min_overall_score)
      if (nameSearch.trim()) params.append('name', nameSearch.trim())
      // Default to sorting by overall_score descending if no sort_by specified
      params.append('sort_by', filters.sort_by || 'overall_score')
      
      const queryString = params.toString()
      const candidatesUrl = `/candidates/job/${jobId}${queryString ? '?' + queryString : ''}`
      
      const [jobRes, candidatesRes, topRes] = await Promise.all([
        getJob(jobId),
        api.get(candidatesUrl),
        getTopCandidates(jobId, topCandidatesLimit)
      ])
      setJob(jobRes.data)
      setCandidates(candidatesRes.data)
      setTopCandidates(topRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    // Validate file limit (50 CVs max)
    if (files.length > 50) {
      await showAlert(
        'File Limit Exceeded',
        `Maximum 50 files allowed. You selected ${files.length} files. Please select fewer files.`,
        'error'
      )
      e.target.value = '' // Reset input
      return
    }

    // Validate file formats
    const allowedExtensions = ['.pdf', '.docx', '.doc']
    const invalidFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase()
      return !allowedExtensions.includes(ext)
    })

    if (invalidFiles.length > 0) {
      await showAlert(
        'Invalid File Format',
        `Invalid file format(s): ${invalidFiles.map(f => f.name).join(', ')}\n\nSupported formats: .pdf, .docx, .doc`,
        'error'
      )
      e.target.value = '' // Reset input
      return
    }

    try {
      await uploadCandidatesBulk(jobId, files)
      await showAlert('Success', `Successfully uploaded ${files.length} file(s)!`, 'success')
      fetchData()
      
      // Auto-analyze if setting is enabled
      if (autoAnalyze) {
        // Wait a moment for candidates to be saved, then trigger analysis
        setTimeout(async () => {
          try {
            await runAnalysis(jobId, false) // false = only analyze new candidates
            await showAlert('Analysis Started', 'Auto-analysis started! Results will appear shortly.', 'info')
            // Poll for updates
            const refreshInterval = setInterval(() => {
              fetchData()
            }, 3000)
            setTimeout(() => clearInterval(refreshInterval), 60000)
          } catch (error) {
            console.error('Error starting auto-analysis:', error)
          }
        }, 1000)
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      await showAlert('Error', 'Error uploading files. Please try again.', 'error')
    }
    e.target.value = '' // Reset input after upload
  }


  const handleRunAnalysis = async () => {
    const force = await showConfirm({
      title: 'Run Analysis',
      message: 'Re-analyze all candidates (including already analyzed ones)?\n\nClick "Re-analyze All" to re-analyze all candidates, or "Analyze New Only" to only analyze new candidates.',
      type: 'info',
      confirmText: 'Re-analyze All',
      cancelText: 'Analyze New Only'
    })
    
    try {
      await runAnalysis(jobId, force)
      await showAlert(
        'Analysis Started',
        `${force ? 'Re-analyzing all candidates' : 'Analyzing new candidates only'}. Results will appear shortly.`,
        'success'
      )
      // Poll for updates
      const refreshInterval = setInterval(() => {
        fetchData()
      }, 3000)
      setTimeout(() => clearInterval(refreshInterval), 60000) // Stop after 60 seconds
    } catch (error) {
      console.error('Error running analysis:', error)
      await showAlert('Error', 'Error running analysis. Please try again.', 'error')
    }
  }

  const handleDelete = async (candidateId) => {
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
        fetchData()
        await showAlert('Success', 'Candidate deleted successfully.', 'success')
      } catch (error) {
        console.error('Error deleting candidate:', error)
        await showAlert('Error', 'Failed to delete candidate. Please try again.', 'error')
      }
    }
  }

  const applyFilters = () => {
    fetchData()
  }

  const clearFilters = () => {
    const clearedFilters = {
      min_resume_score: '',
      min_ccat_score: '',
      min_overall_score: '',
      sort_by: 'overall_score'
    }
    setFilters(clearedFilters)
    setNameSearch('')
    // Fetch with cleared filters
    setTimeout(() => {
      const params = new URLSearchParams()
      params.append('sort_by', 'overall_score')
      const candidatesUrl = `/candidates/job/${jobId}?${params.toString()}`
      api.get(candidatesUrl).then(res => setCandidates(res.data))
    }, 100)
  }

  const toggleCandidateSelection = (candidateId) => {
    setSelectedCandidates(prev => 
      prev.includes(candidateId) 
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    )
  }

  if (!job) return <div className="text-center py-12">Loading...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{job.title}</h2>
            <p className="text-sm text-gray-400">{job.department} • {job.candidate_count} candidates</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="glass-button cursor-pointer flex items-center gap-2">
              <Upload size={18} />
              Upload (.pdf, .docx, .doc)
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button onClick={handleRunAnalysis} className="glass-button flex items-center gap-2">
              <Sparkles size={18} />
              Run AI Analysis
            </button>
          </div>
        </div>
      </div>


      {/* Job Description & Criteria */}
      <div className="grid grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Job Description</h3>
          <p className="text-gray-300 text-sm whitespace-pre-wrap">{job.description}</p>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Evaluation Criteria</h3>
          <div className="space-y-4">
            {job.evaluation_criteria?.map((criterion, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{criterion.name}</span>
                  <span className="text-primary-400 font-semibold text-sm">{criterion.weight}%</span>
                </div>
                <div className="h-2 bg-glass-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-400 to-primary-500 transition-all duration-500"
                    style={{ width: `${Math.min(criterion.weight, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Candidate Scores */}
      {topCandidates.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Top Candidate Scores</h3>
              <p className="text-sm text-gray-400">Ranked by resume score (1-10 scale)</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Show top:</label>
              <select
                value={topCandidatesLimit}
                onChange={(e) => {
                  const newLimit = parseInt(e.target.value)
                  setTopCandidatesLimit(newLimit)
                  fetchData()
                }}
                className="glass-input text-sm w-20"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            {topCandidates.map((candidate) => (
              <div key={candidate.id} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <Link
                      to={`/candidates/${candidate.id}`}
                      className="text-sm font-medium hover:text-primary-400 transition-colors cursor-pointer"
                    >
                      {candidate.name}
                    </Link>
                    <span className="text-sm font-semibold">{parseFloat(candidate.score).toFixed(1)}/10</span>
                  </div>
                  <div className="h-2 bg-glass-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600"
                      style={{ width: `${Math.min((parseFloat(candidate.score) / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Candidates Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-glass-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Candidates</h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="glass-button-secondary flex items-center gap-2"
            >
              <Filter size={18} />
              {showFilters ? 'Hide' : 'Show'} Filters
            </button>
          </div>
          
          {/* Name Search */}
          <div className="glass-input flex items-center gap-2">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search candidates by name..."
              className="bg-transparent border-0 outline-0 w-full"
              value={nameSearch}
              onChange={(e) => {
                setNameSearch(e.target.value)
                // Debounce search - wait 300ms after user stops typing
                clearTimeout(window.searchTimeout)
                window.searchTimeout = setTimeout(() => {
                  fetchData()
                }, 300)
              }}
            />
            {nameSearch && (
              <button
                onClick={() => {
                  setNameSearch('')
                  fetchData()
                }}
                className="p-1 rounded hover:bg-glass-200 transition-colors"
              >
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedCandidates.length > 0 && (
          <div className="p-4 border-b border-glass-200 bg-glass-100 flex items-center justify-between">
            <span className="text-sm text-gray-400">{selectedCandidates.length} candidates selected</span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInterviewModal(true)}
                className="glass-button flex items-center gap-2"
              >
                <Calendar size={16} />
                Invite to Interview ({selectedCandidates.length})
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                className="glass-button-secondary flex items-center gap-2"
              >
                <Send size={16} />
                Send Rejection ({selectedCandidates.length})
              </button>
              <button
                onClick={() => {
                  selectedCandidates.forEach(id => handleDelete(id))
                  setSelectedCandidates([])
                }}
                className="glass-button-secondary flex items-center gap-2 text-red-400 hover:bg-red-500/20"
              >
                <Trash2 size={16} />
                Delete ({selectedCandidates.length})
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="p-6 border-b border-glass-200 bg-glass-100">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Min Resume Score</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  className="glass-input w-full"
                  placeholder="0-10"
                  value={filters.min_resume_score}
                  onChange={(e) => setFilters({...filters, min_resume_score: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Min CCAT Score</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  className="glass-input w-full"
                  placeholder="0-10"
                  value={filters.min_ccat_score}
                  onChange={(e) => setFilters({...filters, min_ccat_score: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Min Overall Score</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  className="glass-input w-full"
                  placeholder="0-10"
                  value={filters.min_overall_score}
                  onChange={(e) => setFilters({...filters, min_overall_score: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Sort By</label>
                <select
                  className="glass-input w-full"
                  value={filters.sort_by}
                  onChange={(e) => setFilters({...filters, sort_by: e.target.value})}
                >
                  <option value="overall_score">Overall Score</option>
                  <option value="resume_score">Resume Score</option>
                  <option value="ccat_score">CCAT Score</option>
                  <option value="created_at">Date Added</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={applyFilters} className="glass-button">
                Apply Filters
              </button>
              <button onClick={clearFilters} className="glass-button-secondary">
                Clear Filters
              </button>
            </div>
          </div>
        )}
        <table className="w-full">
          <thead className="bg-glass-100 border-b border-glass-200">
            <tr>
              <th className="px-6 py-4 text-left">
                <input
                  type="checkbox"
                  checked={selectedCandidates.length === candidates.length && candidates.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCandidates(candidates.map(c => c.id))
                    } else {
                      setSelectedCandidates([])
                    }
                  }}
                />
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Name</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Email</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Phone</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Resume/LinkedIn</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Score</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id} className="border-b border-glass-200 hover:bg-glass-100 transition-colors">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedCandidates.includes(candidate.id)}
                    onChange={() => toggleCandidateSelection(candidate.id)}
                  />
                </td>
                <td className="px-6 py-4 font-medium">{candidate.name}</td>
                <td className="px-6 py-4 text-gray-400">{candidate.contact_info?.email || '-'}</td>
                <td className="px-6 py-4 text-gray-400">{candidate.contact_info?.phone || '-'}</td>
                <td className="px-6 py-4">
                  {candidate.linkedin_url ? (
                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                      LinkedIn
                    </a>
                  ) : candidate.resume_file_path ? (
                    <span className="text-gray-400">Resume</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    candidate.status === 'analyzed' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : candidate.status === 'analyzing'
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {candidate.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    {candidate.score_breakdown?.resume_score && (
                      <span className="font-semibold">
                        Resume: {parseFloat(candidate.score_breakdown.resume_score).toFixed(1)}/10
                      </span>
                    )}
                    {candidate.score_breakdown?.ccat_score && (
                      <span className="text-xs text-gray-400">
                        CCAT: {parseFloat(candidate.score_breakdown.ccat_score).toFixed(1)}/10
                      </span>
                    )}
                    {!candidate.score_breakdown?.resume_score && '-'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/candidates/${candidate.id}`}
                      className="p-2 rounded-lg hover:bg-glass-200 transition-colors"
                    >
                      <Eye size={18} className="text-gray-400" />
                    </Link>
                    <button
                      onClick={() => handleDelete(candidate.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={18} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEmailModal && (
        <SendEmailModal
          jobId={jobId}
          candidateIds={selectedCandidates}
          onClose={() => {
            setShowEmailModal(false)
            setSelectedCandidates([])
            fetchData()
          }}
        />
      )}

      {showInterviewModal && (
        <SendInterviewModal
          jobId={jobId}
          candidateIds={selectedCandidates}
          onClose={() => {
            setShowInterviewModal(false)
            setSelectedCandidates([])
            fetchData()
          }}
        />
      )}
    </div>
  )
}

export default JobDetail

