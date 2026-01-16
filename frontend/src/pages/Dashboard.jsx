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
    department: '',
    minCandidates: '',
    maxCandidates: ''
  })
  const [lastRunSort, setLastRunSort] = useState('latest') // 'latest' or 'oldest'
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
  }, [searchQuery, filters, jobs, lastRunSort])

  const applyFilters = () => {
    let filtered = [...jobs]

    // Search filter (searches in title, department)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(job => 
        job.title?.toLowerCase().includes(query) ||
        job.department?.toLowerCase().includes(query) ||
        String(job.candidate_count || 0).includes(query)
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
      department: '',
      minCandidates: '',
      maxCandidates: ''
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
            <div className="glass-input flex items-center gap-2 w-80">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search Job Posts"
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
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                showFilters 
                  ? 'bg-glass-200 text-primary-400' 
                  : 'hover:bg-glass-200 text-gray-400'
              }`}
              title="Filters"
            >
              <Filter size={18} />
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-glass-200">
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

        {/* Table */}
        
        <div className="overflow-x-auto">
          <table className="w-full">
          <thead className="bg-glass-100 border-b border-glass-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold">Title</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Department</th>
              <th className="px-6 py-4 text-left text-sm font-semibold"># Candidates</th>
              <th 
                className="px-6 py-4 text-left text-sm font-semibold cursor-pointer hover:bg-glass-200 transition-colors select-none"
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

