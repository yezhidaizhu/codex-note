<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { nextTick, onMounted, ref, watch } from 'vue'
import { useNotesStore } from '@/state/notes'

const notesStore = useNotesStore()
const { activeNote, editorFocusRequestId } = storeToRefs(notesStore)

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const draftContent = ref(activeNote.value?.content ?? '')
let lastHandledFocusRequestId = 0
let isApplyingHistory = false
let isComposing = false
let historyStack: Array<{ content: string; selectionStart: number; selectionEnd: number }> = []
let historyIndex = -1
let lastHistoryMeta: { kind: 'typing' | 'delete' | 'other'; at: number } | null = null

const HISTORY_GROUP_WINDOW_MS = 1000

function syncStoreMarkdown(markdown: string) {
  if (!notesStore.activeNote) return
  if (notesStore.activeNote.content === markdown) return
  notesStore.activeNote = {
    ...notesStore.activeNote,
    content: markdown,
  }
}

function focusEditor(placeAtEnd = false) {
  textareaRef.value?.focus()
  if (!placeAtEnd) return

  const value = draftContent.value
  textareaRef.value?.setSelectionRange(value.length, value.length)
}

function resetHistory(content: string) {
  historyStack = [
    {
      content,
      selectionStart: content.length,
      selectionEnd: content.length,
    },
  ]
  historyIndex = 0
  lastHistoryMeta = null
}

function pushHistoryEntry(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  options: { kind?: 'typing' | 'delete' | 'other'; coalesce?: boolean } = {},
) {
  if (isApplyingHistory) return

  const current = historyStack[historyIndex]
  if (current && current.content === content && current.selectionStart === selectionStart && current.selectionEnd === selectionEnd) return

  const kind = options.kind ?? 'other'
  const now = Date.now()
  const canCoalesce =
    options.coalesce === true &&
    lastHistoryMeta !== null &&
    lastHistoryMeta.kind === kind &&
    now - lastHistoryMeta.at <= HISTORY_GROUP_WINDOW_MS &&
    historyIndex > 0

  if (canCoalesce) {
    historyStack[historyIndex] = {
      content,
      selectionStart,
      selectionEnd,
    }
    lastHistoryMeta = { kind, at: now }
    return
  }

  historyStack = historyStack.slice(0, historyIndex + 1)
  historyStack.push({
    content,
    selectionStart,
    selectionEnd,
  })
  historyIndex = historyStack.length - 1
  lastHistoryMeta = { kind, at: now }
}

function applyHistoryEntry(index: number) {
  const entry = historyStack[index]
  const textarea = textareaRef.value
  if (!entry || !textarea) return

  isApplyingHistory = true
  historyIndex = index
  draftContent.value = entry.content
  textarea.value = entry.content
  syncStoreMarkdown(entry.content)
  textarea.focus()
  textarea.setSelectionRange(entry.selectionStart, entry.selectionEnd)
  void nextTick(() => {
    isApplyingHistory = false
  })
}

function undoHistory() {
  if (historyIndex <= 0) return
  applyHistoryEntry(historyIndex - 1)
}

function redoHistory() {
  if (historyIndex >= historyStack.length - 1) return
  applyHistoryEntry(historyIndex + 1)
}

function classifyInputType(inputType: string | undefined): 'typing' | 'delete' | 'other' {
  if (!inputType) return 'other'
  if (inputType.startsWith('insert')) return 'typing'
  if (inputType.startsWith('delete')) return 'delete'
  return 'other'
}

function handleInput(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return
  draftContent.value = target.value
  syncStoreMarkdown(target.value)

  if (isComposing) return

  const inputEvent = event as InputEvent
  const kind = classifyInputType(inputEvent.inputType)
  pushHistoryEntry(target.value, target.selectionStart, target.selectionEnd, {
    kind,
    coalesce: kind !== 'other',
  })
}

function handleCompositionstart() {
  isComposing = true
}

function handleCompositionend(event: CompositionEvent) {
  isComposing = false
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return

  draftContent.value = target.value
  syncStoreMarkdown(target.value)
  pushHistoryEntry(target.value, target.selectionStart, target.selectionEnd, {
    kind: 'typing',
    coalesce: true,
  })
}

function applyTextareaEdit(
  textarea: HTMLTextAreaElement,
  nextValue: string,
  selectionStart: number,
  selectionEnd: number,
) {
  textarea.value = nextValue
  textarea.setSelectionRange(selectionStart, selectionEnd)
  draftContent.value = nextValue
  syncStoreMarkdown(nextValue)
  pushHistoryEntry(nextValue, selectionStart, selectionEnd, { kind: 'other' })
}

function handleListContinuation(event: KeyboardEvent, textarea: HTMLTextAreaElement) {
  if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return false
  if (textarea.selectionStart !== textarea.selectionEnd) return false

  const value = draftContent.value
  const cursor = textarea.selectionStart
  const lineStart = value.lastIndexOf('\n', cursor - 1) + 1
  const lineEnd = value.indexOf('\n', cursor)
  const safeLineEnd = lineEnd === -1 ? value.length : lineEnd
  const beforeCursor = value.slice(lineStart, cursor)
  const afterCursor = value.slice(cursor, safeLineEnd)

  if (beforeCursor.trim().length === 0 && afterCursor.length > 0) return false

  const orderedMatch = beforeCursor.match(/^(\s*)(\d+)\.\s(.*)$/)
  if (orderedMatch && afterCursor.length === 0) {
    event.preventDefault()
    const [, indent, orderText, content] = orderedMatch
    if (content.trim().length === 0) {
      const nextValue = `${value.slice(0, lineStart)}${value.slice(safeLineEnd)}`
      const nextCursor = lineStart
      applyTextareaEdit(textarea, nextValue, nextCursor, nextCursor)
      return true
    }

    const nextOrder = Number(orderText) + 1
    const insertion = `\n${indent}${nextOrder}. `
    const nextValue = `${value.slice(0, cursor)}${insertion}${value.slice(cursor)}`
    const nextCursor = cursor + insertion.length
    applyTextareaEdit(textarea, nextValue, nextCursor, nextCursor)
    return true
  }

  const bulletMatch = beforeCursor.match(/^(\s*)([-*+])\s(.*)$/)
  if (bulletMatch && afterCursor.length === 0) {
    event.preventDefault()
    const [, indent, marker, content] = bulletMatch
    if (content.trim().length === 0) {
      const nextValue = `${value.slice(0, lineStart)}${value.slice(safeLineEnd)}`
      const nextCursor = lineStart
      applyTextareaEdit(textarea, nextValue, nextCursor, nextCursor)
      return true
    }

    const insertion = `\n${indent}${marker} `
    const nextValue = `${value.slice(0, cursor)}${insertion}${value.slice(cursor)}`
    const nextCursor = cursor + insertion.length
    applyTextareaEdit(textarea, nextValue, nextCursor, nextCursor)
    return true
  }

  const taskMatch = beforeCursor.match(/^(\s*)[-*+]\s\[( |x|X)\]\s(.*)$/)
  if (taskMatch && afterCursor.length === 0) {
    event.preventDefault()
    const [, indent, , content] = taskMatch
    if (content.trim().length === 0) {
      const nextValue = `${value.slice(0, lineStart)}${value.slice(safeLineEnd)}`
      const nextCursor = lineStart
      applyTextareaEdit(textarea, nextValue, nextCursor, nextCursor)
      return true
    }

    const insertion = `\n${indent}- [ ] `
    const nextValue = `${value.slice(0, cursor)}${insertion}${value.slice(cursor)}`
    const nextCursor = cursor + insertion.length
    applyTextareaEdit(textarea, nextValue, nextCursor, nextCursor)
    return true
  }

  return false
}

function handleKeydown(event: KeyboardEvent) {
  const textarea = textareaRef.value
  if (isComposing) return

  const isMod = event.metaKey || event.ctrlKey
  if (isMod && !event.altKey && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redoHistory()
      return
    }
    undoHistory()
    return
  }

  if (isMod && !event.altKey && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    redoHistory()
    return
  }

  if (!textarea) return

  if (handleListContinuation(event, textarea)) return

  if (event.key !== 'Tab') return

  event.preventDefault()

  const value = draftContent.value
  const selectionStart = textarea.selectionStart
  const selectionEnd = textarea.selectionEnd
  const hasSelection = selectionStart !== selectionEnd
  const indentUnit = '\t'

  if (!event.shiftKey) {
    if (!hasSelection) {
      textarea.setRangeText(indentUnit, selectionStart, selectionEnd, 'end')
      draftContent.value = textarea.value
      syncStoreMarkdown(textarea.value)
      pushHistoryEntry(textarea.value, textarea.selectionStart, textarea.selectionEnd)
      return
    }

    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const selectedText = value.slice(lineStart, selectionEnd)
    const indentedText = selectedText.replace(/^/gm, indentUnit)
    textarea.setRangeText(indentedText, lineStart, selectionEnd, 'select')
    textarea.setSelectionRange(lineStart, lineStart + indentedText.length)
    draftContent.value = textarea.value
    syncStoreMarkdown(textarea.value)
    pushHistoryEntry(textarea.value, textarea.selectionStart, textarea.selectionEnd)
    return
  }

  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
  const selectedText = value.slice(lineStart, selectionEnd)
  let removedBeforeSelectionStart = 0
  let removedTotal = 0

  const unindentedText = selectedText.replace(/^(?:\t| {1,4})/gm, (match, offset) => {
    removedTotal += match.length
    if (offset === 0) removedBeforeSelectionStart = match.length
    return ''
  })

  if (unindentedText === selectedText) return

  textarea.setRangeText(unindentedText, lineStart, selectionEnd, 'select')
  const nextStart = Math.max(lineStart, selectionStart - removedBeforeSelectionStart)
  const nextEnd = Math.max(nextStart, selectionEnd - removedTotal)
  textarea.setSelectionRange(nextStart, nextEnd)
  draftContent.value = textarea.value
  syncStoreMarkdown(textarea.value)
  pushHistoryEntry(textarea.value, textarea.selectionStart, textarea.selectionEnd)
}

onMounted(() => {
  resetHistory(draftContent.value)
  void nextTick(() => {
    if (editorFocusRequestId.value > 0) {
      focusEditor(true)
      lastHandledFocusRequestId = editorFocusRequestId.value
    }
  })
})

watch(
  () => [activeNote.value?.path ?? null, activeNote.value?.content ?? ''] as const,
  ([path, markdown], [previousPath, previousMarkdown]) => {
    const noteChanged = path !== previousPath
    const externalContentChanged = markdown !== draftContent.value && markdown !== previousMarkdown
    if (!noteChanged && !externalContentChanged) return
    draftContent.value = markdown
    resetHistory(markdown)
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
</script>

<template>
  <section class="editor-surface flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="min-h-0 flex-1 overflow-hidden px-[var(--editor-pad-x)]">
      <textarea
        ref="textareaRef"
        :value="draftContent"
        class="text-ui-sm h-full min-h-full w-full resize-none border-none bg-transparent px-0 py-0 leading-[1.56] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
        placeholder="开始写点什么"
        spellcheck="false"
        @compositionstart="handleCompositionstart"
        @compositionend="handleCompositionend"
        @input="handleInput"
        @keydown="handleKeydown"
      />
    </div>
  </section>
</template>
