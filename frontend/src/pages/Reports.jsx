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
    count: Number(count), // Use actual count, not proportion
    proportion: count / (Object.values(scoreDist).reduce((a, b) => a + b, 0) || 1) // Keep proportion for display if needed
  })) : []

  const deptData = deptScores && Array.isArray(deptScores) 
    ? deptScores.map(d => ({
        name: d.department || 'Unknown',
        value: parseFloat(d.avg_score) || 0
      }))
    : []

  // Greenstone color palette
  const COLORS = ['#014421', '#8EC197', '#948A54', '#7F7F7F', '#E2E2E2']

  return (
    <div className="space-y-6">

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
              <XAxis 
                dataKey="range" 
                stroke="#8EC197" 
                tick={{ fill: '#8EC197', fontSize: 12 }}
              />
              <YAxis 
                stroke="#8EC197" 
                tick={{ fill: '#8EC197', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(10, 10, 15, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#8EC197'
                }}
                labelStyle={{ color: '#8EC197' }}
                formatter={(value) => [value, 'Count']}
              />
              <Bar dataKey="count" fill="#8EC197" radius={[8, 8, 0, 0]} />
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
                labelLine={true}
                label={({ name, percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
                  const RADIAN = Math.PI / 180
                  const radius = outerRadius + 20 // Position label outside the pie
                  const x = cx + radius * Math.cos(-midAngle * RADIAN)
                  const y = cy + radius * Math.sin(-midAngle * RADIAN)
                  
                  return (
                    <text 
                      x={x} 
                      y={y} 
                      fill="#8EC197" 
                      textAnchor={x > cx ? 'start' : 'end'} 
                      dominantBaseline="central"
                      fontSize={16}
                      fontWeight="bold"
                    >
                      {`${name} ${(percent * 100).toFixed(0)}%`}
                    </text>
                  )
                }}
                outerRadius={100}
                fill="#8EC197"
                dataKey="value"
              >
                <Cell fill="#014421" />
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(10, 10, 15, 0.95)', 
                  border: '1px solid rgba(142, 193, 151, 0.5)',
                  borderRadius: '8px',
                  color: '#FFFFFF'
                }}
                labelStyle={{ color: '#8EC197', fontWeight: 'bold', fontSize: 14 }}
                itemStyle={{ color: '#FFFFFF', fontSize: 14 }}
                formatter={(value, name) => [`${value}`, name]}
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
                stroke="#8EC197" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                tick={{ fill: '#8EC197', fontSize: 12 }}
              />
              <YAxis 
                stroke="#8EC197" 
                domain={[0, 10]}
                tick={{ fill: '#8EC197', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(10, 10, 15, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#8EC197'
                }}
                labelStyle={{ color: '#8EC197' }}
                formatter={(value) => [`${value.toFixed(1)}/10`, 'Average Score']}
              />
              <Bar dataKey="value" fill="#8EC197" radius={[8, 8, 0, 0]} />
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

