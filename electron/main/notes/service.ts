import { watch, type FSWatcher } from 'node:fs'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, parse, relative, resolve } from 'node:path'
import { searchNotes as runSearch, type NotesSearchMode } from '../search'

export type NoteListItem = {
  path: string
  name: string
  parentPath: string | null
  title: string
  updatedAt: string
  size: number
}

export type FolderListItem = {
  path: string
  name: string
  parentPath: string | null
}

export type NotePayload = {
  path: string
  name: string
  parentPath: string | null
  title: string
  content: string
  updatedAt: string
}

export type NoteTreeResult = {
  notes: NoteListItem[]
  folders: FolderListItem[]
}

export type RenameFolderResult = {
  path: string
  notes: NoteListItem[]
  folders: FolderListItem[]
}

export type MoveFolderResult = {
  path: string
  notes: NoteListItem[]
  folders: FolderListItem[]
}

type NotesIndexState = {
  notesDir: string | null
  initialized: boolean
  notes: Map<string, NoteListItem>
  searchTexts: Map<string, string>
  folders: Map<string, FolderListItem>
  watchers: Map<string, FSWatcher>
  pendingRefreshRoots: Set<string>
  refreshTimer: NodeJS.Timeout | null
  refreshInFlight: boolean
}

type SaveNotePayload = {
  currentPath?: string | null
  parentPath: string | null
  title: string
  content: string
}

type NotesServiceOptions = {
  getNotesDirSetting: () => Promise<string | null>
  onTreeChanged?: (tree: NoteTreeResult) => void
  defaultSearchMode?: NotesSearchMode
}

const NOTE_TITLE_MAX_LENGTH = 36

