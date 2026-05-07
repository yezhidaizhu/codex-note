import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { app, BrowserWindow, clipboard, dialog, globalShortcut, Menu, nativeImage, nativeTheme, net, protocol, screen, Tray } from 'electron'
import { MAIN_CONFIG } from './config'
import {
  clampWindowFrameToWorkArea,
  clampWindowBounds,
  computeDefaultWindowBounds,
  getWindowMinimumSize,
  type StoredWindowBounds,
  type WindowBounds,
  type WindowSizeMode
} from './window'
import { createWorkspaceFileService } from './file/service'
import { createGitService } from './git/service'
import { registerIpcHandlers } from './ipc'
import { createNotesService } from './notes'
import {
  readSettings,
  sanitizeGitAutoCommitEnabled,
  sanitizeGitAutoCommitIntervalMinutes,
  sanitizeBackgroundColor,
  sanitizeBackgroundOpacity,
  sanitizeEditorEnabledFeatures,
  sanitizeEditorImageDirectory,
  sanitizePinnedNotePaths,
  sanitizeQuickCreateCenterWindowOnTrigger,
  sanitizeQuickCreateDirectory,
  sanitizeQuickCreateHideWindowOnTriggerWhenFocused,
  sanitizeQuickCreateMode,
  sanitizeQuickCreateNamingRule,
  sanitizeQuickCreateTargetPath,
  sanitizeQuickCreateWriteClipboardOnCreate,
  writeSettings,
} from './settings/store'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let persistWindowBoundsTimer: NodeJS.Timeout | null = null
let displayChangeReapplyTimer: NodeJS.Timeout | null = null
let lastDisplayId: number | null = null
let displayChangeResizeLockUntil = 0
let currentWindowSizeMode: WindowSizeMode = 'expanded'
let autoCommitTimer: NodeJS.Timeout | null = null
let autoCommitSequence = 0
let nextAutoCommitAt: string | null = null
const currentDir = dirname(fileURLToPath(import.meta.url))
const appIconPath = join(currentDir, '../../resources/icon.png')
const trayTemplateIconPath = join(currentDir, '../../resources/trayTemplate.png')
const trayTemplateIcon2xPath = join(currentDir, '../../resources/trayTemplate@2x.png')
const NOTE_ASSET_SCHEME = 'note-asset'
const AUTO_COMMIT_MESSAGE = 'notes: auto commit'
const MANUAL_COMMIT_MESSAGE = 'notes: manual commit'
const notesService = createNotesService({
  getNotesDirSetting: async () => (await readSettings()).notesDir,
  defaultSearchMode: MAIN_CONFIG.search.defaultMode,
  onTreeChanged: (tree) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    mainWindow.webContents.send('notes:tree-changed', tree)
  }
})
const gitService = createGitService()
const workspaceFileService = createWorkspaceFileService()

