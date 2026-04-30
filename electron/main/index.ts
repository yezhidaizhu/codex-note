import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, parse, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, Tray } from 'electron'

type StoredSettings = {
  notesDir: string | null
}

type NoteListItem = {
  path: string
  name: string
  parentPath: string | null
  title: string
  preview: string
  updatedAt: string
  size: number
}

type FolderListItem = {
  path: string
  name: string
  parentPath: string | null
}

type NotePayload = {
  path: string
  name: string
  parentPath: string | null
  title: string
  content: string
  updatedAt: string
}

type NoteTreeResult = {
  notes: NoteListItem[]
  folders: FolderListItem[]
}

type RenameFolderResult = {
  path: string
  notes: NoteListItem[]
  folders: FolderListItem[]
}

type MoveFolderResult = {
  path: string
  notes: NoteListItem[]
  folders: FolderListItem[]
}

const NOTE_TITLE_MAX_LENGTH = 36
const EXPANDED_MIN_WIDTH = 600
const COLLAPSED_MIN_WIDTH = 300
const DEFAULT_COLLAPSED_WIDTH = 380

const defaultSettings: StoredSettings = {
  notesDir: null
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let sidebarCollapsed = false
let expandedSize = { width: 1400, height: 920 }
let collapsedSize = { width: DEFAULT_COLLAPSED_WIDTH, height: 920 }
const currentDir = dirname(fileURLToPath(import.meta.url))
const appIconPath = join(currentDir, '../../resources/icon.png')
const trayTemplateIconPath = join(currentDir, '../../resources/trayTemplate.png')
const trayTemplateIcon2xPath = join(currentDir, '../../resources/trayTemplate@2x.png')

function restoreWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.focus()
}

function createTray(): void {
  if (tray) {
    return
  }

  const trayIcon = process.platform === 'darwin' ? nativeImage.createFromPath(trayTemplateIconPath) : nativeImage.createFromPath(appIconPath)

  if (process.platform === 'darwin') {
    const trayIcon2x = nativeImage.createFromPath(trayTemplateIcon2xPath)
    if (!trayIcon2x.isEmpty()) {
      trayIcon.addRepresentation({
        scaleFactor: 2,
        width: trayIcon2x.getSize().width,
        height: trayIcon2x.getSize().height,
        buffer: trayIcon2x.toPNG()
      })
    }
    trayIcon.setTemplateImage(true)
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Coco Note')

  const trayMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => restoreWindow()
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.on('click', () => restoreWindow())
  tray.on('right-click', () => tray?.popUpContextMenu(trayMenu))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: EXPANDED_MIN_WIDTH,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hidden',
    transparent: true,
    backgroundColor: '#00000000',
    vibrancy: nativeTheme.prefersReducedTransparency ? undefined : 'under-window',
    visualEffectState: nativeTheme.prefersReducedTransparency ? undefined : 'active',
    icon: appIconPath,
    webPreferences: {
      preload: join(currentDir, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  const [initialWidth, initialHeight] = mainWindow.getSize()
  expandedSize = {
    width: Math.max(initialWidth, EXPANDED_MIN_WIDTH),
    height: Math.max(initialHeight, 200)
  }
  collapsedSize = {
    width: Math.max(COLLAPSED_MIN_WIDTH, Math.min(DEFAULT_COLLAPSED_WIDTH, expandedSize.width)),
    height: expandedSize.height
  }

  mainWindow.on('will-resize', (_event, newBounds) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    if (sidebarCollapsed) {
      collapsedSize = {
        width: Math.max(newBounds.width, COLLAPSED_MIN_WIDTH),
        height: newBounds.height
      }
      return
    }

    expandedSize = {
      width: Math.max(newBounds.width, EXPANDED_MIN_WIDTH),
      height: newBounds.height
    }
  })

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    if (!nativeTheme.prefersReducedTransparency) {
      mainWindow.setVibrancy('under-window')
    }

    mainWindow.show()
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return
    }

    event.preventDefault()
    mainWindow?.hide()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(join(currentDir, '../../dist/index.html'))
  }
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

async function readSettings(): Promise<StoredSettings> {
  try {
    const content = await readFile(settingsPath(), 'utf8')
    const parsed = JSON.parse(content) as Partial<StoredSettings>
    return {
      ...defaultSettings,
      ...parsed
    }
  } catch {
    return defaultSettings
  }
}

async function writeSettings(nextSettings: StoredSettings): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(settingsPath(), JSON.stringify(nextSettings, null, 2), 'utf8')
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
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

function previewFromContent(content: string): string {
  return content
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 120)
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
  const settings = await readSettings()
  if (!settings.notesDir) {
    throw new Error('未设置笔记目录。')
  }
  await ensureDir(settings.notesDir)
  return settings.notesDir
}

