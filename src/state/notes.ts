import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
import type {
  AppearanceMode,
  AppearanceDensity,
  AppearanceSettings,
  AppearanceTheme,
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

type ResolvedAppearanceMode = Exclude<AppearanceMode, 'system'>

const NOTE_LABEL_MAX_LENGTH = 36

const appearance = ref<AppearanceSettings>({
  mode: 'system',
  theme: 'ember',
  density: 'comfortable',
  transparentBackground: true,
})

const themePresets: Record<AppearanceTheme, { primary: string; primaryForeground: string; ring: string }> = {
  ember: {
    primary: '#f97316',
    primaryForeground: '#fff7ed',
    ring: '#fb923c',
  },
  ocean: {
    primary: '#38bdf8',
    primaryForeground: '#f8fdff',
    ring: '#7dd3fc',
  },
  forest: {
    primary: '#34d399',
    primaryForeground: '#f3fffa',
    ring: '#6ee7b7',
  },
}

const modePresets: Record<ResolvedAppearanceMode, Record<string, string>> = {
  dark: {
    '--background': 'rgba(5, 8, 22, 0.1)',
    '--foreground': '#f8fafc',
    '--card': '#0b1120',
    '--card-foreground': '#f8fafc',
    '--popover': '#0b1120',
    '--popover-foreground': '#f8fafc',
    '--secondary': '#151c2c',
    '--secondary-foreground': '#e5edf7',
    '--muted': '#151c2c',
    '--muted-foreground': '#94a3b8',
    '--accent': '#1b2436',
    '--accent-foreground': '#f8fafc',
    '--destructive': '#ef4444',
    '--destructive-foreground': '#f8fafc',
    '--border': '#373344',
    '--input': '#2f3d55',
    '--sidebar': '#070d1b',
    '--editor': '#0a101d',
    '--window-shell': '#2a2a2a',
    '--separator': 'rgba(255, 255, 255, 0.1)',
    '--shell-border': 'rgba(148, 163, 184, 0.34)',
    '--shadow-soft': 'rgba(255, 255, 255, 0.04)',
    '--shadow-deep': 'rgba(0, 0, 0, 0.45)',
    '--popup-shadow': 'rgba(0, 0, 0, 0.45)',
    '--dialog-shadow': 'rgba(0, 0, 0, 0.28)',
    '--overlay-backdrop': 'rgba(10, 16, 29, 0.38)',
    '--scroll-thumb': 'rgba(255, 255, 255, 0.14)',
    '--scroll-thumb-firefox': 'rgba(255, 255, 255, 0.16)',
  },
  light: {
    '--background': 'rgba(248, 250, 252, 0.68)',
    '--foreground': '#0f172a',
    '--card': '#ffffff',
    '--card-foreground': '#0f172a',
    '--popover': '#ffffff',
    '--popover-foreground': '#0f172a',
    '--secondary': '#eef2ff',
    '--secondary-foreground': '#0f172a',
    '--muted': '#f8fafc',
    '--muted-foreground': '#64748b',
    '--accent': '#f1f5f9',
    '--accent-foreground': '#0f172a',
    '--destructive': '#dc2626',
    '--destructive-foreground': '#ffffff',
    '--border': '#e2e8f0',
    '--input': '#e8eef5',
    '--sidebar': '#f8fafc',
    '--editor': '#ffffff',
    '--window-shell': '#edf2f7',
    '--separator': 'rgba(148, 163, 184, 0.2)',
    '--shell-border': 'rgba(226, 232, 240, 0.96)',
    '--shadow-soft': 'rgba(15, 23, 42, 0.06)',
    '--shadow-deep': 'rgba(15, 23, 42, 0.16)',
    '--popup-shadow': 'rgba(15, 23, 42, 0.16)',
    '--dialog-shadow': 'rgba(15, 23, 42, 0.16)',
    '--overlay-backdrop': 'rgba(148, 163, 184, 0.22)',
    '--scroll-thumb': 'rgba(100, 116, 139, 0.22)',
    '--scroll-thumb-firefox': 'rgba(100, 116, 139, 0.28)',
  },
}

function hexToRgb(value: string) {
  const normalized = value.replace('#', '')
  const digits = normalized.length === 3 ? normalized.split('').map((digit) => `${digit}${digit}`).join('') : normalized
  const numeric = Number.parseInt(digits, 16)

  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  }
}

