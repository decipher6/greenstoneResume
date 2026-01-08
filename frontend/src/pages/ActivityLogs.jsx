import { useEffect, useState } from 'react'
import { Clock, User, Briefcase, FileText, Mail, BarChart3, Settings } from 'lucide-react'
import { getActivityLogs } from '../services/api'

const ActivityLogs = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const response = await getActivityLogs()
      setLogs(response.data || [])
    } catch (error) {
      console.error('Error fetching activity logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionIcon = (action) => {
    if (action.includes('job')) return Briefcase
    if (action.includes('candidate') || action.includes('upload')) return FileText
    if (action.includes('email')) return Mail
    if (action.includes('analysis') || action.includes('analyze')) return BarChart3
    if (action.includes('settings')) return Settings
    return Clock
  }

  const getActionColor = (action) => {
    if (action.includes('created')) return 'text-green-400'
    if (action.includes('uploaded')) return 'text-blue-400'
    if (action.includes('analysis') || action.includes('analyze')) return 'text-purple-400'
    if (action.includes('email')) return 'text-yellow-400'
    if (action.includes('deleted')) return 'text-red-400'
    return 'text-gray-400'
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading activity logs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Activity Logs</h3>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors text-sm"
          >
            Refresh
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No activity logs found</p>
            <p className="text-sm mt-2">Activity will appear here as you use the system</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const Icon = getActionIcon(log.action)
              const colorClass = getActionColor(log.action)
              
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-glass-100 hover:bg-glass-200 transition-colors"
                >
                  <div className={`p-2 rounded-lg bg-glass-200 ${colorClass}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{log.description}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      <span className="capitalize">{log.action.replace('_', ' ')}</span>
                      {log.entity_type && (
                        <span className="px-2 py-0.5 rounded bg-glass-200 capitalize">
                          {log.entity_type}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityLogs
