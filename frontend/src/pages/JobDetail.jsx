import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Upload, Sparkles, Eye, Trash2, CheckCircle, Send, Filter, Calendar, Search, X, FileText, XCircle, Edit, Save, ArrowLeft } from 'lucide-react'
import { 
  getJob, getCandidates, uploadCandidatesBulk, 
  runAnalysis, deleteCandidate, getTopCandidates, updateCandidate
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
  const [editingCandidateId, setEditingCandidateId] = useState(null) // candidateId being edited
  const [editValues, setEditValues] = useState({}) // { candidateId: { name, email, phone } }
  const [isDragging, setIsDragging] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('candidates') // 'description' or 'candidates'
  
  // Use ref to always get the latest nameSearch value
  const nameSearchRef = useRef(nameSearch)
  useEffect(() => {
    nameSearchRef.current = nameSearch
  }, [nameSearch])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.min_resume_score) params.append('min_resume_score', filters.min_resume_score)
      if (filters.min_ccat_score) params.append('min_ccat_score', filters.min_ccat_score)
      if (filters.min_overall_score) params.append('min_overall_score', filters.min_overall_score)
      // Always use the latest nameSearch value from ref
      if (nameSearchRef.current.trim()) params.append('name', nameSearchRef.current.trim())
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
  }, [jobId, topCandidatesLimit, filters])

  // Debounce name search to avoid excessive API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData()
    }, 300)
    
    return () => clearTimeout(timeoutId)
  }, [nameSearch, fetchData])

  // Fetch data when other filters change (immediate)
  useEffect(() => {
    fetchData()
  }, [jobId, topCandidatesLimit, filters, fetchData])

  const validateFiles = (files) => {
    const fileArray = Array.from(files)
    
    // Validate file limit (50 CVs max)
    if (fileArray.length > 50) {
      return {
        valid: false,
        error: `Maximum 50 files allowed. You selected ${fileArray.length} files. Please select fewer files.`,
        errorTitle: 'File Limit Exceeded'
      }
    }

    // Validate file formats
    const allowedExtensions = ['.pdf', '.docx', '.doc']
    const invalidFiles = fileArray.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase()
      return !allowedExtensions.includes(ext)
    })

    if (invalidFiles.length > 0) {
      return {
        valid: false,
        error: `Invalid file format(s): ${invalidFiles.map(f => f.name).join(', ')}\n\nSupported formats: .pdf, .docx, .doc`,
        errorTitle: 'Invalid File Format'
      }
    }

    return { valid: true, files: fileArray }
  }

  const processFiles = (files) => {
    const validation = validateFiles(files)
    if (!validation.valid) {
      showAlert(validation.errorTitle, validation.error, 'error')
      return
    }

    // Add to pending files (avoid duplicates by name)
    setPendingFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name))
      const newFiles = validation.files.filter(f => !existingNames.has(f.name))
      return [...prev, ...newFiles]
    })
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    processFiles(files)
    e.target.value = '' // Reset input
  }

  const handleUploadPendingFiles = async () => {
    if (pendingFiles.length === 0) return

    setIsUploading(true)
    try {
      await uploadCandidatesBulk(jobId, pendingFiles)
      await showAlert('Success', `Successfully uploaded ${pendingFiles.length} file(s)!`, 'success')
      setPendingFiles([])
      fetchData()
      
      // Auto-analyze if setting is enabled
      if (autoAnalyze) {
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
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFiles(files)
    }
  }

  const removePendingFile = (index) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearPendingFiles = () => {
    setPendingFiles([])
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

  const handleFieldEdit = (candidateId, field, value) => {
    setEditValues(prev => ({
      ...prev,
      [candidateId]: {
        ...prev[candidateId],
        [field]: value
      }
    }))
  }

  const handleRowSave = async (candidateId) => {
    const candidate = candidates.find(c => c.id === candidateId)
    if (!candidate) return

    const edited = editValues[candidateId]
    if (!edited) {
      setEditingCandidateId(null)
      return
    }

    try {
      const updateData = {
        name: edited.name || candidate.name,
        contact_info: {
          ...candidate.contact_info,
          email: edited.email !== undefined ? edited.email : (candidate.contact_info?.email || ''),
          phone: edited.phone !== undefined ? edited.phone : (candidate.contact_info?.phone || '')
        }
      }

      await updateCandidate(candidateId, updateData)
      await fetchData() // Refresh the data
      setEditingCandidateId(null)
      setEditValues(prev => {
        const newValues = { ...prev }
        delete newValues[candidateId]
        return newValues
      })
    } catch (error) {
      console.error('Error updating candidate:', error)
      await showAlert('Error', 'Failed to update candidate. Please try again.', 'error')
    }
  }

  const handleRowCancel = (candidateId) => {
    setEditingCandidateId(null)
    setEditValues(prev => {
      const newValues = { ...prev }
      delete newValues[candidateId]
      return newValues
    })
  }

  const startEditingRow = (candidateId, e) => {
    e.stopPropagation() // Prevent row click
    const candidate = candidates.find(c => c.id === candidateId)
    if (!candidate) return

    setEditingCandidateId(candidateId)
    setEditValues(prev => ({
      ...prev,
      [candidateId]: {
        name: candidate.name,
        email: candidate.contact_info?.email || '',
        phone: candidate.contact_info?.phone || ''
      }
    }))
  }

  const handleRowClick = (candidateId, e) => {
    // Don't navigate if clicking on checkbox, edit button, delete button, or if editing
    if (
      e.target.closest('input[type="checkbox"]') ||
      e.target.closest('button') ||
      e.target.closest('input[type="text"]') ||
      e.target.closest('input[type="email"]') ||
      e.target.closest('input[type="tel"]') ||
      editingCandidateId === candidateId
    ) {
      return
    }
    navigate(`/candidates/${candidateId}`)
  }

  // Calculate average resume score
  const calculateAverageResumeScore = () => {
    const scoredCandidates = candidates.filter(c => 
      c.score_breakdown?.resume_score !== undefined && 
      c.score_breakdown?.resume_score !== null
    )
    if (scoredCandidates.length === 0) return null
    const sum = scoredCandidates.reduce((acc, c) => 
      acc + parseFloat(c.score_breakdown.resume_score), 0
    )
    return (sum / scoredCandidates.length).toFixed(1)
  }

  const averageScore = calculateAverageResumeScore()

  if (!job) return <div className="text-center py-12">Loading...</div>

  return (
    <div className="space-y-6">
      {/* Header with Job Name and Average Score */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-glass-200 transition-colors"
              title="Go back"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">{job.title}</h1>
              <p className="text-sm text-gray-400 mt-1">{job.department} • {job.candidate_count} candidates</p>
            </div>
          </div>
          {averageScore !== null && (
            <div className="flex flex-col items-end">
              <span className="text-sm text-gray-400">Average Resume Score</span>
              <span className="text-2xl font-bold text-primary-400">{averageScore}/10</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card p-0 mb-6">
        <div className="flex border-b border-glass-200">
          <button
            onClick={() => setActiveTab('description')}
            className={`px-6 py-4 font-semibold transition-colors ${
              activeTab === 'description'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Job Description & Evaluation Criteria
          </button>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-6 py-4 font-semibold transition-colors ${
              activeTab === 'candidates'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Candidates
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'description' && (
        <div className="space-y-6">
          {/* Job Description */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold mb-4">Job Description</h3>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{job.description}</p>
          </div>

          {/* Evaluation Criteria */}
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
      )}

      {activeTab === 'candidates' && (
        <div className="space-y-6">
          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`glass-card p-8 mb-6 transition-all duration-300 ${
              isDragging
                ? 'border-2 border-primary-400 border-solid bg-primary-500/10 scale-[1.02]'
                : 'border-2 border-dashed border-glass-200 bg-glass-50'
            }`}
          >
            <div className="flex flex-col items-center justify-center text-center">
              <div className={`mb-4 transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
                <Upload size={48} className={`mx-auto ${isDragging ? 'text-primary-400' : 'text-gray-400'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${isDragging ? 'text-primary-400' : 'text-white'}`}>
                {isDragging ? 'Drop files to upload' : 'Drag & Drop Resumes Here'}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Drop PDF, DOCX, or DOC files here, or click to browse
              </p>
              <label className="glass-button cursor-pointer flex items-center gap-2 inline-flex">
                <FileText size={18} />
                Browse Files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Pending Files Preview */}
          {pendingFiles.length > 0 && (
            <div className="glass-card p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-primary-400" />
                  <h3 className="text-lg font-semibold">
                    {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} ready to upload
                  </h3>
                </div>
                <button
                  onClick={clearPendingFiles}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pendingFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-glass-100 rounded-lg border border-glass-200"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText size={18} className="text-primary-400 flex-shrink-0" />
                      <span className="text-sm font-medium truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => removePendingFile(index)}
                      className="p-1 rounded hover:bg-red-500/20 transition-colors flex-shrink-0"
                      title="Remove file"
                    >
                      <XCircle size={18} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleUploadPendingFiles}
                  disabled={isUploading}
                  className="glass-button flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Upload All ({pendingFiles.length})
                    </>
                  )}
                </button>
                <button
                  onClick={clearPendingFiles}
                  className="glass-button-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Top Candidate Scores */}
          {topCandidates.length > 0 ? (
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
          ) : (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4">Top Candidate Scores</h3>
              <p className="text-sm text-gray-400">No candidates analyzed yet</p>
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
                  }}
                />
                {nameSearch && (
                  <button
                    onClick={() => {
                      setNameSearch('')
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
              <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Score</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr 
                key={candidate.id} 
                className={`border-b border-glass-200 transition-colors ${
                  editingCandidateId === candidate.id 
                    ? 'bg-primary-500/5' 
                    : 'hover:bg-glass-100 cursor-pointer'
                }`}
                onClick={(e) => handleRowClick(candidate.id, e)}
              >
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedCandidates.includes(candidate.id)}
                    onChange={() => toggleCandidateSelection(candidate.id)}
                  />
                </td>
                <td className="px-6 py-4">
                  {editingCandidateId === candidate.id ? (
                    <input
                      type="text"
                      className="glass-input text-sm w-full"
                      value={editValues[candidate.id]?.name || candidate.name}
                      onChange={(e) => handleFieldEdit(candidate.id, 'name', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium">
                      {candidate.name}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingCandidateId === candidate.id ? (
                    <input
                      type="email"
                      className="glass-input text-sm w-full"
                      value={editValues[candidate.id]?.email || candidate.contact_info?.email || ''}
                      onChange={(e) => handleFieldEdit(candidate.id, 'email', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-gray-400">
                      {candidate.contact_info?.email || '-'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingCandidateId === candidate.id ? (
                    <input
                      type="tel"
                      className="glass-input text-sm w-full"
                      value={editValues[candidate.id]?.phone || candidate.contact_info?.phone || ''}
                      onChange={(e) => handleFieldEdit(candidate.id, 'phone', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-gray-400">
                      {candidate.contact_info?.phone || '-'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
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
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  {candidate.score_breakdown?.resume_score ? (
                    <span className="font-semibold">
                      {parseFloat(candidate.score_breakdown.resume_score).toFixed(1)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {editingCandidateId === candidate.id ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRowSave(candidate.id)
                          }}
                          className="p-2 rounded-lg hover:bg-green-500/20 transition-colors"
                          title="Save changes"
                        >
                          <Save size={18} className="text-green-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRowCancel(candidate.id)
                          }}
                          className="p-2 rounded-lg hover:bg-gray-500/20 transition-colors"
                          title="Cancel editing"
                        >
                          <X size={18} className="text-gray-400" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => startEditingRow(candidate.id, e)}
                          className="p-2 rounded-lg hover:bg-glass-200 transition-colors"
                          title="Edit candidate"
                        >
                          <Edit size={18} className="text-gray-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(candidate.id)
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                          title="Delete candidate"
                        >
                          <Trash2 size={18} className="text-red-400" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          </div>
        </div>
      )}

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

