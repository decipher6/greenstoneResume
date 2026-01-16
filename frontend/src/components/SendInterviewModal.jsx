import { useState } from 'react'
import { X, Mail, ExternalLink } from 'lucide-react'
import { getInterviewLinks } from '../services/api'
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
  const [generatedLinks, setGeneratedLinks] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateLinks = async (e) => {
    e.preventDefault()
    setIsGenerating(true)
    try {
      const response = await getInterviewLinks({ 
        job_id: jobId, 
        candidate_ids: candidateIds, 
        template 
      })
      setGeneratedLinks(response.data.links || [])
      await showAlert(
        'Links Generated',
        `Generated ${response.data.links?.length || 0} mailto link(s). Click on each link to open Outlook with the pre-filled email.`,
        'success'
      )
    } catch (error) {
      console.error('Error generating links:', error)
      await showAlert('Error', 'Error generating mailto links. Please try again.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleOpenMailto = (mailtoUrl, candidateName) => {
    // Create a temporary anchor element and click it to open mailto link
    // This is more reliable than window.location.href
    const link = document.createElement('a')
    link.href = mailtoUrl
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#0a0a0f] border border-purple-500/30 rounded-2xl w-full max-w-2xl m-4 p-6 shadow-xl" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Mail size={24} className="text-primary-400" />
            <h2 className="text-2xl font-bold">Send Interview Invitations</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-glass-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="mb-6 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-2">
            <Mail size={16} className="text-primary-400" />
            <span className="text-primary-400 text-sm font-semibold">Email Notification</span>
          </div>
          <p className="text-sm text-gray-400">{candidateIds.length} candidate{candidateIds.length !== 1 ? 's' : ''} selected</p>
        </div>

        <form onSubmit={handleGenerateLinks} className="space-y-4">
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
            <button 
              type="submit" 
              disabled={isGenerating}
              className="glass-button bg-gradient-to-r from-green-300 to-green-400 hover:from-green-400 hover:to-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : `Generate ${candidateIds.length} Link${candidateIds.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>

        {/* Generated Mailto Links */}
        {generatedLinks.length > 0 && (
          <div className="mt-6 pt-6 border-t border-glass-200">
            <h3 className="text-lg font-semibold mb-4">Click to Open Outlook</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {generatedLinks.map((link) => (
                <button
                  key={link.candidate_id}
                  onClick={() => {
                    // Use window.location.href to open mailto link
                    // This is the most reliable method for opening email clients
                    window.location.href = link.mailto_url
                  }}
                  className="w-full p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg hover:bg-purple-900/30 transition-colors text-left flex items-center justify-between group cursor-pointer backdrop-blur-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{link.candidate_name}</div>
                    <div className="text-sm text-gray-400 truncate">{link.email}</div>
                  </div>
                  <ExternalLink size={18} className="text-primary-400 flex-shrink-0 ml-2 group-hover:scale-110 transition-transform" />
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Clicking a link will open your default email client (Outlook, Mail, etc.) with the pre-filled message.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SendInterviewModal
