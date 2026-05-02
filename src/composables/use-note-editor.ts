import type { NotesStore } from '@/state/notes'
import { onMounted, onUnmounted } from 'vue'

export function useNoteEditor(store: NotesStore) {
  function createNoteAndFocus(parentPath: string | null = null) {
    store.createNote(parentPath)
    store.requestEditorFocus()
  }

  async function openNoteAndFocus(path: string) {
    const opened = await store.openNote(path)
    if (!opened) return
    store.requestEditorFocus()
  }

  const onSaveHotkey = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void store.saveNote()
    }
  }

  onMounted(() => window.addEventListener('keydown', onSaveHotkey))
  onUnmounted(() => window.removeEventListener('keydown', onSaveHotkey))

  return {
    createNoteAndFocus,
    openNoteAndFocus,
  }
}
