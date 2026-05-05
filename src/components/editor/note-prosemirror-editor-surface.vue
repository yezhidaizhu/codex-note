<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  commandsForFeatures,
  createEditorView,
  focusEditorView,
  isDocumentVisuallyEmpty,
  restoreEditorViewSelection,
  runToolbarCommand,
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

let view: EditorView | null = null
let isApplyingExternalContent = false
let lastAppliedMarkdown = activeNote.value?.content ?? ''
let lastHandledFocusRequestId = 0

const editorConfigKey = computed(() => [...settings.value.enabledFeatures].sort().join(','))

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

function captureEditorSelectionSnapshot() {
  if (!view) {
    return {
      anchor: 0,
      focused: false,
      head: 0,
    }
  }

  const activeElement = document.activeElement
  const root = hostRef.value
  const focused = Boolean(root && activeElement && root.contains(activeElement))
  const { from, to } = view.state.selection

  return {
    anchor: from,
    focused,
    head: to,
  }
}

function rebuildEditorView() {
  if (!hostRef.value) return
  const previousSelection = captureEditorSelectionSnapshot()

  view?.destroy()
  view = createEditorView({
    element: hostRef.value,
    enabledFeatures: enabledFeatureSet.value,
    markdown: activeNote.value?.content ?? '',
    onDocChange(markdown) {
      if (isApplyingExternalContent) return
      lastAppliedMarkdown = markdown
      applyStoreMarkdown(markdown)
      void nextTick(() => syncRenderedImageSources())
    },
    onPasteImages: async (files) => {
      if (!view) return
      const images = await saveImageFiles(files)
      const nextView = view
      if (!nextView) return

      const emptyDoc = isDocumentVisuallyEmpty(nextView.state.doc)
      let tr = nextView.state.tr
      for (const image of images) {
        const imageNode = prosemirrorSchema.nodes.image.create({
          alt: image.alt,
          src: image.src,
          title: null,
        })
        tr = emptyDoc
          ? tr.replaceWith(0, tr.doc.content.size, imageNode)
          : tr.replaceSelectionWith(imageNode)
      }
      nextView.dispatch(tr.scrollIntoView())
      lastAppliedMarkdown = currentMarkdown()
      applyStoreMarkdown(lastAppliedMarkdown)
      await nextTick()
      await syncRenderedImageSources()
    },
  })

  lastAppliedMarkdown = currentMarkdown()
  void nextTick(async () => {
    if (view && previousSelection.focused) {
      restoreEditorViewSelection(view, previousSelection.anchor, previousSelection.head)
    }
    await syncRenderedImageSources()
  })
}

function setEditorMarkdown(markdown: string) {
  if (!view) return
  if (markdown === lastAppliedMarkdown) return

  isApplyingExternalContent = true
  setEditorViewMarkdown(view, markdown, enabledFeatureSet.value)
  lastAppliedMarkdown = currentMarkdown()
  isApplyingExternalContent = false
  void nextTick(() => syncRenderedImageSources())
}

function focusEditor(placeAtEnd = false) {
  if (!view) return
  focusEditorView(view, placeAtEnd)
}

function handleEditorBlankClick(event: MouseEvent) {
  if (!view) return
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  const clickedShell = target === shellRef.value || target === hostRef.value
  if (!clickedShell) return
  focusEditor(true)
}

onMounted(() => {
  rebuildEditorView()
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

function runCommand(command: ReturnType<typeof commandsForFeatures>[keyof ReturnType<typeof commandsForFeatures>]) {
  if (!view || !command) return false
  return runToolbarCommand(view, command)
}

const featureCommands = computed(() => commandsForFeatures(enabledFeatureSet.value))

defineExpose({
  focusEditor,
  runBlockquoteCommand: () => runCommand(featureCommands.value.toggleBlockquote),
  runBoldCommand: () => runCommand(featureCommands.value.toggleBold),
  runBulletListCommand: () => runCommand(featureCommands.value.toggleBulletList),
  runCodeBlockCommand: () => runCommand(featureCommands.value.toggleCodeBlock),
  runHeadingCommand: () => runCommand(featureCommands.value.toggleHeading),
  runItalicCommand: () => runCommand(featureCommands.value.toggleItalic),
  runOrderedListCommand: () => runCommand(featureCommands.value.toggleOrderedList),
  runTaskListCommand: () => runCommand(featureCommands.value.toggleTaskList),
})

watch(
  () => editorConfigKey.value,
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
      @click="handleEditorBlankClick"
    >
      <div
        ref="hostRef"
        class="pm-editor min-h-full"
        data-placeholder="开始写点什么，或粘贴一段 Markdown…"
      />
    </div>
  </section>
</template>