export function createNotesService(options: NotesServiceOptions) {
  const state: NotesIndexState = {
    notesDir: null,
    initialized: false,
    notes: new Map(),
    searchTexts: new Map(),
    folders: new Map(),
    watchers: new Map(),
    pendingRefreshRoots: new Set(),
    refreshTimer: null,
    refreshInFlight: false
  }
  let searchMode: NotesSearchMode = options.defaultSearchMode ?? 'memory'

  function shouldCacheSearchText(mode: NotesSearchMode = searchMode): boolean {
    return mode === 'memory'
  }

  function noteTreeSnapshot(): NoteTreeResult {
    const notes = [...state.notes.values()].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    const folders = [...state.folders.values()].sort((left, right) => left.path.localeCompare(right.path, 'zh-Hans-CN'))
    return { notes, folders }
  }

  function emitTreeChanged(): void {
    options.onTreeChanged?.(noteTreeSnapshot())
  }

  async function ensureDir(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true })
  }

  function clearRefreshTimer(): void {
    if (!state.refreshTimer) {
      return
    }

    clearTimeout(state.refreshTimer)
    state.refreshTimer = null
  }

  function clearWatchers(): void {
    for (const watcher of state.watchers.values()) {
      watcher.close()
    }
    state.watchers.clear()
  }

  function resetIndex(notesDir: string | null = null): void {
    clearRefreshTimer()
    clearWatchers()
    state.notesDir = notesDir
    state.initialized = false
    state.notes.clear()
    state.searchTexts.clear()
    state.folders.clear()
    state.pendingRefreshRoots.clear()
    state.refreshInFlight = false
  }

  function normalizeRelativePath(pathValue: string | null | undefined): string | null {
    if (!pathValue) return null
    const normalized = pathValue
      .replace(/\\/g, '/')
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0 && segment !== '.')

    if (normalized.some((segment) => segment === '..')) {
      throw new Error('路径非法。')
    }

    if (normalized.length === 0) return null
    return normalized.join('/')
  }

  function parentFromPath(pathValue: string): string | null {
    const parent = dirname(pathValue)
    return parent === '.' ? null : parent.replace(/\\/g, '/')
  }

  function resolveInNotesDir(notesDir: string, pathValue: string | null): string {
    const relativePath = normalizeRelativePath(pathValue)
    const absolutePath = resolve(relativePath ? join(notesDir, relativePath) : notesDir)
    const rootPath = resolve(notesDir)
    const relativeToRoot = relative(rootPath, absolutePath)

    if (relativeToRoot.startsWith('..') || relativeToRoot.includes('/../') || relativeToRoot.includes('\\..\\')) {
      throw new Error('路径越界。')
    }

    return absolutePath
  }

  function ensureMarkdownName(name: string): string {
    const trimmed = name.trim() || 'untitled'
    const withoutExtension = extname(trimmed).toLowerCase() === '.md' ? parse(trimmed).name : trimmed
    return `${withoutExtension}.md`
  }

  function normalizeTitle(title: string): string {
    const cleaned = title
      .trim()
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/[`*_~>[\\\]|]/g, ' ')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return (cleaned || 'Untitled').slice(0, NOTE_TITLE_MAX_LENGTH).trim() || 'Untitled'
  }

  function normalizeFolderName(name: string): string {
    const cleaned = name
      .trim()
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return cleaned || '新建目录'
  }

  function firstMeaningfulLine(content: string): string | null {
    return content
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(0) ?? null
  }

  function isMarkdownFile(pathValue: string): boolean {
    return extname(pathValue).toLowerCase() === '.md'
  }

  function removeFolderBranch(folderPath: string, options: { includeSelf?: boolean } = {}): void {
    const includeSelf = options.includeSelf ?? true

    for (const [pathValue] of state.notes) {
      if (pathValue === folderPath || pathValue.startsWith(`${folderPath}/`)) {
        state.notes.delete(pathValue)
        state.searchTexts.delete(pathValue)
      }
    }

    for (const [pathValue] of state.folders) {
      if ((includeSelf && pathValue === folderPath) || pathValue.startsWith(`${folderPath}/`)) {
        state.folders.delete(pathValue)
      }
    }
  }

  async function uniqueNotePath(notesDir: string, parentPath: string | null, preferredName: string, currentPath?: string): Promise<string> {
    const targetName = ensureMarkdownName(preferredName)
    const baseName = parse(targetName).name
    let candidateName = targetName
    let index = 1

    for (;;) {
      const candidatePath = parentPath ? `${parentPath}/${candidateName}` : candidateName
      if (currentPath && currentPath === candidatePath) {
        return candidatePath
      }

      try {
        await stat(resolveInNotesDir(notesDir, candidatePath))
        candidateName = `${baseName}-${index}.md`
        index += 1
      } catch {
        return candidatePath
      }
    }
  }

  async function uniqueFolderPath(notesDir: string, parentPath: string | null, preferredName: string): Promise<string> {
    const baseName = normalizeFolderName(preferredName)
    let candidateName = baseName
    let index = 1

    for (;;) {
      const candidatePath = parentPath ? `${parentPath}/${candidateName}` : candidateName
      try {
        await stat(resolveInNotesDir(notesDir, candidatePath))
        candidateName = `${baseName}-${index}`
        index += 1
      } catch {
        return candidatePath
      }
    }
  }

  async function getNotesDirOrThrow(): Promise<string> {
    const notesDir = await options.getNotesDirSetting()
    if (!notesDir) {
      throw new Error('未设置笔记目录。')
    }
    await ensureDir(notesDir)
    return notesDir
  }

  async function readNoteIndexEntry(notesDir: string, notePath: string): Promise<{ item: NoteListItem; searchText: string }> {
    const normalizedPath = normalizeRelativePath(notePath)
    if (!normalizedPath) {
      throw new Error('笔记路径不能为空。')
    }

    const absolutePath = resolveInNotesDir(notesDir, normalizedPath)
    const [content, fileStat] = await Promise.all([readFile(absolutePath, 'utf8'), stat(absolutePath)])
    const titleSeed = firstMeaningfulLine(content) ?? parse(normalizedPath).name

    return {
      item: {
        path: normalizedPath,
        name: basename(absolutePath),
        parentPath: parentFromPath(normalizedPath),
        title: normalizeTitle(titleSeed),
        updatedAt: fileStat.mtime.toISOString(),
        size: fileStat.size
      },
      searchText: shouldCacheSearchText() ? content.replace(/\r/g, '\n').replace(/\s+/g, ' ').trim().toLowerCase() : ''
    }
  }

  async function refreshFileIndexEntry(notesDir: string, notePath: string): Promise<void> {
    const normalizedPath = normalizeRelativePath(notePath)
    if (!normalizedPath || !isMarkdownFile(normalizedPath)) {
      return
    }

    try {
      const entry = await readNoteIndexEntry(notesDir, normalizedPath)
      state.notes.set(normalizedPath, entry.item)
      if (shouldCacheSearchText()) {
        state.searchTexts.set(normalizedPath, entry.searchText)
      } else {
        state.searchTexts.delete(normalizedPath)
      }
    } catch {
      state.notes.delete(normalizedPath)
      state.searchTexts.delete(normalizedPath)
    }
  }

  async function refreshFolderBranch(notesDir: string, folderPath: string | null): Promise<void> {
    const normalizedFolderPath = normalizeRelativePath(folderPath)
    const branchAbsolutePath = resolveInNotesDir(notesDir, normalizedFolderPath)
    if (normalizedFolderPath) {
      removeFolderBranch(normalizedFolderPath, { includeSelf: false })
    } else {
      state.notes.clear()
      state.searchTexts.clear()
      state.folders.clear()
    }

    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>
    try {
      entries = (await readdir(branchAbsolutePath, { withFileTypes: true, encoding: 'utf8' })) as Array<{
        name: string
        isDirectory(): boolean
        isFile(): boolean
      }>
    } catch {
      if (normalizedFolderPath) {
        removeFolderBranch(normalizedFolderPath, { includeSelf: true })
      } else {
        state.notes.clear()
        state.searchTexts.clear()
        state.folders.clear()
      }
      return
    }

    entries.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))

    for (const entry of entries) {
      const entryRelativePath = normalizedFolderPath ? `${normalizedFolderPath}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        state.folders.set(entryRelativePath, {
          path: entryRelativePath,
          name: entry.name,
          parentPath: normalizedFolderPath
        })
        await refreshFolderBranch(notesDir, entryRelativePath)
        continue
      }

      if (!entry.isFile() || !isMarkdownFile(entry.name)) {
        continue
      }

      try {
        const entryData = await readNoteIndexEntry(notesDir, entryRelativePath)
        state.notes.set(entryRelativePath, entryData.item)
        if (shouldCacheSearchText()) {
          state.searchTexts.set(entryRelativePath, entryData.searchText)
        } else {
          state.searchTexts.delete(entryRelativePath)
        }
      } catch {
        state.notes.delete(entryRelativePath)
        state.searchTexts.delete(entryRelativePath)
      }
    }
  }

  function watchDirectoryBranch(notesDir: string, folderPath: string | null): void {
    const normalizedFolderPath = normalizeRelativePath(folderPath)
    const watchKey = normalizedFolderPath ?? ''
    if (state.watchers.has(watchKey)) {
      return
    }

    const absolutePath = resolveInNotesDir(notesDir, normalizedFolderPath)

    try {
      const watcher = watch(absolutePath, { persistent: false }, (_eventType, filename) => {
        const nextRoot = filename ? normalizeRelativePath(normalizedFolderPath ? `${normalizedFolderPath}/${filename}` : filename) : normalizedFolderPath
        queueRefresh(nextRoot)
      })
      watcher.on('error', () => {
        queueRefresh(normalizedFolderPath)
      })
      state.watchers.set(watchKey, watcher)
    } catch {
      // Ignore watch failures for transient paths; the next branch refresh will retry.
    }
  }

  function rewireWatchers(notesDir: string): void {
    clearWatchers()
    watchDirectoryBranch(notesDir, null)
    for (const folder of state.folders.values()) {
      watchDirectoryBranch(notesDir, folder.path)
    }
  }

  function nearestRefreshRoot(pathValue: string | null): string | null {
    const normalizedPath = normalizeRelativePath(pathValue)
    if (!normalizedPath) {
      return null
    }

    if (isMarkdownFile(normalizedPath)) {
      return parentFromPath(normalizedPath)
    }

    return normalizedPath
  }

  async function flushQueuedRefresh(): Promise<void> {
    if (state.refreshInFlight) {
      return
    }

    const notesDir = state.notesDir
    if (!notesDir || !state.initialized) {
      state.pendingRefreshRoots.clear()
      return
    }

    state.refreshInFlight = true
    const refreshRoots = [...state.pendingRefreshRoots]
    state.pendingRefreshRoots.clear()

    try {
      if (refreshRoots.length === 0) {
        return
      }

      const uniqueRoots = [...new Set(refreshRoots.map((root) => nearestRefreshRoot(root)))]
      const shouldRefreshAll = uniqueRoots.includes(null)

      if (shouldRefreshAll) {
        await refreshFolderBranch(notesDir, null)
      } else {
        const filteredRoots = uniqueRoots
          .filter((root): root is string => root !== null)
          .sort((left, right) => left.length - right.length)
          .filter((root, index, roots) => !roots.slice(0, index).some((candidate) => root === candidate || root.startsWith(`${candidate}/`)))

        for (const root of filteredRoots) {
          await refreshFolderBranch(notesDir, root)
        }
      }

      rewireWatchers(notesDir)
      emitTreeChanged()
    } finally {
      state.refreshInFlight = false
      if (state.pendingRefreshRoots.size > 0) {
        queueRefresh(null)
      }
    }
  }

  function queueRefresh(pathValue: string | null): void {
    state.pendingRefreshRoots.add(pathValue ?? '')
    clearRefreshTimer()
    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null
      void flushQueuedRefresh()
    }, 120)
  }

  async function ensureNotesIndex(notesDir: string): Promise<void> {
    const normalizedDir = resolve(notesDir)
    if (state.notesDir !== normalizedDir) {
      resetIndex(normalizedDir)
    }

    if (state.initialized) {
      return
    }

    await ensureDir(normalizedDir)
    state.notesDir = normalizedDir
    await refreshFolderBranch(normalizedDir, null)
    rewireWatchers(normalizedDir)
    state.initialized = true
  }

  async function currentNotesTree(notesDir: string): Promise<NoteTreeResult> {
    await ensureNotesIndex(notesDir)
    return noteTreeSnapshot()
  }

  async function searchNotes(notesDir: string, query: string, mode = searchMode): Promise<NoteTreeResult> {
    await ensureNotesIndex(notesDir)
    const notes = noteTreeSnapshot().notes
    if (!query.trim()) {
      return noteTreeSnapshot()
    }

    const matchedNotes = await runSearch({
      mode,
      notesDir,
      notes,
      searchTexts: state.searchTexts,
      query
    })

    return { notes: matchedNotes, folders: noteTreeSnapshot().folders }
  }

  async function readNote(notesDir: string, notePath: string): Promise<NotePayload> {
    const normalizedPath = normalizeRelativePath(notePath)
    if (!normalizedPath) {
      throw new Error('笔记路径不能为空。')
    }

    const filePath = resolveInNotesDir(notesDir, normalizedPath)
    const [content, fileStat] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)])
    const firstLine = firstMeaningfulLine(content)

    return {
      path: normalizedPath,
      name: basename(filePath),
      parentPath: parentFromPath(normalizedPath),
      title: normalizeTitle(firstLine ?? parse(normalizedPath).name),
      content,
      updatedAt: fileStat.mtime.toISOString()
    }
  }

  async function saveNote(notesDir: string, payload: SaveNotePayload): Promise<{ note: NotePayload; notes: NoteListItem[]; folders: FolderListItem[] }> {
    const normalizedTitle = normalizeTitle(payload.title)
    const currentPath = normalizeRelativePath(payload.currentPath ?? null)
    let nextPath: string

    if (currentPath) {
      nextPath = currentPath
      await writeFile(resolveInNotesDir(notesDir, currentPath), payload.content, 'utf8')
    } else {
      const parentPath = normalizeRelativePath(payload.parentPath)
      if (parentPath) {
        await ensureDir(resolveInNotesDir(notesDir, parentPath))
      }
      nextPath = await uniqueNotePath(notesDir, parentPath, normalizedTitle)
      await writeFile(resolveInNotesDir(notesDir, nextPath), payload.content, 'utf8')
    }

    await ensureNotesIndex(notesDir)
    await refreshFileIndexEntry(notesDir, nextPath)
    emitTreeChanged()
    const noteTree = noteTreeSnapshot()

    return {
      note: await readNote(notesDir, nextPath),
      notes: noteTree.notes,
      folders: noteTree.folders
    }
  }

  async function deleteNote(notesDir: string, notePath: string): Promise<NoteTreeResult> {
    const normalizedPath = normalizeRelativePath(notePath)
    if (!normalizedPath) {
      throw new Error('笔记路径不能为空。')
    }

    await rm(resolveInNotesDir(notesDir, normalizedPath), { force: true })
    await ensureNotesIndex(notesDir)
    state.notes.delete(normalizedPath)
    state.searchTexts.delete(normalizedPath)
    emitTreeChanged()
    return noteTreeSnapshot()
  }

  async function createFolder(notesDir: string, parentPath: string | null, name: string): Promise<NoteTreeResult> {
    const normalizedParentPath = normalizeRelativePath(parentPath)
    if (normalizedParentPath) {
      await ensureDir(resolveInNotesDir(notesDir, normalizedParentPath))
    }

    const folderPath = await uniqueFolderPath(notesDir, normalizedParentPath, name)
    await ensureDir(resolveInNotesDir(notesDir, folderPath))
    await ensureNotesIndex(notesDir)
    state.folders.set(folderPath, {
      path: folderPath,
      name: basename(folderPath),
      parentPath: normalizedParentPath
    })
    rewireWatchers(notesDir)
    emitTreeChanged()
    return noteTreeSnapshot()
  }

  async function deleteFolder(notesDir: string, folderPath: string): Promise<NoteTreeResult> {
    const normalizedPath = normalizeRelativePath(folderPath)
    if (!normalizedPath) {
      throw new Error('目录路径不能为空。')
    }

    await rm(resolveInNotesDir(notesDir, normalizedPath), { recursive: true, force: true })
    await ensureNotesIndex(notesDir)
    removeFolderBranch(normalizedPath)
    rewireWatchers(notesDir)
    emitTreeChanged()
    return noteTreeSnapshot()
  }

  async function moveNote(notesDir: string, notePath: string, targetFolderPath: string | null): Promise<{ note: NotePayload; notes: NoteListItem[]; folders: FolderListItem[] }> {
    const normalizedPath = normalizeRelativePath(notePath)
    if (!normalizedPath) {
      throw new Error('笔记路径不能为空。')
    }

    const normalizedTargetFolderPath = normalizeRelativePath(targetFolderPath)
    if (normalizedTargetFolderPath) {
      await ensureDir(resolveInNotesDir(notesDir, normalizedTargetFolderPath))
    }

    const currentParentPath = parentFromPath(normalizedPath)
    if (currentParentPath === normalizedTargetFolderPath) {
      const noteTree = await currentNotesTree(notesDir)
      return {
        note: await readNote(notesDir, normalizedPath),
        notes: noteTree.notes,
        folders: noteTree.folders
      }
    }

    const nextPath = await uniqueNotePath(notesDir, normalizedTargetFolderPath, basename(normalizedPath))
    await rename(resolveInNotesDir(notesDir, normalizedPath), resolveInNotesDir(notesDir, nextPath))
    await ensureNotesIndex(notesDir)
    state.notes.delete(normalizedPath)
    state.searchTexts.delete(normalizedPath)
    await refreshFileIndexEntry(notesDir, nextPath)
    emitTreeChanged()
    const noteTree = noteTreeSnapshot()

    return {
      note: await readNote(notesDir, nextPath),
      notes: noteTree.notes,
      folders: noteTree.folders
    }
  }

  async function renameNote(notesDir: string, notePath: string, nextName: string): Promise<{ note: NotePayload; notes: NoteListItem[]; folders: FolderListItem[] }> {
    const normalizedPath = normalizeRelativePath(notePath)
    if (!normalizedPath) {
      throw new Error('笔记路径不能为空。')
    }

    const parentPath = parentFromPath(normalizedPath)
    const nextPath = await uniqueNotePath(notesDir, parentPath, nextName, normalizedPath)

    if (nextPath !== normalizedPath) {
      await rename(resolveInNotesDir(notesDir, normalizedPath), resolveInNotesDir(notesDir, nextPath))
    }

    await ensureNotesIndex(notesDir)
    if (nextPath !== normalizedPath) {
      state.notes.delete(normalizedPath)
      state.searchTexts.delete(normalizedPath)
    }
    await refreshFileIndexEntry(notesDir, nextPath)
    emitTreeChanged()
    const noteTree = noteTreeSnapshot()

    return {
      note: await readNote(notesDir, nextPath),
      notes: noteTree.notes,
      folders: noteTree.folders
    }
  }

  async function renameFolder(notesDir: string, folderPath: string, nextName: string): Promise<RenameFolderResult> {
    const normalizedPath = normalizeRelativePath(folderPath)
    if (!normalizedPath) {
      throw new Error('目录路径不能为空。')
    }

    const parentPath = parentFromPath(normalizedPath)
    const nextPath = await uniqueFolderPath(notesDir, parentPath, nextName)

    if (nextPath !== normalizedPath) {
      await rename(resolveInNotesDir(notesDir, normalizedPath), resolveInNotesDir(notesDir, nextPath))
    }

    await ensureNotesIndex(notesDir)
    if (nextPath !== normalizedPath) {
      removeFolderBranch(normalizedPath)
    }
    await refreshFolderBranch(notesDir, nextPath)
    rewireWatchers(notesDir)
    emitTreeChanged()
    const noteTree = noteTreeSnapshot()

    return {
      path: nextPath,
      notes: noteTree.notes,
      folders: noteTree.folders
    }
  }

  async function moveFolder(notesDir: string, folderPath: string, targetFolderPath: string | null): Promise<MoveFolderResult> {
    const normalizedPath = normalizeRelativePath(folderPath)
    if (!normalizedPath) {
      throw new Error('目录路径不能为空。')
    }

    const normalizedTargetFolderPath = normalizeRelativePath(targetFolderPath)
    if (normalizedTargetFolderPath === normalizedPath) {
      throw new Error('不能将目录移动到自身。')
    }

    if (normalizedTargetFolderPath?.startsWith(`${normalizedPath}/`)) {
      throw new Error('不能将目录移动到自身的子目录中。')
    }

    const currentParentPath = parentFromPath(normalizedPath)
    if (currentParentPath === normalizedTargetFolderPath) {
      const noteTree = await currentNotesTree(notesDir)
      return {
        path: normalizedPath,
        notes: noteTree.notes,
        folders: noteTree.folders
      }
    }

    if (normalizedTargetFolderPath) {
      await ensureDir(resolveInNotesDir(notesDir, normalizedTargetFolderPath))
    }

    const nextPath = await uniqueFolderPath(notesDir, normalizedTargetFolderPath, basename(normalizedPath))
    await rename(resolveInNotesDir(notesDir, normalizedPath), resolveInNotesDir(notesDir, nextPath))

    await ensureNotesIndex(notesDir)
    removeFolderBranch(normalizedPath)
    await refreshFolderBranch(notesDir, nextPath)
    rewireWatchers(notesDir)
    emitTreeChanged()
    const noteTree = noteTreeSnapshot()

    return {
      path: nextPath,
      notes: noteTree.notes,
      folders: noteTree.folders
    }
  }

  return {
    dispose: () => resetIndex(null),
    getSearchMode: () => searchMode,
    setSearchMode: (mode: NotesSearchMode) => {
      searchMode = mode
      if (!shouldCacheSearchText(mode)) {
        state.searchTexts.clear()
      }
    },
    getNotesDirOrThrow,
    currentNotesTree,
    searchNotes,
    readNote,
    saveNote,
    deleteNote,
    createFolder,
    deleteFolder,
    moveNote,
    moveFolder,
    renameNote,
    renameFolder
  }
}
