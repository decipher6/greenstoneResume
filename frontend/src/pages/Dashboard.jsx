import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Briefcase, Users, CheckCircle, TrendingUp, ArrowUpRight, Plus } from 'lucide-react'
import { getDashboardStats, getScoreDistribution, getMonthlyTrends } from '../services/api'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import CreateJobModal from '../components/CreateJobModal'

const Dashboard = () => {
  const [stats, setStats] = useState(null)
  const [scoreDist, setScoreDist] = useState(null)
  const [trends, setTrends] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [statsRes, distRes, trendsRes] = await Promise.all([
        getDashboardStats(),
        getScoreDistribution(),
        getMonthlyTrends()
      ])
      setStats(statsRes.data)
      setScoreDist(distRes.data)
      setTrends(trendsRes.data)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

  const scoreData = scoreDist ? Object.entries(scoreDist).map(([range, count]) => ({
    range,
    count: count / (Object.values(scoreDist).reduce((a, b) => a + b, 0) || 1)
  })) : []

  const trendData = trends ? trends.months.map((month, i) => ({
    month,
    Jobs: trends.jobs[i],
    Candidates: trends.candidates[i]
  })) : []

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

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-xl font-bold mb-2">Score Distribution</h3>
          <p className="text-sm text-gray-400 mb-4">Candidate scores across all positions (1-10 scale)</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="range" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(10, 10, 15, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="count" fill="#14a869" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-xl font-bold mb-2">Monthly Trends</h3>
          <p className="text-sm text-gray-400 mb-4">Jobs and candidates over time</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(10, 10, 15, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px'
                }}
              />
              <Line type="monotone" dataKey="Jobs" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="Candidates" stroke="#14a869" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
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

