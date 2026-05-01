import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, parse, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, screen, Tray } from 'electron'
import {
  clampWindowBounds,
  computeDefaultWindowBounds,
  getWindowMinimumSize,
  normalizeStoredWindowBounds,
  type StoredWindowBounds,
  type WindowBounds,
  type WindowSizeMode
} from './window-bounds'

type StoredSettings = {
  notesDir: string | null
  windowBounds: StoredWindowBounds | null
  appearance: {
    mode: 'system' | 'dark' | 'light'
    theme: 'ember' | 'ocean' | 'forest'
    density: 'comfortable' | 'compact'
    transparentBackground: boolean
    backgroundColor: string | null
    backgroundOpacity: number | null
  }
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

type LegacyStoredSettings = Omit<StoredSettings, 'windowBounds'> & {
  windowBounds?: unknown
}

const NOTE_TITLE_MAX_LENGTH = 36
const DISPLAY_CHANGE_RESIZE_LOCK_MS = 1600

const defaultSettings: StoredSettings = {
  notesDir: null,
  windowBounds: null,
  appearance: {
    mode: 'system',
    theme: 'ember',
    density: 'comfortable',
    transparentBackground: true,
    backgroundColor: null,
    backgroundOpacity: null
  }
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let persistWindowBoundsTimer: NodeJS.Timeout | null = null
let displayChangeReapplyTimer: NodeJS.Timeout | null = null
let lastDisplayId: number | null = null
let displayChangeResizeLockUntil = 0
let currentWindowSizeMode: WindowSizeMode = 'expanded'
const currentDir = dirname(fileURLToPath(import.meta.url))
const appIconPath = join(currentDir, '../../resources/icon.png')
const trayTemplateIconPath = join(currentDir, '../../resources/trayTemplate.png')
const trayTemplateIcon2xPath = join(currentDir, '../../resources/trayTemplate@2x.png')

function currentSystemAppearance(): 'dark' | 'light' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function restoreWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createWindow()
    return
  }

  if (process.platform === 'darwin') {
    app.focus({ steal: true })
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.moveTop()
  mainWindow.focus()
}

function clearPersistWindowBoundsTimer(): void {
  if (!persistWindowBoundsTimer) {
    return
  }

  clearTimeout(persistWindowBoundsTimer)
  persistWindowBoundsTimer = null
}

function clearDisplayChangeReapplyTimer(): void {
  if (!displayChangeReapplyTimer) {
    return
  }

  clearTimeout(displayChangeReapplyTimer)
  displayChangeReapplyTimer = null
}

async function persistWindowBounds(bounds: Electron.Rectangle, mode: WindowSizeMode = currentWindowSizeMode): Promise<void> {
  const current = await readSettings()
  const nextWindowBounds: StoredWindowBounds = {
    expanded: current.windowBounds?.expanded ?? null,
    collapsed: current.windowBounds?.collapsed ?? null
  }
  nextWindowBounds[mode] = {
    width: bounds.width,
    height: bounds.height
  }

  await writeSettings({
    ...current,
    windowBounds: nextWindowBounds
  })
}

function schedulePersistWindowBounds(bounds: Electron.Rectangle, mode: WindowSizeMode = currentWindowSizeMode): void {
  clearPersistWindowBoundsTimer()
  persistWindowBoundsTimer = setTimeout(() => {
    persistWindowBoundsTimer = null
    void persistWindowBounds(bounds, mode)
  }, 180)
}

function displayForBounds(bounds?: Electron.Rectangle): Electron.Display {
  if (bounds) {
    return screen.getDisplayMatching(bounds)
  }

  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

function currentWorkArea(bounds?: Electron.Rectangle): Electron.Rectangle {
  return displayForBounds(bounds).workArea
}

function shouldBlockDisplayChangeResize(currentBounds: Electron.Rectangle, nextBounds: Electron.Rectangle): boolean {
  if (Date.now() > displayChangeResizeLockUntil) {
    return false
  }

  return currentBounds.width !== nextBounds.width || currentBounds.height !== nextBounds.height
}

async function applyWindowSizeMode(mode: WindowSizeMode): Promise<WindowBounds> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const workArea = currentWorkArea()
    return computeDefaultWindowBounds(workArea, mode)
  }

  currentWindowSizeMode = mode
  const currentBounds = mainWindow.getBounds()
  const workArea = currentWorkArea(currentBounds)
  const settings = await readSettings()
  const targetBounds = settings.windowBounds?.[mode] ?? computeDefaultWindowBounds(workArea, mode)
  const nextBounds = clampWindowBounds(targetBounds, workArea, mode)
  const minimumSize = getWindowMinimumSize(mode)

  mainWindow.setMinimumSize(minimumSize.width, minimumSize.height)
  mainWindow.setBounds({
    ...currentBounds,
    width: nextBounds.width,
    height: nextBounds.height
  })
  schedulePersistWindowBounds({
    ...currentBounds,
    width: nextBounds.width,
    height: nextBounds.height
  }, mode)

  return nextBounds
}

