import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type {
  FolderListItem,
  MoveFolderResult,
  NoteListItem as NoteListItemData,
  NotePayload,
  NoteTreeResult,
  RenameFolderResult,
  SaveNoteResult,
} from '@/lib/types'

type DraftNote = {
  path: string | null
  parentPath: string | null
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

function normalizePath(pathValue: string | null | undefined): string | null {
  if (!pathValue) return null
  const normalized = pathValue
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.')
  if (normalized.length === 0) return null
  return normalized.join('/')
}

function pathParent(pathValue: string | null): string | null {
  const normalized = normalizePath(pathValue)
  if (!normalized) return null
  const segments = normalized.split('/')
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('/')
}

function emptyDraft(parentPath: string | null = null): DraftNote {
  return { path: null, parentPath: normalizePath(parentPath), content: '', updatedAt: null }
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

function applyTreeResult(result: NoteTreeResult | SaveNoteResult | { notes: NoteListItemData[]; folders: FolderListItem[] }) {
  notes.value = result.notes
  folders.value = result.folders
  syncExpandedFolders(result.folders)
}

function replacePathPrefix(pathValue: string | null, sourcePrefix: string, targetPrefix: string): string | null {
  if (!pathValue) return pathValue
  if (pathValue === sourcePrefix) return targetPrefix
  if (!pathValue.startsWith(`${sourcePrefix}/`)) return pathValue
  return `${targetPrefix}${pathValue.slice(sourcePrefix.length)}`
}

function syncExpandedFolders(nextFolders: FolderListItem[]) {
  const previousKnown = new Set(knownFolderPaths.value)
  const nextKnown = new Set(nextFolders.map((folder) => folder.path))
  const nextExpanded = new Set(expandedFolderPaths.value.filter((path) => nextKnown.has(path)))

  for (const path of nextKnown) {
    if (!previousKnown.has(path)) nextExpanded.add(path)
  }

  knownFolderPaths.value = [...nextKnown]
  expandedFolderPaths.value = [...nextExpanded]
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

export function buildDeleteFolderMessage(folderLabel: string, notesCount: number): string {
  return `将删除目录「${folderLabel}」及其内容（${notesCount} 篇笔记），这个操作不可撤销。`
}

const viewReady = ref(false)
const notesDir = ref<string | null>(null)
const notes = ref<NoteListItemData[]>([])
const folders = ref<FolderListItem[]>([])
const activeNote = ref<DraftNote | null>(null)
const selectedPath = ref<string | null>(null)
const errorMessage = ref('')
const query = ref('')
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(312)
const isPinned = ref(false)
const expandedFolderPaths = ref<string[]>([])
const knownFolderPaths = ref<string[]>([])

const lastSavedSnapshot = ref<{ path: string | null; content: string } | null>(null)
let saveInFlight = false
let queuedSave: DraftNote | null = null

const filteredNotes = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return notes.value
  return notes.value.filter((item) => [item.title, item.preview, item.path].some((field) => field.toLowerCase().includes(keyword)))
})

function countNotesInFolder(folderPath: string): number {
  const prefix = `${folderPath}/`
  return notes.value.filter((item) => item.parentPath === folderPath || item.path.startsWith(prefix)).length
}

function isPathInsideFolder(pathValue: string | null, folderPath: string): boolean {
  if (!pathValue) return false
  return pathValue === folderPath || pathValue.startsWith(`${folderPath}/`)
}

function toggleFolderExpanded(pathValue: string) {
  expandedFolderPaths.value = expandedFolderPaths.value.includes(pathValue)
    ? expandedFolderPaths.value.filter((item) => item !== pathValue)
    : [...expandedFolderPaths.value, pathValue]
}

async function openNote(pathValue: string) {
  try {
    const note = await getNotesApi().readNote(pathValue)
    selectedPath.value = note.path
    lastSavedSnapshot.value = { path: note.path, content: note.content }
    activeNote.value = { path: note.path, parentPath: note.parentPath, content: note.content, updatedAt: note.updatedAt }
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
    folders.value = settings.folders
    syncExpandedFolders(settings.folders)

    if (settings.notes.length > 0) {
      await openNote(settings.notes[0].path)
    } else if (settings.notesDir) {
      activeNote.value = emptyDraft()
      selectedPath.value = null
    } else {
      activeNote.value = null
      selectedPath.value = null
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
    folders.value = result.folders
    syncExpandedFolders(result.folders)
    query.value = ''

    if (result.notes.length > 0) {
      await openNote(result.notes[0].path)
    } else {
      createNote()
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '选择目录失败。'
  }
}

function createNote(parentPath: string | null = null) {
  selectedPath.value = null
  lastSavedSnapshot.value = { path: null, content: '' }
  activeNote.value = emptyDraft(parentPath)
  errorMessage.value = ''
}

async function saveNote(noteToSave = activeNote.value) {
  if (!noteToSave || !notesDir.value) return
  if (!noteToSave.path && !noteToSave.content.trim()) return

  if (saveInFlight) {
    queuedSave = noteToSave
    return
  }

  saveInFlight = true
  errorMessage.value = ''

  try {
    const title = inferTitleFromContent(noteToSave.content)
    const result = await getNotesApi().saveNote({
      currentPath: noteToSave.path,
      parentPath: noteToSave.path ? pathParent(noteToSave.path) : noteToSave.parentPath,
      title,
      content: noteToSave.content,
    })

    applyTreeResult(result)
    selectedPath.value = result.note.path
    lastSavedSnapshot.value = { path: result.note.path, content: noteToSave.content }

    if (activeNote.value && activeNote.value.path === noteToSave.path && activeNote.value.content === noteToSave.content) {
      activeNote.value = {
        path: result.note.path,
        parentPath: result.note.parentPath,
        content: result.note.content,
        updatedAt: result.note.updatedAt,
      }
    } else if (activeNote.value) {
      activeNote.value = { ...activeNote.value, path: result.note.path, parentPath: result.note.parentPath }
    }

    if (queuedSave) queuedSave = { ...queuedSave, path: result.note.path, parentPath: result.note.parentPath }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存失败。'
  } finally {
    saveInFlight = false
    const nextQueued = queuedSave
    queuedSave = null
    if (nextQueued) {
      const snapshot = lastSavedSnapshot.value
      const alreadySaved = snapshot?.path === nextQueued.path && snapshot?.content === nextQueued.content
      if (!alreadySaved) void saveNote(nextQueued)
    }
  }
}

async function deleteNotesByPaths(paths: string[]) {
  const targets = Array.from(new Set(paths.map((item) => normalizePath(item)).filter((item): item is string => Boolean(item))))
  if (targets.length === 0) return

  try {
    let nextTree: NoteTreeResult = { notes: notes.value, folders: folders.value }
    for (const pathValue of targets) nextTree = await getNotesApi().deleteNote(pathValue)
    applyTreeResult(nextTree)

    if (selectedPath.value && targets.includes(selectedPath.value)) {
      if (nextTree.notes.length > 0) {
        await openNote(nextTree.notes[0].path)
      } else {
        selectedPath.value = null
        activeNote.value = emptyDraft()
      }
    }

    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除失败。'
  }
}

async function createFolder(parentPath: string | null, name: string) {
  if (!notesDir.value) return
  try {
    const tree = await getNotesApi().createFolder(parentPath, name)
    applyTreeResult(tree)
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '创建目录失败。'
  }
}

async function deleteFolder(folderPath: string) {
  if (!notesDir.value) return
  try {
    const currentPath = selectedPath.value
    const tree = await getNotesApi().deleteFolder(folderPath)
    applyTreeResult(tree)

    if (currentPath && isPathInsideFolder(currentPath, folderPath)) {
      if (tree.notes.length > 0) {
        await openNote(tree.notes[0].path)
      } else {
        selectedPath.value = null
        activeNote.value = emptyDraft()
      }
    }

    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除目录失败。'
  }
}

async function moveNote(pathValue: string, targetFolderPath: string | null) {
  if (!notesDir.value) return
  try {
    const result = await getNotesApi().moveNote(pathValue, targetFolderPath)
    applyTreeResult(result)

    if (selectedPath.value === pathValue || activeNote.value?.path === pathValue) {
      selectedPath.value = result.note.path
      if (activeNote.value) {
        activeNote.value = { ...activeNote.value, path: result.note.path, parentPath: result.note.parentPath }
      }
      if (lastSavedSnapshot.value?.path === pathValue) {
        lastSavedSnapshot.value = { ...lastSavedSnapshot.value, path: result.note.path }
      }
    }

    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '移动笔记失败。'
  }
}

async function moveFolder(folderPath: string, targetFolderPath: string | null) {
  if (!notesDir.value) return
  try {
    const result: MoveFolderResult = await getNotesApi().moveFolder(folderPath, targetFolderPath)
    applyTreeResult(result)
    expandedFolderPaths.value = expandedFolderPaths.value.map((path) => replacePathPrefix(path, folderPath, result.path) ?? path)

    if (selectedPath.value) {
      selectedPath.value = replacePathPrefix(selectedPath.value, folderPath, result.path)
    }

    if (activeNote.value) {
      activeNote.value = {
        ...activeNote.value,
        path: replacePathPrefix(activeNote.value.path, folderPath, result.path),
        parentPath: replacePathPrefix(activeNote.value.parentPath, folderPath, result.path),
      }
    }

    if (lastSavedSnapshot.value?.path) {
      lastSavedSnapshot.value = {
        ...lastSavedSnapshot.value,
        path: replacePathPrefix(lastSavedSnapshot.value.path, folderPath, result.path),
      }
    }

    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '移动目录失败。'
  }
}

async function renameNote(pathValue: string, name: string) {
  if (!notesDir.value) return
  try {
    const result = await getNotesApi().renameNote(pathValue, name)
    applyTreeResult(result)

    if (selectedPath.value === pathValue || activeNote.value?.path === pathValue) {
      selectedPath.value = result.note.path
      if (activeNote.value) {
        activeNote.value = { ...activeNote.value, path: result.note.path, parentPath: result.note.parentPath }
      }
      if (lastSavedSnapshot.value?.path === pathValue) {
        lastSavedSnapshot.value = { ...lastSavedSnapshot.value, path: result.note.path }
      }
    }

    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '重命名笔记失败。'
  }
}

async function renameFolder(folderPath: string, name: string) {
  if (!notesDir.value) return
  try {
    const result: RenameFolderResult = await getNotesApi().renameFolder(folderPath, name)
    applyTreeResult(result)
    expandedFolderPaths.value = expandedFolderPaths.value.map((path) => replacePathPrefix(path, folderPath, result.path) ?? path)

    if (selectedPath.value) {
      selectedPath.value = replacePathPrefix(selectedPath.value, folderPath, result.path)
    }

    if (activeNote.value) {
      activeNote.value = {
        ...activeNote.value,
        path: replacePathPrefix(activeNote.value.path, folderPath, result.path),
        parentPath: replacePathPrefix(activeNote.value.parentPath, folderPath, result.path),
      }
    }

    if (lastSavedSnapshot.value?.path) {
      lastSavedSnapshot.value = {
        ...lastSavedSnapshot.value,
        path: replacePathPrefix(lastSavedSnapshot.value.path, folderPath, result.path),
      }
    }

    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '重命名目录失败。'
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

        const currentSnapshot: DraftNote = {
          path: note.path,
          parentPath: note.parentPath,
          content: note.content,
          updatedAt: note.updatedAt,
        }
        const snapshot = lastSavedSnapshot.value
        const unchanged = snapshot?.path === currentSnapshot.path && snapshot?.content === currentSnapshot.content
        if (unchanged) return

        const timer = window.setTimeout(() => void saveNote(currentSnapshot), 700)
        onCleanup(() => window.clearTimeout(timer))
      },
      { deep: true },
    )

    onMounted(() => {
      if (!viewReady.value) void bootOnce()
    })
  }

  return {
    viewReady,
    notesDir,
    notes,
    folders,
    filteredNotes,
    activeNote,
    selectedPath,
    errorMessage,
    query,
    sidebarCollapsed,
    sidebarWidth,
    isPinned,
    expandedFolderPaths,
    bootOnce,
    chooseDirectory,
    openNote,
    createNote,
    saveNote,
    deleteNotesByPaths,
    createFolder,
    deleteFolder,
    moveNote,
    moveFolder,
    renameNote,
    renameFolder,
    togglePinned,
    toggleFolderExpanded,
    countNotesInFolder,
  }
}

export type { DraftNote, NotePayload }
