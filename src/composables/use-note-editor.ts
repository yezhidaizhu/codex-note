import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { NotesStore } from '@/state/notes'

type EditorTextareaHandle = {
  focus: () => void
  setSelectionRange: (start: number, end: number) => void
} | null

function isEditorTextareaHandle(value: unknown): value is NonNullable<EditorTextareaHandle> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'focus' in value &&
      typeof value.focus === 'function' &&
      'setSelectionRange' in value &&
      typeof value.setSelectionRange === 'function',
  )
}

export function useNoteEditor(store: NotesStore) {
  const pendingEditorFocus = ref(false)
  const editorTextarea = ref<EditorTextareaHandle>(null)

  function bindEditorTextarea(element: Element | ComponentPublicInstance | null) {
    editorTextarea.value = isEditorTextareaHandle(element) ? element : null
  }

  function onEditorInput(event: Event) {
    if (!store.activeNote) return
    const target = event.target as HTMLTextAreaElement | null
    store.activeNote = { ...store.activeNote, content: target?.value ?? '' }
  }

  function createNoteAndFocus(parentPath: string | null = null) {
    pendingEditorFocus.value = true
    store.createNote(parentPath)
  }

  const onSaveHotkey = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void store.saveNote()
    }
  }

  watch(
    () => store.activeNote,
    async (note) => {
      if (!note || !pendingEditorFocus.value) return
      await nextTick()
      editorTextarea.value?.focus()
      const cursorPosition = note.content.length
      editorTextarea.value?.setSelectionRange(cursorPosition, cursorPosition)
      pendingEditorFocus.value = false
    },
  )

  onMounted(() => window.addEventListener('keydown', onSaveHotkey))
  onUnmounted(() => window.removeEventListener('keydown', onSaveHotkey))

  return {
    bindEditorTextarea,
    onEditorInput,
    createNoteAndFocus,
  }
}