protocol.registerSchemesAsPrivileged([
  {
    scheme: NOTE_ASSET_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

function buildNoteAssetPreviewUrl(path: string): string {
  return `${NOTE_ASSET_SCHEME}://local/?path=${encodeURIComponent(path)}`
}

function isPathInsideRoot(rootPath: string, targetPath: string): boolean {
  const relativePath = relative(resolve(rootPath), resolve(targetPath))
  return relativePath !== '..' && !isAbsolute(relativePath) && !relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
}

function registerNoteAssetProtocol(): void {
  protocol.handle(NOTE_ASSET_SCHEME, async (request) => {
    try {
      const requestedPath = new URL(request.url).searchParams.get('path')?.trim()
      if (!requestedPath) {
        return new Response('Missing asset path.', { status: 400 })
      }

      const notesDir = await notesService.getNotesDirOrThrow()
      if (!isPathInsideRoot(notesDir, requestedPath)) {
        return new Response('Forbidden.', { status: 403 })
      }

      return net.fetch(pathToFileURL(resolve(requestedPath)).toString())
    } catch {
      return new Response('Not found.', { status: 404 })
    }
  })
}

function currentSystemAppearance(): 'dark' | 'light' {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function centerMainWindowOnActiveDisplay(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  const currentBounds = mainWindow.getBounds()
  const workArea = currentWorkArea()
  const centeredBounds = {
    ...currentBounds,
    x: workArea.x + Math.round((workArea.width - currentBounds.width) / 2),
    y: workArea.y + Math.round((workArea.height - currentBounds.height) / 2)
  }

  mainWindow.setBounds(centeredBounds)
  lastDisplayId = displayForBounds(centeredBounds).id
}

function restoreWindow(options: { center?: boolean } = {}): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createWindow().then(() => restoreWindow(options))
    return
  }

  if (process.platform === 'darwin') {
    app.focus({ steal: true })
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  if (options.center) {
    centerMainWindowOnActiveDisplay()
  }

  mainWindow.show()
  mainWindow.moveTop()
  mainWindow.focus()
}

function toggleMainWindow(options: { center?: boolean } = {}): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    restoreWindow(options)
    return
  }

  const isVisible = mainWindow.isVisible() && !mainWindow.isMinimized()
  if (isVisible) {
    mainWindow.hide()
    return
  }

  restoreWindow(options)
}

function resolveQuickCreateParentPath(directory: string): string | null {
  const normalizedSegments = directory
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.')

  if (normalizedSegments.some((segment) => segment === '..')) {
    throw new Error('快速创建目录非法。')
  }

  return normalizedSegments.length > 0 ? normalizedSegments.join('/') : null
}

function resolveQuickCreateTargetPath(pathValue: string): string {
  const normalizedSegments = pathValue
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.')

  if (normalizedSegments.some((segment) => segment === '..')) {
    throw new Error('快速打开路径非法。')
  }

  if (normalizedSegments.length === 0) {
    throw new Error('请先设置要快速打开的 Markdown 文件路径。')
  }

  const targetPath = normalizedSegments.join('/')
  return targetPath.toLowerCase().endsWith('.md') ? targetPath : `${targetPath}.md`
}

function buildQuickCreateNameSeed(options: {
  clipboardContent: string
  writeClipboardOnCreate: boolean
  namingRule: 'default' | 'datetime'
}): string | null {
  if (options.namingRule !== 'datetime') {
    return null
  }

  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function emitQuickCreateTriggered(payload: { action: 'create'; parentPath: string | null; initialContent: string } | { action: 'open'; path: string }): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  const sendEvent = () => mainWindow?.webContents.send('quick-create:triggered', payload)
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', sendEvent)
    return
  }

  sendEvent()
}

async function showQuickCreateError(message: string): Promise<void> {
  restoreWindow({ center: true })

  if (!mainWindow || mainWindow.isDestroyed()) {
    dialog.showErrorBox('快速创建失败', message)
    return
  }

  await dialog.showMessageBox(mainWindow, {
    type: 'error',
    buttons: ['知道了'],
    defaultId: 0,
    noLink: true,
    title: '快速创建失败',
    message: '快速创建失败',
    detail: message
  })
}

