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

export function sanitizeBackgroundColor(value: string | null | undefined): string | null {
  return normalizeHexColor(value)
}

export function sanitizeBackgroundOpacity(value: number | null | undefined): number | null {
  return normalizeBackgroundOpacity(value)
}

export async function readSettings(): Promise<StoredSettings> {
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

export async function writeSettings(nextSettings: StoredSettings): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(settingsPath(), JSON.stringify(nextSettings, null, 2), 'utf8')
}
