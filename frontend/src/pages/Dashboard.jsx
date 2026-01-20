import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Eye, Calendar, LucideTrash, Search, X, ArrowUpDown, Users } from 'lucide-react'
import { getJobs, deleteJob, updateJobStatus } from '../services/api'
import CreateJobModal from '../components/CreateJobModal'
import { useModal } from '../context/ModalContext'

const Dashboard = () => {
  const [jobs, setJobs] = useState([])
  const [filteredJobs, setFilteredJobs] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    department: [], // Changed to array for multi-select
    status: [] // Changed to array for multi-select
  })
  const [titleSort, setTitleSort] = useState(null) // null, 'asc', 'desc'
  const [candidatesSort, setCandidatesSort] = useState(null) // null, 'asc', 'desc'
  const [lastRunSort, setLastRunSort] = useState('latest') // 'latest' or 'oldest'
  const [keywordSearch, setKeywordSearch] = useState('')
  const [openDropdown, setOpenDropdown] = useState(null) // 'department' or 'status' or null
  const { showConfirm, showAlert } = useModal()

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const response = await getJobs()
      setJobs(response.data)
      setFilteredJobs(response.data)
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }

  useEffect(() => {
    applyFilters()
  }, [searchQuery, filters, jobs, lastRunSort, titleSort, candidatesSort, keywordSearch])

  const applyFilters = () => {
    let filtered = [...jobs]

    // Keyword search (searches across title, department)
    if (keywordSearch.trim()) {
      const query = keywordSearch.toLowerCase()
      filtered = filtered.filter(job => 
        job.title?.toLowerCase().includes(query) ||
        job.department?.toLowerCase().includes(query)
      )
    }


    // Department filter (multi-select)
    if (filters.department && filters.department.length > 0) {
      filtered = filtered.filter(job => 
        filters.department.includes(job.department)
      )
    }


    // Status filter (multi-select)
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(job => 
        filters.status.includes(job.status || 'active')
      )
    }

    // Sort by title
    if (titleSort) {
      filtered.sort((a, b) => {
        const aTitle = (a.title || '').toLowerCase()
        const bTitle = (b.title || '').toLowerCase()
        if (titleSort === 'asc') {
          return aTitle.localeCompare(bTitle)
        } else {
          return bTitle.localeCompare(aTitle)
        }
      })
    }

    // Sort by candidates
    if (candidatesSort) {
      filtered.sort((a, b) => {
        const aCount = a.candidate_count || 0
        const bCount = b.candidate_count || 0
        if (candidatesSort === 'asc') {
          return aCount - bCount
        } else {
          return bCount - aCount
        }
      })
    }

    // Sort by last_run (if no other sorts applied)
    if (!titleSort && !candidatesSort) {
      filtered.sort((a, b) => {
        const aDate = a.last_run ? new Date(a.last_run).getTime() : 0
        const bDate = b.last_run ? new Date(b.last_run).getTime() : 0
        
        if (lastRunSort === 'latest') {
          return bDate - aDate // Latest first (descending)
        } else {
          return aDate - bDate // Oldest first (ascending)
        }
      })
    }

    setFilteredJobs(filtered)
  }

  const toggleLastRunSort = () => {
    setLastRunSort(prev => prev === 'latest' ? 'oldest' : 'latest')
  }

  const clearFilters = () => {
    setSearchQuery('')
    setKeywordSearch('')
    setFilters({
      department: [],
      status: []
    })
    setTitleSort(null)
    setCandidatesSort(null)
    setLastRunSort('latest')
  }

  const toggleDepartmentFilter = (dept) => {
    setFilters(prev => ({
      ...prev,
      department: prev.department.includes(dept)
        ? prev.department.filter(d => d !== dept)
        : [...prev.department, dept]
    }))
  }

  const toggleStatusFilter = (status) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }))
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

  const toggleTitleSort = () => {
    if (titleSort === null) {
      setTitleSort('asc')
      setCandidatesSort(null)
    } else if (titleSort === 'asc') {
      setTitleSort('desc')
    } else {
      setTitleSort(null)
    }
  }

  const toggleCandidatesSort = () => {
    if (candidatesSort === null) {
      setCandidatesSort('asc')
      setTitleSort(null)
    } else if (candidatesSort === 'asc') {
      setCandidatesSort('desc')
    } else {
      setCandidatesSort(null)
    }
  }

  const handleDelete = async (jobId) => {
    const confirmed = await showConfirm({
      title: 'Delete Job Post',
      message: 'Are you sure you want to delete this job? This action cannot be undone and will also delete all associated candidates.',
      type: 'confirm',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })
    
    if (confirmed) {
      try {
        await deleteJob(jobId)
        fetchJobs()
        await showAlert('Success', 'Job post deleted successfully.', 'success')
      } catch (error) {
        console.error('Error deleting job:', error)
        await showAlert('Error', 'Failed to delete job post. Please try again.', 'error')
      }
    }
  }

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      await updateJobStatus(jobId, newStatus)
      fetchJobs()
    } catch (error) {
      console.error('Error updating job status:', error)
      await showAlert('Error', 'Failed to update job status. Please try again.', 'error')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const day = date.getDate()
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  // Get unique departments for filter
  const departments = [...new Set(jobs.map(job => job.department).filter(Boolean))].sort()

  return (
    <div className="space-y-6">
      {/* Combined Search, Filters, Add Job Button, and Table */}
      <div className="glass-card overflow-hidden">
        {/* Search and Filters with Add Job Button */}
        <div className="p-4 border-b border-glass-200">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="glass-button flex items-center gap-2 whitespace-nowrap"
            >
              <Plus size={32} />
              Create New Job
            </button>
            <div className="flex-1"></div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-200 z-10 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by keyword..."
                    className="glass-input pl-10 pr-4 py-2 w-64 text-sm"
                    value={keywordSearch}
                    onChange={(e) => setKeywordSearch(e.target.value)}
                  />
                </div>
              </div>
            {(Object.values(filters).some(f => Array.isArray(f) ? f.length > 0 : f) || keywordSearch || titleSort || candidatesSort) && (
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

        {/* Table */}
        
        <div className="overflow-x-auto">
          <table className="w-full">
          <thead className="bg-glass-100 border-b border-glass-200">
            <tr>
              <th 
                className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-glass-200 transition-colors select-none"
                onClick={toggleTitleSort}
              >
                <div className="flex items-center gap-2">
                  <span>Title</span>
                  <ArrowUpDown size={14} className="text-gray-400" />
                  {titleSort === 'asc' && <span className="text-xs text-gray-400">(A-Z)</span>}
                  {titleSort === 'desc' && <span className="text-xs text-gray-400">(Z-A)</span>}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold relative">
                <div className="space-y-2 filter-dropdown-container">
                  <div 
                    className="cursor-pointer hover:bg-glass-200 transition-colors px-2 py-1 rounded flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenDropdown(openDropdown === 'department' ? null : 'department')
                    }}
                  >
                    <span>Department</span>
                    {filters.department.length > 0 && (
                      <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                        {filters.department.length}
                      </span>
                    )}
                  </div>
                  {openDropdown === 'department' && (
                    <div className="absolute top-full left-0 mt-1 z-50 glass-card p-3 min-w-[200px] max-h-64 overflow-y-auto shadow-lg">
                      <div className="space-y-2">
                        {departments.map(dept => (
                          <label key={dept} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-glass-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={filters.department.includes(dept)}
                              onChange={() => toggleDepartmentFilter(dept)}
                              className="rounded"
                            />
                            <span>{dept}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-glass-200 transition-colors select-none"
                onClick={toggleCandidatesSort}
              >
                <div className="flex items-center gap-2">
                  <span># Candidates</span>
                  <ArrowUpDown size={14} className="text-gray-400" />
                  {candidatesSort === 'asc' && <span className="text-xs text-gray-400">(Low-High)</span>}
                  {candidatesSort === 'desc' && <span className="text-xs text-gray-400">(High-Low)</span>}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-glass-200 transition-colors select-none"
                onClick={toggleLastRunSort}
              >
                <div className="flex items-center gap-2">
                  <span>Last Run</span>
                  <ArrowUpDown size={14} className="text-gray-400" />
                  {lastRunSort === 'latest' && (
                    <span className="text-xs text-gray-400">(Latest first)</span>
                  )}
                  {lastRunSort === 'oldest' && (
                    <span className="text-xs text-gray-400">(Oldest first)</span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold relative">
                <div className="space-y-2 filter-dropdown-container">
                  <div 
                    className="cursor-pointer hover:bg-glass-200 transition-colors px-2 py-1 rounded flex items-center gap-2"
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
                        {['active', 'on-hold', 'filled', 'cancelled'].map(status => (
                          <label key={status} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-glass-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={filters.status.includes(status)}
                              onChange={() => toggleStatusFilter(status)}
                              className="rounded"
                            />
                            <span className="capitalize">{status === 'on-hold' ? 'On-Hold' : status}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No jobs found matching your search criteria.
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
              <tr key={job.id} className="border-b border-glass-200 hover:bg-glass-100 transition-colors">
                <td className="px-6 py-4">
                  <Link to={`/jobs/${job.id}`} className="font-medium hover:text-primary-400">
                    {job.title}
                  </Link>
                </td>
                <td className="px-6 py-4 text-gray-400">{job.department}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-gray-400" />
                    {job.candidate_count || 0}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-400">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    {formatDate(job.last_run)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={job.status || 'active'}
                    onChange={(e) => handleStatusChange(job.id, e.target.value)}
                    className={`glass-input text-xs font-medium py-1.5 px-3 rounded-lg cursor-pointer ${
                      (job.status || 'active') === 'active'
                        ? 'bg-green-400/40 text-green-300 border-green-400/60'
                        : (job.status || 'active') === 'on-hold'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : (job.status || 'active') === 'filled'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="on-hold">On-Hold</option>
                    <option value="filled">Filled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="p-2 rounded-lg hover:bg-glass-200 transition-colors"
                      title="View Job"
                    >
                      <Eye size={18} className="text-gray-400" />
                    </Link>
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                      title="Delete Job"
                    >
                      <LucideTrash size={18} className="text-red-400" />
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

      {showCreateModal && (
        <CreateJobModal
          onClose={() => {
            setShowCreateModal(false)
            fetchJobs()
          }}
        />
      )}
    </div>
  )
}

export default Dashboard

