import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, screen, Tray } from 'electron'
import {
  clampWindowBounds,
  computeDefaultWindowBounds,
  getWindowMinimumSize,
  type StoredWindowBounds,
  type WindowBounds,
  type WindowSizeMode
} from './window-bounds'
import { createNotesService } from './notes-service'
import {
  defaultSettings,
  readSettings,
  sanitizeBackgroundColor,
  sanitizeBackgroundOpacity,
  writeSettings,
  type StoredSettings
} from './settings-store'

const DISPLAY_CHANGE_RESIZE_LOCK_MS = 1600

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
const notesService = createNotesService({
  getNotesDirSetting: async () => (await readSettings()).notesDir,
  onTreeChanged: (tree) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    mainWindow.webContents.send('notes:tree-changed', tree)
  }
})

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
  const noteTree = settings.notesDir ? await notesService.currentNotesTree(settings.notesDir) : { notes: [], folders: [] }

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
  await writeSettings({ ...current, notesDir })
  const noteTree = await notesService.currentNotesTree(notesDir)

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
      appearance.backgroundColor === undefined ? current.appearance.backgroundColor : sanitizeBackgroundColor(appearance.backgroundColor),
    backgroundOpacity:
      appearance.backgroundOpacity === undefined
        ? current.appearance.backgroundOpacity
        : sanitizeBackgroundOpacity(appearance.backgroundOpacity)
  }

  await writeSettings({
    ...current,
    appearance: nextAppearance
  })

  return nextAppearance
})

ipcMain.handle('system:get-appearance', async () => currentSystemAppearance())

ipcMain.handle('notes:list', async () => {
  const notesDir = await notesService.getNotesDirOrThrow()
  return notesService.currentNotesTree(notesDir)
})

ipcMain.handle('notes:search', async (_event, query: string) => {
  const notesDir = await notesService.getNotesDirOrThrow()
  return notesService.searchNotes(notesDir, query)
})

ipcMain.handle('notes:read', async (_event, notePath: string) => {
  const notesDir = await notesService.getNotesDirOrThrow()
  return notesService.readNote(notesDir, notePath)
})

ipcMain.handle(
  'notes:save',
  async (_event, payload: { currentPath?: string | null; parentPath: string | null; title: string; content: string }) => {
    const notesDir = await notesService.getNotesDirOrThrow()
    return notesService.saveNote(notesDir, payload)
  }
)

ipcMain.handle('notes:delete', async (_event, notePath: string) => {
  const notesDir = await notesService.getNotesDirOrThrow()
  return notesService.deleteNote(notesDir, notePath)
})

ipcMain.handle('notes:create-folder', async (_event, parentPath: string | null, name: string) => {
  const notesDir = await notesService.getNotesDirOrThrow()
  return notesService.createFolder(notesDir, parentPath, name)
})

ipcMain.handle('notes:delete-folder', async (_event, folderPath: string) => {
  const notesDir = await notesService.getNotesDirOrThrow()
  return notesService.deleteFolder(notesDir, folderPath)
})

ipcMain.handle('notes:move', async (_event, notePath: string, targetFolderPath: string | null) => {
  const notesDir = await notesService.getNotesDirOrThrow()
  return notesService.moveNote(notesDir, notePath, targetFolderPath)
})

ipcMain.handle('notes:move-folder', async (_event, folderPath: string, targetFolderPath: string | null) => {
  const notesDir = await notesService.getNotesDirOrThrow()
  return notesService.moveFolder(notesDir, folderPath, targetFolderPath)
})

ipcMain.handle('notes:rename-note', async (_event, notePath: string, name: string) => {
  const notesDir = await notesService.getNotesDirOrThrow()
  return notesService.renameNote(notesDir, notePath, name)
})

ipcMain.handle('notes:rename-folder', async (_event, folderPath: string, name: string) => {
  const notesDir = await notesService.getNotesDirOrThrow()
  return notesService.renameFolder(notesDir, folderPath, name)
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
