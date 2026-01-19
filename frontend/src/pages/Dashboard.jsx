import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Plus, Eye, Calendar, LucideTrash, Search, Filter, X, ArrowUpDown } from 'lucide-react'
import { getJobs, deleteJob, updateJobStatus } from '../services/api'
import CreateJobModal from '../components/CreateJobModal'
import { useModal } from '../context/ModalContext'

const Dashboard = () => {
  const [jobs, setJobs] = useState([])
  const [filteredJobs, setFilteredJobs] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    title: '',
    department: '',
    minCandidates: '',
    maxCandidates: '',
    status: ''
  })
  const [lastRunSort, setLastRunSort] = useState('latest') // 'latest' or 'oldest'
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
  }, [searchQuery, filters, jobs, lastRunSort])

  const applyFilters = () => {
    let filtered = [...jobs]

    // Title filter
    if (filters.title) {
      const query = filters.title.toLowerCase()
      filtered = filtered.filter(job => 
        job.title?.toLowerCase().includes(query)
      )
    }

    // Department filter
    if (filters.department) {
      filtered = filtered.filter(job => 
        job.department?.toLowerCase() === filters.department.toLowerCase()
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

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(job => 
        (job.status || 'active') === filters.status
      )
    }

    // Sort by last_run
    filtered.sort((a, b) => {
      const aDate = a.last_run ? new Date(a.last_run).getTime() : 0
      const bDate = b.last_run ? new Date(b.last_run).getTime() : 0
      
      if (lastRunSort === 'latest') {
        return bDate - aDate // Latest first (descending)
      } else {
        return aDate - bDate // Oldest first (ascending)
      }
    })

    setFilteredJobs(filtered)
  }

  const toggleLastRunSort = () => {
    setLastRunSort(prev => prev === 'latest' ? 'oldest' : 'latest')
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilters({
      title: '',
      department: '',
      minCandidates: '',
      maxCandidates: '',
      status: ''
    })
    setLastRunSort('latest')
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
              <Plus size={20} />
              Create New Job
            </button>
            <div className="flex-1"></div>
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
            {(Object.values(filters).some(f => f)) && (
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
              <th className="px-6 py-3 text-left text-sm font-semibold">
                <div className="space-y-2">
                  <div>Title</div>
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
                      className="glass-input w-full text-xs py-1.5 px-2"
                      value={filters.department}
                      onChange={(e) => setFilters({...filters, department: e.target.value})}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">All</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                <div className="space-y-2">
                  <div># Candidates</div>
                  {showFilters && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        placeholder="Min"
                        className="glass-input w-16 text-xs py-1.5 px-2"
                        value={filters.minCandidates}
                        onChange={(e) => setFilters({...filters, minCandidates: e.target.value})}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-gray-400 text-xs">-</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Max"
                        className="glass-input w-16 text-xs py-1.5 px-2"
                        value={filters.maxCandidates}
                        onChange={(e) => setFilters({...filters, maxCandidates: e.target.value})}
                        onClick={(e) => e.stopPropagation()}
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
                      className="glass-input w-full text-xs py-1.5 px-2"
                      value={filters.status}
                      onChange={(e) => setFilters({...filters, status: e.target.value})}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">All</option>
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
          }}
        />
      )}
    </div>
  )
}

export default Dashboard

