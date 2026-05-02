<script setup lang="ts">
import { Milkdown } from '@milkdown/vue'
import { storeToRefs } from 'pinia'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMilkdownEditor } from '@/composables/use-milkdown-editor'
import { useNotesStore } from '@/state/notes'

const { imageEnabled, focusEditor, onImageFileChange, onPasteImage } = useMilkdownEditor()
const notesStore = useNotesStore()
const { activeNote } = storeToRefs(notesStore)
const shellRef = ref<HTMLElement | null>(null)
let imageObserver: MutationObserver | null = null

function handleSurfacePointerDown(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  const proseMirrorRoot = target.closest('.ProseMirror')
  const clickedShell = target.classList.contains('milkdown-shell')
  const clickedEditorBlank = Boolean(proseMirrorRoot) && target === proseMirrorRoot
  if (!clickedShell && !clickedEditorBlank) return
  event.preventDefault()
  focusEditor(true)
}

async function syncRenderedImageSources() {
  const shell = shellRef.value
  const notePath = activeNote.value?.path
  if (!shell || !notePath || !window.notesApi) return

  const images = Array.from(shell.querySelectorAll<HTMLImageElement>('.ProseMirror img'))
  await Promise.all(
    images.map(async (image) => {
      const markdownSrc = image.dataset.markdownSrc ?? image.getAttribute('src') ?? ''
      if (!markdownSrc || /^(file:|data:|blob:|https?:|note-asset:)/i.test(markdownSrc)) return

      image.dataset.markdownSrc = markdownSrc

      try {
        const { fileUrl } = await window.notesApi!.resolveNoteAssetPath(notePath, markdownSrc)
        if (activeNote.value?.path !== notePath) return
        if (image.isConnected) {
          image.src = fileUrl
        }
      } catch {
        // Keep the original markdown path when it cannot be resolved for preview.
      }
    }),
  )
}

onMounted(() => {
  imageObserver = new MutationObserver(() => {
    void syncRenderedImageSources()
  })

  if (shellRef.value) {
    imageObserver.observe(shellRef.value, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src'],
    })
  }

  void nextTick(() => syncRenderedImageSources())
})

onBeforeUnmount(() => {
  imageObserver?.disconnect()
  imageObserver = null
})

watch(
  () => [activeNote.value?.path, activeNote.value?.content] as const,
  async () => {
    await nextTick()
    await syncRenderedImageSources()
  },
)
</script>

<template>
  <section class="editor-surface flex min-h-0 flex-1 flex-col overflow-hidden">
    <input
      v-if="imageEnabled"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onImageFileChange"
    >

    <div
      ref="shellRef"
      class="milkdown-shell relative min-h-0 flex-1 overflow-y-auto px-[var(--editor-pad-x)] py-[var(--editor-pad-y)]"
      @mousedown="handleSurfacePointerDown"
      @paste.capture="onPasteImage"
    >
      <Milkdown />
    </div>
  </section>
</template>
