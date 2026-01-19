import { useEffect, useState } from 'react'
import { Briefcase, Users, PauseCircle, CheckCircle2 } from 'lucide-react'
import { getDashboardStats } from '../services/api'
import { useAuth } from '../context/AuthContext'

const StatCard = ({ icon: Icon, label, value, color }) => {
  try {
    const colorClasses = {
      green: 'from-green-400/40 to-green-500/40 border-green-400/60 text-green-300',
      purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
      pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400',
      orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400',
      blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
    }

    if (!Icon) return null

    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[color] || colorClasses.green} flex items-center justify-center flex-shrink-0`}>
              <Icon size={24} />
            </div>
            <div className="text-3xl font-bold">{value ?? 0}</div>
          </div>
        </div>
        <div className="text-sm text-gray-400">{label || ''}</div>
      </div>
    )
  } catch (e) {
    console.error('StatCard error:', e)
    return null
  }
}

const StatsCards = () => {
  const [stats, setStats] = useState({
    active_jobs: 0,
    total_candidates: 0,
    jobs_on_hold: 0,
    jobs_filled: 0
  })
  const { user, loading } = useAuth()

  useEffect(() => {
    // Only fetch if user is authenticated and not loading
    if (loading || !user) {
      return
    }

    let isMounted = true
    
    const fetchStats = async () => {
      try {
        const statsRes = await getDashboardStats()
        if (isMounted && statsRes?.data) {
          setStats({
            active_jobs: statsRes.data.active_jobs ?? 0,
            total_candidates: statsRes.data.total_candidates ?? 0,
            jobs_on_hold: statsRes.data.jobs_on_hold ?? 0,
            jobs_filled: statsRes.data.jobs_filled ?? 0
          })
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        // Keep default values, don't crash
      }
    }
    
    // Small delay to ensure everything is ready
    const timeoutId = setTimeout(() => {
      fetchStats()
    }, 100)
    
    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [user, loading])

  // Always render safely
  try {
    return (
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Briefcase}
          label="Active Jobs"
          value={stats.active_jobs}
          color="green"
        />
        <StatCard
          icon={Users}
          label="Total Candidates"
          value={stats.total_candidates}
          color="purple"
        />
        <StatCard
          icon={PauseCircle}
          label="Jobs On Hold"
          value={stats.jobs_on_hold}
          color="orange"
        />
        <StatCard
          icon={CheckCircle2}
          label="Jobs Filled"
          value={stats.jobs_filled}
          color="blue"
        />
      </div>
    )
  } catch (e) {
    console.error('StatsCards render error:', e)
    return null
  }
}

export default StatsCards