function rgba(value: string, alpha: number) {
  const { r, g, b } = hexToRgb(value)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const systemAppearanceMode = ref<ResolvedAppearanceMode>('dark')

function resolveAppearanceMode(mode: AppearanceMode): ResolvedAppearanceMode {
  return mode === 'system' ? systemAppearanceMode.value : mode
}

function buildThemeTokens(mode: ResolvedAppearanceMode, theme: AppearanceTheme): Record<string, string> {
  const preset = themePresets[theme]
  const hoverAlpha = mode === 'dark' ? 0.16 : 0.1
  const hoverStrongAlpha = mode === 'dark' ? 0.24 : 0.16
  const selectedAlpha = mode === 'dark' ? 0.38 : 0.34
  const selectedHoverAlpha = mode === 'dark' ? 0.46 : 0.42
  const iconActiveAlpha = mode === 'dark' ? 0.3 : 0.28
  const glowAlpha = mode === 'dark' ? 0.18 : 0.14
  const buttonShadowAlpha = mode === 'dark' ? 0.24 : 0.18

  return {
    '--primary': preset.primary,
    '--primary-foreground': preset.primaryForeground,
    '--ring': preset.ring,
    '--interactive-hover': rgba(preset.primary, hoverAlpha),
    '--interactive-hover-strong': rgba(preset.primary, hoverStrongAlpha),
    '--interactive-selected': rgba(preset.primary, selectedAlpha),
    '--interactive-selected-hover': rgba(preset.primary, selectedHoverAlpha),
    '--interactive-icon-surface': mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)',
    '--interactive-icon-surface-active': rgba(preset.primary, iconActiveAlpha),
    '--primary-glow': rgba(preset.primary, glowAlpha),
    '--button-shadow': `0 10px 24px ${rgba(preset.primary, buttonShadowAlpha)}`,
  }
}

const densityPresets: Record<AppearanceDensity, Record<string, string>> = {
  comfortable: {
    '--sidebar-search-pad-x': '0.5rem',
    '--sidebar-search-pad-top': '0.5rem',
    '--sidebar-search-pad-bottom': '0.4rem',
    '--sidebar-toolbar-pad-x': '0.5rem',
    '--sidebar-toolbar-pad-y': '0.4rem',
    '--sidebar-search-input-height': '2rem',
    '--sidebar-footer-pad-x': '0.5rem',
    '--sidebar-footer-pad-y': '0.4rem',
    '--sidebar-footer-stack-gap': '0.4rem',
    '--tree-indent-step': '10px',
    '--tree-branch-gap': '0.375rem',
    '--tree-guide-offset': '0.75rem',
    '--tree-guide-padding': '0.375rem',
    '--tree-chevron-slot': '1rem',
  },
  compact: {
    '--sidebar-search-pad-x': '0.4rem',
    '--sidebar-search-pad-top': '0.35rem',
    '--sidebar-search-pad-bottom': '0.3rem',
    '--sidebar-toolbar-pad-x': '0.4rem',
    '--sidebar-toolbar-pad-y': '0.3rem',
    '--sidebar-search-input-height': '1.85rem',
    '--sidebar-footer-pad-x': '0.4rem',
    '--sidebar-footer-pad-y': '0.3rem',
    '--sidebar-footer-stack-gap': '0.3rem',
    '--tree-indent-step': '8px',
    '--tree-branch-gap': '0.3rem',
    '--tree-guide-offset': '0.6rem',
    '--tree-guide-padding': '0.3rem',
    '--tree-chevron-slot': '0.9rem',
  },
}

