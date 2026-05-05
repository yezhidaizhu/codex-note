<script setup lang="ts">
import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { storeToRefs } from 'pinia'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEditorSettingsStore } from '@/state/editor-settings'
import { useNotesStore } from '@/state/notes'

const notesStore = useNotesStore()
const editorSettingsStore = useEditorSettingsStore()

const { activeNote, editorFocusRequestId } = storeToRefs(notesStore)
const { settings } = storeToRefs(editorSettingsStore)

const hostRef = ref<HTMLElement | null>(null)

let crepe: Crepe | null = null
let imageSyncObserver: MutationObserver | null = null
let isApplyingExternalContent = false
let lastAppliedMarkdown = activeNote.value?.content ?? ''
let lastHandledFocusRequestId = 0
let pendingFocusAfterCreate = false

function applyStoreMarkdown(markdown: string) {
  if (!notesStore.activeNote) return
  if (notesStore.activeNote.content === markdown) return
  notesStore.activeNote = {
    ...notesStore.activeNote,
    content: markdown,
  }
}

async function uploadImage(file: File) {
  const result = await notesStore.saveImageAsset(file, settings.value)
  return result.relativePath
}

async function syncRenderedImageSources() {
  const host = hostRef.value
  const notePath = activeNote.value?.path
  const notesApi = window.notesApi
  if (!host || !notePath || !notesApi) return

  const images = Array.from(host.querySelectorAll<HTMLImageElement>('.milkdown img'))
  await Promise.all(
    images.map(async (image) => {
      const rawSrc = image.dataset.markdownSrc ?? image.getAttribute('src') ?? ''
      if (!rawSrc || /^(file:|data:|blob:|https?:|note-asset:)/i.test(rawSrc)) return

      image.dataset.markdownSrc = rawSrc

      try {
        const { fileUrl } = await notesApi.resolveNoteAssetPath(notePath, rawSrc)
        if (activeNote.value?.path !== notePath) return
        if (image.isConnected) {
          image.src = fileUrl
        }
      } catch {
        // Keep the original markdown src when preview resolution fails.
      }
    }),
  )
}

function bindImageSyncObserver() {
  imageSyncObserver?.disconnect()

  const host = hostRef.value
  if (!host) return

  imageSyncObserver = new MutationObserver(() => {
    void syncRenderedImageSources()
  })

  imageSyncObserver.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  })
}

function isEditorFocused() {
  const activeElement = document.activeElement
  return Boolean(hostRef.value && activeElement && hostRef.value.contains(activeElement))
}

function focusEditor() {
  const editorElement = hostRef.value?.querySelector<HTMLElement>('.milkdown .ProseMirror')
  if (!editorElement) return false
  editorElement.focus()
  return true
}

async function createCrepeEditor() {
  if (!hostRef.value) return

  const shouldRestoreFocus = pendingFocusAfterCreate || isEditorFocused()
  await crepe?.destroy()

  crepe = new Crepe({
    root: hostRef.value,
    defaultValue: activeNote.value?.content ?? '',
    features: {
      [CrepeFeature.Cursor]: false,
      [CrepeFeature.BlockEdit]: false,
      [CrepeFeature.LinkTooltip]: false,
      [CrepeFeature.Latex]: false,
      [CrepeFeature.Placeholder]: false,
      [CrepeFeature.Table]: false,
      [CrepeFeature.Toolbar]: false,
      [CrepeFeature.TopBar]: false,
    },
    featureConfigs: {
      [CrepeFeature.ImageBlock]: {
        onUpload: uploadImage,
        inlineOnUpload: uploadImage,
        blockOnUpload: uploadImage,
      },
    },
  })

  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      if (isApplyingExternalContent) return
      lastAppliedMarkdown = markdown
      applyStoreMarkdown(markdown)
    })
  })

  await crepe.create()
  lastAppliedMarkdown = activeNote.value?.content ?? ''
  bindImageSyncObserver()
  await syncRenderedImageSources()
  if (shouldRestoreFocus) {
    await nextTick()
    if (focusEditor()) {
      pendingFocusAfterCreate = false
    }
  }
}

onMounted(() => {
  void createCrepeEditor()
})

onBeforeUnmount(() => {
  imageSyncObserver?.disconnect()
  imageSyncObserver = null
  void crepe?.destroy()
  crepe = null
})

watch(
  () => activeNote.value?.content ?? '',
  async (markdown) => {
    if (!crepe) return
    if (markdown === lastAppliedMarkdown) return

    isApplyingExternalContent = true
    await createCrepeEditor()
    isApplyingExternalContent = false
    lastAppliedMarkdown = markdown
  },
)

watch(
  () => editorFocusRequestId.value,
  async (focusRequestId) => {
    if (focusRequestId === 0 || focusRequestId === lastHandledFocusRequestId) return
    pendingFocusAfterCreate = true
    await nextTick()
    if (focusEditor()) {
      pendingFocusAfterCreate = false
    }
    lastHandledFocusRequestId = focusRequestId
  },
)
</script>

<template>
  <section class="editor-surface flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="milkdown-host min-h-0 flex-1 overflow-y-auto px-[var(--editor-pad-x)]">
      <div ref="hostRef" class="min-h-full" />
    </div>
  </section>
</template>
