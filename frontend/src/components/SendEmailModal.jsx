import { useState } from 'react'
import { X, Mail } from 'lucide-react'
import { sendEmails } from '../services/api'

const SendEmailModal = ({ jobId, candidateIds, onClose }) => {
  const [template, setTemplate] = useState({
    subject: 'Update on your application',
    body: `Dear [Candidate Name],

Thank you for your interest in the [Job Title] position at Greenstone. After careful review of all applications, we have decided to move forward with other candidates whose qualifications more closely match our current needs.

We appreciate the time you invested in applying and wish you the best in your job search.

Best regards,
Greenstone Talent Team`,
    template_type: 'rejection'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await sendEmails({ job_id: jobId, candidate_ids: candidateIds, template })
      alert(response.data.message || `Demo: Emails would be sent to ${candidateIds.length} candidates`)
      onClose()
    } catch (error) {
      console.error('Error sending emails:', error)
      alert('Error sending emails. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-card w-full max-w-2xl m-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Mail size={24} className="text-primary-400" />
            <h2 className="text-2xl font-bold">Send Rejection Emails</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-glass-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="mb-6 p-4 glass-card bg-glass-100 border border-yellow-500/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-sm font-semibold">⚠️ DEMO MODE</span>
          </div>
          <p className="text-sm text-gray-400 mb-2">{candidateIds.length} candidates selected</p>
          <p className="text-xs text-yellow-300">This is a demonstration. No actual emails will be sent.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email Subject</label>
            <input
              type="text"
              required
              className="glass-input w-full"
              value={template.subject}
              onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email Message</label>
            <textarea
              required
              rows={10}
              className="glass-input w-full resize-none"
              value={template.body}
              onChange={(e) => setTemplate({ ...template, body: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="glass-button-secondary">
              Cancel
            </button>
            <button type="submit" className="glass-button bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700">
              Demo: Send {candidateIds.length} Emails
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SendEmailModal

