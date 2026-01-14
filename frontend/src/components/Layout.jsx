import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, User, LogOut, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Layout = ({ children, pageTitle, pageSubtitle }) => {
  const location = useLocation()
  const { user, logout } = useAuth()

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
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 glass-card m-4 rounded-2xl p-6 flex flex-col">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
        <img 
          src="/logo.svg" 
          alt="Greenstone Logo" 
          className="w-[72px] h-[72px] object-contain"
        />
          <div className="text-center">
            <p className="text-sm text-gray-400">ResumAI</p>
          </div>
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
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-500/40 to-primary-600/40 border border-primary-500/50 text-primary-300'
                    : 'text-gray-400 hover:text-white hover:bg-glass-100'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User Profile */}
        <div className="mt-auto pt-4 border-t border-glass-200">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-glass-100">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <User size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email || 'admin@gsequity.com'}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-red-500/20 transition-colors flex-shrink-0"
              title="Logout"
            >
              <LogOut size={18} className="text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Hidden for Dashboard, Job Detail, and Candidate Profile pages */}
        {location.pathname !== '/' && !location.pathname.startsWith('/jobs/') && !location.pathname.startsWith('/candidates/') && (
          <header className="glass-card m-4 mb-0 rounded-2xl p-6">
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-sm text-gray-400">{subtitle}</p>
            </div>
          </header>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Layout

