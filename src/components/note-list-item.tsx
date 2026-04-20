import type { MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type NoteListItemProps = {
  label: string
  dateLabel: string
  selected: boolean
  selectionMode?: boolean
  checked?: boolean
  onToggleChecked?: () => void
  onOpen: () => void
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void
}

export function NoteListItem({
  label,
  dateLabel,
  selected,
  selectionMode = false,
  checked = false,
  onToggleChecked,
  onOpen,
  onContextMenu
}: NoteListItemProps) {
  return (
    <Button
      type="button"
      onClick={selectionMode ? onToggleChecked : onOpen}
      onContextMenu={onContextMenu}
      variant="ghost"
      data-note-item="true"
      className={cn(
        'h-auto w-full items-start justify-start rounded-[calc(var(--radius)-0.1rem)] border px-[var(--space-2)] py-[var(--space-2)] text-left',
        selected
          ? 'border-[color-mix(in_srgb,var(--primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--foreground)]'
          : 'border-transparent bg-transparent text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_68%,transparent)]'
      )}
    >
      <div className="flex w-full items-center justify-between gap-[var(--space-2)]">
        <div className="flex min-w-0 flex-1 items-center gap-[var(--space-2)]">
          {selectionMode ? (
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-[0.3rem] border transition-colors',
                checked
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border-[color-mix(in_srgb,var(--border)_92%,transparent)] bg-transparent text-transparent'
              )}
              aria-hidden="true"
            >
              <span className="text-[10px] leading-none">✓</span>
            </span>
          ) : null}

          <strong className="text-ui-sm min-w-0 flex-1 truncate font-normal">{label}</strong>
        </div>
        <span className="text-ui-xs shrink-0 text-[var(--muted-foreground)]">{dateLabel}</span>
      </div>
    </Button>
  )
}
