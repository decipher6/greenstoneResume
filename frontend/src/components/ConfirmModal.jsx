import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'OK', 
  cancelText = 'Cancel',
  type = 'confirm', // 'confirm', 'alert', 'success', 'error', 'info'
  showCancel = true
}) => {
  if (!isOpen) return null

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={24} className="text-green-300" />
      case 'error':
        return <AlertCircle size={24} className="text-red-400" />
      case 'info':
        return <Info size={24} className="text-blue-400" />
      case 'alert':
        return <AlertTriangle size={24} className="text-orange-400" />
      default:
        return <AlertTriangle size={24} className="text-yellow-400" />
    }
  }

  const getButtonColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-300 hover:bg-green-400'
      case 'error':
        return 'bg-red-500 hover:bg-red-600'
      case 'info':
        return 'bg-blue-500 hover:bg-blue-600'
      default:
        return 'bg-primary-500 hover:bg-primary-600'
    }
  }

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0f] border border-purple-500/30 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)' }}>
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 mt-1">
            {getIcon()}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-gray-300 whitespace-pre-line">{message}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-glass-200 transition-colors flex-shrink-0"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          {showCancel && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-glass-200 hover:bg-glass-300 transition-colors text-gray-300"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg text-white transition-colors ${getButtonColor()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
