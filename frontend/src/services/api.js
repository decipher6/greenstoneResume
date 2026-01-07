import axios from 'axios'
import { getToken } from './auth'

// In development, use proxy (no CORS needed). In production, use Render backend
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://greenstoneresume.onrender.com/api')

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
export const runAnalysis = (jobId, force = false) => api.post(`/jobs/${jobId}/run-analysis?force=${force}`)
export const reAnalyzeCandidate = (candidateId) => api.post(`/candidates/${candidateId}/re-analyze`)

// Candidates
export const getCandidates = (jobId) => api.get(`/candidates/job/${jobId}`)
export const getCandidate = (candidateId) => api.get(`/candidates/${candidateId}`)
export const uploadCandidatesBulk = (jobId, files) => {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('job_id', jobId)
  return api.post('/candidates/upload-bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const addLinkedInCandidate = (jobId, linkedinUrl, name, email) => {
  const formData = new FormData()
  formData.append('job_id', jobId)
  formData.append('linkedin_url', linkedinUrl)
  if (name) formData.append('name', name)
  if (email) formData.append('email', email)
  return api.post('/candidates/linkedin', formData)
}
export const deleteCandidate = (candidateId) => api.delete(`/candidates/${candidateId}`)

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

// Activity Logs
export const getActivityLogs = (params = {}) => {
  const queryParams = new URLSearchParams()
  if (params.limit) queryParams.append('limit', params.limit)
  if (params.skip) queryParams.append('skip', params.skip)
  if (params.activity_type) queryParams.append('activity_type', params.activity_type)
  if (params.job_id) queryParams.append('job_id', params.job_id)
  const queryString = queryParams.toString()
  return api.get(`/activity-logs${queryString ? `?${queryString}` : ''}`)
}

export default api

