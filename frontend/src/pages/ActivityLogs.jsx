import { useEffect, useState, useRef } from 'react'
import { 
  Clock, Filter, X, ChevronLeft, ChevronRight, ChevronDown, Search, User,
  Briefcase, UserPlus, Mail, FileText, Trash2, Upload, Download, CheckCircle,
  PlayCircle, Settings, LogIn, LogOut, FileCheck
} from 'lucide-react'
import { getActivityLogs, getActivityLogsCount, getActivityTypes, getActivityUsers } from '../services/api'

const ActivityLogs = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [activityTypes, setActivityTypes] = useState([])
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  
  // Filter states
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  
  // Refs for closing dropdowns on outside click
  const dateFilterRef = useRef(null)
  const typeFilterRef = useRef(null)
  const userSearchRef = useRef(null)
  
  const logsPerPage = 30

  useEffect(() => {
    fetchActivityTypes()
    fetchActivityUsers()
  }, [])

  useEffect(() => {
    fetchLogs()
    fetchCount()
  }, [currentPage, startDate, endDate, selectedType, selectedUserId])

  // Filter users based on search
  useEffect(() => {
    if (userSearch.trim() === '') {
      setFilteredUsers([])
    } else {
      const filtered = users.filter(user => 
        user.name.toLowerCase().includes(userSearch.toLowerCase())
      )
      setFilteredUsers(filtered)
    }
  }, [userSearch, users])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target)) {
        setShowDateFilter(false)
      }
      if (typeFilterRef.current && !typeFilterRef.current.contains(event.target)) {
        setShowTypeFilter(false)
      }
      if (userSearchRef.current && !userSearchRef.current.contains(event.target)) {
        // Don't close if clicking on the dropdown results
        if (!event.target.closest('.user-search-results')) {
          // Keep search open but clear results if clicking outside
        }
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
      return <Upload size={16} className="text-green-400" />
    }
    if (description.includes('completed') || description.includes('complete')) {
      return <CheckCircle size={16} className="text-green-400" />
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
        return <UserPlus size={16} className="text-green-400" />
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
      return 'bg-green-500/20'
    }
    if (description.includes('completed') || description.includes('complete')) {
      return 'bg-green-500/20'
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
        return 'bg-green-500/20'
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
    setUserSearch('')
    setSelectedUserId('')
    setCurrentPage(1)
  }

  const handleUserSelect = (userId, userName) => {
    setSelectedUserId(userId)
    setUserSearch(userName)
    setFilteredUsers([])
    setCurrentPage(1) // Reset to first page when filter changes
  }

  const clearUserFilter = (e) => {
    e.stopPropagation()
    setUserSearch('')
    setSelectedUserId('')
    setFilteredUsers([])
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
              <div className="absolute top-full left-0 mt-2 bg-gray-800 rounded-lg p-2 z-50 min-w-[200px] shadow-xl border border-glass-300 max-h-60 overflow-y-auto">
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value)
                    setShowTypeFilter(false)
                  }}
                  className="w-full px-3 py-2 bg-gray-700 rounded border border-glass-300 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Types</option>
                  {activityTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* User Search Filter */}
          <div className="relative" ref={userSearchRef}>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="User"
                value={userSearch}
                onChange={(e) => {
                  const value = e.target.value
                  setUserSearch(value)
                  // Clear selection if user is typing something different
                  if (selectedUserId) {
                    const selectedUser = users.find(u => u.id === selectedUserId)
                    if (!selectedUser || value !== selectedUser.name) {
                      setSelectedUserId('')
                    }
                  }
                }}
                className={`pl-10 pr-8 py-2 rounded-lg text-sm transition-colors ${
                  selectedUserId 
                    ? 'bg-primary-500 text-white placeholder-gray-300' 
                    : 'bg-glass-200 text-gray-300 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[150px]`}
              />
              {selectedUserId && (
                <button
                  onClick={clearUserFilter}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-300 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {filteredUsers.length > 0 && (
              <div className="absolute top-full left-0 mt-2 bg-gray-800 rounded-lg z-50 min-w-[200px] shadow-xl border border-glass-300 max-h-60 overflow-y-auto user-search-results">
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user.id, user.name)}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-xs">
                      {getUserInitials(user.name)}
                    </div>
                    {user.name}
                  </button>
                ))}
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
        </div>
      )}
    </div>
  )
}

export default ActivityLogs
