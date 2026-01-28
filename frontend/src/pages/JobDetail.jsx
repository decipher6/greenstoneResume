import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Upload, Sparkles, Eye, Trash2, CheckCircle, Search, X, FileText, XCircle, Edit, Save, ArrowLeft, Star, RefreshCw, ArrowUpDown, Copy, Check } from 'lucide-react'
import { 
  getJob, getCandidates, uploadCandidatesBulk, 
  runAnalysis, deleteCandidate, getTopCandidates, updateCandidate, shortlistCandidate, reAnalyzeCandidate
} from '../services/api'
import api from '../services/api'
import { useModal } from '../context/ModalContext'
import { useStats } from '../context/StatsContext'

const JobDetail = () => {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { showConfirm, showAlert } = useModal()
  const { refreshStats, refreshJobStats } = useStats()
  const [job, setJob] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [topCandidates, setTopCandidates] = useState([])
  const [topCandidatesLimit, setTopCandidatesLimit] = useState(5)
  const [selectedCandidates, setSelectedCandidates] = useState([])
  const [nameSearch, setNameSearch] = useState('')
  const [filters, setFilters] = useState({
    status: [], // Multi-select: new, analyzing, reviewed, interview, rejected
    rating: [], // Multi-select: 1-5 stars
    sort_by: 'overall_score'
  })
  const [nameSort, setNameSort] = useState(null) // null, 'asc', 'desc'
  const [ratingSort, setRatingSort] = useState(null) // null, 'asc', 'desc'
  const [scoreSort, setScoreSort] = useState(null) // null, 'asc', 'desc'
  const [openDropdown, setOpenDropdown] = useState(null) // 'status' or 'rating' or null
  const [autoAnalyze, setAutoAnalyze] = useState(true)
  const [editingCandidateId, setEditingCandidateId] = useState(null) // candidateId being edited
  const [editValues, setEditValues] = useState({}) // { candidateId: { name, email, phone } }
  const [isDragging, setIsDragging] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ 
    current: 0, 
    total: 0, 
    filesProcessed: 0, 
    totalFiles: 0,
    currentChunk: 0,
    retrying: false
  })
  const [activeTab, setActiveTab] = useState('candidates') // 'description', 'candidates', or 'shortlist'
  const [shortlistedCandidates, setShortlistedCandidates] = useState([])
  const [copiedField, setCopiedField] = useState(null) // Track which field was copied: 'candidateId-email' or 'candidateId-phone'
  
  // Use ref to always get the latest nameSearch value
  const nameSearchRef = useRef(nameSearch)
  useEffect(() => {
    nameSearchRef.current = nameSearch
  }, [nameSearch])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      // Default to sorting by overall_score descending if no sort_by specified
      params.append('sort_by', filters.sort_by || 'overall_score')
      
      const queryString = params.toString()
      const candidatesUrl = `/candidates/job/${jobId}${queryString ? '?' + queryString : ''}`
      
      const [jobRes, candidatesRes, topRes, shortlistedRes] = await Promise.all([
        getJob(jobId),
        api.get(candidatesUrl),
        getTopCandidates(jobId, topCandidatesLimit),
        api.get(`/candidates/job/${jobId}?sort_by=overall_score`)
      ])
      setJob(jobRes.data)
      setCandidates(candidatesRes.data)
      setTopCandidates(topRes.data)
      // Filter candidates with ratings (4+ stars)
      const shortlisted = shortlistedRes.data.filter(c => 
        c.rating && c.rating >= 4
      )
      setShortlistedCandidates(shortlisted)
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }, [jobId, topCandidatesLimit, filters.sort_by])

  // Fetch data when API filters change
  useEffect(() => {
    fetchData()
  }, [jobId, topCandidatesLimit, filters.sort_by, fetchData])

  const validateFiles = (files) => {
    const fileArray = Array.from(files)
    
    // Support up to 1000 files - warn for very large batches
    // 100 CVs is fully supported and recommended
    if (fileArray.length > 1000) {
      return {
        valid: false,
        error: `You selected ${fileArray.length} files. For best performance, please upload in batches of up to 500 files at a time.`,
        errorTitle: 'Large Batch Warning'
      }
    }
    
    // Inform user about batch processing for large uploads
    if (fileArray.length > 100) {
      console.log(`Processing ${fileArray.length} files in optimized batches...`)
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
    let uploadPollInterval = null
    try {
      // Upload files in optimized chunks for faster processing
      // Reduced to 15 files per chunk to avoid request size limits and timeout issues
      // 15 files balances speed with reliability (each PDF ~1-3MB = ~15-45MB per request)
      const CHUNK_SIZE = 15 // Upload 15 files at a time for optimal balance
      const chunks = []
      for (let i = 0; i < pendingFiles.length; i += CHUNK_SIZE) {
        chunks.push(pendingFiles.slice(i, i + CHUNK_SIZE))
      }

      let totalUploaded = 0
      let totalFailed = 0
      const allFailedFiles = []
      const totalFiles = pendingFiles.length
      const filesToRetry = [] // Files that failed due to network errors

      // Start polling for new candidates while upload is in progress
      // This allows users to see candidates as they're being uploaded
      uploadPollInterval = setInterval(() => {
        fetchData().catch(err => console.error('Error polling during upload:', err))
      }, 2000) // Poll every 2 seconds during upload

      // Upload chunks sequentially to avoid overwhelming the server
      setUploadProgress({ current: 0, total: chunks.length, filesProcessed: 0, totalFiles })
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex]
        let chunkSuccess = false
        let retries = 0
        const MAX_RETRIES = 1 // Reduced retries to avoid delays - bulk uploads should work on first try

        // Retry logic for network errors (only retry once to maintain speed)
        while (!chunkSuccess && retries <= MAX_RETRIES) {
          try {
            const filesProcessed = chunkIndex * CHUNK_SIZE
            setUploadProgress({ 
              current: chunkIndex + 1, 
              total: chunks.length,
              filesProcessed,
              totalFiles,
              currentChunk: chunk.length,
              retrying: retries > 0
            })
            
            const response = await uploadCandidatesBulk(jobId, chunk)
            const data = response.data || {}
            const uploaded = data.uploaded || 0
            const failed = data.failed || 0
            
            totalUploaded += uploaded
            totalFailed += failed
            
            if (data.failed_files && data.failed_files.length > 0) {
              allFailedFiles.push(...data.failed_files)
            }
            
            // Refresh candidates immediately after each chunk to show uploaded candidates
            // This allows users to see candidates as they're being uploaded
            await fetchData()
            
            chunkSuccess = true
          } catch (error) {
            const isNetworkError = error.code === 'ECONNABORTED' || 
                                 error.code === 'ERR_NETWORK' ||
                                 error.message?.includes('timeout') ||
                                 error.message?.includes('Network Error') ||
                                 !error.response
            
            if (isNetworkError && retries < MAX_RETRIES) {
              retries++
              console.log(`Network error on chunk ${chunkIndex + 1}, retrying (${retries}/${MAX_RETRIES})...`)
              // Wait briefly before retrying (reduced delay for speed)
              await new Promise(resolve => setTimeout(resolve, 500 * retries))
              continue
            }
            
            // If it's a network error and we've exhausted retries, add to retry queue as bulk chunk
            if (isNetworkError && retries >= MAX_RETRIES) {
              console.log(`Chunk ${chunkIndex + 1} failed after retries, will retry as bulk chunk at end`)
              filesToRetry.push(chunk) // Keep as chunk, not individual files - maintains bulk processing
              chunkSuccess = true // Move to next chunk, retry failed ones at end
              break
            }
            
            // Non-network error - don't retry, just mark as failed
            console.error(`Error uploading chunk ${chunkIndex + 1}:`, error)
            totalFailed += chunk.length
            chunk.forEach(file => {
              allFailedFiles.push({
                filename: file.name || 'Unknown',
                error: error.response?.data?.detail || error.message || 'Upload failed'
              })
            })
            chunkSuccess = true // Stop retrying for non-network errors
          }
        }
      }

      // Retry failed chunks as bulk uploads (maintain bulk processing)
      if (filesToRetry.length > 0) {
        console.log(`Retrying ${filesToRetry.length} failed chunk(s) as bulk uploads...`)
        const totalRetryChunks = filesToRetry.length
        
        for (let retryChunkIndex = 0; retryChunkIndex < filesToRetry.length; retryChunkIndex++) {
          const retryChunk = filesToRetry[retryChunkIndex]
          // Ensure retryChunk is an array (it should be a chunk, not a single file)
          const chunkArray = Array.isArray(retryChunk) ? retryChunk : [retryChunk]
          
          try {
            setUploadProgress({ 
              current: chunks.length + retryChunkIndex + 1, 
              total: chunks.length + totalRetryChunks,
              filesProcessed: totalUploaded,
              totalFiles,
              currentChunk: chunkArray.length,
              retrying: true
            })
            
            // Retry as bulk upload (maintains bulk processing speed)
            const response = await uploadCandidatesBulk(jobId, chunkArray)
            const data = response.data || {}
            const uploaded = data.uploaded || 0
            const failed = data.failed || 0
            
            totalUploaded += uploaded
            totalFailed += failed
            
            if (data.failed_files && data.failed_files.length > 0) {
              allFailedFiles.push(...data.failed_files)
            }
            
            // Refresh after retry chunk
            await fetchData()
          } catch (error) {
            console.error(`Error retrying chunk ${retryChunkIndex + 1}:`, error)
            // Mark all files in this chunk as failed
            chunkArray.forEach(file => {
              totalFailed++
              allFailedFiles.push({
                filename: file.name || 'Unknown',
                error: error.response?.data?.detail || error.message || 'Upload failed after retries'
              })
            })
          }
        }
      }

      let message = `Successfully uploaded ${totalUploaded} file(s)!`
      if (totalFailed > 0) {
        message += `\n\n${totalFailed} file(s) failed to upload.`
        if (allFailedFiles.length > 0) {
          // Group errors by type for better visibility
          const errorGroups = {}
          allFailedFiles.forEach(f => {
            const error = f.error || 'Unknown error'
            if (!errorGroups[error]) {
              errorGroups[error] = []
            }
            errorGroups[error].push(f.filename || 'Unknown')
          })
          
          // Show error summary
          const errorTypes = Object.keys(errorGroups)
          if (errorTypes.length > 0) {
            message += `\n\nCommon errors:\n`
            errorTypes.slice(0, 3).forEach((error, idx) => {
              const count = errorGroups[error].length
              message += `\n${idx + 1}. ${error} (${count} file${count !== 1 ? 's' : ''})`
              if (count <= 3) {
                message += `: ${errorGroups[error].join(', ')}`
              } else {
                message += `: ${errorGroups[error].slice(0, 3).join(', ')} and ${count - 3} more`
              }
            })
            if (errorTypes.length > 3) {
              message += `\n... and ${errorTypes.length - 3} more error type${errorTypes.length - 3 !== 1 ? 's' : ''}`
            }
          } else {
            // Fallback to showing filenames
            const failedNames = allFailedFiles.slice(0, 5).map(f => f.filename || 'Unknown').join(', ')
            message += `\n\nFailed files: ${failedNames}${allFailedFiles.length > 5 ? '...' : ''}`
          }
        }
        await showAlert('Partial Success', message, 'warning')
      } else {
        await showAlert('Success', message, 'success')
      }
      
      // Stop polling during upload
      clearInterval(uploadPollInterval)
      
      setPendingFiles([])
      fetchData()
      refreshStats() // Refresh dashboard stats
      refreshJobStats() // Refresh job-specific stats
      
      // Auto-analyze immediately if setting is enabled and we have uploaded candidates
      if (autoAnalyze && totalUploaded > 0) {
        // Start analysis immediately - use a small delay only to ensure database has processed the uploads
        const startAnalysis = async (retryCount = 0) => {
          try {
            console.log(`Starting auto-analysis for ${totalUploaded} uploaded candidate(s)... (attempt ${retryCount + 1})`)
            await runAnalysis(jobId, false) // false = only analyze new candidates (uploaded status)
            console.log('Auto-analysis started successfully')
            
            // Show notification that analysis has started (only on first attempt to avoid spam)
            if (retryCount === 0) {
              await showAlert(
                'Analysis Started', 
                `Auto-analysis started for ${totalUploaded} candidate(s)! Results will appear shortly.`,
                'info'
              )
            }
            
            // Poll for updates to show progress
            let pollCount = 0
            const maxPolls = 20 // Poll for up to 60 seconds (20 * 3s)
            const refreshInterval = setInterval(async () => {
              pollCount++
              await fetchData()
              refreshJobStats() // Refresh job stats during polling
              
              // Stop polling after max time
              if (pollCount >= maxPolls) {
                clearInterval(refreshInterval)
                await fetchData() // Final fetch
                refreshStats() // Final refresh after polling ends
                refreshJobStats()
                console.log('Stopped polling for analysis updates')
              }
            }, 3000) // Poll every 3 seconds
          } catch (error) {
            console.error(`Error starting auto-analysis (attempt ${retryCount + 1}):`, error)
            
            // Retry once after a short delay if first attempt fails (might be database delay)
            if (retryCount === 0) {
              console.log('Retrying auto-analysis after short delay...')
              setTimeout(() => startAnalysis(1), 2000) // Retry after 2 seconds
            } else {
              // Both attempts failed
              await showAlert(
                'Analysis Error', 
                'Failed to start auto-analysis. You can manually trigger analysis using the "Run Analysis" button.',
                'error'
              )
            }
          }
        }
        
        // Start analysis with a small initial delay to ensure database has processed uploads
        setTimeout(() => startAnalysis(0), 500)
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      let errorMessage = 'Error uploading files. Please try again.'
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error.message) {
        errorMessage = error.message
      }
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Upload timed out. The files may still be processing. Please check back in a moment.'
      }
      await showAlert('Error', errorMessage, 'error')
    } finally {
      // Make sure to clear polling interval if it exists
      if (uploadPollInterval) {
        clearInterval(uploadPollInterval)
      }
      setIsUploading(false)
      setUploadProgress({ current: 0, total: 0, filesProcessed: 0, totalFiles: 0, currentChunk: 0, retrying: false })
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
        refreshJobStats() // Refresh job stats during polling
      }, 3000)
      setTimeout(() => {
        clearInterval(refreshInterval)
        refreshStats() // Final refresh after polling ends
        refreshJobStats()
      }, 60000) // Stop after 60 seconds
    } catch (error) {
      console.error('Error running analysis:', error)
      await showAlert('Error', 'Error running analysis. Please try again.', 'error')
    }
  }

  const handleRating = async (candidateId, rating) => {
    // Optimistic update - update UI immediately
    const candidate = candidates.find(c => c.id === candidateId)
    if (!candidate) return
    
    const previousCandidates = [...candidates]
    const newRating = candidate?.rating === rating ? null : rating
    
    // Prepare update data
    const updateData = { rating: newRating }
    
    // Rating doesn't change status anymore - status is managed separately
    
    // Update UI immediately (optimistic update)
    setCandidates(prevCandidates => 
      prevCandidates.map(c => 
        c.id === candidateId 
          ? { ...c, ...updateData }
          : c
      )
    )
    
    // Also update topCandidates if the candidate is in there
    setTopCandidates(prevTop => 
      prevTop.map(c => 
        c.id === candidateId 
          ? { ...c, ...updateData }
          : c
      )
    )
    
    // Also update shortlistedCandidates if needed
    setShortlistedCandidates(prevShort => {
      if (newRating >= 4) {
        // Add or update in shortlisted
        const exists = prevShort.find(c => c.id === candidateId)
        if (exists) {
          return prevShort.map(c => 
            c.id === candidateId ? { ...c, ...updateData } : c
          )
        } else {
          return [...prevShort, { ...candidate, ...updateData }]
        }
      } else {
        // Remove from shortlisted if rating < 4
        return prevShort.filter(c => c.id !== candidateId)
      }
    })
    
    // Then update in background
    try {
      await updateCandidate(candidateId, updateData)
      // Optionally refresh data in background (non-blocking)
      fetchData().catch(err => console.error('Background refresh failed:', err))
      refreshJobStats() // Refresh job stats after rating update
    } catch (error) {
      console.error('Error updating rating:', error)
      // Revert on error
      setCandidates(previousCandidates)
      await showAlert('Error', 'Failed to update rating. Please try again.', 'error')
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
        refreshStats() // Refresh dashboard stats
        refreshJobStats() // Refresh job stats
        await showAlert('Success', 'Candidate deleted successfully.', 'success')
      } catch (error) {
        console.error('Error deleting candidate:', error)
        await showAlert('Error', 'Failed to delete candidate. Please try again.', 'error')
      }
    }
  }

  const handleBulkDelete = async () => {
    if (selectedCandidates.length === 0) return
    
    const confirmed = await showConfirm({
      title: 'Delete Selected Candidates',
      message: `Are you sure you want to delete ${selectedCandidates.length} candidate(s)? This action cannot be undone.`,
      type: 'confirm',
      confirmText: 'Delete All',
      cancelText: 'Cancel'
    })
    
    if (confirmed) {
      try {
        // Delete all candidates in parallel
        await Promise.all(selectedCandidates.map(id => deleteCandidate(id)))
        setSelectedCandidates([])
        fetchData()
        refreshStats() // Refresh dashboard stats
        refreshJobStats() // Refresh job stats
        await showAlert('Success', `Successfully deleted ${selectedCandidates.length} candidate(s).`, 'success')
      } catch (error) {
        console.error('Error deleting candidates:', error)
        await showAlert('Error', 'Failed to delete some candidates. Please try again.', 'error')
        fetchData() // Refresh to show current state
        refreshStats() // Refresh stats even on error
        refreshJobStats()
      }
    }
  }

  const handleBulkReAnalyze = async () => {
    if (selectedCandidates.length === 0) return
    
    const confirmed = await showConfirm({
      title: 'Re-analyze Selected Candidates',
      message: `Re-analyze ${selectedCandidates.length} selected candidate(s)? This will update all scores and justifications.`,
      type: 'info',
      confirmText: 'Re-analyze',
      cancelText: 'Cancel'
    })
    
    if (confirmed) {
      try {
        await Promise.all(selectedCandidates.map(id => reAnalyzeCandidate(id)))
        setSelectedCandidates([])
        await showAlert('Success', `Re-analysis started for ${selectedCandidates.length} candidate(s).`, 'success')
        fetchData() // Refresh data
      } catch (error) {
        console.error('Error re-analyzing candidates:', error)
        await showAlert('Error', 'Failed to start re-analysis for some candidates. Please try again.', 'error')
        fetchData()
      }
    }
  }

  const applyFilters = () => {
    fetchData()
  }

  const clearFilters = () => {
    setFilters({
      status: [],
      rating: [],
      sort_by: 'overall_score'
    })
    setNameSearch('')
    setNameSort(null)
    setRatingSort(null)
    setScoreSort(null)
    // Fetch with cleared filters
    setTimeout(() => {
      const params = new URLSearchParams()
      params.append('sort_by', 'overall_score')
      const candidatesUrl = `/candidates/job/${jobId}?${params.toString()}`
      api.get(candidatesUrl).then(res => setCandidates(res.data))
    }, 100)
  }

  // Client-side filtering and sorting
  const getFilteredCandidates = () => {
    let filtered = [...candidates]

    // Apply name search
    if (nameSearch.trim()) {
      const query = nameSearch.toLowerCase()
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(query)
      )
    }

    // Status filter (multi-select)
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(c => 
        filters.status.includes(c.status || 'new')
      )
    }

    // Rating filter (multi-select)
    if (filters.rating && filters.rating.length > 0) {
      filtered = filtered.filter(c => {
        const rating = c.rating || 0
        return filters.rating.includes(rating.toString())
      })
    }

    // Group by status first (new, interview, reviewed, rejected, then others)
    const statusOrder = ['new', 'interview', 'reviewed', 'rejected', 'analyzing']
    const groupedByStatus = {}
    
    filtered.forEach(candidate => {
      const status = candidate.status || 'new'
      if (!groupedByStatus[status]) {
        groupedByStatus[status] = []
      }
      groupedByStatus[status].push(candidate)
    })

    // Sort within each status group
    const sortWithinGroup = (group) => {
      // Sort by name
      if (nameSort) {
        group.sort((a, b) => {
          const aName = (a.name || '').toLowerCase()
          const bName = (b.name || '').toLowerCase()
          if (nameSort === 'asc') {
            return aName.localeCompare(bName)
          } else {
            return bName.localeCompare(aName)
          }
        })
      }
      // Sort by rating
      else if (ratingSort) {
        group.sort((a, b) => {
          const aRating = a.rating || 0
          const bRating = b.rating || 0
          if (ratingSort === 'asc') {
            return aRating - bRating
          } else {
            return bRating - aRating
          }
        })
      }
      // Sort by score
      else if (scoreSort) {
        group.sort((a, b) => {
          const aScore = parseFloat(a.score_breakdown?.resume_score || 0)
          const bScore = parseFloat(b.score_breakdown?.resume_score || 0)
          if (scoreSort === 'asc') {
            return aScore - bScore
          } else {
            return bScore - aScore
          }
        })
      }
      return group
    }

    // Combine groups in status order
    const result = []
    statusOrder.forEach(status => {
      if (groupedByStatus[status]) {
        result.push(...sortWithinGroup(groupedByStatus[status]))
      }
    })
    
    // Add any remaining statuses not in the order list
    Object.keys(groupedByStatus).forEach(status => {
      if (!statusOrder.includes(status)) {
        result.push(...sortWithinGroup(groupedByStatus[status]))
      }
    })

    return result
  }

  const toggleStatusFilter = (status) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }))
  }

  const toggleRatingFilter = (rating) => {
    setFilters(prev => ({
      ...prev,
      rating: prev.rating.includes(rating)
        ? prev.rating.filter(r => r !== rating)
        : [...prev.rating, rating]
    }))
  }

  const toggleNameSort = () => {
    if (nameSort === null) {
      setNameSort('asc')
      setRatingSort(null)
      setScoreSort(null)
    } else if (nameSort === 'asc') {
      setNameSort('desc')
    } else {
      setNameSort(null)
    }
  }

  const toggleRatingSort = () => {
    if (ratingSort === null) {
      setRatingSort('asc')
      setNameSort(null)
      setScoreSort(null)
    } else if (ratingSort === 'asc') {
      setRatingSort('desc')
    } else {
      setRatingSort(null)
    }
  }

  const toggleScoreSort = () => {
    if (scoreSort === null) {
      setScoreSort('asc')
      setNameSort(null)
      setRatingSort(null)
    } else if (scoreSort === 'asc') {
      setScoreSort('desc')
    } else {
      setScoreSort(null)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest('.filter-dropdown-container')) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdown])

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
        },
        location: edited.location !== undefined ? edited.location : (candidate.location || '')
      }

      await updateCandidate(candidateId, updateData)
      await fetchData() // Refresh the data
      refreshJobStats() // Refresh job stats after candidate update
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
        phone: candidate.contact_info?.phone || '',
        location: candidate.location || ''
      }
    }))
  }

  const handleStatusChange = async (candidateId, newStatus, e) => {
    e.stopPropagation()
    try {
      await updateCandidate(candidateId, { status: newStatus })
      await fetchData() // Refresh the data
      refreshJobStats() // Refresh job stats after candidate update
    } catch (error) {
      console.error('Error updating candidate status:', error)
      await showAlert('Error', 'Failed to update candidate status. Please try again.', 'error')
    }
  }

  const handleRowClick = (candidateId, e) => {
    // Don't navigate if clicking on checkbox, edit button, delete button, status dropdown, or if editing
    if (
      e.target.closest('input[type="checkbox"]') ||
      e.target.closest('button') ||
      e.target.closest('input[type="text"]') ||
      e.target.closest('input[type="email"]') ||
      e.target.closest('input[type="tel"]') ||
      e.target.closest('select') ||
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
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-glass-200 transition-colors"
              title="Go to Dashboard"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">{job.title}</h1>
              <p className="text-sm text-gray-400 mt-1">{job.department} • {job.candidate_count} candidates</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card p-0 mb-6">
        <div className="flex border-b border-glass-200">
          <button
            onClick={() => setActiveTab('description')}
            className={`px-6 py-4 font-semibold transition-colors ${
              activeTab === 'description'
                ? 'text-green-300 border-b-2 border-green-300'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Job Description & Evaluation Criteria
          </button>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-6 py-4 font-semibold transition-colors ${
              activeTab === 'candidates'
                ? 'text-green-300 border-b-2 border-green-300'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Candidates
          </button>
          <button
            onClick={() => setActiveTab('shortlist')}
            className={`px-6 py-4 font-semibold transition-colors ${
              activeTab === 'shortlist'
                ? 'text-green-300 border-b-2 border-green-300'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Highly Rated ({shortlistedCandidates.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'description' && (
        <div className="flex gap-6">
          {/* Job Description - 60% width */}
          <div className="glass-card p-6 flex-[0.6]">
            <h3 className="text-lg font-semibold mb-4">Job Description</h3>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{job.description}</p>
          </div>

          {/* Evaluation Criteria - 40% width */}
          <div className="glass-card p-6 flex-[0.4]">
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
                Drop PDF, DOCX, or DOC files here, or click to browse<br />
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
                      {uploadProgress.totalFiles > 0 ? (
                        <span>
                          {uploadProgress.retrying ? 'Retrying... ' : 'Uploading... '}
                          {uploadProgress.filesProcessed || 0}/{uploadProgress.totalFiles} files
                          {uploadProgress.total > 1 && ` (Batch ${uploadProgress.current}/${uploadProgress.total})`}
                        </span>
                      ) : uploadProgress.total > 1 ? (
                        <span>
                          {uploadProgress.retrying ? 'Retrying... ' : 'Uploading... '}
                          (Batch {uploadProgress.current}/{uploadProgress.total})
                        </span>
                      ) : (
                        <span>{uploadProgress.retrying ? 'Retrying...' : 'Uploading...'}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Upload All ({pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''})
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

          {/* Candidates Table */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-glass-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Candidates</h3>
                
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-200 z-10 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by name..."
                      className="glass-input pl-10 pr-4 py-2 w-64 text-sm"
                      value={nameSearch}
                      onChange={(e) => setNameSearch(e.target.value)}
                    />
                  </div>
                  {(filters.status.length > 0 || filters.rating.length > 0 || nameSearch || nameSort || ratingSort || scoreSort) && (
                    <button
                      onClick={clearFilters}
                      className="glass-button-secondary flex items-center gap-2 text-sm"
                    >
                      <X size={16} />
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedCandidates.length > 0 && (
              <div className="p-4 border-b border-glass-200 bg-glass-100 flex items-center justify-between">
                <span className="text-sm text-gray-400">{selectedCandidates.length} candidates selected</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkReAnalyze}
                    className="glass-button-secondary flex items-center gap-2 text-primary-400 hover:bg-primary-500/20"
                  >
                    <RefreshCw size={16} />
                    Re-analyze ({selectedCandidates.length})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="glass-button-secondary flex items-center gap-2 text-red-400 hover:bg-red-500/20"
                  >
                    <Trash2 size={16} />
                    Delete ({selectedCandidates.length})
                  </button>
                </div>
              </div>
            )}
            <table className="w-full">
          <thead className="bg-glass-200/80 border-b-2 border-glass-300">
            <tr>
              <th className="px-6 py-5 text-left">
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
              <th className="px-6 py-5 text-left text-lg font-extrabold text-white">
                #
              </th>
              <th 
                className="px-6 py-5 text-left text-lg font-extrabold text-white cursor-pointer hover:bg-glass-300 transition-colors select-none"
                onClick={toggleNameSort}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span>Name</span>
                    <ArrowUpDown size={14} className="text-gray-300" />
                    {nameSort === 'asc' && <span className="text-xs text-gray-300">(A-Z)</span>}
                    {nameSort === 'desc' && <span className="text-xs text-gray-300">(Z-A)</span>}
                  </div>
                </div>
              </th>
              <th className="px-6 py-5 text-left text-lg font-extrabold text-white">
                <div>Email</div>
              </th>
              <th className="px-6 py-5 text-left text-lg font-extrabold text-white">
                <div>Phone</div>
              </th>
              <th className="px-6 py-5 text-left text-lg font-extrabold text-white">
                <div>Location</div>
              </th>
              <th className="px-6 py-5 text-left text-lg font-extrabold text-white relative">
                <div className="space-y-2 filter-dropdown-container">
                  <div 
                    className="cursor-pointer hover:bg-glass-300 transition-colors px-2 py-1 rounded flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenDropdown(openDropdown === 'status' ? null : 'status')
                    }}
                  >
                    <span>Status</span>
                    {filters.status.length > 0 && (
                      <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                        {filters.status.length}
                      </span>
                    )}
                  </div>
                  {openDropdown === 'status' && (
                    <div className="absolute top-full left-0 mt-1 z-50 glass-card p-3 min-w-[200px] shadow-lg">
                      <div className="space-y-2">
                        {['new', 'analyzing', 'reviewed', 'interview', 'rejected'].map(status => (
                          <label key={status} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-glass-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={filters.status.includes(status)}
                              onChange={() => toggleStatusFilter(status)}
                              className="rounded"
                            />
                            <span className="capitalize">{status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-5 text-left text-lg font-extrabold text-white relative"
              >
                <div className="space-y-2 filter-dropdown-container">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:bg-glass-300 transition-colors px-2 py-1 rounded"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (e.target.closest('span') || e.target.closest('svg')) {
                        toggleRatingSort()
                      } else {
                        setOpenDropdown(openDropdown === 'rating' ? null : 'rating')
                      }
                    }}
                  >
                    <span>Rating</span>
                    <ArrowUpDown size={14} className="text-gray-300" onClick={(e) => {
                      e.stopPropagation()
                      toggleRatingSort()
                    }} />
                    {ratingSort === 'asc' && <span className="text-xs text-gray-300">(Low-High)</span>}
                    {ratingSort === 'desc' && <span className="text-xs text-gray-300">(High-Low)</span>}
                    {filters.rating.length > 0 && (
                      <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                        {filters.rating.length}
                      </span>
                    )}
                  </div>
                  {openDropdown === 'rating' && (
                    <div className="absolute top-full left-0 mt-1 z-50 glass-card p-3 min-w-[200px] shadow-lg">
                      <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map(rating => (
                          <label key={rating} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-glass-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={filters.rating.includes(rating.toString())}
                              onChange={() => toggleRatingFilter(rating.toString())}
                              className="rounded"
                            />
                            <span>{rating} Star{rating !== 1 ? 's' : ''}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-5 text-left text-lg font-extrabold text-white cursor-pointer hover:bg-glass-300 transition-colors select-none"
                onClick={toggleScoreSort}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span>Score</span>
                    <ArrowUpDown size={14} className="text-gray-300" />
                    {scoreSort === 'asc' && <span className="text-xs text-gray-300">(Low-High)</span>}
                    {scoreSort === 'desc' && <span className="text-xs text-gray-300">(High-Low)</span>}
                  </div>
                </div>
              </th>
              <th className="px-6 py-5 text-left text-lg font-extrabold text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {getFilteredCandidates().length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                  No candidates found matching your filters.
                </td>
              </tr>
            ) : (
              getFilteredCandidates().map((candidate, index) => (
              <tr 
                key={candidate.id} 
                className={`border-b border-glass-200 transition-colors ${
                  editingCandidateId === candidate.id 
                    ? 'bg-primary-500/5' 
                    : (candidate.rating && candidate.rating >= 4)
                    ? index % 2 === 0 ? 'bg-green-500/10 hover:bg-green-500/15 cursor-pointer' : 'bg-green-500/5 hover:bg-green-500/10 cursor-pointer'
                    : index % 2 === 0 ? 'bg-glass-100/50 hover:bg-glass-100 cursor-pointer' : 'bg-transparent hover:bg-glass-100 cursor-pointer'
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
                <td className="px-6 py-4 text-gray-400 text-sm">
                  {index + 1}
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
                    <div className="flex items-center gap-x-1">
                      <span className="text-gray-400">
                        {candidate.contact_info?.email || '-'}
                      </span>
                      {candidate.contact_info?.email && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await navigator.clipboard.writeText(candidate.contact_info.email)
                              setCopiedField(`${candidate.id}-email`)
                              setTimeout(() => setCopiedField(null), 2000)
                            } catch (err) {
                              await showAlert('Error', 'Failed to copy email', 'error')
                            }
                          }}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors group"
                          title="Copy email"
                        >
                          {copiedField === `${candidate.id}-email` ? (
                            <Check size={14} className="text-green-400" />
                          ) : (
                            <Copy size={14} className="text-gray-400 group-hover:text-white transition-colors" />
                          )}
                        </button>
                      )}
                    </div>
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
                    <div className="flex items-center gap-x-1">
                      <span className="text-gray-400">
                        {candidate.contact_info?.phone || '-'}
                      </span>
                      {candidate.contact_info?.phone && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await navigator.clipboard.writeText(candidate.contact_info.phone)
                              setCopiedField(`${candidate.id}-phone`)
                              setTimeout(() => setCopiedField(null), 2000)
                            } catch (err) {
                              await showAlert('Error', 'Failed to copy phone number', 'error')
                            }
                          }}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors group"
                          title="Copy phone number"
                        >
                          {copiedField === `${candidate.id}-phone` ? (
                            <Check size={14} className="text-green-400" />
                          ) : (
                            <Copy size={14} className="text-gray-400 group-hover:text-white transition-colors" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingCandidateId === candidate.id ? (
                    <input
                      type="text"
                      className="glass-input text-sm w-full"
                      value={editValues[candidate.id]?.location || candidate.location || ''}
                      onChange={(e) => handleFieldEdit(candidate.id, 'location', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-gray-400">
                      {candidate.location || '-'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={candidate.status || 'new'}
                    onChange={(e) => handleStatusChange(candidate.id, e.target.value, e)}
                    className={`glass-input text-xs font-medium py-1.5 px-3 rounded-lg cursor-pointer ${
                      candidate.status === 'new'
                        ? 'bg-gray-400/40 text-gray-300 border-gray-400/60'
                        : candidate.status === 'interview'
                        ? 'bg-purple-400/40 text-purple-300 border-purple-400/60'
                        : candidate.status === 'reviewed'
                        ? 'bg-blue-400/40 text-blue-300 border-blue-400/60'
                        : candidate.status === 'rejected'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : candidate.status === 'analyzing'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}
                  >
                    <option value="new">New</option>
                    <option value="analyzing">Analyzing</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="interview">Interview</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRating(candidate.id, star)
                        }}
                        className="transition-all hover:scale-110 p-0.5"
                        title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                      >
                        <Star 
                          size={14} 
                          className={`${
                            candidate?.rating >= star 
                              ? 'text-yellow-400 fill-yellow-400' 
                              : 'text-gray-500 fill-none'
                          } transition-colors`}
                        />
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  {candidate.score_breakdown?.resume_score ? (
                    <span 
                      className="font-semibold"
                      title="Maximum score is 10"
                    >
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
                          className="p-2 rounded-lg hover:bg-green-400/40 transition-colors"
                          title="Save changes"
                        >
                          <Save size={18} className="text-green-300" />
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
              ))
            )}
          </tbody>
        </table>
          </div>
        </div>
      )}

      {activeTab === 'shortlist' && (
        <div className="space-y-6">
          {/* Shortlisted Candidates Table */}
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-glass-200">
              <h3 className="text-lg font-semibold">Rated Candidates ({shortlistedCandidates.length})</h3>
            </div>
            <table className="w-full">
              <thead className="bg-glass-200/80 border-b-2 border-glass-300">
                <tr>
                  <th className="px-6 py-5 text-left text-lg font-extrabold text-white">Name</th>
                  <th className="px-6 py-5 text-left text-lg font-extrabold text-white">Email</th>
                  <th className="px-6 py-5 text-left text-lg font-extrabold text-white">Phone</th>
                  <th className="px-6 py-5 text-left text-lg font-extrabold text-white">Status</th>
                  <th className="px-6 py-5 text-left text-lg font-extrabold text-white">Rating</th>
                  <th className="px-6 py-5 text-left text-lg font-extrabold text-white">Score</th>
                  <th className="px-6 py-5 text-left text-lg font-extrabold text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shortlistedCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      No rated candidates yet. Rate candidates with 4+ stars to see them here.
                    </td>
                  </tr>
                ) : (
                  shortlistedCandidates.map((candidate, index) => (
                    <tr 
                      key={candidate.id} 
                      className={`border-b border-glass-200 hover:bg-glass-100 cursor-pointer transition-colors ${index % 2 === 0 ? 'bg-glass-100/50' : 'bg-transparent'}`}
                      onClick={(e) => {
                        if (!e.target.closest('button')) {
                          navigate(`/candidates/${candidate.id}`)
                        }
                      }}
                    >
                      <td className="px-6 py-4">
                        <span className="font-medium">{candidate.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-x-1">
                          <span className="text-gray-400">
                            {candidate.contact_info?.email || '-'}
                          </span>
                          {candidate.contact_info?.email && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await navigator.clipboard.writeText(candidate.contact_info.email)
                                  setCopiedField(`${candidate.id}-email`)
                                  setTimeout(() => setCopiedField(null), 2000)
                                } catch (err) {
                                  await showAlert('Error', 'Failed to copy email', 'error')
                                }
                              }}
                              className="p-1.5 hover:bg-white/10 rounded transition-colors group"
                              title="Copy email"
                            >
                              {copiedField === `${candidate.id}-email` ? (
                                <Check size={14} className="text-green-400" />
                              ) : (
                                <Copy size={14} className="text-gray-400 group-hover:text-white transition-colors" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-x-1">
                          <span className="text-gray-400">
                            {candidate.contact_info?.phone || '-'}
                          </span>
                          {candidate.contact_info?.phone && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await navigator.clipboard.writeText(candidate.contact_info.phone)
                                  setCopiedField(`${candidate.id}-phone`)
                                  setTimeout(() => setCopiedField(null), 2000)
                                } catch (err) {
                                  await showAlert('Error', 'Failed to copy phone number', 'error')
                                }
                              }}
                              className="p-1.5 hover:bg-white/10 rounded transition-colors group"
                              title="Copy phone number"
                            >
                              {copiedField === `${candidate.id}-phone` ? (
                                <Check size={14} className="text-green-400" />
                              ) : (
                                <Copy size={14} className="text-gray-400 group-hover:text-white transition-colors" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={candidate.status || 'new'}
                          onChange={(e) => handleStatusChange(candidate.id, e.target.value, e)}
                          className={`glass-input text-xs font-medium py-1.5 px-3 rounded-lg cursor-pointer ${
                            candidate.status === 'new'
                              ? 'bg-gray-400/40 text-gray-300 border-gray-400/60'
                              : candidate.status === 'interview'
                              ? 'bg-purple-400/40 text-purple-300 border-purple-400/60'
                              : candidate.status === 'reviewed'
                              ? 'bg-blue-400/40 text-blue-300 border-blue-400/60'
                              : candidate.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : candidate.status === 'analyzing'
                              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          }`}
                        >
                          <option value="new">New</option>
                          <option value="analyzing">Analyzing</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="interview">Interview</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRating(candidate.id, star)
                              }}
                              className="transition-all hover:scale-110 p-0.5"
                              title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                            >
                              <Star 
                                size={14} 
                                className={`${
                                  candidate?.rating >= star 
                                    ? 'text-yellow-400 fill-yellow-400' 
                                    : 'text-gray-500 fill-none'
                                } transition-colors`}
                              />
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {candidate.score_breakdown?.resume_score ? (
                          <span 
                            className="font-semibold"
                            title="Maximum score is 10"
                          >
                            {parseFloat(candidate.score_breakdown.resume_score).toFixed(1)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/candidates/${candidate.id}`)
                            }}
                            className="p-2 rounded-lg hover:bg-glass-200 transition-colors"
                            title="View candidate"
                          >
                            <Eye size={18} className="text-gray-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}

export default JobDetail

