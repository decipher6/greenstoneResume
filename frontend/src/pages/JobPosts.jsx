import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Eye, MoreVertical, Calendar, Users, Trash2, LucideTrash, Search, Filter, X } from 'lucide-react'
import { getJobs, deleteJob, updateJobStatus } from '../services/api'
import CreateJobModal from '../components/CreateJobModal'
import { useModal } from '../context/ModalContext'

const JobPosts = () => {
  const [jobs, setJobs] = useState([])
  const [filteredJobs, setFilteredJobs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    department: '',
    status: '',
    minCandidates: '',
    maxCandidates: ''
  })
  const navigate = useNavigate()
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
  }, [searchQuery, filters, jobs])

  const applyFilters = () => {
    let filtered = [...jobs]

    // Search filter (searches in title, department, status)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(job => 
        job.title?.toLowerCase().includes(query) ||
        job.department?.toLowerCase().includes(query) ||
        job.status?.toLowerCase().includes(query) ||
        String(job.candidate_count || 0).includes(query)
      )
    }

    // Department filter
    if (filters.department) {
      filtered = filtered.filter(job => 
        job.department?.toLowerCase() === filters.department.toLowerCase()
      )
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(job => 
        job.status?.toLowerCase() === filters.status.toLowerCase()
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

    setFilteredJobs(filtered)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilters({
      department: '',
      status: '',
      minCandidates: '',
      maxCandidates: ''
    })
  }

  const handleCloseJob = async (jobId) => {
    const confirmed = await showConfirm({
      title: 'Close Job Post',
      message: 'Are you sure you want to close this job post? You can reopen it later if needed.',
      type: 'info',
      confirmText: 'Close Job',
      cancelText: 'Cancel'
    })
    
    if (confirmed) {
      try {
        await updateJobStatus(jobId, 'closed')
        await showAlert('Success', 'Job post closed successfully.', 'success')
        fetchJobs()
      } catch (error) {
        console.error('Error closing job:', error)
        await showAlert('Error', 'Failed to close job post. Please try again.', 'error')
      }
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Get unique departments for filter
  const departments = [...new Set(jobs.map(job => job.department).filter(Boolean))].sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Job Posts</h2>
          <p className="text-sm text-gray-400">Manage your open positions and track candidates</p>
        </div>
        <button onClick={() => setShowModal(true)} className="glass-button flex items-center gap-2">
          <Plus size={20} />
          Add Job
        </button>
      </div>

      {/* Search and Filters */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="glass-input flex items-center gap-2 flex-1">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, department, status, or candidate count..."
              className="bg-transparent border-0 outline-0 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded hover:bg-glass-200 transition-colors"
              >
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`glass-button-secondary flex items-center gap-2 ${showFilters ? 'bg-glass-200' : ''}`}
          >
            <Filter size={18} />
            Filters
          </button>
          {(searchQuery || Object.values(filters).some(f => f)) && (
            <button
              onClick={clearFilters}
              className="glass-button-secondary flex items-center gap-2 text-sm"
            >
              <X size={16} />
              Clear
            </button>
          )}
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-glass-200">
            <div>
              <label className="block text-sm font-medium mb-2">Department</label>
              <select
                className="glass-input w-full"
                value={filters.department}
                onChange={(e) => setFilters({...filters, department: e.target.value})}
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                className="glass-input w-full"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Min Candidates</label>
              <input
                type="number"
                min="0"
                className="glass-input w-full"
                placeholder="0"
                value={filters.minCandidates}
                onChange={(e) => setFilters({...filters, minCandidates: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Max Candidates</label>
              <input
                type="number"
                min="0"
                className="glass-input w-full"
                placeholder="Any"
                value={filters.maxCandidates}
                onChange={(e) => setFilters({...filters, maxCandidates: e.target.value})}
              />
            </div>
          </div>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-glass-200 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing {filteredJobs.length} of {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <table className="w-full">
          <thead className="bg-glass-100 border-b border-glass-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold">Title</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Department</th>
              <th className="px-6 py-4 text-left text-sm font-semibold"># Candidates</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Last Run</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
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
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    job.status === 'active' 
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : job.status === 'closed'
                      ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  }`}>
                    {job.status}
                  </span>
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
                    {job.status !== 'closed' && (
                      <button
                        onClick={() => handleCloseJob(job.id)}
                        className="p-2 rounded-lg hover:bg-orange-500/20 transition-colors"
                        title="Close Job"
                      >
                        <X size={18} className="text-orange-400" />
                      </button>
                    )}
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

      {showModal && (
        <CreateJobModal
          onClose={() => {
            setShowModal(false)
            fetchJobs()
          }}
        />
      )}
    </div>
  )
}

export default JobPosts

