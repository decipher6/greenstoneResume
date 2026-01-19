import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Users, ArrowUpRight, Plus, Eye, Calendar, LucideTrash, Search, Filter, X, ArrowUpDown, PauseCircle, CheckCircle2 } from 'lucide-react'
import { getDashboardStats, getJobs, deleteJob, updateJobStatus } from '../services/api'
import CreateJobModal from '../components/CreateJobModal'
import { useModal } from '../context/ModalContext'

const Dashboard = () => {
  const [stats, setStats] = useState(null)
  const [jobs, setJobs] = useState([])
  const [filteredJobs, setFilteredJobs] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    title: '',
    department: [], // Changed to array for multi-select
    minCandidates: '',
    maxCandidates: '',
    status: [] // Changed to array for multi-select
  })
  const [titleSort, setTitleSort] = useState(null) // null, 'asc', 'desc'
  const [candidatesSort, setCandidatesSort] = useState(null) // null, 'asc', 'desc'
  const [lastRunSort, setLastRunSort] = useState('latest') // 'latest' or 'oldest'
  const [keywordSearch, setKeywordSearch] = useState('')
  const { showConfirm, showAlert } = useModal()

  useEffect(() => {
    fetchData()
    fetchJobs()
  }, [])

  const fetchData = async () => {
    try {
      const statsRes = await getDashboardStats()
      setStats(statsRes.data)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

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

    // Title filter
    if (filters.title) {
      const query = filters.title.toLowerCase()
      filtered = filtered.filter(job => 
        job.title?.toLowerCase().includes(query)
      )
    }

    // Department filter (multi-select)
    if (filters.department && filters.department.length > 0) {
      filtered = filtered.filter(job => 
        filters.department.includes(job.department)
      )
    }

    // Candidate count filters
    if (filters.minCandidates) {
      const min = parseInt(filters.minCandidates)
      filtered = filtered.filter(job => (job.candidate_count || 0) >= min)
    }

    if (filters.maxCandidates) {
      const max = parseInt(filters.maxCandidates)
      filtered = filtered.filter(job => (job.candidate_count || 0) <= max)
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
      title: '',
      department: [],
      minCandidates: '',
      maxCandidates: '',
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
        fetchData() // Refresh stats
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
      fetchData() // Refresh stats
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
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Briefcase}
          label="Active Jobs"
          value={stats?.active_jobs || 0}
          color="green"
        />
        <StatCard
          icon={Users}
          label="Total Candidates"
          value={stats?.total_candidates || 0}
          color="purple"
        />
        <StatCard
          icon={PauseCircle}
          label="Jobs On Hold"
          value={stats?.jobs_on_hold || 0}
          color="orange"
        />
        <StatCard
          icon={CheckCircle2}
          label="Jobs Filled"
          value={stats?.jobs_filled || 0}
          color="blue"
        />
      </div>

      {/* Combined Search, Filters, Add Job Button, and Table */}
      <div className="glass-card overflow-hidden">
        {/* Search and Filters with Add Job Button */}
        <div className="p-4 border-b border-glass-200">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="glass-button flex items-center gap-2 whitespace-nowrap"
            >
              <Plus size={20} />
              Create New Job
            </button>
            <div className="flex-1"></div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by keyword..."
                  className="glass-input pl-10 pr-4 py-2 w-64 text-sm"
                  value={keywordSearch}
                  onChange={(e) => setKeywordSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                  showFilters 
                    ? 'bg-glass-200 text-primary-400' 
                    : 'hover:bg-glass-200 text-gray-400'
                }`}
                title="Toggle Filters"
              >
                <Filter size={18} />
              </button>
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span>Title</span>
                    <ArrowUpDown size={14} className="text-gray-400" />
                    {titleSort === 'asc' && <span className="text-xs text-gray-400">(A-Z)</span>}
                    {titleSort === 'desc' && <span className="text-xs text-gray-400">(Z-A)</span>}
                  </div>
                  {showFilters && (
                    <input
                      type="text"
                      placeholder="Filter title..."
                      className="glass-input w-full text-xs py-1.5 px-2"
                      value={filters.title}
                      onChange={(e) => setFilters({...filters, title: e.target.value})}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                <div className="space-y-2">
                  <div>Department</div>
                  {showFilters && (
                    <select
                      multiple
                      className="glass-input w-full text-xs py-1.5 px-2"
                      value={filters.department}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value)
                        setFilters({...filters, department: selected})
                      }}
                      onClick={(e) => e.stopPropagation()}
                      size={Math.min(departments.length, 5)}
                    >
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-glass-200 transition-colors select-none"
                onClick={toggleCandidatesSort}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span># Candidates</span>
                    <ArrowUpDown size={14} className="text-gray-400" />
                    {candidatesSort === 'asc' && <span className="text-xs text-gray-400">(Low-High)</span>}
                    {candidatesSort === 'desc' && <span className="text-xs text-gray-400">(High-Low)</span>}
                  </div>
                  {showFilters && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min="0"
                        placeholder="Min"
                        className="glass-input w-16 text-xs py-1.5 px-2"
                        value={filters.minCandidates}
                        onChange={(e) => setFilters({...filters, minCandidates: e.target.value})}
                      />
                      <span className="text-gray-400 text-xs">-</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Max"
                        className="glass-input w-16 text-xs py-1.5 px-2"
                        value={filters.maxCandidates}
                        onChange={(e) => setFilters({...filters, maxCandidates: e.target.value})}
                      />
                    </div>
                  )}
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
              <th className="px-6 py-3 text-left text-sm font-semibold">
                <div className="space-y-2">
                  <div>Status</div>
                  {showFilters && (
                    <select
                      multiple
                      className="glass-input w-full text-xs py-1.5 px-2"
                      value={filters.status}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value)
                        setFilters({...filters, status: selected})
                      }}
                      onClick={(e) => e.stopPropagation()}
                      size={4}
                    >
                      <option value="active">Active</option>
                      <option value="on-hold">On-Hold</option>
                      <option value="filled">Filled</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
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
            fetchData()
          }}
        />
      )}
    </div>
  )
}

const StatCard = ({ icon: Icon, label, value, trend, trendUp, color }) => {
  const colorClasses = {
    green: 'from-green-400/40 to-green-500/40 border-green-400/60 text-green-300',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
    pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center flex-shrink-0`}>
            <Icon size={24} />
          </div>
          <div className="text-3xl font-bold">{value}</div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trendUp ? 'text-green-300' : 'text-red-400'}`}>
            <ArrowUpRight size={14} />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  )
}

export default Dashboard

