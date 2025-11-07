import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Eye, MoreVertical, Calendar, Users, Trash2, LucideTrash } from 'lucide-react'
import { getJobs, deleteJob } from '../services/api'
import CreateJobModal from '../components/CreateJobModal'

const JobPosts = () => {
  const [jobs, setJobs] = useState([])
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const response = await getJobs()
      setJobs(response.data)
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }

  const handleDelete = async (jobId) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await deleteJob(jobId)
        fetchJobs()
      } catch (error) {
        console.error('Error deleting job:', error)
      }
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Job Posts</h2>
          <p className="text-sm text-gray-400">Manage your open positions and track candidates</p>
        </div>
        <button onClick={() => setShowModal(true)} className="glass-button flex items-center gap-2">
          <Plus size={20} />
          Add Job
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-glass-100 border-b border-glass-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold">Title</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Department</th>
              <th className="px-6 py-4 text-left text-sm font-semibold"># Candidates</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Last Run</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-glass-200 hover:bg-glass-100 transition-colors">
                <td className="px-6 py-4">
                  <Link to={`/jobs/${job.id}`} className="font-medium hover:text-primary-400">
                    {job.title}
                  </Link>
                </td>
                <td className="px-6 py-4 text-gray-400">{job.department}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-gray-400" />
                    {job.candidate_count || 0}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-400">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    {formatDate(job.last_run)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                    {job.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="p-2 rounded-lg hover:bg-glass-200 transition-colors"
                    >
                      <Eye size={18} className="text-gray-400" />
                    </Link>
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <LucideTrash size={18} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CreateJobModal
          onClose={() => {
            setShowModal(false)
            fetchJobs()
          }}
        />
      )}
    </div>
  )
}

export default JobPosts

