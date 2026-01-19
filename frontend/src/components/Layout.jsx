import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, User, LogOut, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import StatsCards from './StatsCards'

const Layout = ({ children, pageTitle, pageSubtitle }) => {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [isExpanded, setIsExpanded] = useState(false)

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/activity-logs', icon: Clock, label: 'Activity Logs' },
  ]

  const getPageInfo = () => {
    if (pageTitle) return { title: pageTitle, subtitle: pageSubtitle || '' }
    
    if (location.pathname === '/') return { title: 'Dashboard', subtitle: 'Overview of your talent pipeline' }
    if (location.pathname.startsWith('/jobs/')) {
      return { title: 'Job Detail', subtitle: 'View and manage job post details' }
    }
    if (location.pathname === '/activity-logs') return { title: 'Activity Logs', subtitle: 'View system activity and events' }
    if (location.pathname.startsWith('/candidates/')) return { title: 'Candidate Profile', subtitle: 'Detailed candidate evaluation' }
    return { title: 'Greenstone Talent AI', subtitle: '' }
  }

  const { title, subtitle } = getPageInfo()

  return (
    <div className="flex min-h-screen h-full overflow-hidden">
      {/* Sidebar */}
      <div 
        className={`glass-card m-4 rounded-2xl flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'w-80' : 'w-20'
        }`}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className={`p-6 flex flex-col h-full ${isExpanded ? '' : 'items-center'} overflow-hidden`}>
          {/* Logo */}
          <div className={`flex flex-col ${isExpanded ? 'items-center' : 'items-center'} gap-3 mb-8`}>
            <img 
              src="/logo.svg" 
              alt="Greenstone Logo" 
              className={`object-contain ${isExpanded ? 'w-[72px] h-[72px]' : 'w-[88px] h-[88px]'}`}
            />
            {isExpanded && (
              <div className="text-center whitespace-nowrap">
                <p className="text-sm text-gray-400">AI Resume Checker</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path || 
                             (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-green-300/50 to-green-400/50 border border-green-300/60 text-green-200'
                      : 'text-gray-400 hover:text-white hover:bg-glass-100'
                  }`}
                  title={!isExpanded ? item.label : ''}
                >
                  <Icon size={20} />
                  {isExpanded && (
                    <span className="font-medium whitespace-nowrap">{item.label}</span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User Profile */}
          <div className={`mt-auto pt-4 border-t border-glass-200 ${isExpanded ? '' : 'w-full'}`}>
            {isExpanded ? (
              <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-glass-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium text-white truncate whitespace-nowrap">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-400 truncate whitespace-nowrap">{user?.email || 'admin@gsequity.com'}</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-red-500/20 transition-colors flex-shrink-0"
                  title="Logout"
                >
                  <LogOut size={18} className="text-red-400" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <User size={18} className="text-white" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Header - Hidden for Dashboard, Job Detail, and Candidate Profile pages */}
        {location.pathname !== '/' && !location.pathname.startsWith('/jobs/') && !location.pathname.startsWith('/candidates/') && (
          <header className="glass-card m-4 mb-0 rounded-2xl p-6 flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-sm text-gray-400">{subtitle}</p>
            </div>
          </header>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {/* Stats Cards - Show on all pages except Activity Logs */}
          {location.pathname !== '/activity-logs' && <StatsCards />}
          {children}
        </div>
      </div>
    </div>
  )
}

export default Layout

