import { Button } from '@/components/ui/button'

type DeleteNoteDialogProps = {
  title?: string
  message: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteNoteDialog({
  title = '删除笔记？',
  message,
  confirmLabel = '删除',
  onCancel,
  onConfirm
}: DeleteNoteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,16,29,0.38)] p-[var(--space-4)] backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_84%,transparent)] bg-[color-mix(in_srgb,var(--editor)_94%,white_6%)] p-[var(--space-4)] shadow-[0_14px_36px_rgba(0,0,0,0.28)]">
        <p className="text-ui-md font-medium text-[var(--foreground)]">{title}</p>
        <p className="text-ui-sm mt-[var(--space-2)] text-[var(--muted-foreground)]">{message}</p>
        <div className="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
          <Button variant="ghost" size="sm" className="text-ui-sm h-7 px-3 font-normal" onClick={onCancel}>
            取消
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="text-ui-sm h-7 px-3 font-normal text-[var(--destructive)] hover:bg-[color-mix(in_srgb,var(--accent)_92%,transparent)]"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
