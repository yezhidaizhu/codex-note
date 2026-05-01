import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, parse, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, screen, Tray } from 'electron'

type StoredSettings = {
  notesDir: string | null
  windowBounds: {
    width: number
    height: number
  } | null
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

const NOTE_TITLE_MAX_LENGTH = 36
const EXPANDED_MIN_WIDTH = 600
const EXPANDED_MIN_HEIGHT = 600
const COLLAPSED_MIN_WIDTH = 300
const DEFAULT_COLLAPSED_WIDTH = 480
const DEFAULT_WINDOW_WIDTH = 960
const DEFAULT_WINDOW_HEIGHT = 760
const WINDOW_EDGE_SNAP_THRESHOLD = 24
const MIN_VISIBLE_HEADER_HEIGHT = 88

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
let sidebarCollapsed = false
let expandedSize = { width: DEFAULT_WINDOW_WIDTH, height: DEFAULT_WINDOW_HEIGHT }
let collapsedSize = { width: DEFAULT_COLLAPSED_WIDTH, height: DEFAULT_WINDOW_HEIGHT }
let persistWindowBoundsTimer: NodeJS.Timeout | null = null
let moveStabilizeTimer: NodeJS.Timeout | null = null
let correctingDisplayTransition = false
let lastDisplayId: number | null = null
const currentDir = dirname(fileURLToPath(import.meta.url))
const appIconPath = join(currentDir, '../../resources/icon.png')
const trayTemplateIconPath = join(currentDir, '../../resources/trayTemplate.png')
const trayTemplateIcon2xPath = join(currentDir, '../../resources/trayTemplate@2x.png')

function currentSystemAppearance(): 'dark' | 'light' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function computeVisibleBounds(nextWidth: number, nextHeight: number): Electron.Rectangle | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null
  }

  const currentBounds = mainWindow.getBounds()
  const display = screen.getDisplayMatching(currentBounds)
  const workArea = display.workArea
  const workAreaRight = workArea.x + workArea.width
  const workAreaBottom = workArea.y + workArea.height
  const currentRight = currentBounds.x + currentBounds.width
  const currentBottom = currentBounds.y + currentBounds.height

  let nextX = currentBounds.x
  let nextY = currentBounds.y

  const pinnedLeft = Math.abs(currentBounds.x - workArea.x) <= WINDOW_EDGE_SNAP_THRESHOLD
  const pinnedRight = Math.abs(workAreaRight - currentRight) <= WINDOW_EDGE_SNAP_THRESHOLD
  const pinnedTop = Math.abs(currentBounds.y - workArea.y) <= WINDOW_EDGE_SNAP_THRESHOLD
  const pinnedBottom = Math.abs(workAreaBottom - currentBottom) <= WINDOW_EDGE_SNAP_THRESHOLD

  if (pinnedRight && !pinnedLeft) {
    nextX = currentRight - nextWidth
  }

  if (pinnedBottom && !pinnedTop) {
    nextY = currentBottom - nextHeight
  }

  nextX = clamp(nextX, workArea.x, Math.max(workArea.x, workAreaRight - nextWidth))
  nextY = clamp(nextY, workArea.y, Math.max(workArea.y, workAreaBottom - MIN_VISIBLE_HEADER_HEIGHT))

  return {
    x: nextX,
    y: nextY,
    width: nextWidth,
    height: nextHeight
  }
}

function resizeWindowWithinVisibleArea(nextWidth: number, nextHeight: number): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  const nextBounds = computeVisibleBounds(nextWidth, nextHeight)
  if (!nextBounds) {
    return
  }

  mainWindow.setBounds(nextBounds)
}

function clampWindowWidth(width: number, workAreaWidth: number): number {
  return clamp(width, EXPANDED_MIN_WIDTH, Math.max(EXPANDED_MIN_WIDTH, workAreaWidth))
}

function clampWindowHeight(height: number, workAreaHeight: number): number {
  return clamp(height, EXPANDED_MIN_HEIGHT, Math.max(EXPANDED_MIN_HEIGHT, workAreaHeight))
}

function computeDefaultWindowSize(workArea: Electron.Rectangle) {
  const allDisplays = screen.getAllDisplays()
  const smallestWorkArea = allDisplays.reduce(
    (smallest, display) => ({
      width: Math.min(smallest.width, display.workArea.width),
      height: Math.min(smallest.height, display.workArea.height)
    }),
    {
      width: workArea.width,
      height: workArea.height
    }
  )

  return {
    width: clampWindowWidth(Math.min(DEFAULT_WINDOW_WIDTH, Math.round(smallestWorkArea.width * 0.78)), workArea.width),
    height: clampWindowHeight(Math.min(DEFAULT_WINDOW_HEIGHT, Math.round(smallestWorkArea.height * 0.82)), workArea.height)
  }
}

async function persistWindowBounds(width: number, height: number): Promise<void> {
  const current = await readSettings()
  await writeSettings({
    ...current,
    windowBounds: {
      width: Math.max(width, EXPANDED_MIN_WIDTH),
      height: Math.max(height, EXPANDED_MIN_HEIGHT)
    }
  })
}