function scheduleDisplayChangeModeReapply(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  clearDisplayChangeReapplyTimer()
  const mode = currentWindowSizeMode
  displayChangeReapplyTimer = setTimeout(() => {
    displayChangeReapplyTimer = null
    void applyWindowSizeMode(mode)
  }, 420)
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

async function createWindow(): Promise<void> {
  const settings = await readSettings()
  const workArea = currentWorkArea()
  currentWindowSizeMode = 'expanded'
  const preferredExpandedBounds = settings.windowBounds?.expanded ?? computeDefaultWindowBounds(workArea, 'expanded')
  const preferredSize = clampWindowBounds(preferredExpandedBounds, workArea, 'expanded')
  const initialX = workArea.x + Math.round((workArea.width - preferredSize.width) / 2)
  const initialY = workArea.y + Math.round((workArea.height - preferredSize.height) / 2)
  const minimumSize = getWindowMinimumSize('expanded')

  mainWindow = new BrowserWindow({
    width: preferredSize.width,
    height: preferredSize.height,
    x: initialX,
    y: initialY,
    minWidth: minimumSize.width,
    minHeight: minimumSize.height,
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

  lastDisplayId = displayForBounds(mainWindow.getBounds()).id

  mainWindow.on('will-resize', (_event, newBounds) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    const currentBounds = mainWindow.getBounds()
    if (shouldBlockDisplayChangeResize(currentBounds, newBounds)) {
      _event.preventDefault()
      return
    }
    schedulePersistWindowBounds(newBounds, currentWindowSizeMode)
  })

  mainWindow.on('move', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    const displayId = displayForBounds(mainWindow.getBounds()).id
    if (displayId === lastDisplayId) {
      return
    }

    lastDisplayId = displayId
    displayChangeResizeLockUntil = Date.now() + DISPLAY_CHANGE_RESIZE_LOCK_MS
    scheduleDisplayChangeModeReapply()
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

function normalizeHexColor(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!/^#([\da-fA-F]{3}|[\da-fA-F]{6})$/.test(normalized)) {
    return null
  }

  if (normalized.length === 4) {
    return `#${normalized
      .slice(1)
      .split('')
      .map((digit) => `${digit}${digit}`)
      .join('')
      .toLowerCase()}`
  }

  return normalized.toLowerCase()
}

function normalizeBackgroundOpacity(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, Math.round(value)))
}

async function readSettings(): Promise<StoredSettings> {
  try {
    const content = await readFile(settingsPath(), 'utf8')
    const parsed = JSON.parse(content) as Partial<LegacyStoredSettings>
    const parsedAppearance = {
      ...defaultSettings.appearance,
      ...(parsed.appearance ?? {})
    }

    return {
      notesDir: parsed.notesDir ?? defaultSettings.notesDir,
      windowBounds: normalizeStoredWindowBounds(parsed.windowBounds),
      appearance: {
        ...parsedAppearance,
        backgroundColor: normalizeHexColor(parsedAppearance.backgroundColor),
        backgroundOpacity: normalizeBackgroundOpacity(parsedAppearance.backgroundOpacity)
      }
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
  void createWindow()

  nativeTheme.on('updated', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    mainWindow.webContents.send('system-appearance:changed', currentSystemAppearance())
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
      return
    }

    restoreWindow()
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
    folders: noteTree.folders,
    appearance: settings.appearance
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
  await writeSettings({ ...current, notesDir })
  const noteTree = await listNotesTree(notesDir)

  return {
    notesDir,
    notes: noteTree.notes,
    folders: noteTree.folders,
    appearance: current.appearance ?? defaultSettings.appearance
  }
})

ipcMain.handle('settings:update-appearance', async (_event, appearance: StoredSettings['appearance']) => {
  const current = await readSettings()
  const nextAppearance = {
    mode: appearance.mode ?? current.appearance.mode,
    theme: appearance.theme ?? current.appearance.theme,
    density: appearance.density ?? current.appearance.density,
    transparentBackground: appearance.transparentBackground ?? current.appearance.transparentBackground,
    backgroundColor:
      appearance.backgroundColor === undefined ? current.appearance.backgroundColor : normalizeHexColor(appearance.backgroundColor),
    backgroundOpacity:
      appearance.backgroundOpacity === undefined
        ? current.appearance.backgroundOpacity
        : normalizeBackgroundOpacity(appearance.backgroundOpacity)
  }

  await writeSettings({
    ...current,
    appearance: nextAppearance
  })

  return nextAppearance
})

ipcMain.handle('system:get-appearance', async () => currentSystemAppearance())

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
    const workArea = currentWorkArea()
    return computeDefaultWindowBounds(workArea, collapsed ? 'collapsed' : 'expanded')
  }

  clearDisplayChangeReapplyTimer()
  await persistWindowBounds(mainWindow.getBounds(), currentWindowSizeMode)
  return applyWindowSizeMode(collapsed ? 'collapsed' : 'expanded')
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
