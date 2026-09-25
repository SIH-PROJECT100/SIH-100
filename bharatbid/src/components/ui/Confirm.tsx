import { AlertTriangle, AlertOctagon } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface ConfirmProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  /** The action name, e.g. "disqualification", "award decision", "rule reset" */
  actionName?: string
  /** The immutable consequence sentence, e.g. "log event EVT-DISQ to the immutable ledger and notify the bidder" */
  consequence?: string
  /** Additional explanation text */
  description?: string
  confirmText?: string
  cancelText?: string
  isDestructive?: boolean
  isLoading?: boolean
}

export function Confirm({
  isOpen,
  onClose,
  onConfirm,
  title,
  actionName,
  consequence,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
}: ConfirmProps) {
  const Icon = isDestructive ? AlertOctagon : AlertTriangle

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'p-2 rounded-full shrink-0 border',
              isDestructive
                ? 'bg-[#FAECEB] text-risk-critical border-[#EFC2BF]'
                : 'bg-[#FBF6EA] text-risk-medium border-[#EBDCB4]'
            )}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-h3 font-semibold text-ink-900 leading-snug">{title}</h3>
            {description && <p className="text-small text-ink-500 mt-1">{description}</p>}
          </div>
        </div>

        {/* Consequence sentence pattern */}
        {consequence && (
          <div
            className={cn(
              'p-3 rounded-md border text-small leading-relaxed',
              isDestructive
                ? 'bg-[#FAECEB]/60 border-[#EFC2BF] text-risk-critical'
                : 'bg-cream-100/70 border-line text-ink-700'
            )}
          >
            <span className="font-semibold">Consequence: </span>
            {actionName ? (
              <span>
                Confirming this {actionName} will {consequence}.{' '}
                <strong className="font-semibold">This action cannot be undone.</strong>
              </span>
            ) : (
              <span>
                {consequence}. <strong className="font-semibold">This action cannot be undone.</strong>
              </span>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
