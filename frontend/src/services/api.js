import axios from 'axios'
import { getToken } from './auth'

// In development, use proxy (no CORS needed). In production, use Render backend
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://greenstone-resume-xzxm.vercel.app/api')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Jobs
export const getJobs = () => api.get('/jobs')
export const getJob = (jobId) => api.get(`/jobs/${jobId}`)
export const createJob = (data) => api.post('/jobs', data)
export const deleteJob = (jobId) => api.delete(`/jobs/${jobId}`)
export const updateJobStatus = (jobId, status) => api.patch(`/jobs/${jobId}/status`, { status })
export const runAnalysis = (jobId, force = false) => api.post(`/jobs/${jobId}/run-analysis?force=${force}`)
export const reAnalyzeCandidate = (candidateId) => api.post(`/candidates/${candidateId}/re-analyze`)

// Candidates
export const getCandidates = (jobId) => api.get(`/candidates/job/${jobId}`)
export const getCandidate = (candidateId) => api.get(`/candidates/${candidateId}`)
export const uploadCandidatesBulk = (jobId, files) => {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('job_id', jobId)
  // Smaller chunks = shorter timeout needed per request
  // 2 minutes per chunk should be plenty for 5 files
  const timeout = files.length <= 5 ? 120000 : 300000 // 2 min for small batches, 5 min for larger
  return api.post('/candidates/upload-bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: timeout,
    // Add retry configuration
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  })
}
export const deleteCandidate = (candidateId) => api.delete(`/candidates/${candidateId}`)
export const updateCandidate = (candidateId, data) => api.patch(`/candidates/${candidateId}`, data)
export const shortlistCandidate = (candidateId) => api.patch(`/candidates/${candidateId}`, { status: 'shortlisted' })

// Assessments
export const uploadCandidateAssessments = (candidateId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/assessments/candidate/${candidateId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// Analytics
export const getDashboardStats = () => api.get('/analytics/dashboard')
export const getScoreDistribution = () => api.get('/analytics/score-distribution')
export const getMonthlyTrends = () => api.get('/analytics/monthly-trends')
export const getAvgScoreByDepartment = () => api.get('/analytics/avg-score-by-department')
export const getTopCandidates = (jobId, limit = 5) => api.get(`/analytics/top-candidates/${jobId}?limit=${limit}`)

// Email
export const sendEmails = (data) => api.post('/email/send', data)
export const getInterviewLinks = (data) => api.post('/email/interview-links', data)
export const getRejectionLinks = (data) => api.post('/email/rejection-links', data)

// Activity Logs
export const getActivityLogs = (params = {}) => {
  const { limit = 30, skip = 0, start_date, end_date, activity_type, user_id } = params
  const queryParams = new URLSearchParams({ limit: limit.toString(), skip: skip.toString() })
  if (start_date) queryParams.append('start_date', start_date)
  if (end_date) queryParams.append('end_date', end_date)
  if (activity_type) queryParams.append('activity_type', activity_type)
  if (user_id) queryParams.append('user_id', user_id)
  return api.get(`/activity-logs?${queryParams.toString()}`)
}
export const getActivityLogsCount = (params = {}) => {
  const { start_date, end_date, activity_type, user_id } = params
  const queryParams = new URLSearchParams()
  if (start_date) queryParams.append('start_date', start_date)
  if (end_date) queryParams.append('end_date', end_date)
  if (activity_type) queryParams.append('activity_type', activity_type)
  if (user_id) queryParams.append('user_id', user_id)
  return api.get(`/activity-logs/count?${queryParams.toString()}`)
}
export const getActivityTypes = () => api.get('/activity-logs/types')
export const getActivityUsers = () => api.get('/activity-logs/users')

export default api

