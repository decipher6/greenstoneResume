import { useEffect, useState, useRef } from 'react'
import { Clock, Filter, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
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
  
  // Refs for closing dropdowns on outside click
  const dateFilterRef = useRef(null)
  const typeFilterRef = useRef(null)
  const userFilterRef = useRef(null)
  
  const logsPerPage = 30

  useEffect(() => {
    fetchActivityTypes()
    fetchActivityUsers()
  }, [])

  useEffect(() => {
    fetchLogs()
    fetchCount()
  }, [currentPage, startDate, endDate, selectedType, selectedUserId])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target)) {
        setShowDateFilter(false)
      }
      if (typeFilterRef.current && !typeFilterRef.current.contains(event.target)) {
        setShowTypeFilter(false)
      }
      if (userFilterRef.current && !userFilterRef.current.contains(event.target)) {
        setShowUserFilter(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

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

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
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

  const getActivityColor = (entityType) => {
    switch (entityType?.toLowerCase()) {
      case 'job':
        return 'bg-blue-500'
      case 'candidate':
        return 'bg-green-500'
      case 'email':
        return 'bg-purple-500'
      case 'assessment':
        return 'bg-orange-500'
      default:
        return 'bg-gray-500'
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
        <h3 className="text-xl font-bold">Activity</h3>
      </div>

      {/* Filter Section */}
      <div className="bg-glass-100 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-300 font-medium">Filter by:</span>
          
          {/* Date Range Filter */}
          <div className="relative" ref={dateFilterRef}>
            <button
              onClick={() => {
                setShowDateFilter(!showDateFilter)
                setShowTypeFilter(false)
                setShowUserFilter(false)
              }}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                (startDate || endDate) 
                  ? 'bg-primary-500 hover:bg-primary-600 text-white' 
                  : 'bg-glass-200 hover:bg-glass-300 text-gray-300'
              }`}
            >
              Date Range
              <ChevronDown size={14} className={`transition-transform ${showDateFilter ? 'rotate-180' : ''}`} />
            </button>
            {showDateFilter && (
              <div className="absolute top-full left-0 mt-2 bg-gray-800 rounded-lg p-4 z-50 min-w-[320px] shadow-xl border border-glass-300">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-300">Date Range</span>
                    {(startDate || endDate) && (
                      <button
                        onClick={() => {
                          setStartDate('')
                          setEndDate('')
                        }}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 rounded border border-glass-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 rounded border border-glass-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Activity Type Filter */}
          <div className="relative" ref={typeFilterRef}>
            <button
              onClick={() => {
                setShowTypeFilter(!showTypeFilter)
                setShowDateFilter(false)
                setShowUserFilter(false)
              }}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                selectedType 
                  ? 'bg-primary-500 hover:bg-primary-600 text-white' 
                  : 'bg-glass-200 hover:bg-glass-300 text-gray-300'
              }`}
            >
              Activity Type
              <ChevronDown size={14} className={`transition-transform ${showTypeFilter ? 'rotate-180' : ''}`} />
            </button>
            {showTypeFilter && (
              <div className="absolute top-full left-0 mt-2 bg-glass-200 rounded-lg p-2 z-50 min-w-[200px] shadow-xl border border-glass-300 max-h-60 overflow-y-auto">
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value)
                    setShowTypeFilter(false)
                  }}
                  className="w-full px-3 py-2 bg-glass-100 rounded border border-glass-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <div className="relative" ref={userFilterRef}>
            <button
              onClick={() => {
                setShowUserFilter(!showUserFilter)
                setShowDateFilter(false)
                setShowTypeFilter(false)
              }}
              className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                selectedUserId 
                  ? 'bg-primary-500 hover:bg-primary-600 text-white' 
                  : 'bg-glass-200 hover:bg-glass-300 text-gray-300'
              }`}
            >
              Who Made the Changes
              <ChevronDown size={14} className={`transition-transform ${showUserFilter ? 'rotate-180' : ''}`} />
            </button>
            {showUserFilter && (
              <div className="absolute top-full left-0 mt-2 bg-glass-200 rounded-lg p-2 z-50 min-w-[220px] shadow-xl border border-glass-300 max-h-60 overflow-y-auto">
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value)
                    setShowUserFilter(false)
                  }}
                  className="w-full px-3 py-2 bg-glass-100 rounded border border-glass-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm text-white transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
          <div>
            Showing {((currentPage - 1) * logsPerPage) + 1} to {Math.min(currentPage * logsPerPage, totalCount)} of {totalCount} logs
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-glass-200 hover:bg-glass-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
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
                    className={`px-3 py-1 rounded transition-colors ${
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
                    className="px-3 py-1 rounded bg-glass-200 hover:bg-glass-300 transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-glass-200 hover:bg-glass-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              Older
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Logs Display with Timeline */}
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
        <div className="space-y-8">
          {Object.entries(groupedLogs).map(([dateKey, dateLogs], dateIndex) => (
            <div key={dateKey} className="relative">
              {/* Date Header */}
              <h4 className="text-sm font-semibold text-gray-400 mb-4 pb-2 border-b border-glass-200">
                {dateKey}
              </h4>
              
              {/* Timeline */}
              <div className="relative pl-8">
                {/* Vertical line for the timeline */}
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-glass-300"></div>
                
                {/* Log entries */}
                <div className="space-y-0">
                  {dateLogs.map((log, logIndex) => {
                    const isLast = logIndex === dateLogs.length - 1 && dateIndex === Object.keys(groupedLogs).length - 1
                    return (
                      <div key={log.id} className="relative flex items-start gap-4 pb-6">
                        {/* Timeline circle */}
                        <div className="absolute left-0 flex items-center justify-center">
                          <div className={`relative z-10 w-6 h-6 rounded-full ${getActivityColor(log.entity_type)} flex items-center justify-center`}>
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                          {/* Connecting line (except for last item) */}
                          {!isLast && (
                            <div className="absolute left-3 top-6 w-0.5 h-full bg-glass-300"></div>
                          )}
                        </div>
                        
                        {/* Log content */}
                        <div className="flex-1 min-w-0 ml-8">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{getActivityIcon(log.entity_type)}</span>
                                <p className="text-white text-sm">{log.description}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                <span className="font-medium">{formatTime(log.created_at)}</span>
                                {log.user_name && (
                                  <>
                                    <span>•</span>
                                    <span>{log.user_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ActivityLogs
