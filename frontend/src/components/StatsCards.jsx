import { useEffect, useState } from 'react'
import { Briefcase, Users, PauseCircle, CheckCircle2 } from 'lucide-react'
import { getDashboardStats } from '../services/api'

const StatCard = ({ icon: Icon, label, value, color }) => {
  const colorClasses = {
    green: 'from-green-400/40 to-green-500/40 border-green-400/60 text-green-300',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
    pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center flex-shrink-0`}>
            <Icon size={24} />
          </div>
          <div className="text-3xl font-bold">{value}</div>
        </div>
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  )
}

const StatsCards = () => {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let isMounted = true
    
    const fetchStats = async () => {
      try {
        const statsRes = await getDashboardStats()
        if (isMounted) {
          setStats(statsRes.data)
          setError(false)
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        if (isMounted) {
          setError(true)
          // Set default values on error to prevent crash
          setStats({
            active_jobs: 0,
            total_candidates: 0,
            jobs_on_hold: 0,
            jobs_filled: 0
          })
        }
      }
    }
    
    fetchStats()
    
    return () => {
      isMounted = false
    }
  }, [])

  // Always render, even if stats are null or error occurred
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <StatCard
        icon={Briefcase}
        label="Active Jobs"
        value={stats?.active_jobs ?? 0}
        color="green"
      />
      <StatCard
        icon={Users}
        label="Total Candidates"
        value={stats?.total_candidates ?? 0}
        color="purple"
      />
      <StatCard
        icon={PauseCircle}
        label="Jobs On Hold"
        value={stats?.jobs_on_hold ?? 0}
        color="orange"
      />
      <StatCard
        icon={CheckCircle2}
        label="Jobs Filled"
        value={stats?.jobs_filled ?? 0}
        color="blue"
      />
    </div>
  )
}

export default StatsCards
