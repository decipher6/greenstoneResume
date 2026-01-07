import { createContext, useContext, useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'

const ModalContext = createContext(null)

export const useModal = () => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within ModalProvider')
  }
  return context
}

export const ModalProvider = ({ children }) => {
  const [modal, setModal] = useState(null)

  const showConfirm = (options) => {
    return new Promise((resolve) => {
      setModal({
        ...options,
        type: options.type || 'confirm',
        showCancel: options.showCancel !== false,
        onConfirm: () => {
          resolve(true)
          if (options.onConfirm) options.onConfirm()
        },
        onClose: () => {
          resolve(false)
          setModal(null)
          if (options.onClose) options.onClose()
        }
      })
    })
  }

  const showAlert = (title, message, type = 'info') => {
    return new Promise((resolve) => {
      setModal({
        title,
        message,
        type,
        showCancel: false,
        confirmText: 'OK',
        onConfirm: () => {
          resolve(true)
        },
        onClose: () => {
          resolve(false)
          setModal(null)
        }
      })
    })
  }

  const closeModal = () => {
    setModal(null)
  }

  return (
    <ModalContext.Provider value={{ showConfirm, showAlert, closeModal }}>
      {children}
      {modal && (
        <ConfirmModal
          isOpen={!!modal}
          onClose={modal.onClose}
          onConfirm={modal.onConfirm}
          title={modal.title}
          message={modal.message}
          confirmText={modal.confirmText || 'OK'}
          cancelText={modal.cancelText || 'Cancel'}
          type={modal.type}
          showCancel={modal.showCancel}
        />
      )}
    </ModalContext.Provider>
  )
}