async function listNotesTree(notesDir: string): Promise<NoteTreeResult> {
  await ensureDir(notesDir)
  const notes: NoteListItem[] = []
  const folders: FolderListItem[] = []

  async function walk(currentDir: string, parentPath: string | null): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))

    for (const entry of entries) {
      const entryAbsolutePath = join(currentDir, entry.name)
      const entryRelativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        folders.push({
          path: entryRelativePath,
          name: entry.name,
          parentPath
        })
        await walk(entryAbsolutePath, entryRelativePath)
        continue
      }

      if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.md') continue

      const [content, fileStat] = await Promise.all([readFile(entryAbsolutePath, 'utf8'), stat(entryAbsolutePath)])
      const firstNonEmptyLine =
        content
          .replace(/\r/g, '')
          .split('\n')
          .map((line) => line.trim())
          .find(Boolean) ?? parse(entry.name).name

      notes.push({
        path: entryRelativePath,
        name: entry.name,
        parentPath,
        title: normalizeTitle(firstNonEmptyLine),
        preview: previewFromContent(content),
        updatedAt: fileStat.mtime.toISOString(),
        size: fileStat.size
      })
    }
  }

  await walk(notesDir, null)

  notes.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  folders.sort((left, right) => left.path.localeCompare(right.path, 'zh-Hans-CN'))

  return { notes, folders }
}

async function readNote(notesDir: string, notePath: string): Promise<NotePayload> {
  const normalizedPath = normalizeRelativePath(notePath)
  if (!normalizedPath) {
    throw new Error('笔记路径不能为空。')
  }

  const filePath = resolveInNotesDir(notesDir, normalizedPath)
  const [content, fileStat] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)])
  const firstLine = content
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  return {
    path: normalizedPath,
    name: basename(filePath),
    parentPath: parentFromPath(normalizedPath),
    title: normalizeTitle(firstLine ?? parse(normalizedPath).name),
    content,
    updatedAt: fileStat.mtime.toISOString()
  }
}

async function renameNoteInPlace(notesDir: string, notePath: string, nextName: string) {
  const normalizedPath = normalizeRelativePath(notePath)
  if (!normalizedPath) {
    throw new Error('笔记路径不能为空。')
  }

  const parentPath = parentFromPath(normalizedPath)
  const nextPath = await uniqueNotePath(notesDir, parentPath, nextName, normalizedPath)

  if (nextPath !== normalizedPath) {
    await rename(resolveInNotesDir(notesDir, normalizedPath), resolveInNotesDir(notesDir, nextPath))
  }

  const noteTree = await listNotesTree(notesDir)
  return {
    note: await readNote(notesDir, nextPath),
    notes: noteTree.notes,
    folders: noteTree.folders
  }
}

async function renameFolderInPlace(notesDir: string, folderPath: string, nextName: string): Promise<RenameFolderResult> {
  const normalizedPath = normalizeRelativePath(folderPath)
  if (!normalizedPath) {
    throw new Error('目录路径不能为空。')
  }

  const parentPath = parentFromPath(normalizedPath)
  const nextPath = await uniqueFolderPath(notesDir, parentPath, nextName)

  if (nextPath !== normalizedPath) {
    await rename(resolveInNotesDir(notesDir, normalizedPath), resolveInNotesDir(notesDir, nextPath))
  }

  const noteTree = await listNotesTree(notesDir)
  return {
    path: nextPath,
    notes: noteTree.notes,
    folders: noteTree.folders
  }
}

async function moveFolderInPlace(notesDir: string, folderPath: string, targetFolderPath: string | null): Promise<MoveFolderResult> {
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
    const noteTree = await listNotesTree(notesDir)
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

  const noteTree = await listNotesTree(notesDir)
  return {
    path: nextPath,
    notes: noteTree.notes,
    folders: noteTree.folders
  }
}

app.whenReady().then(() => {
  app.on('before-quit', () => {
    isQuitting = true
  })

  if (process.platform === 'darwin') {
    if (process.env.VITE_DEV_SERVER_URL) {
      const dockIcon = nativeImage.createFromPath(appIconPath)
      if (!dockIcon.isEmpty()) {
        app.dock?.setIcon(dockIcon)
      }
    }
    app.dock?.hide()
  }

  createTray()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})

ipcMain.handle('settings:get', async () => {
  const settings = await readSettings()
  if (settings.notesDir) {
    await ensureDir(settings.notesDir)
  }

  const noteTree = settings.notesDir ? await listNotesTree(settings.notesDir) : { notes: [], folders: [] }

  return {
    ...settings,
    notes: noteTree.notes,
    folders: noteTree.folders
  }
})

ipcMain.handle('notes:choose-directory', async () => {
  const current = await readSettings()
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择 Markdown 笔记保存目录',
    defaultPath: current.notesDir ?? app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const notesDir = result.filePaths[0]
  await ensureDir(notesDir)
  await writeSettings({ notesDir })
  const noteTree = await listNotesTree(notesDir)

  return {
    notesDir,
    notes: noteTree.notes,
    folders: noteTree.folders
  }
})

