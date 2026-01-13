import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    
    return date.toLocaleString('en-US', { 
      timeZone: 'Asia/Dubai',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading activity logs...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Activity Logs</h3>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm"
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
        <div className="space-y-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-4 py-3 border-b border-glass-200 text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="text-white">{log.description}</p>
                {log.user_name && (
                  <p className="text-gray-400 text-xs mt-1">by {log.user_name}</p>
                )}
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {formatDate(log.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ActivityLogs
