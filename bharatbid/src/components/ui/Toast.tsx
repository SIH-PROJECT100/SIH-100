import { toast as sonnerToast } from 'sonner'
import type { ReactNode } from 'react'

export interface ToastOptions {
  description?: ReactNode
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export const notify = {
  success: (message: string, options?: ToastOptions) => {
    return sonnerToast.success(message, {
      description: options?.description,
      duration: options?.duration || 3000,
      action: options?.action,
    })
  },

  error: (message: string, options?: ToastOptions) => {
    return sonnerToast.error(message, {
      description: options?.description,
      duration: options?.duration || 4500,
      action: options?.action,
    })
  },

  warning: (message: string, options?: ToastOptions) => {
    return sonnerToast.warning(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
    })
  },

  info: (message: string, options?: ToastOptions) => {
    return sonnerToast.info(message, {
      description: options?.description,
      duration: options?.duration || 3000,
      action: options?.action,
    })
  },
}

export { sonnerToast as toast }
