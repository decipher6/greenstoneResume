import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Eye, Calendar, LucideTrash, Search, X, ArrowUpDown, Users, Filter } from 'lucide-react'
import { getJobs, deleteJob, updateJobStatus } from '../services/api'
import CreateJobModal from '../components/CreateJobModal'
import { useModal } from '../context/ModalContext'
import { useStats } from '../context/StatsContext'

const Dashboard = () => {
  const [searchParams] = useSearchParams()
  const [jobs, setJobs] = useState([])
  const [filteredJobs, setFilteredJobs] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    department: [], // Changed to array for multi-select
    status: [], // Changed to array for multi-select
    regions: [] // Multi-select for regions
  })
  const [titleSort, setTitleSort] = useState(null) // null, 'asc', 'desc'
  const [candidatesSort, setCandidatesSort] = useState(null) // null, 'asc', 'desc'
  const [createdSort, setCreatedSort] = useState('latest') // 'latest' or 'oldest'
  const [keywordSearch, setKeywordSearch] = useState('')
  const [openDropdown, setOpenDropdown] = useState(null) // 'department', 'status', 'regions' or null
  const { showConfirm, showAlert } = useModal()
  const { refreshStats } = useStats()

  useEffect(() => {
    fetchJobs()
    // Check for status filter in URL
    const statusParam = searchParams.get('status')
    if (statusParam) {
      setFilters(prev => ({
        ...prev,
        status: [statusParam]
      }))
    }
  }, [searchParams])

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
  }, [searchQuery, filters, jobs, createdSort, titleSort, candidatesSort, keywordSearch])

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

    // Regions filter (multi-select) - check if job has any of the selected regions
    if (filters.regions && filters.regions.length > 0) {
      filtered = filtered.filter(job => {
        const jobRegions = job.regions || []
        // Check if any of the selected regions match any of the job's regions
        return filters.regions.some(selectedRegion => 
          jobRegions.includes(selectedRegion)
        )
      })
    }

    // Group by status: active, on-hold, filled, cancelled
    // Define status order
    const statusOrder = ['active', 'on-hold', 'filled', 'cancelled']
    
    // Sort by title within status groups
    if (titleSort) {
      filtered.sort((a, b) => {
        const aStatus = a.status || 'active'
        const bStatus = b.status || 'active'
        const aStatusIndex = statusOrder.indexOf(aStatus)
        const bStatusIndex = statusOrder.indexOf(bStatus)
        
        // First sort by status
        if (aStatusIndex !== bStatusIndex) {
          return aStatusIndex - bStatusIndex
        }
        
        // Then sort by title within same status
        const aTitle = (a.title || '').toLowerCase()
        const bTitle = (b.title || '').toLowerCase()
        if (titleSort === 'asc') {
          return aTitle.localeCompare(bTitle)
        } else {
          return bTitle.localeCompare(aTitle)
        }
      })
    }
    // Sort by candidates within status groups
    else if (candidatesSort) {
      filtered.sort((a, b) => {
        const aStatus = a.status || 'active'
        const bStatus = b.status || 'active'
        const aStatusIndex = statusOrder.indexOf(aStatus)
        const bStatusIndex = statusOrder.indexOf(bStatus)
        
        // First sort by status
        if (aStatusIndex !== bStatusIndex) {
          return aStatusIndex - bStatusIndex
        }
        
        // Then sort by candidates within same status
        const aCount = a.candidate_count || 0
        const bCount = b.candidate_count || 0
        if (candidatesSort === 'asc') {
          return aCount - bCount
        } else {
          return bCount - aCount
        }
      })
    }
    // Sort by created_at within status groups (if no other sorts applied)
    else {
      filtered.sort((a, b) => {
        const aStatus = a.status || 'active'
        const bStatus = b.status || 'active'
        const aStatusIndex = statusOrder.indexOf(aStatus)
        const bStatusIndex = statusOrder.indexOf(bStatus)
        
        // First sort by status
        if (aStatusIndex !== bStatusIndex) {
          return aStatusIndex - bStatusIndex
        }
        
        // Then sort by created_at within same status
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
        
        if (createdSort === 'latest') {
          return bDate - aDate // Latest first (descending)
        } else {
          return aDate - bDate // Oldest first (ascending)
        }
      })
    }

    setFilteredJobs(filtered)
  }

  const toggleCreatedSort = () => {
    setCreatedSort(prev => prev === 'latest' ? 'oldest' : 'latest')
  }

  const clearFilters = () => {
    setSearchQuery('')
    setKeywordSearch('')
    setFilters({
      department: [],
      status: [],
      regions: []
    })
    setTitleSort(null)
    setCandidatesSort(null)
    setCreatedSort('latest')
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

  const toggleRegionFilter = (region) => {
    setFilters(prev => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter(r => r !== region)
        : [...prev.regions, region]
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
        refreshStats() // Refresh stats after deletion
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
      refreshStats() // Refresh stats after status change
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

  // Hardcoded list of departments for filter
  const departments = [
    'Investor Relations',
    'Partner Relations',
    'Investor Development',
    'IR Research',
    'Legal',
    'Compliance',
    'Technology',
    'Finance',
    'HR and Operations'
  ]

  // Get all unique regions from all jobs (including custom "Other" locations)
  const allRegions = new Set()
  jobs.forEach(job => {
    if (job.regions && Array.isArray(job.regions)) {
      job.regions.forEach(region => {
        if (region) {
          allRegions.add(region)
        }
      })
    }
  })
  
  // Sort regions: GCC first, then alphabetically, then "All" and "Other" at the end
  const regions = Array.from(allRegions).sort((a, b) => {
    // GCC always first
    if (a === 'GCC') return -1
    if (b === 'GCC') return 1
    
    // "All" and "Other" at the end
    if (a === 'All') return 1
    if (b === 'All') return -1
    if (a === 'Other') return 1
    if (b === 'Other') return -1
    
    // Everything else alphabetically
    return a.localeCompare(b)
  })

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
            {(Object.values(filters).some(f => Array.isArray(f) ? f.length > 0 : f) || keywordSearch || titleSort || candidatesSort || createdSort !== 'latest') && (
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
          <thead className="bg-glass-200/80 border-b-2 border-glass-300 sticky top-0 z-10">
            <tr>
              <th 
                className="px-6 py-5 text-left text-lg font-extrabold text-white cursor-pointer hover:bg-glass-300 transition-colors select-none"
                onClick={toggleTitleSort}
              >
                <div className="flex items-center gap-2">
                  <span>Title</span>
                  <ArrowUpDown size={14} className="text-gray-300" />
                  {titleSort === 'asc' && <span className="text-xs text-gray-300">(A-Z)</span>}
                  {titleSort === 'desc' && <span className="text-xs text-gray-300">(Z-A)</span>}
                </div>
              </th>
              <th className="px-6 py-5 text-left text-lg font-extrabold text-white relative">
                <div className="space-y-2 filter-dropdown-container">
                  <div 
                    className="cursor-pointer hover:bg-glass-300 transition-colors px-2 py-1 rounded flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenDropdown(openDropdown === 'department' ? null : 'department')
                    }}
                  >
                    <span>Department</span>
                    <Filter size={14} className="text-gray-300" />
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
                className="px-6 py-5 text-left text-lg font-extrabold text-white cursor-pointer hover:bg-glass-300 transition-colors select-none"
                onClick={toggleCandidatesSort}
              >
                <div className="flex items-center gap-2">
                  <span># Candidates</span>
                  <ArrowUpDown size={14} className="text-gray-300" />
                  {candidatesSort === 'asc' && <span className="text-xs text-gray-300">(Low-High)</span>}
                  {candidatesSort === 'desc' && <span className="text-xs text-gray-300">(High-Low)</span>}
                </div>
              </th>
              <th className="px-6 py-5 text-left text-lg font-extrabold text-white relative">
                <div className="space-y-2 filter-dropdown-container">
                  <div 
                    className="cursor-pointer hover:bg-glass-300 transition-colors px-2 py-1 rounded flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenDropdown(openDropdown === 'regions' ? null : 'regions')
                    }}
                  >
                    <span>Regions</span>
                    <Filter size={14} className="text-gray-300" />
                    {filters.regions.length > 0 && (
                      <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                        {filters.regions.length}
                      </span>
                    )}
                  </div>
                  {openDropdown === 'regions' && (
                    <div className="absolute top-full left-0 mt-1 z-50 glass-card p-3 min-w-[200px] max-h-64 overflow-y-auto shadow-lg">
                      <div className="space-y-2">
                        {regions.map(region => (
                          <label key={region} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-glass-100 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={filters.regions.includes(region)}
                              onChange={() => toggleRegionFilter(region)}
                              className="rounded"
                            />
                            <span>{region}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-5 text-left text-lg font-extrabold text-white cursor-pointer hover:bg-glass-300 transition-colors select-none"
                onClick={toggleCreatedSort}
              >
                <div className="flex items-center gap-2">
                  <span>Created On</span>
                  <ArrowUpDown size={14} className="text-gray-300" />
                  {createdSort === 'latest' && (
                    <span className="text-xs text-gray-300">(Latest first)</span>
                  )}
                  {createdSort === 'oldest' && (
                    <span className="text-xs text-gray-300">(Oldest first)</span>
                  )}
                </div>
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
                    <Filter size={14} className="text-gray-300" />
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
              <th className="px-6 py-5 text-left text-lg font-extrabold text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No jobs found matching your search criteria.
                </td>
              </tr>
            ) : (
              filteredJobs.map((job, index) => (
              <tr key={job.id} className={`border-b border-glass-200 hover:bg-glass-100 transition-colors ${index % 2 === 0 ? 'bg-glass-100/50' : 'bg-transparent'}`}>
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
                  {job.regions && job.regions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {job.regions.slice(0, 3).map((region, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-glass-200 rounded text-xs">
                          {region}
                        </span>
                      ))}
                      {job.regions.length > 3 && (
                        <span className="px-2 py-0.5 bg-glass-200 rounded text-xs">
                          +{job.regions.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-400">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    {formatDate(job.created_at)}
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
            refreshStats() // Refresh stats after job creation
          }}
        />
      )}
    </div>
  )
}

export default Dashboard

