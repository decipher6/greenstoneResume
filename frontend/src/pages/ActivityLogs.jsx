import { useEffect, useState, useRef } from 'react'
import { 
  Clock, Filter, X, ChevronDown, User,
  Briefcase, UserPlus, Mail, FileText, Trash2, Upload, Download, CheckCircle,
  PlayCircle, Settings, LogIn, LogOut, FileCheck, Search
} from 'lucide-react'
import { getActivityLogs, getActivityLogsCount, getActivityTypes, getActivityUsers } from '../services/api'

const ActivityLogs = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [activityTypes, setActivityTypes] = useState([])
  const [users, setUsers] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [skip, setSkip] = useState(0)
  
  // Filter states
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showUserFilter, setShowUserFilter] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Refs
  const dateFilterRef = useRef(null)
  const typeFilterRef = useRef(null)
  const userFilterRef = useRef(null)
  const observerTarget = useRef(null)
  
  const logsPerPage = 30

  useEffect(() => {
    fetchActivityTypes()
    fetchActivityUsers()
  }, [])

  // Initial fetch and filter changes
  useEffect(() => {
    setSkip(0)
    setLogs([])
    setHasMore(true)
    fetchLogs(0, true)
  }, [startDate, endDate, selectedType, selectedUserId, searchQuery])

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          const nextSkip = skip + logsPerPage
          setSkip(nextSkip)
          fetchLogs(nextSkip, false)
        }
      },
      { threshold: 1.0 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current)
      }
    }
  }, [hasMore, loading, loadingMore, skip])

  const fetchLogs = async (currentSkip, isInitial = false) => {
    try {
      if (isInitial) {
        setInitialLoading(true)
      } else {
        setLoadingMore(true)
      }
      
      const params = {
        limit: logsPerPage,
        skip: currentSkip,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedType && { activity_type: selectedType }),
        ...(selectedUserId && { user_id: selectedUserId }),
        ...(searchQuery && { search: searchQuery })
      }
      
      const response = await getActivityLogs(params)
      const newLogs = response.data || []
      
      if (isInitial) {
        setLogs(newLogs)
      } else {
        setLogs(prev => [...prev, ...newLogs])
      }
      
      setHasMore(newLogs.length === logsPerPage)
    } catch (error) {
      console.error('Error fetching activity logs:', error)
    } finally {
      setInitialLoading(false)
      setLoadingMore(false)
    }
  }

  // We don't need a separate fetchCount for infinite scroll but we'll keep it for info
  useEffect(() => {
    fetchCount()
  }, [startDate, endDate, selectedType, selectedUserId, searchQuery])

  const fetchCount = async () => {
    try {
      const params = {
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedType && { activity_type: selectedType }),
        ...(selectedUserId && { user_id: selectedUserId }),
        ...(searchQuery && { search: searchQuery })
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
    const day = date.getDate()
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const year = date.getFullYear()
    return `${day} ${month} ${year}`
  }

  const getTimelineIcon = (log) => {
    const description = log.description?.toLowerCase() || ''
    const entityType = log.entity_type?.toLowerCase() || ''
    
    // Check description for specific actions
    if (description.includes('logged in') || description.includes('login')) {
      return <LogIn size={16} className="text-blue-400" />
    }
    if (description.includes('deleted') || description.includes('delete')) {
      return <Trash2 size={16} className="text-red-400" />
    }
    if (description.includes('uploaded') || description.includes('upload')) {
      return <Upload size={16} className="text-green-300" />
    }
    if (description.includes('completed') || description.includes('complete')) {
      return <CheckCircle size={16} className="text-green-300" />
    }
    if (description.includes('started') || description.includes('start')) {
      return <PlayCircle size={16} className="text-blue-400" />
    }
    if (description.includes('email') || description.includes('sent')) {
      return <Mail size={16} className="text-purple-400" />
    }
    
    // Fallback to entity type
    switch (entityType) {
      case 'job':
        return <Briefcase size={16} className="text-blue-400" />
      case 'candidate':
        return <UserPlus size={16} className="text-green-300" />
      case 'email':
        return <Mail size={16} className="text-purple-400" />
      case 'assessment':
        return <FileCheck size={16} className="text-orange-400" />
      default:
        return <FileText size={16} className="text-gray-400" />
    }
  }

  const getTimelineIconBg = (log) => {
    const description = log.description?.toLowerCase() || ''
    const entityType = log.entity_type?.toLowerCase() || ''
    
    if (description.includes('logged in') || description.includes('login')) {
      return 'bg-blue-500/20'
    }
    if (description.includes('deleted') || description.includes('delete')) {
      return 'bg-red-500/20'
    }
    if (description.includes('uploaded') || description.includes('upload')) {
      return 'bg-green-400/40'
    }
    if (description.includes('completed') || description.includes('complete')) {
      return 'bg-green-400/40'
    }
    if (description.includes('started') || description.includes('start')) {
      return 'bg-blue-500/20'
    }
    if (description.includes('email') || description.includes('sent')) {
      return 'bg-purple-500/20'
    }
    
    switch (entityType) {
      case 'job':
        return 'bg-blue-500/20'
      case 'candidate':
        return 'bg-green-400/40'
      case 'email':
        return 'bg-purple-500/20'
      case 'assessment':
        return 'bg-orange-500/20'
      default:
        return 'bg-gray-500/20'
    }
  }

  const getUserInitials = (name) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getActivityTypeLabel = (type) => {
    const typeMap = {
      'job': 'Job Management',
      'candidate': 'Candidate Actions',
      'email': 'Email Activities',
      'assessment': 'Assessment Uploads',
      'user': 'User Activities',
      'analysis': 'AI Analysis',
      'login': 'User Login',
      'logout': 'User Logout'
    }
    return typeMap[type?.toLowerCase()] || type || 'All Types'
  }

  const groupLogsByDate = (logs) => {
    const grouped = {}
    logs.forEach(log => {
      if (!log.created_at) return
      const date = new Date(log.created_at)
      const day = date.getDate()
      const month = date.toLocaleDateString('en-US', { month: 'short' })
      const year = date.getFullYear()
      const dateKey = `${day} ${month} ${year}`
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
    setSearchQuery('')
    setSkip(0)
  }

  const hasActiveFilters = startDate || endDate || selectedType || selectedUserId || searchQuery

  if (initialLoading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <p className="text-gray-400">Loading activity logs...</p>
        </div>
      </div>
    )
  }

  const groupedLogs = groupLogsByDate(logs)

  return (
    <div className="space-y-6">

      {/* Filter Section */}
      <div className="bg-glass-100 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Filter by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-glass-200 border border-glass-300 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
          </div>

          <span className="text-sm text-gray-300 font-medium ml-2">Filters:</span>
          
          {/* Date Range Filter */}
          <div className="relative" ref={dateFilterRef}>
            <button
              onClick={() => {
                setShowDateFilter(!showDateFilter)
                setShowTypeFilter(false)
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
              {selectedType ? getActivityTypeLabel(selectedType) : 'Activity Type'}
              <ChevronDown size={14} className={`transition-transform ${showTypeFilter ? 'rotate-180' : ''}`} />
            </button>
            {showTypeFilter && (
              <div className="absolute top-full left-0 mt-2 bg-gray-800 rounded-lg p-2 z-50 min-w-[240px] shadow-xl border border-glass-300 max-h-60 overflow-y-auto">
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value)
                    setShowTypeFilter(false)
                  }}
                  className="w-full px-3 py-2 bg-gray-700 rounded border border-glass-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Activity Types</option>
                  {activityTypes.map(type => (
                    <option key={type} value={type}>{getActivityTypeLabel(type)}</option>
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
              {selectedUserId ? users.find(u => u.id === selectedUserId)?.name || 'User' : 'User'}
              <ChevronDown size={14} className={`transition-transform ${showUserFilter ? 'rotate-180' : ''}`} />
            </button>
            {showUserFilter && (
              <div className="absolute top-full left-0 mt-2 bg-gray-800 rounded-lg p-2 z-50 min-w-[240px] shadow-xl border border-glass-300 max-h-60 overflow-y-auto">
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value)
                    setShowUserFilter(false)
                  }}
                  className="w-full px-3 py-2 bg-gray-700 rounded border border-glass-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Users</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name || user.email || 'Unknown User'}</option>
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
          {Object.entries(groupedLogs).map(([dateKey, dateLogs], dateIndex) => (
            <div key={dateKey} className="relative">
              {/* Date Header */}
              <h4 className="text-sm font-semibold text-gray-300 mb-3 pb-1 border-b border-gray-700">
                {dateKey}
              </h4>
              
              {/* Log entries as cards */}
              <div className="space-y-2">
                {dateLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4">
                    {/* Timestamp on the left */}
                    <div className="w-24 text-right pr-2 flex-shrink-0">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTime(log.created_at)}
                      </span>
                    </div>
                    
                    {/* Card content */}
                    <div className="flex-1">
                      <div className="bg-white/5 border border-gray-700 rounded-lg p-3 hover:bg-white/10 transition-colors">
                        {/* User info and description in one row */}
                        <div className="flex items-center gap-3">
                          {log.user_name ? (
                            <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                              {getUserInitials(log.user_name)}
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                              <User size={14} className="text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {log.user_name && (
                                <span className="text-xs font-medium text-gray-300">{log.user_name}</span>
                              )}
                              {!log.user_name && (
                                <span className="text-xs text-gray-400">System</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-200 leading-snug">{log.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Infinite Scroll Load More / Sentinel */}
          <div ref={observerTarget} className="py-8 flex justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-primary-400">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
                <span className="text-sm">Loading more logs...</span>
              </div>
            )}
            {!hasMore && logs.length > 0 && (
              <p className="text-sm text-gray-500">No more logs to load</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityLogs
