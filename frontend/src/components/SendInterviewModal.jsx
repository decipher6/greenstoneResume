import { useState } from 'react'
import { X, Mail } from 'lucide-react'
import { sendEmails } from '../services/api'
import { useModal } from '../context/ModalContext'

const SendInterviewModal = ({ jobId, candidateIds, onClose }) => {
  const { showAlert } = useModal()
  const [template, setTemplate] = useState({
    subject: 'Interview Invitation - [Job Title]',
    body: `Dear [Candidate Name],

Congratulations! We were impressed with your application for the [Job Title] position at Greenstone. We would like to invite you for an interview to discuss your qualifications and learn more about you.

We would like to schedule a time that works for you. Please let us know your availability, and we will coordinate accordingly.

We look forward to speaking with you soon.

Best regards,
Greenstone Talent Team`,
    template_type: 'interview'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const response = await sendEmails({ job_id: jobId, candidate_ids: candidateIds, template })
      await showAlert(
        'Emails Sent',
        response.data.message || `Demo: Emails would be sent to ${candidateIds.length} candidates`,
        'success'
      )
      onClose()
    } catch (error) {
      console.error('Error sending emails:', error)
      await showAlert('Error', 'Error sending emails. Please try again.', 'error')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-card w-full max-w-2xl m-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Mail size={24} className="text-primary-400" />
            <h2 className="text-2xl font-bold">Send Interview Invitations</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-glass-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="mb-6 p-4 glass-card bg-glass-100 border border-primary-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Mail size={16} className="text-primary-400" />
            <span className="text-primary-400 text-sm font-semibold">Email Notification</span>
          </div>
          <p className="text-sm text-gray-400">{candidateIds.length} candidate{candidateIds.length !== 1 ? 's' : ''} selected</p>
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
            <button type="submit" className="glass-button bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
              Send {candidateIds.length} Email{candidateIds.length !== 1 ? 's' : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SendInterviewModal
