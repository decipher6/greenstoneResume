import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { 
  getDashboardStats, getScoreDistribution, getAvgScoreByDepartment 
} from '../services/api'
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const Reports = () => {
  const [stats, setStats] = useState(null)
  const [scoreDist, setScoreDist] = useState(null)
  const [deptScores, setDeptScores] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [statsRes, distRes, deptRes] = await Promise.all([
        getDashboardStats(),
        getScoreDistribution(),
        getAvgScoreByDepartment()
      ])
      setStats(statsRes.data)
      setScoreDist(distRes.data)
      setDeptScores(deptRes.data)
    } catch (error) {
      console.error('Error fetching reports:', error)
    }
  }

  const scoreData = scoreDist ? Object.entries(scoreDist).map(([range, count]) => ({
    range,
    count: count / (Object.values(scoreDist).reduce((a, b) => a + b, 0) || 1)
  })) : []

  const deptData = deptScores && Array.isArray(deptScores) 
    ? deptScores.map(d => ({
        name: d.department || 'Unknown',
        value: parseFloat(d.avg_score) || 0
      }))
    : []

  const COLORS = ['#14a869', '#3b82f6', '#9333ea', '#ec4899', '#f59e0b']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end mb-6">
        <button className="glass-button flex items-center gap-2">
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-6">
          <p className="text-sm text-gray-400 mb-2">Total Candidates</p>
          <p className="text-3xl font-bold">{stats?.total_candidates || 0}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-gray-400 mb-2">Analyzed</p>
          <p className="text-3xl font-bold">{stats?.analyzed || 0}</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-gray-400 mb-2">Avg Score</p>
          <p className="text-3xl font-bold">{stats?.avg_score || 0}/10</p>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-gray-400 mb-2">Active Jobs</p>
          <p className="text-3xl font-bold">{stats?.active_jobs || 0}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-xl font-bold mb-2">Score Distribution</h3>
          <p className="text-sm text-gray-400 mb-4">Candidate scores (1-10 scale)</p>
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
          <h3 className="text-xl font-bold mb-2">Top Performing Roles</h3>
          <p className="text-sm text-gray-400 mb-4">By number of analyzed candidates</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[{ name: 'Senior', value: 100 }]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#14a869"
                dataKey="value"
              >
                <Cell fill="#14a869" />
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(10, 10, 15, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Scores */}
      <div className="glass-card p-6">
        <h3 className="text-xl font-bold mb-2">Average Scores by Department</h3>
        <p className="text-sm text-gray-400 mb-4">Performance across departments (1-10 scale)</p>
        {deptData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={deptData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="name" 
                stroke="#888" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                tick={{ fill: '#888', fontSize: 12 }}
              />
              <YAxis 
                stroke="#888" 
                domain={[0, 10]}
                tick={{ fill: '#888', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(10, 10, 15, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                labelStyle={{ color: '#fff' }}
                formatter={(value) => [`${value.toFixed(1)}/10`, 'Average Score']}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-400">
            <p>No department data available. Upload candidates and run analysis to see scores by department.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Reports

