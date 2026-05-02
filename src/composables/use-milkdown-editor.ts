import { Editor, defaultValueCtx, editorViewCtx, parserCtx, rootCtx } from '@milkdown/core'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { Selection } from '@milkdown/prose/state'
import { upload, uploadConfig } from '@milkdown/plugin-upload'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { useEditor, useInstance } from '@milkdown/vue'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useEditorSettingsStore } from '@/state/editor-settings'
import { useNotesStore } from '@/state/notes'
import { placeholder } from '@/components/editor/milkdown-placeholder'
import {
  toggleBlockquote,
  toggleBold,
  toggleCodeBlock,
  toggleHeading,
  toggleItalic,
  toggleLink,
  toggleOrderedList,
  toggleBulletList,
} from '@/components/editor/milkdown-commands'

export function useMilkdownEditor() {
  const notesStore = useNotesStore()
  const editorSettingsStore = useEditorSettingsStore()
  const { activeNote, editorFocusRequestId } = storeToRefs(notesStore)
  const { settings, enabledFeatureSet } = storeToRefs(editorSettingsStore)
  const imageEnabled = computed(() => enabledFeatureSet.value.has('image'))

  const fileInput = ref<HTMLInputElement | null>(null)
  const ignoreMarkdownUpdate = ref(false)
  const lastAppliedMarkdown = ref(activeNote.value?.content ?? '')
  let lastHandledFocusRequestId = 0

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, activeNote.value?.content ?? '')
        ctx.get(listenerCtx).markdownUpdated((_ctx: unknown, markdown: string) => {
          lastAppliedMarkdown.value = markdown
          if (ignoreMarkdownUpdate.value || !notesStore.activeNote) return
          notesStore.activeNote = {
            ...notesStore.activeNote,
            content: markdown,
          }
        })
        ctx.update(uploadConfig.key, (prev) => ({
          ...prev,
          uploader: async (files, schema) => {
            const nodes = []
            for (let index = 0; index < files.length; index += 1) {
              const file = files.item(index)
              if (!file || !file.type.startsWith('image/')) continue
              const result = await notesStore.saveImageAsset(file, settings.value)
              const imageNode = schema.nodes.image?.createAndFill({
                src: result.relativePath,
                alt: file.name,
              })
              if (imageNode) {
                nodes.push(imageNode)
              }
            }
            return nodes
          },
        }))
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(placeholder)
      .use(listener)
      .use(upload),
  )

  const [loading, getEditor] = useInstance()

  function withEditor(action: (editor: NonNullable<ReturnType<typeof getEditor>>) => void) {
    if (loading.value) return
    const editor = getEditor()
    if (!editor) return
    action(editor)
  }

  function replaceMarkdown(nextMarkdown: string) {
    withEditor((editor) => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const parser = ctx.get(parserCtx)
        const nextDoc = parser(nextMarkdown)
        if (view.state.doc.eq(nextDoc)) return
        ignoreMarkdownUpdate.value = true
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nextDoc.content))
        lastAppliedMarkdown.value = nextMarkdown
        queueMicrotask(() => {
          ignoreMarkdownUpdate.value = false
        })
      })
    })
  }

  function focusEditor(placeCursorAtEnd = false) {
    withEditor((editor) => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        if (placeCursorAtEnd) {
          const selection = Selection.atEnd(view.state.doc)
          view.dispatch(view.state.tr.setSelection(selection))
        }
        view.focus()
      })
    })
  }

  function insertImageIntoEditor(src: string, alt = '') {
    withEditor((editor) => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const { state } = view
        const imageNode = state.schema.nodes.image?.create({
          src,
          alt,
          title: '',
        })

        if (!imageNode) return

        const selectionParent = state.selection.$from.parent
        if (selectionParent.inlineContent) {
          view.dispatch(state.tr.replaceSelectionWith(imageNode).scrollIntoView())
          view.focus()
          return
        }

        const paragraphNode = state.schema.nodes.paragraph?.create(null, [imageNode])
        if (!paragraphNode) return

        view.dispatch(state.tr.replaceSelectionWith(paragraphNode).scrollIntoView())
        view.focus()
      })
    })
  }

  function runHeadingCommand() {
    withEditor((editor) => editor.action(toggleHeading))
  }

  function runBoldCommand() {
    withEditor((editor) => editor.action(toggleBold))
  }

  function runItalicCommand() {
    withEditor((editor) => editor.action(toggleItalic))
  }

  function runBlockquoteCommand() {
    withEditor((editor) => editor.action(toggleBlockquote))
  }

  function runBulletListCommand() {
    withEditor((editor) => editor.action(toggleBulletList))
  }

  function runOrderedListCommand() {
    withEditor((editor) => editor.action(toggleOrderedList))
  }

  function runCodeBlockCommand() {
    withEditor((editor) => editor.action(toggleCodeBlock))
  }

  function runLinkCommand() {
    const href = window.prompt('输入链接地址', 'https://')
    if (!href) return
    withEditor((editor) => {
      editor.action((ctx) => {
        toggleLink(ctx, { href })
      })
    })
  }

  function insertTaskListItem() {
    if (!activeNote.value) return
    notesStore.activeNote = {
      ...activeNote.value,
      content: `${activeNote.value.content}${activeNote.value.content.endsWith('\n') || activeNote.value.content.length === 0 ? '' : '\n'}- [ ] `,
    }
  }

  async function insertImageFiles(files: Iterable<File>) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const result = await notesStore.saveImageAsset(file, settings.value)
      await nextTick()
      focusEditor(true)
      insertImageIntoEditor(result.relativePath, file.name)
    }
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const imageFiles: File[] = []
    for (let index = 0; index < files.length; index += 1) {
      const file = files.item(index)
      if (!file || !file.type.startsWith('image/')) continue
      imageFiles.push(file)
    }
    if (imageFiles.length === 0) return
    await insertImageFiles(imageFiles)
  }

  function openImagePicker() {
    fileInput.value?.click()
  }

  function onImageFileChange(event: Event) {
    void handleImageFiles((event.target as HTMLInputElement).files)
    ;(event.target as HTMLInputElement).value = ''
  }

  function onPasteImage(event: ClipboardEvent) {
    if (!imageEnabled.value) return
    const items = Array.from(event.clipboardData?.items ?? [])
    const imageFiles = items
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))

    if (imageFiles.length === 0) return
    event.preventDefault()
    void insertImageFiles(imageFiles)
  }

  watch(
    () => activeNote.value?.content ?? '',
    (nextMarkdown) => {
      if (nextMarkdown === lastAppliedMarkdown.value) return
      replaceMarkdown(nextMarkdown)
    },
  )

  watch(
    () => activeNote.value?.path,
    (nextPath) => {
      if (!nextPath) return
      replaceMarkdown(activeNote.value?.content ?? '')
    },
  )

  watch(
    () => editorFocusRequestId.value,
    async (focusRequestId) => {
      if (focusRequestId === 0 || focusRequestId === lastHandledFocusRequestId) return
      await nextTick()
      focusEditor(true)
      lastHandledFocusRequestId = focusRequestId
    },
  )

  return {
    enabledFeatureSet,
    imageEnabled,
    fileInput,
    focusEditor,
    openImagePicker,
    onImageFileChange,
    onPasteImage,
    runHeadingCommand,
    runBoldCommand,
    runItalicCommand,
    runBlockquoteCommand,
    runBulletListCommand,
    runOrderedListCommand,
    runCodeBlockCommand,
    runLinkCommand,
    insertTaskListItem,
  }
}
