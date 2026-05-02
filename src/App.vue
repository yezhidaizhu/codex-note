<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { useRouter } from 'vue-router'
import { Toaster } from 'vue-sonner'
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
  <div class="contents">
    <RouterView />
    <Toaster
      position="bottom-right"
      theme="system"
      :rich-colors="true"
      :close-button="false"
      :visible-toasts="1"
      :expand="false"
      :offset="14"
      :mobile-offset="12"
      :toast-options="{
        duration: 1150,
        class: 'min-h-0 w-auto min-w-0 rounded-[10px] px-2.5 py-1.5 text-[11px] leading-none shadow-[0_8px_18px_rgba(0,0,0,0.12)]',
        descriptionClass: 'hidden',
      }"
    />
  </div>
</template>
