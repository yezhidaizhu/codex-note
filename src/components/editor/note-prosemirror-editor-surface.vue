<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createEditorView,
  focusEditorView,
  serializeMarkdown,
  setEditorViewMarkdown,
  prosemirrorSchema,
} from './prosemirror-editor-core'
import type { EditorView } from 'prosemirror-view'
import { useEditorSettingsStore } from '@/state/editor-settings'
import { useNotesStore } from '@/state/notes'

const notesStore = useNotesStore()
const editorSettingsStore = useEditorSettingsStore()

const { activeNote, editorFocusRequestId } = storeToRefs(notesStore)
const { settings, enabledFeatureSet } = storeToRefs(editorSettingsStore)

const shellRef = ref<HTMLElement | null>(null)
const hostRef = ref<HTMLElement | null>(null)
const showPlaceholder = ref(false)

let view: EditorView | null = null
let isApplyingExternalContent = false
let lastAppliedMarkdown = activeNote.value?.content ?? ''
let lastHandledFocusRequestId = 0

const editorKey = computed(() => {
  const notePath = activeNote.value?.path ?? 'draft'
  return `${notePath}::${[...settings.value.enabledFeatures].sort().join(',')}`
})

async function syncRenderedImageSources() {
  const shell = shellRef.value
  const notePath = activeNote.value?.path
  if (!shell || !notePath || !window.notesApi) return

  const images = Array.from(shell.querySelectorAll<HTMLImageElement>('.pm-editor-image'))
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
        // Keep original markdown src when preview resolution fails.
      }
    }),
  )
}

async function saveImageFiles(files: File[]) {
  const images: Array<{ alt: string; src: string }> = []
  for (const file of files) {
    const result = await notesStore.saveImageAsset(file, settings.value)
    images.push({
      alt: file.name,
      src: result.relativePath,
    })
  }
  return images
}

function applyStoreMarkdown(markdown: string) {
  if (!notesStore.activeNote) return
  if (notesStore.activeNote.content === markdown) return
  notesStore.activeNote = {
    ...notesStore.activeNote,
    content: markdown,
  }
}

function currentMarkdown() {
  if (!view) return activeNote.value?.content ?? ''
  return serializeMarkdown(view.state.doc)
}

function isDocumentVisuallyEmpty() {
  if (!view) return true
  const { doc } = view.state
  if (doc.childCount === 0) return true
  if (doc.childCount > 1) return false

  const firstChild = doc.firstChild
  if (!firstChild) return true
  if (firstChild.type.name !== 'paragraph') return false
  return firstChild.childCount === 0 || firstChild.textContent.trim().length === 0
}

function updatePlaceholderState() {
  showPlaceholder.value = isDocumentVisuallyEmpty()
}

function rebuildEditorView() {
  if (!hostRef.value) return

  view?.destroy()
  view = createEditorView({
    element: hostRef.value,
    enabledFeatures: enabledFeatureSet.value,
    markdown: activeNote.value?.content ?? '',
    onDocChange(markdown) {
      if (isApplyingExternalContent) return
      lastAppliedMarkdown = markdown
      applyStoreMarkdown(markdown)
      updatePlaceholderState()
      void nextTick(() => syncRenderedImageSources())
    },
    onPasteImages: async (files) => {
      if (!view) return
      const images = await saveImageFiles(files)
      const nextView = view
      if (!nextView) return

      let tr = nextView.state.tr
      for (const image of images) {
        tr = tr.replaceSelectionWith(
          prosemirrorSchema.nodes.image.create({
            alt: image.alt,
            src: image.src,
            title: null,
          }),
        )
      }
      nextView.dispatch(tr.scrollIntoView())
      lastAppliedMarkdown = currentMarkdown()
      applyStoreMarkdown(lastAppliedMarkdown)
      updatePlaceholderState()
      await nextTick()
      await syncRenderedImageSources()
    },
  })

  lastAppliedMarkdown = currentMarkdown()
  updatePlaceholderState()
  void nextTick(() => syncRenderedImageSources())
}

function setEditorMarkdown(markdown: string) {
  if (!view) return
  if (markdown === lastAppliedMarkdown) return

  isApplyingExternalContent = true
  setEditorViewMarkdown(view, markdown, enabledFeatureSet.value)
  lastAppliedMarkdown = currentMarkdown()
  isApplyingExternalContent = false
  updatePlaceholderState()
  void nextTick(() => syncRenderedImageSources())
}

function focusEditor(placeAtEnd = false) {
  if (!view) return
  focusEditorView(view, placeAtEnd)
}

function handleEditorBlankPointerDown(event: MouseEvent) {
  if (!view) return
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  const proseMirrorRoot = target.closest('.ProseMirror')
  const clickedShell = target === shellRef.value || target === hostRef.value
  const clickedEditorBlank = Boolean(proseMirrorRoot) && target === proseMirrorRoot
  if (!clickedShell && !clickedEditorBlank) return
  event.preventDefault()
  focusEditor(true)
}

onMounted(() => {
  rebuildEditorView()
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

watch(
  () => editorKey.value,
  () => {
    rebuildEditorView()
  },
)

watch(
  () => activeNote.value?.content ?? '',
  (markdown) => {
    if (!view) return
    if (markdown === lastAppliedMarkdown) return
    setEditorMarkdown(markdown)
  },
)

watch(
  () => editorFocusRequestId.value,
  async (focusRequestId) => {
    if (!view) return
    if (focusRequestId === 0 || focusRequestId === lastHandledFocusRequestId) return
    await nextTick()
    focusEditor(true)
    lastHandledFocusRequestId = focusRequestId
  },
)
</script>

<template>
  <section class="editor-surface flex min-h-0 flex-1 flex-col overflow-hidden">
    <div
      ref="shellRef"
      class="pm-host relative min-h-0 flex-1 overflow-y-auto px-[var(--editor-pad-x)] py-1"
      @mousedown="handleEditorBlankPointerDown"
    >
      <div v-if="showPlaceholder" class="pm-placeholder">开始写点什么，或粘贴一段 Markdown…</div>
      <div ref="hostRef" class="pm-editor min-h-full" />
    </div>
  </section>
</template>