ipcMain.handle('notes:list', async () => {
  const notesDir = await getNotesDirOrThrow()
  return listNotesTree(notesDir)
})

ipcMain.handle('notes:read', async (_event, notePath: string) => {
  const notesDir = await getNotesDirOrThrow()
  return readNote(notesDir, notePath)
})

ipcMain.handle(
  'notes:save',
  async (_event, payload: { currentPath?: string | null; parentPath: string | null; title: string; content: string }) => {
    const notesDir = await getNotesDirOrThrow()
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

    const noteTree = await listNotesTree(notesDir)

    return {
      note: await readNote(notesDir, nextPath),
      notes: noteTree.notes,
      folders: noteTree.folders
    }
  }
)

ipcMain.handle('notes:delete', async (_event, notePath: string) => {
  const notesDir = await getNotesDirOrThrow()
  const normalizedPath = normalizeRelativePath(notePath)
  if (!normalizedPath) {
    throw new Error('笔记路径不能为空。')
  }

  await rm(resolveInNotesDir(notesDir, normalizedPath), { force: true })
  return listNotesTree(notesDir)
})

ipcMain.handle('notes:create-folder', async (_event, parentPath: string | null, name: string) => {
  const notesDir = await getNotesDirOrThrow()
  const normalizedParentPath = normalizeRelativePath(parentPath)
  if (normalizedParentPath) {
    await ensureDir(resolveInNotesDir(notesDir, normalizedParentPath))
  }

  const folderPath = await uniqueFolderPath(notesDir, normalizedParentPath, name)
  await ensureDir(resolveInNotesDir(notesDir, folderPath))
  return listNotesTree(notesDir)
})

ipcMain.handle('notes:delete-folder', async (_event, folderPath: string) => {
  const notesDir = await getNotesDirOrThrow()
  const normalizedPath = normalizeRelativePath(folderPath)
  if (!normalizedPath) {
    throw new Error('目录路径不能为空。')
  }

  await rm(resolveInNotesDir(notesDir, normalizedPath), { recursive: true, force: true })
  return listNotesTree(notesDir)
})

ipcMain.handle('notes:move', async (_event, notePath: string, targetFolderPath: string | null) => {
  const notesDir = await getNotesDirOrThrow()
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
    const noteTree = await listNotesTree(notesDir)
    return {
      note: await readNote(notesDir, normalizedPath),
      notes: noteTree.notes,
      folders: noteTree.folders
    }
  }

  const nextPath = await uniqueNotePath(notesDir, normalizedTargetFolderPath, basename(normalizedPath))
  await rename(resolveInNotesDir(notesDir, normalizedPath), resolveInNotesDir(notesDir, nextPath))
  const noteTree = await listNotesTree(notesDir)

  return {
    note: await readNote(notesDir, nextPath),
    notes: noteTree.notes,
    folders: noteTree.folders
  }
})

ipcMain.handle('notes:move-folder', async (_event, folderPath: string, targetFolderPath: string | null) => {
  const notesDir = await getNotesDirOrThrow()
  return moveFolderInPlace(notesDir, folderPath, targetFolderPath)
})

ipcMain.handle('notes:rename-note', async (_event, notePath: string, name: string) => {
  const notesDir = await getNotesDirOrThrow()
  return renameNoteInPlace(notesDir, notePath, name)
})

ipcMain.handle('notes:rename-folder', async (_event, folderPath: string, name: string) => {
  const notesDir = await getNotesDirOrThrow()
  return renameFolderInPlace(notesDir, folderPath, name)
})

ipcMain.handle('window:set-sidebar-collapsed', async (_event, collapsed: boolean) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  const [currentWidth, currentHeight] = mainWindow.getSize()

  if (collapsed) {
    expandedSize = {
      width: Math.max(currentWidth, EXPANDED_MIN_WIDTH),
      height: currentHeight
    }
    sidebarCollapsed = true

    mainWindow.setMinimumSize(COLLAPSED_MIN_WIDTH, 200)
    mainWindow.setSize(Math.max(collapsedSize.width, COLLAPSED_MIN_WIDTH), collapsedSize.height)

    return
  }

  collapsedSize = {
    width: Math.max(currentWidth, COLLAPSED_MIN_WIDTH),
    height: currentHeight
  }
  sidebarCollapsed = false
  mainWindow.setMinimumSize(EXPANDED_MIN_WIDTH, 200)
  mainWindow.setSize(Math.max(expandedSize.width, EXPANDED_MIN_WIDTH), expandedSize.height)
})

ipcMain.handle('window:get-state', async () => {
  return {
    isAlwaysOnTop: mainWindow?.isAlwaysOnTop() ?? false
  }
})

ipcMain.handle('window:set-always-on-top', async (_event, pinned: boolean) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return {
      isAlwaysOnTop: false
    }
  }

  mainWindow.setAlwaysOnTop(pinned, 'floating')

  return {
    isAlwaysOnTop: mainWindow.isAlwaysOnTop()
  }
})
