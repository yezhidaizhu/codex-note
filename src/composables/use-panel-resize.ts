import { ref, watch, type Ref } from 'vue'

type PanelResizeOptions = {
  minWidth: number
  maxWidth: number
  side?: 'left' | 'right'
}

type ResizeState = {
  pointerX: number
  width: number
}

export function usePanelResize(width: Ref<number>, disabled: Ref<boolean>, options: PanelResizeOptions) {
  const { minWidth, maxWidth, side = 'left' } = options
  const isResizing = ref(false)
  const resizeStart = ref<ResizeState | null>(null)

  function beginResize(event: MouseEvent) {
    if (disabled.value) return
    event.preventDefault()
    resizeStart.value = { pointerX: event.clientX, width: width.value }
    isResizing.value = true
  }

  watch(isResizing, (resizing, _prev, onCleanup) => {
    if (!resizing) return

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const stopResize = () => {
      resizeStart.value = null
      isResizing.value = false
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopResize)
      window.removeEventListener('blur', stopResize)
    }

    const onMouseMove = (event: MouseEvent) => {
      const state = resizeStart.value
      if (!state) return
      const delta = side === 'right' ? state.pointerX - event.clientX : event.clientX - state.pointerX
      const nextWidth = state.width + delta
      width.value = Math.min(maxWidth, Math.max(minWidth, nextWidth))
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopResize)
    window.addEventListener('blur', stopResize)
    onCleanup(stopResize)
  })

  return {
    isResizing,
    beginResize,
  }
}
