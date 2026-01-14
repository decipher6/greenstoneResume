import { useEffect, useState } from 'react'
import { Clock, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { getActivityLogs, getActivityLogsCount, getActivityTypes, getActivityUsers } from '../services/api'

const ActivityLogs = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [activityTypes, setActivityTypes] = useState([])
  const [users, setUsers] = useState([])
  
  // Filter states
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showUserFilter, setShowUserFilter] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  
  const logsPerPage = 30

  useEffect(() => {
    fetchActivityTypes()
    fetchActivityUsers()
  }, [])

  useEffect(() => {
    fetchLogs()
    fetchCount()
  }, [currentPage, startDate, endDate, selectedType, selectedUserId])

  const fetchActivityTypes = async () => {
    try {
      const response = await getActivityTypes()
      setActivityTypes(response.data?.types || [])
    } catch (error) {
      console.error('Error fetching activity types:', error)
    }
  }

  const fetchActivityUsers = async () => {
    try {
      const response = await getActivityUsers()
      setUsers(response.data?.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const skip = (currentPage - 1) * logsPerPage
      const params = {
        limit: logsPerPage,
        skip,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedType && { activity_type: selectedType }),
        ...(selectedUserId && { user_id: selectedUserId })
      }
      const response = await getActivityLogs(params)
      setLogs(response.data || [])
    } catch (error) {
      console.error('Error fetching activity logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCount = async () => {
    try {
      const params = {
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedType && { activity_type: selectedType }),
        ...(selectedUserId && { user_id: selectedUserId })
      }
      const response = await getActivityLogsCount(params)
      setTotalCount(response.data?.count || 0)
    } catch (error) {
      console.error('Error fetching count:', error)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDateOnly = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getActivityIcon = (entityType) => {
    switch (entityType?.toLowerCase()) {
      case 'job':
        return '📋'
      case 'candidate':
        return '👤'
      case 'email':
        return '📧'
      case 'assessment':
        return '📊'
      default:
        return '📝'
    }
  }

  const groupLogsByDate = (logs) => {
    const grouped = {}
    logs.forEach(log => {
      if (!log.created_at) return
      const date = new Date(log.created_at)
      const dateKey = date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(log)
    })
    return grouped
  }

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedType('')
    setSelectedUserId('')
    setCurrentPage(1)
  }

  const hasActiveFilters = startDate || endDate || selectedType || selectedUserId

  const totalPages = Math.ceil(totalCount / logsPerPage)

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading activity logs...</p>
      </div>
    )
  }

  const groupedLogs = groupLogsByDate(logs)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Activity Logs</h3>
      </div>

      {/* Filter Section */}
      <div className="bg-glass-100 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-300 font-medium">Filter by:</span>
          
          {/* Date Range Filter */}
          <div className="relative">
            <button
              onClick={() => {
                setShowDateFilter(!showDateFilter)
                setShowTypeFilter(false)
                setShowUserFilter(false)
              }}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
                (startDate || endDate) 
                  ? 'bg-primary-500 hover:bg-primary-600' 
                  : 'bg-glass-200 hover:bg-glass-300'
              }`}
            >
              <Filter size={16} />
              Date Range
              {(startDate || endDate) && (
                <X 
                  size={14} 
                  className="ml-1" 
                  onClick={(e) => {
                    e.stopPropagation()
                    setStartDate('')
                    setEndDate('')
                  }}
                />
              )}
            </button>
            {showDateFilter && (
              <div className="absolute top-full left-0 mt-2 bg-glass-200 rounded-lg p-4 z-10 min-w-[300px] shadow-lg">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-glass-100 rounded border border-glass-300 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-glass-100 rounded border border-glass-300 text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Activity Type Filter */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTypeFilter(!showTypeFilter)
                setShowDateFilter(false)
                setShowUserFilter(false)
              }}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
                selectedType 
                  ? 'bg-primary-500 hover:bg-primary-600' 
                  : 'bg-glass-200 hover:bg-glass-300'
              }`}
            >
              <Filter size={16} />
              Activity Type
              {selectedType && (
                <X 
                  size={14} 
                  className="ml-1" 
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedType('')
                  }}
                />
              )}
            </button>
            {showTypeFilter && (
              <div className="absolute top-full left-0 mt-2 bg-glass-200 rounded-lg p-3 z-10 min-w-[200px] shadow-lg max-h-60 overflow-y-auto">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 bg-glass-100 rounded border border-glass-300 text-white"
                >
                  <option value="">All Types</option>
                  {activityTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* User Filter */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserFilter(!showUserFilter)
                setShowDateFilter(false)
                setShowTypeFilter(false)
              }}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
                selectedUserId 
                  ? 'bg-primary-500 hover:bg-primary-600' 
                  : 'bg-glass-200 hover:bg-glass-300'
              }`}
            >
              <Filter size={16} />
              Who Made Changes
              {selectedUserId && (
                <X 
                  size={14} 
                  className="ml-1" 
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedUserId('')
                  }}
                />
              )}
            </button>
            {showUserFilter && (
              <div className="absolute top-full left-0 mt-2 bg-glass-200 rounded-lg p-3 z-10 min-w-[200px] shadow-lg max-h-60 overflow-y-auto">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-glass-100 rounded border border-glass-300 text-white"
                >
                  <option value="">All Users</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div>
            Showing {((currentPage - 1) * logsPerPage) + 1} to {Math.min(currentPage * logsPerPage, totalCount)} of {totalCount} logs
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-glass-200 hover:bg-glass-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              Newer
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded ${
                      currentPage === pageNum
                        ? 'bg-primary-500 text-white'
                        : 'bg-glass-200 hover:bg-glass-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="px-2">...</span>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="px-3 py-1 rounded bg-glass-200 hover:bg-glass-300"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-glass-200 hover:bg-glass-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Older
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Logs Display */}
      {logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p>No activity logs found</p>
          <p className="text-sm mt-2">
            {hasActiveFilters 
              ? 'Try adjusting your filters' 
              : 'Activity will appear here as you use the system'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedLogs).map(([dateKey, dateLogs]) => (
            <div key={dateKey}>
              <h4 className="text-sm font-semibold text-gray-400 mb-3 pb-2 border-b border-glass-200">
                {dateKey}
              </h4>
              <div className="space-y-1">
                {dateLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 py-3 border-b border-glass-200 text-sm hover:bg-glass-100/50 rounded px-2"
                  >
                    <div className="text-lg mt-0.5">
                      {getActivityIcon(log.entity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white">{log.description}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{formatDate(log.created_at)}</span>
                        {log.user_name && (
                          <>
                            <span>•</span>
                            <span>{log.user_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ActivityLogs
