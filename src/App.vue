<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { useRouter } from 'vue-router'
import { useEditorSettingsStore } from '@/state/editor-settings'
import { useNoteStyleStore } from '@/state/note-style'
import { useNotesStore } from '@/state/notes'

const router = useRouter()
const noteStyleStore = useNoteStyleStore()
const editorSettingsStore = useEditorSettingsStore()
const notesStore = useNotesStore()
let disposeQuickCreateListener: (() => void) | null = null

void noteStyleStore.ensureInitialized()
void editorSettingsStore.ensureInitialized()
void notesStore.ensureInitialized()

onMounted(() => {
  disposeQuickCreateListener =
    window.notesApi?.onQuickCreateTriggered?.((payload) => {
      void (async () => {
        if (router.currentRoute.value.path !== '/') {
          await router.push('/')
        }

        if (payload.action === 'open') {
          const opened = await notesStore.openNote(payload.path)
          if (!opened) return
          notesStore.requestEditorFocus()
          return
        }

        notesStore.createNoteWithContent(payload.parentPath, payload.initialContent, payload.nameSeed ?? null)
        notesStore.requestEditorFocus()
      })()
    }) ?? null
})

onUnmounted(() => {
  disposeQuickCreateListener?.()
})
</script>

<template>
  <RouterView />
</template>
