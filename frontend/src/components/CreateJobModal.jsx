import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, AlertTriangle, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react'
import { createJob, generateEvaluationCriteria } from '../services/api'
import { useModal } from '../context/ModalContext'

const CreateJobModal = ({ onClose }) => {
  const { showAlert } = useModal()
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Form, 2: Review
  const [generatingCriteria, setGeneratingCriteria] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    description: '',
    regions: [],
    otherRegions: '', // For custom "Other" locations
    evaluation_criteria: [
      { name: 'Technical Skills', weight: 30 }
    ]
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [regionsDropdownOpen, setRegionsDropdownOpen] = useState(false)
  const regionsDropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (regionsDropdownRef.current && !regionsDropdownRef.current.contains(event.target)) {
        setRegionsDropdownOpen(false)
      }
    }
    if (regionsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [regionsDropdownOpen])

  const totalWeight = formData.evaluation_criteria.reduce((sum, c) => {
    const weight = c.weight === '' ? 0 : (parseFloat(c.weight) || 0)
    return sum + weight
  }, 0)

  const regionOptions = ['GCC', 'APAC', 'EMEA', 'LATAM', 'NA', 'All', 'Other']

  const validateFields = () => {
    const errors = {}
    let hasErrors = false

    if (!formData.title.trim()) {
      errors.title = 'Job title is required.'
      hasErrors = true
    }
    if (!formData.department) {
      errors.department = 'Department is required.'
      hasErrors = true
    }
    if (!formData.description.trim()) {
      errors.description = 'Job description is required.'
      hasErrors = true
    }
    if (formData.regions.length === 0) {
      errors.regions = 'At least one region must be selected.'
      hasErrors = true
    }

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

  const handleGenerateCriteria = async () => {
    if (!formData.description.trim()) {
      await showAlert('Error', 'Please enter a job description first.', 'error')
      return
    }

    setGeneratingCriteria(true)
    try {
      const response = await generateEvaluationCriteria(
        formData.description,
        formData.title,
        formData.department
      )
      const generatedCriteria = response.data.criteria || []
      
      if (generatedCriteria.length > 0) {
        setFormData({
          ...formData,
          evaluation_criteria: generatedCriteria
        })
        await showAlert('Success', 'Evaluation criteria generated successfully!', 'success')
      } else {
        await showAlert('Error', 'Failed to generate criteria. Please try again.', 'error')
      }
    } catch (error) {
      console.error('Error generating criteria:', error)
      await showAlert('Error', 'Failed to generate criteria. Please try again.', 'error')
    } finally {
      setGeneratingCriteria(false)
    }
  }

  const handleNext = () => {
    if (!validateFields()) {
      return
    }
    
    // Validate weights sum to 100% (±1% tolerance)
    if (Math.abs(totalWeight - 100) > 1) {
      showAlert(
        'Invalid Criteria Weights',
        `The evaluation criteria weights must sum to 100%.\n\nCurrent total: ${totalWeight.toFixed(1)}%\nRequired: 100% (within ±1%)`,
        'error'
      )
      return
    }

    setStep(2) // Move to review step
  }

  const handleSubmit = async () => {
    try {
      // Process regions: if "Other" is selected, add the custom locations
      let finalRegions = [...formData.regions]
      if (formData.regions.includes('Other') && formData.otherRegions.trim()) {
        const customLocations = formData.otherRegions
          .split(/[,\n]/)
          .map(loc => loc.trim())
          .filter(loc => loc.length > 0)
        finalRegions = [...formData.regions.filter(r => r !== 'Other'), ...customLocations]
      } else if (formData.regions.includes('Other')) {
        finalRegions = formData.regions.filter(r => r !== 'Other')
      }
      
      const jobData = {
        ...formData,
        regions: finalRegions
      }
      
      const response = await createJob(jobData)
      const jobId = response.data.id
      onClose()
      navigate(`/jobs/${jobId}`)
    } catch (error) {
      console.error('Error creating job:', error)
      const errorMessage = error.response?.data?.detail || 'Error creating job. Please try again.'
      await showAlert('Error', errorMessage, 'error')
    }
  }

  const toggleRegion = (region) => {
    if (region === 'All') {
      if (formData.regions.includes('All')) {
        setFormData({ ...formData, regions: [], otherRegions: '' })
      } else {
        setFormData({ ...formData, regions: ['GCC', 'APAC', 'EMEA', 'LATAM', 'NA', 'All'] })
      }
    } else {
      const newRegions = formData.regions.includes(region)
        ? formData.regions.filter(r => r !== region && r !== 'All')
        : [...formData.regions.filter(r => r !== 'All'), region]
      setFormData({ 
        ...formData, 
        regions: newRegions,
        otherRegions: region === 'Other' && !formData.regions.includes('Other') ? formData.otherRegions : (region !== 'Other' ? formData.otherRegions : '')
      })
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
      updated[index][field] = value === '' ? '' : parseFloat(value) || ''
    } else {
      updated[index][field] = value
    }
    setFormData({ ...formData, evaluation_criteria: updated })
    
    if (fieldErrors[`${field}-${index}`]) {
      const newErrors = { ...fieldErrors }
      delete newErrors[`${field}-${index}`]
      setFieldErrors(newErrors)
    }
  }

  const autoResizeTextarea = (textarea) => {
    if (!textarea) return
    const lineHeight = 24
    const maxHeight = lineHeight * 4
    
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
    
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
          <h2 className="text-2xl font-bold">
            {step === 1 ? 'Create New Job Post' : 'Review Job Details'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-glass-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        {step === 1 ? (
          <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Job Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Senior Software Engineer"
                className={`glass-input w-full ${fieldErrors.title ? 'border-red-400' : ''}`}
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value })
                  if (fieldErrors.title) {
                    const newErrors = { ...fieldErrors }
                    delete newErrors.title
                    setFieldErrors(newErrors)
                  }
                }}
              />
              {fieldErrors.title && (
                <p className="text-red-400 text-xs mt-1">{fieldErrors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Department</label>
              <select
                required
                className={`glass-input w-full ${fieldErrors.department ? 'border-red-400' : ''}`}
                value={formData.department}
                onChange={(e) => {
                  setFormData({ ...formData, department: e.target.value })
                  if (fieldErrors.department) {
                    const newErrors = { ...fieldErrors }
                    delete newErrors.department
                    setFieldErrors(newErrors)
                  }
                }}
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
              {fieldErrors.department && (
                <p className="text-red-400 text-xs mt-1">{fieldErrors.department}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Regions</label>
              <div className="relative" ref={regionsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setRegionsDropdownOpen(!regionsDropdownOpen)}
                  className={`glass-input w-full text-left flex items-center justify-between ${fieldErrors.regions ? 'border-red-400' : ''}`}
                >
                  <span className={formData.regions.length === 0 ? 'text-gray-400' : ''}>
                    {formData.regions.length === 0 
                      ? 'Select regions...' 
                      : formData.regions.length === 1 
                        ? formData.regions[0]
                        : `${formData.regions.length} regions selected`}
                  </span>
                  <ChevronRight size={16} className={`transform transition-transform ${regionsDropdownOpen ? 'rotate-90' : ''}`} />
                </button>
                {regionsDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 glass-card border border-glass-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2 space-y-1">
                      {regionOptions.map((region) => (
                        <label
                          key={region}
                          className="flex items-center gap-2 cursor-pointer hover:bg-glass-100 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={formData.regions.includes(region)}
                            onChange={() => toggleRegion(region)}
                            className="rounded"
                          />
                          <span>{region}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {formData.regions.includes('Other') && (
                <div className="mt-3">
                  <label className="block text-xs font-medium mb-2 text-gray-300">
                    Specify other locations (comma or newline separated)
                  </label>
                  <textarea
                    placeholder="e.g. Middle East, Africa, Europe"
                    className="glass-input w-full text-sm resize-none"
                    rows={3}
                    value={formData.otherRegions}
                    onChange={(e) => setFormData({ ...formData, otherRegions: e.target.value })}
                  />
                </div>
              )}
              {fieldErrors.regions && (
                <p className="text-red-400 text-xs mt-1">{fieldErrors.regions}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Job Description</label>
              <textarea
                required
                rows={6}
                placeholder="Describe the role, responsibilities, and requirements..."
                className={`glass-input w-full resize-none ${fieldErrors.description ? 'border-red-400' : ''}`}
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value })
                  if (fieldErrors.description) {
                    const newErrors = { ...fieldErrors }
                    delete newErrors.description
                    setFieldErrors(newErrors)
                  }
                }}
              />
              {fieldErrors.description && (
                <p className="text-red-400 text-xs mt-1">{fieldErrors.description}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium">Evaluation Criteria</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateCriteria}
                    disabled={generatingCriteria || !formData.description.trim()}
                    className="glass-button-secondary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles size={14} className={generatingCriteria ? 'animate-spin' : ''} />
                    {generatingCriteria ? 'Generating...' : 'Generate with AI'}
                  </button>
                  <div className={`text-sm font-medium ${Math.abs(totalWeight - 100) <= 1 ? 'text-green-300' : 'text-red-400'}`}>
                    Total: {totalWeight.toFixed(1)}% {Math.abs(totalWeight - 100) <= 1 ? '✓' : '(Must be 100%)'}
                  </div>
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
                        rows={1}
                        style={{ minHeight: '40px', maxHeight: '96px', overflowY: 'auto' }}
                      />
                      {fieldErrors[`name-${index}`] && (
                        <p className="text-red-400 text-xs mt-1">{fieldErrors[`name-${index}`]}</p>
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
                        <p className="text-red-400 text-xs mt-1 absolute">{fieldErrors[`weight-${index}`]}</p>
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
              <button type="submit" className="glass-button flex items-center gap-2">
                Review
                <ChevronRight size={18} />
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Job Title</h3>
              <p className="text-gray-300">{formData.title}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Department</h3>
              <p className="text-gray-300">{formData.department}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Regions</h3>
              <div className="flex flex-wrap gap-2">
                {formData.regions.filter(r => r !== 'Other').map((region) => (
                  <span key={region} className="px-3 py-1 bg-primary-500/20 text-primary-300 rounded-full text-sm">
                    {region}
                  </span>
                ))}
                {formData.regions.includes('Other') && formData.otherRegions.trim() && (
                  formData.otherRegions.split(/[,\n]/).map((loc, idx) => (
                    loc.trim() && (
                      <span key={`other-${idx}`} className="px-3 py-1 bg-primary-500/20 text-primary-300 rounded-full text-sm">
                        {loc.trim()}
                      </span>
                    )
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Job Description</h3>
              <p className="text-gray-300 whitespace-pre-wrap">{formData.description}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Evaluation Criteria</h3>
              <div className="space-y-2">
                {formData.evaluation_criteria.map((criterion, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-glass-100 rounded-lg">
                    <span className="text-gray-300">{criterion.name}</span>
                    <span className="text-primary-400 font-semibold">{criterion.weight}%</span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-glass-200 rounded-lg mt-2">
                  <span className="font-semibold text-white">Total</span>
                  <span className="font-semibold text-green-300">{totalWeight.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="glass-button-secondary flex items-center gap-2"
              >
                <ChevronLeft size={18} />
                Back
              </button>
              <button 
                type="button" 
                onClick={handleSubmit} 
                className="glass-button"
              >
                Create Job
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreateJobModal
