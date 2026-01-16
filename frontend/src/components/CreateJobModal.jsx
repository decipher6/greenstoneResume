import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
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

  const totalWeight = formData.evaluation_criteria.reduce((sum, c) => {
    const weight = c.weight === '' ? 0 : (parseFloat(c.weight) || 0)
    return sum + weight
  }, 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate weights
    if (Math.abs(totalWeight - 100) > 5) {
      await showAlert(
        'Invalid Criteria Weights',
        `The evaluation criteria weights must sum to 100%.\n\nCurrent total: ${totalWeight.toFixed(1)}%\nRequired: 100%`,
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
            <input
              type="text"
              required
              placeholder="e.g. Engineering"
              className="glass-input w-full"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            />
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
              <div className={`text-sm font-medium ${Math.abs(totalWeight - 100) <= 5 ? 'text-green-400' : 'text-red-400'}`}>
                Total: {totalWeight.toFixed(1)}% {Math.abs(totalWeight - 100) <= 5 ? '✓' : '(Must be 100%)'}
              </div>
            </div>
            <div className="space-y-3">
              {formData.evaluation_criteria.map((criterion, index) => (
                <div key={index} className="flex items-start gap-3">
                  <textarea
                    placeholder="Criterion name"
                    className="glass-input flex-1 resize-none"
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
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Weight"
                    className="glass-input w-24"
                    value={criterion.weight === 0 ? '' : criterion.weight}
                    onChange={(e) => updateCriterion(index, 'weight', e.target.value)}
                  />
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