function schedulePersistWindowBounds(width: number, height: number): void {
  if (persistWindowBoundsTimer) {
    clearTimeout(persistWindowBoundsTimer)
  }

  persistWindowBoundsTimer = setTimeout(() => {
    persistWindowBoundsTimer = null
    void persistWindowBounds(width, height)
  }, 180)
}

function desiredWindowSizeForDisplay(display: Electron.Display) {
  if (sidebarCollapsed) {
    return {
      width: clamp(Math.max(collapsedSize.width, COLLAPSED_MIN_WIDTH), COLLAPSED_MIN_WIDTH, Math.max(COLLAPSED_MIN_WIDTH, display.workArea.width)),
      height: clamp(Math.max(collapsedSize.height, EXPANDED_MIN_HEIGHT), EXPANDED_MIN_HEIGHT, Math.max(EXPANDED_MIN_HEIGHT, display.workArea.height))
    }
  }

  return {
    width: clampWindowWidth(expandedSize.width, display.workArea.width),
    height: clampWindowHeight(expandedSize.height, display.workArea.height)
  }
}

function scheduleDisplayTransitionCorrection(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  if (moveStabilizeTimer) {
    clearTimeout(moveStabilizeTimer)
  }

  moveStabilizeTimer = setTimeout(() => {
    moveStabilizeTimer = null

    if (!mainWindow || mainWindow.isDestroyed() || correctingDisplayTransition) {
      return
    }

    const display = screen.getDisplayMatching(mainWindow.getBounds())
    if (lastDisplayId === display.id) {
      return
    }

    lastDisplayId = display.id
    const desiredSize = desiredWindowSizeForDisplay(display)
    const [currentWidth, currentHeight] = mainWindow.getSize()
    if (currentWidth === desiredSize.width && currentHeight === desiredSize.height) {
      return
    }

    correctingDisplayTransition = true
    resizeWindowWithinVisibleArea(desiredSize.width, desiredSize.height)
    setTimeout(() => {
      correctingDisplayTransition = false
    }, 0)
  }, 120)
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
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const workArea = display.workArea
  const preferredSize = settings.windowBounds
    ? {
        width: clampWindowWidth(settings.windowBounds.width, workArea.width),
        height: clampWindowHeight(settings.windowBounds.height, workArea.height)
      }
    : computeDefaultWindowSize(workArea)
  const initialX = workArea.x + Math.round((workArea.width - preferredSize.width) / 2)
  const initialY = workArea.y + Math.round((workArea.height - preferredSize.height) / 2)

  mainWindow = new BrowserWindow({
    width: preferredSize.width,
    height: preferredSize.height,
    x: initialX,
    y: initialY,
    minWidth: EXPANDED_MIN_WIDTH,
    minHeight: EXPANDED_MIN_HEIGHT,
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
    height: Math.max(initialHeight, EXPANDED_MIN_HEIGHT)
  }
  collapsedSize = {
    width: Math.max(COLLAPSED_MIN_WIDTH, Math.min(DEFAULT_COLLAPSED_WIDTH, expandedSize.width)),
    height: expandedSize.height
  }
  lastDisplayId = display.id

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
    schedulePersistWindowBounds(expandedSize.width, expandedSize.height)
  })

  mainWindow.on('move', () => {
    scheduleDisplayTransitionCorrection()
  })

  mainWindow.on('moved', () => {
    scheduleDisplayTransitionCorrection()
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
    const parsed = JSON.parse(content) as Partial<StoredSettings>
    const parsedAppearance = {
      ...defaultSettings.appearance,
      ...(parsed.appearance ?? {})
    }

    return {
      notesDir: parsed.notesDir ?? defaultSettings.notesDir,
      windowBounds: parsed.windowBounds ?? defaultSettings.windowBounds,
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
    return
  }

  const [currentWidth, currentHeight] = mainWindow.getSize()

  if (collapsed) {
    expandedSize = {
      width: Math.max(currentWidth, EXPANDED_MIN_WIDTH),
      height: currentHeight
    }
    sidebarCollapsed = true

    mainWindow.setMinimumSize(COLLAPSED_MIN_WIDTH, EXPANDED_MIN_HEIGHT)
    resizeWindowWithinVisibleArea(Math.max(collapsedSize.width, COLLAPSED_MIN_WIDTH), collapsedSize.height)

    return
  }

  collapsedSize = {
    width: Math.max(currentWidth, COLLAPSED_MIN_WIDTH),
    height: currentHeight
  }
  sidebarCollapsed = false
  mainWindow.setMinimumSize(EXPANDED_MIN_WIDTH, EXPANDED_MIN_HEIGHT)
  resizeWindowWithinVisibleArea(Math.max(expandedSize.width, EXPANDED_MIN_WIDTH), expandedSize.height)
  schedulePersistWindowBounds(Math.max(expandedSize.width, EXPANDED_MIN_WIDTH), expandedSize.height)
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
