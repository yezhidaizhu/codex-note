import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { AppearanceDensity, AppearanceMode, AppearanceSettings, AppearanceTheme } from '@/lib/types'

type ResolvedAppearanceMode = Exclude<AppearanceMode, 'system'>

const defaultAppearance: AppearanceSettings = {
  mode: 'system',
  theme: 'ember',
  density: 'comfortable',
  transparentBackground: true,
  backgroundColor: null,
  backgroundOpacity: null,
}

export const themePresets: Record<AppearanceTheme, { primary: string; primaryForeground: string; ring: string }> = {
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
    '--scroll-thumb-hover': 'rgba(255, 255, 255, 0.22)',
    '--scroll-track': 'rgba(255, 255, 255, 0.03)',
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
    '--scroll-thumb-hover': 'rgba(71, 85, 105, 0.28)',
    '--scroll-track': 'rgba(71, 85, 105, 0.08)',
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

const backgroundDefaults: Record<ResolvedAppearanceMode, { color: string; opacity: number }> = {
  dark: {
    color: '#050816',
    opacity: 10,
  },
  light: {
    color: '#f8fafc',
    opacity: 68,
  },
}

export function resolveAppearanceMode(mode: AppearanceMode): ResolvedAppearanceMode {
  return mode === 'system' ? systemAppearanceMode.value : mode
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

export function resolveAppearanceBackgroundColor(appearanceSettings: AppearanceSettings, mode: ResolvedAppearanceMode): string {
  return normalizeHexColor(appearanceSettings.backgroundColor) ?? backgroundDefaults[mode].color
}

export function resolveAppearanceBackgroundOpacity(appearanceSettings: AppearanceSettings, mode: ResolvedAppearanceMode): number {
  const rawValue = appearanceSettings.backgroundOpacity
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return appearanceSettings.transparentBackground ? backgroundDefaults[mode].opacity : 100
  }

  return Math.min(100, Math.max(0, Math.round(rawValue)))
}

function resolveAppearanceTransparencyEnabled(appearanceSettings: AppearanceSettings, mode: ResolvedAppearanceMode): boolean {
  return resolveAppearanceBackgroundOpacity(appearanceSettings, mode) < 100
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

export const densityPresets: Record<AppearanceDensity, Record<string, string>> = {
  comfortable: {
    '--content-area-pad': '1.25rem',
    '--panel-pad': '1.25rem',
    '--editor-pad-x': '1rem',
    '--editor-pad-y': '1rem',
    '--settings-page-pad': '1.25rem',
    '--settings-page-gap': '1.25rem',
    '--settings-section-gap': '1.25rem',
    '--settings-panel-pad': '1rem',
    '--settings-row-gap': '0.875rem',
    '--sidebar-search-pad-x': '0.4rem',
    '--sidebar-search-pad-top': '0.5rem',
    '--sidebar-search-pad-bottom': '0.4rem',
    '--sidebar-toolbar-pad-x': '0.4rem',
    '--sidebar-toolbar-pad-y': '0.4rem',
    '--sidebar-search-input-height': '2rem',
    '--sidebar-footer-pad-x': '0.4rem',
    '--sidebar-footer-pad-y': '0.4rem',
    '--sidebar-footer-stack-gap': '0.4rem',
    '--tree-list-pad-x': '0.25rem',
    '--tree-list-pad-bottom': '0.5rem',
    '--tree-list-gap': '2px',
    '--tree-item-pad-x': '0.3rem',
    '--tree-item-pad-y': '0.4rem',
    '--tree-item-min-height': '2.25rem',
    '--tree-item-icon-size': '1.5rem',
    '--tree-indent-step': '10px',
    '--tree-branch-gap': '0.25rem',
    '--tree-guide-offset': '0.45rem',
    '--tree-guide-padding': '0.2rem',
    '--tree-chevron-slot': '0.8rem',
  },
  compact: {
    '--content-area-pad': '0.875rem',
    '--panel-pad': '0.875rem',
    '--editor-pad-x': '1rem',
    '--editor-pad-y': '1rem',
    '--settings-page-pad': '0.875rem',
    '--settings-page-gap': '0.875rem',
    '--settings-section-gap': '0.875rem',
    '--settings-panel-pad': '0.75rem',
    '--settings-row-gap': '0.625rem',
    '--sidebar-search-pad-x': '0.4rem',
    '--sidebar-search-pad-top': '0.35rem',
    '--sidebar-search-pad-bottom': '0.3rem',
    '--sidebar-toolbar-pad-x': '0.4rem',
    '--sidebar-toolbar-pad-y': '0.3rem',
    '--sidebar-search-input-height': '1.85rem',
    '--sidebar-footer-pad-x': '0.4rem',
    '--sidebar-footer-pad-y': '0.3rem',
    '--sidebar-footer-stack-gap': '0.3rem',
    '--tree-list-pad-x': '0.25rem',
    '--tree-list-pad-bottom': '0.35rem',
    '--tree-list-gap': '1px',
    '--tree-item-pad-x': '0.3rem',
    '--tree-item-pad-y': '0.28rem',
    '--tree-item-min-height': '1.95rem',
    '--tree-item-icon-size': '1.35rem',
    '--tree-indent-step': '8px',
    '--tree-branch-gap': '0.22rem',
    '--tree-guide-offset': '0.42rem',
    '--tree-guide-padding': '0.18rem',
    '--tree-chevron-slot': '0.75rem',
  },
}

function applyAppearanceSettings(nextAppearance: AppearanceSettings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const resolvedMode = resolveAppearanceMode(nextAppearance.mode)
  const nextMode = modePresets[resolvedMode]
  const nextTheme = buildThemeTokens(resolvedMode, nextAppearance.theme)
  const nextDensity = densityPresets[nextAppearance.density]
  const backgroundColor = resolveAppearanceBackgroundColor(nextAppearance, resolvedMode)
  const backgroundOpacity = resolveAppearanceBackgroundOpacity(nextAppearance, resolvedMode)
  const transparencyEnabled = resolveAppearanceTransparencyEnabled(nextAppearance, resolvedMode)

  root.style.colorScheme = resolvedMode
  root.dataset.appearanceMode = resolvedMode
  root.dataset.appearancePreference = nextAppearance.mode
  root.dataset.transparentBackground = String(transparencyEnabled)

  for (const [name, value] of Object.entries(nextMode)) {
    root.style.setProperty(name, value)
  }

  for (const [name, value] of Object.entries(nextTheme)) {
    root.style.setProperty(name, value)
  }

  for (const [name, value] of Object.entries(nextDensity)) {
    root.style.setProperty(name, value)
  }

  root.style.setProperty('--background', rgba(backgroundColor, backgroundOpacity / 100))
  root.style.setProperty(
    '--shell-surface-background',
    rgba(backgroundColor, transparencyEnabled ? backgroundOpacity / 100 : 1),
  )
}

function getNotesApi() {
  if (!window.notesApi) {
    throw new Error(
      '未检测到 Electron 预加载接口。请用 `pnpm dev` 或 `pnpm dev:electron` 启动 Electron 窗口，不要直接打开 Vite 地址或 `index.html`。',
    )
  }

  return window.notesApi
}

let hasBoundSystemAppearanceListener = false

function bindSystemAppearanceListener(onSystemAppearanceChanged: (mode: ResolvedAppearanceMode) => void) {
  if (hasBoundSystemAppearanceListener || typeof window === 'undefined') return

  getNotesApi().onSystemAppearanceChange((mode) => {
    systemAppearanceMode.value = mode
    onSystemAppearanceChanged(mode)
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

export const useNoteStyleStore = defineStore('noteStyle', () => {
  const appearance = ref<AppearanceSettings>({ ...defaultAppearance })
  const errorMessage = ref('')
  let bootPromise: Promise<void> | null = null
  let initialized = false

  async function bootOnce() {
    errorMessage.value = ''

    try {
      bindSystemAppearanceListener(() => {
        if (appearance.value.mode === 'system') {
          applyAppearanceSettings(appearance.value)
        }
      })
      await syncSystemAppearanceMode()
      const settings = await getNotesApi().getSettings()
      appearance.value = settings.appearance
      applyAppearanceSettings(settings.appearance)
      initialized = true
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '初始化外观设置失败。'
    }
  }

  async function ensureInitialized() {
    if (initialized) return
    if (!bootPromise) {
      bootPromise = bootOnce().finally(() => {
        bootPromise = null
      })
    }
    await bootPromise
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
      initialized = true
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '更新外观设置失败。'
    }
  }

  async function resetAppearance() {
    await updateAppearance({ ...defaultAppearance })
  }

  return {
    appearance,
    errorMessage,
    ensureInitialized,
    updateAppearance,
    resetAppearance,
  }
})
