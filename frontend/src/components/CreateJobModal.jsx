import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, AlertTriangle } from 'lucide-react'
import { createJob } from '../services/api'
import { useModal } from '../context/ModalContext'

const CreateJobModal = ({ onClose }) => {
  const { showAlert } = useModal()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    description: '',
    evaluation_criteria: [
      { name: 'Technical Skills', weight: 30 }
    ]
  })
  const [fieldErrors, setFieldErrors] = useState({}) // Track errors for each field: { 'name-0': 'error', 'weight-0': 'error' }

  const totalWeight = formData.evaluation_criteria.reduce((sum, c) => {
    const weight = c.weight === '' ? 0 : (parseFloat(c.weight) || 0)
    return sum + weight
  }, 0)

  const validateFields = () => {
    const errors = {}
    let hasErrors = false

    // Validate each criterion
    formData.evaluation_criteria.forEach((criterion, index) => {
      if (!criterion.name || criterion.name.trim() === '') {
        errors[`name-${index}`] = 'Criterion name is required.'
        hasErrors = true
      }
      if (criterion.weight === '' || criterion.weight === null || criterion.weight === undefined) {
        errors[`weight-${index}`] = 'Weight is required.'
        hasErrors = true
      } else {
        const weight = parseFloat(criterion.weight)
        if (isNaN(weight) || weight < 0 || weight > 100) {
          errors[`weight-${index}`] = 'Value must be between 0 and 100.'
          hasErrors = true
        }
      }
    })

    setFieldErrors(errors)
    return !hasErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate all fields
    if (!validateFields()) {
      return
    }
    
    // Validate weights sum to 100% (±1% tolerance)
    if (Math.abs(totalWeight - 100) > 1) {
      await showAlert(
        'Invalid Criteria Weights',
        `The evaluation criteria weights must sum to 100%.\n\nCurrent total: ${totalWeight.toFixed(1)}%\nRequired: 100% (within ±1%)`,
        'error'
      )
      return
    }

    try {
      const response = await createJob(formData)
      const jobId = response.data.id
      onClose()
      // Navigate to the newly created job detail page
      navigate(`/jobs/${jobId}`)
    } catch (error) {
      console.error('Error creating job:', error)
      const errorMessage = error.response?.data?.detail || 'Error creating job. Please try again.'
      await showAlert('Error', errorMessage, 'error')
    }
  }

  const addCriterion = () => {
    setFormData({
      ...formData,
      evaluation_criteria: [...formData.evaluation_criteria, { name: '', weight: '' }]
    })
  }

  const removeCriterion = (index) => {
    setFormData({
      ...formData,
      evaluation_criteria: formData.evaluation_criteria.filter((_, i) => i !== index)
    })
  }

  const updateCriterion = (index, field, value) => {
    const updated = [...formData.evaluation_criteria]
    if (field === 'weight') {
      // Keep as empty string if empty, otherwise parse as float
      updated[index][field] = value === '' ? '' : parseFloat(value) || ''
    } else {
      updated[index][field] = value
    }
    setFormData({ ...formData, evaluation_criteria: updated })
    
    // Clear error for this field when user starts typing
    if (fieldErrors[`${field}-${index}`]) {
      const newErrors = { ...fieldErrors }
      delete newErrors[`${field}-${index}`]
      setFieldErrors(newErrors)
    }
  }

  // Auto-resize textarea helper - caps at 4 lines, enables scrolling beyond
  const autoResizeTextarea = (textarea) => {
    if (!textarea) return
    const lineHeight = 24 // Approximate line height in pixels
    const maxHeight = lineHeight * 4 // Max 4 lines (96px)
    
    // Reset height to calculate scrollHeight
    textarea.style.height = 'auto'
    
    // Set height to min of scrollHeight and maxHeight
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
    
    // Ensure maxHeight is enforced
    if (textarea.scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto'
    } else {
      textarea.style.overflowY = 'hidden'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#0a0a0f] border border-purple-500/30 rounded-2xl w-full max-w-2xl m-4 p-6 max-h-[90vh] overflow-y-auto shadow-xl" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Create New Job Post</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-glass-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Job Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Senior Software Engineer"
              className="glass-input w-full"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Department</label>
            <select
              required
              className="glass-input w-full"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            >
              <option value="">Select a department</option>
              <option value="Investor Relations">Investor Relations</option>
              <option value="Partner Relations">Partner Relations</option>
              <option value="Investor Development">Investor Development</option>
              <option value="IR Research">IR Research</option>
              <option value="Legal">Legal</option>
              <option value="Compliance">Compliance</option>
              <option value="Technology">Technology</option>
              <option value="Finance">Finance</option>
              <option value="HR and Operations">HR and Operations</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Job Description</label>
            <textarea
              required
              rows={6}
              placeholder="Describe the role, responsibilities, and requirements..."
              className="glass-input w-full resize-none"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium">Evaluation Criteria</label>
              <div className={`text-sm font-medium ${Math.abs(totalWeight - 100) <= 1 ? 'text-green-300' : 'text-red-400'}`}>
                Total: {totalWeight.toFixed(1)}% {Math.abs(totalWeight - 100) <= 1 ? '✓' : '(Must be 100%)'}
              </div>
            </div>
            <div className="space-y-3">
              {formData.evaluation_criteria.map((criterion, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      placeholder="Criterion name"
                      className={`glass-input w-full resize-none ${fieldErrors[`name-${index}`] ? 'border-red-400' : ''}`}
                      value={criterion.name}
                      onChange={(e) => {
                        updateCriterion(index, 'name', e.target.value)
                        autoResizeTextarea(e.target)
                      }}
                      onInput={(e) => autoResizeTextarea(e.target)}
                      ref={(textarea) => {
                        if (textarea) {
                          // Resize on mount if there's existing text
                          setTimeout(() => autoResizeTextarea(textarea), 0)
                        }
                      }}
                      rows={1}
                      style={{ minHeight: '40px', maxHeight: '96px', overflowY: 'auto' }}
                    />
                    {fieldErrors[`name-${index}`] && (
                      <div className="absolute left-0 top-full mt-1 z-10">
                        <div className="bg-white rounded-lg shadow-lg p-3 flex items-start gap-2 max-w-xs">
                          <div className="flex-shrink-0 w-5 h-5 bg-orange-500 rounded flex items-center justify-center">
                            <AlertTriangle size={12} className="text-white" />
                          </div>
                          <p className="text-sm text-gray-800 font-medium">{fieldErrors[`name-${index}`]}</p>
                        </div>
                        <div className="absolute left-4 -top-1 w-2 h-2 bg-white transform rotate-45"></div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="Weight"
                      className={`glass-input w-24 ${fieldErrors[`weight-${index}`] ? 'border-red-400' : ''}`}
                      value={criterion.weight === 0 ? '' : criterion.weight}
                      onChange={(e) => updateCriterion(index, 'weight', e.target.value)}
                    />
                    {fieldErrors[`weight-${index}`] && (
                      <div className="absolute left-0 top-full mt-1 z-10">
                        <div className="bg-white rounded-lg shadow-lg p-3 flex items-start gap-2 max-w-xs">
                          <div className="flex-shrink-0 w-5 h-5 bg-orange-500 rounded flex items-center justify-center">
                            <AlertTriangle size={12} className="text-white" />
                          </div>
                          <p className="text-sm text-gray-800 font-medium">{fieldErrors[`weight-${index}`]}</p>
                        </div>
                        <div className="absolute left-4 -top-1 w-2 h-2 bg-white transform rotate-45"></div>
                      </div>
                    )}
                  </div>
                  <span className="text-gray-400 pt-2">%</span>
                  <button
                    type="button"
                    onClick={() => removeCriterion(index)}
                    className="p-2 rounded-lg hover:bg-red-500/20 transition-colors mt-0.5"
                    disabled={formData.evaluation_criteria.length === 1}
                  >
                    <X size={18} className="text-red-400" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addCriterion}
                className="text-sm text-primary-400 hover:text-primary-300"
              >
                + Add Criterion
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="glass-button-secondary">
              Cancel
            </button>
            <button type="submit" className="glass-button">
              Next
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateJobModal

