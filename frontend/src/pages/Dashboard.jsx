import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Users, CheckCircle, TrendingUp, ArrowUpRight, Plus } from 'lucide-react'
import { getDashboardStats } from '../services/api'
import CreateJobModal from '../components/CreateJobModal'

const Dashboard = () => {
  const [stats, setStats] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const statsRes = await getDashboardStats()
      setStats(statsRes.data)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero Section with Create Job Button */}
      <div className="glass-card p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Greenstone Talent AI</h1>
        <p className="text-gray-400 mb-6 text-lg">Intelligent candidate screening and evaluation platform</p>
        <button 
          onClick={() => setShowCreateModal(true)} 
          className="glass-button text-lg px-8 py-4 flex items-center gap-3 mx-auto"
        >
          <Plus size={24} />
          Create Job Post
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Briefcase}
          label="Active Jobs"
          value={stats?.active_jobs || 0}
          color="green"
        />
        <StatCard
          icon={Users}
          label="Total Candidates"
          value={stats?.total_candidates || 0}
          color="purple"
        />
        <StatCard
          icon={CheckCircle}
          label="Analyzed"
          value={stats?.analyzed || 0}
          color="pink"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Score"
          value={`${stats?.avg_score || 0}/10`}
          color="orange"
        />
      </div>

      {showCreateModal && (
        <CreateJobModal
          onClose={() => {
            setShowCreateModal(false)
            fetchData()
            navigate('/jobs')
          }}
        />
      )}
    </div>
  )
}

const StatCard = ({ icon: Icon, label, value, trend, trendUp, color }) => {
  const colorClasses = {
    green: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
    pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400',
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
            <ArrowUpRight size={14} />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  )
}

export default Dashboard

