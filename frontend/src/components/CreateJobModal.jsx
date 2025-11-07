import { useState } from 'react'
import { X } from 'lucide-react'
import { createJob } from '../services/api'

const CreateJobModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    description: '',
    evaluation_criteria: [
      { name: 'Technical Skills', weight: 30 }
    ]
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await createJob(formData)
      onClose()
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Error creating job. Please try again.')
    }
  }

  const addCriterion = () => {
    setFormData({
      ...formData,
      evaluation_criteria: [...formData.evaluation_criteria, { name: '', weight: 0 }]
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
    updated[index][field] = field === 'weight' ? parseFloat(value) || 0 : value
    setFormData({ ...formData, evaluation_criteria: updated })
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-card w-full max-w-2xl m-4 p-6 max-h-[90vh] overflow-y-auto">
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
            <label className="block text-sm font-medium mb-3">Evaluation Criteria</label>
            <div className="space-y-3">
              {formData.evaluation_criteria.map((criterion, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Criterion name"
                    className="glass-input flex-1"
                    value={criterion.name}
                    onChange={(e) => updateCriterion(index, 'name', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Weight"
                    className="glass-input w-24"
                    value={criterion.weight}
                    onChange={(e) => updateCriterion(index, 'weight', e.target.value)}
                  />
                  <span className="text-gray-400">%</span>
                  <button
                    type="button"
                    onClick={() => removeCriterion(index)}
                    className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
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
              Create Job Post
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateJobModal

