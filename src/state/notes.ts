import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { NoteListItem as NoteListItemData, NotePayload } from '@/lib/types'

type DraftNote = {
  basename: string | null
  content: string
  updatedAt: string | null
}

const NOTE_LABEL_MAX_LENGTH = 36

function getNotesApi() {
  if (!window.notesApi) {
    throw new Error(
      '未检测到 Electron 预加载接口。请用 `pnpm dev` 或 `pnpm dev:electron` 启动 Electron 窗口，不要直接打开 Vite 地址或 `index.html`。',
    )
  }

  return window.notesApi
}

function emptyDraft(): DraftNote {
  return { basename: null, content: '', updatedAt: null }
}

function getMeaningfulLines(content: string): string[] {
  return content
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function stripMarkdownLabel(value: string): string {
  return value
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[`*_~>[\\\]|]/g, '')
    .trim()
}

function normalizeNoteLabel(value: string, fallback: string): string {
  const cleaned = stripMarkdownLabel(value)
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return (cleaned || fallback).slice(0, NOTE_LABEL_MAX_LENGTH).trim()
}

function inferTitleFromContent(content: string): string {
  const firstLine = getMeaningfulLines(content)[0] ?? ''
  return normalizeNoteLabel(firstLine, 'Untitled')
}

export function formatCompactDate(value: string | null): string {
  if (!value) return '今天'

  const target = dayjs(value)
  const now = dayjs()
  const diffDays = now.startOf('day').diff(target.startOf('day'), 'day')

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays === 2) return '前天'

  if (target.year() === now.year()) return target.format('M月D日')
  return target.format('YYYY年M月D日')
}

export function getListLabel(item: NoteListItemData): string {
  const normalizedTitle = normalizeNoteLabel(item.title, '')
  return normalizedTitle || formatCompactDate(item.updatedAt)
}

export function buildDeleteMessage(count: number, label?: string): string {
  if (count <= 1 && label) return `将删除「${label}」，这个操作不可撤销。`
  return `将删除 ${count} 篇笔记，这个操作不可撤销。`
}

// Module-level singleton state (shared across routes).
const viewReady = ref(false)
const notesDir = ref<string | null>(null)
const notes = ref<NoteListItemData[]>([])
const activeNote = ref<DraftNote | null>(null)
const selectedBasename = ref<string | null>(null)
const errorMessage = ref('')
const query = ref('')
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(312)
const isPinned = ref(false)

const lastSavedSnapshot = ref<{ basename: string | null; content: string } | null>(null)
let saveInFlight = false
let queuedSave: DraftNote | null = null

const filteredNotes = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return notes.value
  return notes.value.filter((item) => [item.title, item.preview, item.basename].some((field) => field.toLowerCase().includes(keyword)))
})

async function openNote(basename: string) {
  try {
    const note = await getNotesApi().readNote(basename)
    selectedBasename.value = basename
    lastSavedSnapshot.value = { basename: note.basename, content: note.content }
    activeNote.value = { basename: note.basename, content: note.content, updatedAt: note.updatedAt }
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '打开笔记失败。'
  }
}

async function bootOnce() {
  errorMessage.value = ''

  try {
    const settings = await getNotesApi().getSettings()
    notesDir.value = settings.notesDir
    notes.value = settings.notes

    if (settings.notes.length > 0) {
      await openNote(settings.notes[0].basename)
    } else if (settings.notesDir) {
      activeNote.value = emptyDraft()
      selectedBasename.value = null
    } else {
      activeNote.value = null
      selectedBasename.value = null
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '初始化失败。'
  } finally {
    viewReady.value = true
  }
}

async function chooseDirectory() {
  try {
    const result = await getNotesApi().chooseDirectory()
    if (!result) return

    notesDir.value = result.notesDir
    notes.value = result.notes
    query.value = ''

    if (result.notes.length > 0) {
      await openNote(result.notes[0].basename)
    } else {
      createNote()
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '选择目录失败。'
  }
}

function createNote() {
  selectedBasename.value = null
  lastSavedSnapshot.value = { basename: null, content: '' }
  activeNote.value = emptyDraft()
  errorMessage.value = ''
}

async function saveNote(noteToSave = activeNote.value) {
  if (!noteToSave || !notesDir.value) return
  if (!noteToSave.basename && !noteToSave.content.trim()) return

  if (saveInFlight) {
    queuedSave = noteToSave
    return
  }

  saveInFlight = true
  errorMessage.value = ''

  try {
    const title = inferTitleFromContent(noteToSave.content)
    const result = await getNotesApi().saveNote({
      currentBasename: noteToSave.basename,
      title,
      content: noteToSave.content,
    })

    notes.value = result.notes
    selectedBasename.value = result.note.basename
    lastSavedSnapshot.value = { basename: result.note.basename, content: noteToSave.content }

    if (activeNote.value && activeNote.value.basename === noteToSave.basename && activeNote.value.content === noteToSave.content) {
      activeNote.value = { basename: result.note.basename, content: result.note.content, updatedAt: result.note.updatedAt }
    } else if (activeNote.value) {
      activeNote.value = { ...activeNote.value, basename: result.note.basename }
    }

    if (queuedSave) queuedSave = { ...queuedSave, basename: result.note.basename }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存失败。'
  } finally {
    saveInFlight = false
    const nextQueued = queuedSave
    queuedSave = null
    if (nextQueued) {
      const snapshot = lastSavedSnapshot.value
      const alreadySaved = snapshot?.basename === nextQueued.basename && snapshot?.content === nextQueued.content
      if (!alreadySaved) void saveNote(nextQueued)
    }
  }
}

async function deleteNotesByBasenames(basenames: string[]) {
  const targets = Array.from(new Set(basenames))
  if (targets.length === 0) return

  try {
    let nextNotes = notes.value
    for (const basename of targets) nextNotes = await getNotesApi().deleteNote(basename)

    notes.value = nextNotes

    if (selectedBasename.value && targets.includes(selectedBasename.value)) {
      if (nextNotes.length > 0) {
        await openNote(nextNotes[0].basename)
      } else {
        selectedBasename.value = null
        activeNote.value = emptyDraft()
      }
    }

    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除失败。'
  }
}

async function togglePinned() {
  try {
    const state = await getNotesApi().setAlwaysOnTop(!isPinned.value)
    isPinned.value = state.isAlwaysOnTop
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '设置置顶失败。'
  }
}

// Boot + background behaviors (debounced save + remember sidebar collapse)
let isWired = false
export function useNotesStore() {
  if (!isWired) {
    isWired = true

    void getNotesApi()
      .getWindowState()
      .then((state) => (isPinned.value = state.isAlwaysOnTop))
      .catch(() => (isPinned.value = false))

    watch(sidebarCollapsed, (collapsed) => {
      void getNotesApi().setSidebarCollapsed(collapsed)
    })

    watch(
      () => ({ note: activeNote.value, dir: notesDir.value }),
      ({ note, dir }, _prev, onCleanup) => {
        if (!note || !dir) return

        const currentSnapshot: DraftNote = { basename: note.basename, content: note.content, updatedAt: note.updatedAt }
        const snapshot = lastSavedSnapshot.value
        const unchanged = snapshot?.basename === currentSnapshot.basename && snapshot?.content === currentSnapshot.content
        if (unchanged) return

        const timer = window.setTimeout(() => void saveNote(currentSnapshot), 700)
        onCleanup(() => window.clearTimeout(timer))
      },
      { deep: true },
    )

    // Kick boot once when first used.
    onMounted(() => {
      if (!viewReady.value) void bootOnce()
    })
  }

  return {
    viewReady,
    notesDir,
    notes,
    filteredNotes,
    activeNote,
    selectedBasename,
    errorMessage,
    query,
    sidebarCollapsed,
    sidebarWidth,
    isPinned,
    bootOnce,
    chooseDirectory,
    openNote,
    createNote,
    saveNote,
    deleteNotesByBasenames,
    togglePinned,
  }
}

export type { DraftNote, NotePayload }