async function handleQuickCreateShortcut(): Promise<void> {
  try {
    const [settings] = await Promise.all([readSettings(), notesService.getNotesDirOrThrow()])
    const currentWindow = mainWindow
    const isWindowFocused =
      currentWindow !== null &&
      !currentWindow.isDestroyed() &&
      currentWindow.isVisible() &&
      !currentWindow.isMinimized() &&
      currentWindow.isFocused()

    if (settings.quickCreate.mode === 'toggle') {
      toggleMainWindow({ center: settings.quickCreate.centerWindowOnTrigger })
      return
    }

    if (settings.quickCreate.hideWindowOnTriggerWhenFocused && isWindowFocused) {
      currentWindow?.hide()
      return
    }

    const content = settings.quickCreate.writeClipboardOnCreate ? clipboard.readText() : ''
    restoreWindow({ center: settings.quickCreate.centerWindowOnTrigger })

    const payload =
      settings.quickCreate.mode === 'open'
        ? { action: 'open' as const, path: resolveQuickCreateTargetPath(settings.quickCreate.targetPath) }
        : {
            action: 'create' as const,
            parentPath: resolveQuickCreateParentPath(settings.quickCreate.directory),
            initialContent: content,
            nameSeed: buildQuickCreateNameSeed({
              clipboardContent: content,
              writeClipboardOnCreate: settings.quickCreate.writeClipboardOnCreate,
              namingRule: settings.quickCreate.namingRule
            })
          }

    emitQuickCreateTriggered(payload)
  } catch (error) {
    await showQuickCreateError(error instanceof Error ? error.message : '创建笔记时出现未知错误。')
  }
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

function clearAutoCommitTimer(): void {
  if (!autoCommitTimer) {
    nextAutoCommitAt = null
    return
  }

  clearTimeout(autoCommitTimer)
  autoCommitTimer = null
  nextAutoCommitAt = null
}

async function scheduleAutoCommitFromActivity(): Promise<void> {
  const settings = await readSettings()
  const notesDir = settings.notesDir

  clearAutoCommitTimer()
  autoCommitSequence += 1

  if (!notesDir || !settings.gitAutomation.autoCommitEnabled) {
    return
  }

  const currentSequence = autoCommitSequence
  nextAutoCommitAt = new Date(Date.now() + settings.gitAutomation.autoCommitIntervalMinutes * 60 * 1000).toISOString()
  autoCommitTimer = setTimeout(() => {
    autoCommitTimer = null
    nextAutoCommitAt = null
    void (async () => {
      const latestSettings = await readSettings()
      if (currentSequence !== autoCommitSequence) return
      if (!latestSettings.notesDir || latestSettings.notesDir !== notesDir) return
      if (!latestSettings.gitAutomation.autoCommitEnabled) return
      await gitService.commitAll(latestSettings.notesDir, AUTO_COMMIT_MESSAGE)
    })().catch(() => {
      // Auto commit failure should not interrupt note editing.
    })
  }, settings.gitAutomation.autoCommitIntervalMinutes * 60 * 1000)
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
  const nextFrame = clampWindowFrameToWorkArea(
    {
      ...currentBounds,
      width: nextBounds.width,
      height: nextBounds.height
    },
    workArea
  )

  mainWindow.setMinimumSize(minimumSize.width, minimumSize.height)
  mainWindow.setBounds(nextFrame)
  lastDisplayId = displayForBounds(nextFrame).id
  schedulePersistWindowBounds(nextFrame, mode)

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
      label: '打开 DevTools',
      click: () => {
        restoreWindow()
        mainWindow?.webContents.openDevTools({ mode: 'detach' })
      }
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
    displayChangeResizeLockUntil = Date.now() + MAIN_CONFIG.window.displayChangeResizeLockMs
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

app.whenReady().then(() => {
  registerNoteAssetProtocol()
  app.on('before-quit', () => {
    isQuitting = true
  })
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
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
  globalShortcut.register('Alt+A', () => {
    void handleQuickCreateShortcut()
  })

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

registerIpcHandlers({
  getMainWindow: () => mainWindow,
  notesService,
  gitService,
  workspaceFileService,
  readSettings,
  writeSettings,
  sanitizeBackgroundColor,
  sanitizeBackgroundOpacity,
  sanitizeEditorEnabledFeatures,
  sanitizeEditorImageDirectory,
  sanitizeGitAutoCommitEnabled,
  sanitizeGitAutoCommitIntervalMinutes,
  sanitizePinnedNotePaths,
  sanitizeQuickCreateCenterWindowOnTrigger,
  sanitizeQuickCreateDirectory,
  sanitizeQuickCreateHideWindowOnTriggerWhenFocused,
  sanitizeQuickCreateMode,
  sanitizeQuickCreateNamingRule,
  sanitizeQuickCreateTargetPath,
  sanitizeQuickCreateWriteClipboardOnCreate,
  currentSystemAppearance,
  buildNoteAssetPreviewUrl,
  currentWorkArea: () => currentWorkArea(),
  computeDefaultWindowBounds,
  persistWindowBounds,
  applyWindowSizeMode,
  getCurrentWindowSizeMode: () => currentWindowSizeMode,
  scheduleAutoCommitFromActivity,
  cancelAutoCommit: () => {
    clearAutoCommitTimer()
    autoCommitSequence += 1
  },
  getNextAutoCommitAt: () => nextAutoCommitAt,
})
