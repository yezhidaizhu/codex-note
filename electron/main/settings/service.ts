import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { normalizeStoredWindowBounds, type StoredWindowBounds } from '../window'

export type StoredSettings = {
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
  quickCreate: {
    mode: 'create' | 'open'
    directory: string
    targetPath: string
    writeClipboardOnCreate: boolean
    namingRule: 'default' | 'datetime'
  }
  pinnedNotePaths: string[]
}

type LegacyStoredSettings = Omit<StoredSettings, 'windowBounds'> & {
  windowBounds?: unknown
}

export const defaultSettings: StoredSettings = {
  notesDir: null,
  windowBounds: null,
  appearance: {
    mode: 'system',
    theme: 'ember',
    density: 'comfortable',
    transparentBackground: true,
    backgroundColor: null,
    backgroundOpacity: null
  },
  quickCreate: {
    mode: 'create',
    directory: '/快速创建',
    targetPath: '',
    writeClipboardOnCreate: false,
    namingRule: 'default'
  },
  pinnedNotePaths: []
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

export function sanitizeBackgroundColor(value: string | null | undefined): string | null {
  return normalizeHexColor(value)
}

export function sanitizeBackgroundOpacity(value: number | null | undefined): number | null {
  return normalizeBackgroundOpacity(value)
}

export function sanitizeQuickCreateDirectory(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return defaultSettings.quickCreate.directory
  }

  const normalizedSegments = value
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.')

  if (normalizedSegments.some((segment) => segment === '..')) {
    return defaultSettings.quickCreate.directory
  }

  if (normalizedSegments.length === 0) {
    return ''
  }

  return `/${normalizedSegments.join('/')}`
}

export function sanitizeQuickCreateMode(value: 'create' | 'open' | null | undefined): 'create' | 'open' {
  return value === 'open' ? 'open' : 'create'
}

export function sanitizeQuickCreateTargetPath(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return defaultSettings.quickCreate.targetPath
  }

  const normalizedSegments = value
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.')

  if (normalizedSegments.some((segment) => segment === '..')) {
    return defaultSettings.quickCreate.targetPath
  }

  if (normalizedSegments.length === 0) {
    return ''
  }

  return normalizedSegments.join('/')
}

export function sanitizeQuickCreateWriteClipboardOnCreate(value: boolean | null | undefined): boolean {
  return typeof value === 'boolean' ? value : defaultSettings.quickCreate.writeClipboardOnCreate
}

export function sanitizeQuickCreateNamingRule(value: 'default' | 'datetime' | null | undefined): 'default' | 'datetime' {
  return value === 'datetime' ? 'datetime' : 'default'
}

export function sanitizePinnedNotePaths(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [...defaultSettings.pinnedNotePaths]
  }

  const deduped = new Set<string>()
  for (const rawPath of value) {
    if (typeof rawPath !== 'string') continue
    const normalizedSegments = rawPath
      .replace(/\\/g, '/')
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0 && segment !== '.')

    if (normalizedSegments.length === 0) continue
    if (normalizedSegments.some((segment) => segment === '..')) continue
    deduped.add(normalizedSegments.join('/'))
  }

  return [...deduped]
}

export async function readSettings(): Promise<StoredSettings> {
  try {
    const content = await readFile(settingsPath(), 'utf8')
    const parsed = JSON.parse(content) as Partial<LegacyStoredSettings>
    const parsedAppearance = {
      ...defaultSettings.appearance,
      ...(parsed.appearance ?? {})
    }
    const parsedQuickCreate = {
      ...defaultSettings.quickCreate,
      ...(parsed.quickCreate ?? {})
    }

    return {
      notesDir: parsed.notesDir ?? defaultSettings.notesDir,
      windowBounds: normalizeStoredWindowBounds(parsed.windowBounds),
      appearance: {
        ...parsedAppearance,
        backgroundColor: normalizeHexColor(parsedAppearance.backgroundColor),
        backgroundOpacity: normalizeBackgroundOpacity(parsedAppearance.backgroundOpacity)
      },
      quickCreate: {
        mode: sanitizeQuickCreateMode(parsedQuickCreate.mode),
        directory: sanitizeQuickCreateDirectory(parsedQuickCreate.directory),
        targetPath: sanitizeQuickCreateTargetPath(parsedQuickCreate.targetPath),
        writeClipboardOnCreate: sanitizeQuickCreateWriteClipboardOnCreate(parsedQuickCreate.writeClipboardOnCreate),
        namingRule: sanitizeQuickCreateNamingRule(parsedQuickCreate.namingRule)
      },
      pinnedNotePaths: sanitizePinnedNotePaths(parsed.pinnedNotePaths)
    }
  } catch {
    return defaultSettings
  }
}

export async function writeSettings(nextSettings: StoredSettings): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(settingsPath(), JSON.stringify(nextSettings, null, 2), 'utf8')
}
