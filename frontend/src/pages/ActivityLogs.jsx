import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Briefcase, 
  UserPlus, 
  UserMinus, 
  FileText, 
  Trash2, 
  PlayCircle,
  Filter,
  RefreshCw
} from 'lucide-react'
import { getActivityLogs } from '../services/api'

const ActivityLogs = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const limit = 50

  useEffect(() => {
    fetchLogs()
  }, [filter, page])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = {
        limit,
        skip: page * limit
      }
      if (filter !== 'all') {
        params.activity_type = filter
      }
      const response = await getActivityLogs(params)
      console.log('Activity logs response:', response.data)
      setLogs(response.data || [])
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActivityIcon = (type) => {
    switch (type) {
      case 'job_created':
        return Briefcase
      case 'job_deleted':
        return Trash2
      case 'candidate_uploaded':
        return UserPlus
      case 'candidate_deleted':
        return UserMinus
      case 'candidate_analyzed':
        return FileText
      case 'analysis_run':
        return PlayCircle
      default:
        return FileText
    }
  }

  const getActivityColor = (type) => {
    switch (type) {
      case 'job_created':
        return 'text-green-400 bg-green-500/20 border-green-500/30'
      case 'job_deleted':
        return 'text-red-400 bg-red-500/20 border-red-500/30'
      case 'candidate_uploaded':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/30'
      case 'candidate_deleted':
        return 'text-red-400 bg-red-500/20 border-red-500/30'
      case 'candidate_analyzed':
        return 'text-purple-400 bg-purple-500/20 border-purple-500/30'
      case 'analysis_run':
        return 'text-orange-400 bg-orange-500/20 border-orange-500/30'
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }
  }

  const getActivityLabel = (type) => {
    switch (type) {
      case 'job_created':
        return 'Job Created'
      case 'job_deleted':
        return 'Job Deleted'
      case 'candidate_uploaded':
        return 'Resume Uploaded'
      case 'candidate_deleted':
        return 'Candidate Deleted'
      case 'candidate_analyzed':
        return 'Candidate Analyzed'
      case 'analysis_run':
        return 'Analysis Run'
      default:
        return type
    }
  }

  const filterOptions = [
    { value: 'all', label: 'All Activities' },
    { value: 'job_created', label: 'Job Created' },
    { value: 'job_deleted', label: 'Job Deleted' },
    { value: 'candidate_uploaded', label: 'Resume Uploaded' },
    { value: 'candidate_deleted', label: 'Candidate Deleted' },
    { value: 'candidate_analyzed', label: 'Candidate Analyzed' },
    { value: 'analysis_run', label: 'Analysis Run' }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Activity Logs</h2>
          <p className="text-sm text-gray-400">Track all system activities and changes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass-input flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value)
                setPage(0)
              }}
              className="bg-transparent border-0 outline-0 text-sm"
            >
              {filterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchLogs}
            className="glass-button flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading activity logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText size={48} className="mx-auto mb-4 text-gray-500" />
          <p className="text-gray-400 mb-2">No activity logs found</p>
          <p className="text-sm text-gray-500">
            Activity logs will appear here when you create jobs, upload resumes, delete candidates, or run analyses.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="divide-y divide-glass-200">
            {logs.map((log) => {
              const Icon = getActivityIcon(log.activity_type)
              const colorClass = getActivityColor(log.activity_type)
              
              return (
                <div
                  key={log.id}
                  className="p-6 hover:bg-glass-100 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg border ${colorClass} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <p className="font-medium mb-1">{log.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            {log.job_title && (
                              <Link
                                to={log.job_id ? `/jobs/${log.job_id}` : '#'}
                                className="hover:text-primary-400 flex items-center gap-1"
                              >
                                <Briefcase size={14} />
                                {log.job_title}
                              </Link>
                            )}
                            {log.candidate_name && (
                              <span className="flex items-center gap-1">
                                <UserPlus size={14} />
                                {log.candidate_name}
                              </span>
                            )}
                            <span className="px-2 py-1 rounded text-xs border border-glass-200">
                              {getActivityLabel(log.activity_type)}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-400 flex-shrink-0">
                          {formatDate(log.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {logs.length >= limit && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="glass-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={logs.length < limit}
            className="glass-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default ActivityLogs
