import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'

type StoredSettings = {
  notesDir: string | null
}

type NoteListItem = {
  basename: string
  title: string
  preview: string
  updatedAt: string
  size: number
}

type NotePayload = {
  basename: string
  title: string
  content: string
  updatedAt: string
}

const NOTE_TITLE_MAX_LENGTH = 36
const EXPANDED_MIN_WIDTH = 600
const COLLAPSED_MIN_WIDTH = 300

const defaultSettings: StoredSettings = {
  notesDir: null
}

let mainWindow: BrowserWindow | null = null
let sidebarCollapsed = false
let expandedSize = { width: 1400, height: 920 }
let collapsedSize = { width: COLLAPSED_MIN_WIDTH, height: 920 }
const currentDir = dirname(fileURLToPath(import.meta.url))

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
    width: Math.max(COLLAPSED_MIN_WIDTH, Math.min(initialWidth, expandedSize.width)),
    height: expandedSize.height
  }

  mainWindow.on('resize', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    const [width, height] = mainWindow.getSize()
    if (sidebarCollapsed) {
      collapsedSize = {
        width: Math.max(width, COLLAPSED_MIN_WIDTH),
        height
      }
      return
    }

    expandedSize = {
      width: Math.max(width, EXPANDED_MIN_WIDTH),
      height
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

function notePath(notesDir: string, noteBasename: string): string {
  return join(notesDir, ensureMarkdownName(noteBasename))
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

async function uniqueBasename(notesDir: string, preferredName: string, currentBasename?: string): Promise<string> {
  const target = ensureMarkdownName(preferredName)
  if (currentBasename && target === currentBasename) {
    return currentBasename
  }

  let candidate = target
  let index = 1

  for (;;) {
    try {
      await stat(notePath(notesDir, candidate))
      candidate = `${parse(target).name}-${index}.md`
      index += 1
    } catch {
      return candidate
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

async function listNotes(notesDir: string): Promise<NoteListItem[]> {
  await ensureDir(notesDir)
  const entries = await readdir(notesDir, { withFileTypes: true })
  const notes = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.md')
      .map(async (entry) => {
        const filepath = join(notesDir, entry.name)
        const [content, fileStat] = await Promise.all([readFile(filepath, 'utf8'), stat(filepath)])
        const firstNonEmptyLine =
          content
            .replace(/\r/g, '')
            .split('\n')
            .map((line) => line.trim())
            .find(Boolean) ?? parse(entry.name).name

        return {
          basename: entry.name,
          title: normalizeTitle(firstNonEmptyLine),
          preview: previewFromContent(content),
          updatedAt: fileStat.mtime.toISOString(),
          size: fileStat.size
        }
      })
  )

  return notes.sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
}

async function readNote(notesDir: string, noteBasename: string): Promise<NotePayload> {
  const filepath = notePath(notesDir, noteBasename)
  const [content, fileStat] = await Promise.all([readFile(filepath, 'utf8'), stat(filepath)])
  const firstLine = content
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  return {
    basename: basename(filepath),
    title: normalizeTitle(firstLine ?? parse(noteBasename).name),
    content,
    updatedAt: fileStat.mtime.toISOString()
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('settings:get', async () => {
  const settings = await readSettings()
  if (settings.notesDir) {
    await ensureDir(settings.notesDir)
  }

  return {
    ...settings,
    notes: settings.notesDir ? await listNotes(settings.notesDir) : []
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

  return {
    notesDir,
    notes: await listNotes(notesDir)
  }
})

ipcMain.handle('notes:list', async () => {
  const notesDir = await getNotesDirOrThrow()
  return listNotes(notesDir)
})

ipcMain.handle('notes:read', async (_event, noteBasename: string) => {
  const notesDir = await getNotesDirOrThrow()
  return readNote(notesDir, noteBasename)
})

ipcMain.handle(
  'notes:save',
  async (_event, payload: { currentBasename?: string | null; title: string; content: string }) => {
    const notesDir = await getNotesDirOrThrow()
    const normalizedTitle = normalizeTitle(payload.title)
    const basenameToSave = await uniqueBasename(notesDir, normalizedTitle, payload.currentBasename ?? undefined)
    const content = payload.content
    const nextPath = notePath(notesDir, basenameToSave)

    if (payload.currentBasename && payload.currentBasename !== basenameToSave) {
      const previousPath = notePath(notesDir, payload.currentBasename)
      await rename(previousPath, nextPath)
    }

    await writeFile(nextPath, content, 'utf8')

    return {
      note: await readNote(notesDir, basenameToSave),
      notes: await listNotes(notesDir)
    }
  }
)

ipcMain.handle('notes:delete', async (_event, noteBasename: string) => {
  const notesDir = await getNotesDirOrThrow()
  await rm(notePath(notesDir, noteBasename), { force: true })
  return listNotes(notesDir)
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