function applyAppearanceSettings(nextAppearance: AppearanceSettings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const resolvedMode = resolveAppearanceMode(nextAppearance.mode)
  const nextMode = modePresets[resolvedMode]
  const nextTheme = buildThemeTokens(resolvedMode, nextAppearance.theme)
  const nextDensity = densityPresets[nextAppearance.density]

  root.style.colorScheme = resolvedMode
  root.dataset.appearanceMode = resolvedMode
  root.dataset.appearancePreference = nextAppearance.mode
  root.dataset.transparentBackground = String(nextAppearance.transparentBackground)

  for (const [name, value] of Object.entries(nextMode)) {
    root.style.setProperty(name, value)
  }

  for (const [name, value] of Object.entries(nextTheme)) {
    root.style.setProperty(name, value)
  }

  for (const [name, value] of Object.entries(nextDensity)) {
    root.style.setProperty(name, value)
  }
}

let hasBoundSystemAppearanceListener = false

function bindSystemAppearanceListener() {
  if (hasBoundSystemAppearanceListener || typeof window === 'undefined') return

  getNotesApi().onSystemAppearanceChange((mode) => {
    systemAppearanceMode.value = mode
    if (appearance.value.mode === 'system') {
      applyAppearanceSettings(appearance.value)
    }
  })
  hasBoundSystemAppearanceListener = true
}

async function syncSystemAppearanceMode() {
  try {
    systemAppearanceMode.value = await getNotesApi().getSystemAppearance()
  } catch {
    systemAppearanceMode.value = 'dark'
  }
}

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

function replacePathPrefix(pathValue: string | null, sourcePrefix: string, targetPrefix: string): string | null {
  if (!pathValue) return pathValue
  if (pathValue === sourcePrefix) return targetPrefix
  if (!pathValue.startsWith(`${sourcePrefix}/`)) return pathValue
  return `${targetPrefix}${pathValue.slice(sourcePrefix.length)}`
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

export const useNotesStore = defineStore('notes', () => {
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

  const filteredNotes = computed(() => {
    const keyword = query.value.trim().toLowerCase()
    if (!keyword) return notes.value
    return notes.value.filter((item) => [item.title, item.preview, item.path].some((field) => field.toLowerCase().includes(keyword)))
  })

  let saveInFlight = false
  let queuedSave: DraftNote | null = null
  let bootPromise: Promise<void> | null = null

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

  function applyTreeResult(result: NoteTreeResult | SaveNoteResult | { notes: NoteListItemData[]; folders: FolderListItem[] }) {
    notes.value = result.notes
    folders.value = result.folders
    syncExpandedFolders(result.folders)
  }

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
      bindSystemAppearanceListener()
      await syncSystemAppearanceMode()
      const settings = await getNotesApi().getSettings()
      notesDir.value = settings.notesDir
      notes.value = settings.notes
      folders.value = settings.folders
      appearance.value = settings.appearance
      applyAppearanceSettings(settings.appearance)
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

  async function ensureInitialized() {
    if (viewReady.value) return
    if (!bootPromise) {
      bootPromise = bootOnce().finally(() => {
        bootPromise = null
      })
    }
    await bootPromise
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

  async function updateAppearance(nextAppearance: AppearanceSettings) {
    try {
      if (nextAppearance.mode === 'system') {
        await syncSystemAppearanceMode()
      }
      const persisted = await getNotesApi().updateAppearance(nextAppearance)
      appearance.value = persisted
      applyAppearanceSettings(persisted)
      errorMessage.value = ''
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '更新外观设置失败。'
    }
  }

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

  void getNotesApi()
    .getWindowState()
    .then((state) => {
      isPinned.value = state.isAlwaysOnTop
    })
    .catch(() => {
      isPinned.value = false
    })

  void ensureInitialized()

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
    appearance,
    sidebarCollapsed,
    sidebarWidth,
    isPinned,
    expandedFolderPaths,
    ensureInitialized,
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
    updateAppearance,
    togglePinned,
    toggleFolderExpanded,
    countNotesInFolder,
  }
})

export type NotesStore = ReturnType<typeof useNotesStore>
export type { DraftNote, NotePayload }
export { densityPresets, themePresets }
