import { ref, watch } from 'vue'
import type { NotesStore } from '@/state/notes'

const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 520

export function useSidebarResize(store: NotesStore) {
  const isSidebarResizing = ref(false)
  const sidebarResizeStart = ref<{ pointerX: number; width: number } | null>(null)

  function beginSidebarResize(event: MouseEvent) {
    if (store.sidebarCollapsed) return
    event.preventDefault()
    sidebarResizeStart.value = { pointerX: event.clientX, width: store.sidebarWidth }
    isSidebarResizing.value = true
  }

  watch(isSidebarResizing, (resizing, _prev, onCleanup) => {
    if (!resizing) return

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const stopResize = () => {
      sidebarResizeStart.value = null
      isSidebarResizing.value = false
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopResize)
      window.removeEventListener('blur', stopResize)
    }

    const onMouseMove = (event: MouseEvent) => {
      const state = sidebarResizeStart.value
      if (!state) return
      const nextWidth = state.width + event.clientX - state.pointerX
      store.sidebarWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, nextWidth))
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopResize)
    window.addEventListener('blur', stopResize)
    onCleanup(stopResize)
  })

  return {
    isSidebarResizing,
    beginSidebarResize,
  }
}
