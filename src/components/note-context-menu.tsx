type NoteContextMenuProps = {
  x: number
  y: number
  onDelete: () => void
}

export function NoteContextMenu({ x, y, onDelete }: NoteContextMenuProps) {
  return (
    <div
      className="fixed z-50 min-w-[120px] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_92%,transparent)] bg-[color-mix(in_srgb,var(--card)_96%,transparent)] p-1 shadow-[0_12px_28px_rgba(0,0,0,0.45)] backdrop-blur"
      style={{
        left: x,
        top: y
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--destructive)] hover:bg-[color-mix(in_srgb,var(--accent)_80%,transparent)]"
        onClick={onDelete}
      >
        删除
      </button>
    </div>
  )
}
