export type WindowSizeMode = 'expanded' | 'collapsed'

export type WindowBounds = {
  width: number
  height: number
}

export type StoredWindowBounds = {
  expanded: WindowBounds | null
  collapsed: WindowBounds | null
}

const EXPANDED_MIN_WIDTH = 600
const EXPANDED_MIN_HEIGHT = 600
const COLLAPSED_MIN_WIDTH = 280
const COLLAPSED_MIN_HEIGHT = 220
const DEFAULT_EXPANDED_WIDTH = 960
const DEFAULT_EXPANDED_HEIGHT = 760
const DEFAULT_COLLAPSED_WIDTH = 500
const DEFAULT_COLLAPSED_HEIGHT = 800

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function normalizeBoundsCandidate(value: unknown): WindowBounds | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<WindowBounds>
  if (!isFinitePositiveNumber(candidate.width) || !isFinitePositiveNumber(candidate.height)) {
    return null
  }

  return {
    width: Math.round(candidate.width),
    height: Math.round(candidate.height)
  }
}

export function getWindowMinimumSize(mode: WindowSizeMode): WindowBounds {
  if (mode === 'collapsed') {
    return {
      width: COLLAPSED_MIN_WIDTH,
      height: COLLAPSED_MIN_HEIGHT
    }
  }

  return {
    width: EXPANDED_MIN_WIDTH,
    height: EXPANDED_MIN_HEIGHT
  }
}

export function clampWindowBounds(bounds: WindowBounds, workArea: Electron.Rectangle, mode: WindowSizeMode): WindowBounds {
  const minimumSize = getWindowMinimumSize(mode)

  return {
    width: clamp(bounds.width, minimumSize.width, Math.max(minimumSize.width, workArea.width)),
    height: clamp(bounds.height, minimumSize.height, Math.max(minimumSize.height, workArea.height))
  }
}

export function clampWindowFrameToWorkArea(bounds: Electron.Rectangle, workArea: Electron.Rectangle): Electron.Rectangle {
  const maxX = workArea.x + Math.max(0, workArea.width - bounds.width)
  const maxY = workArea.y + Math.max(0, workArea.height - bounds.height)

  return {
    ...bounds,
    x: clamp(bounds.x, workArea.x, maxX),
    y: clamp(bounds.y, workArea.y, maxY)
  }
}

export function computeDefaultWindowBounds(workArea: Electron.Rectangle, mode: WindowSizeMode): WindowBounds {
  if (mode === 'collapsed') {
    return clampWindowBounds(
      {
        width: DEFAULT_COLLAPSED_WIDTH,
        height: DEFAULT_COLLAPSED_HEIGHT
      },
      workArea,
      mode
    )
  }

  return clampWindowBounds(
    {
      width: DEFAULT_EXPANDED_WIDTH,
      height: DEFAULT_EXPANDED_HEIGHT
    },
    workArea,
    mode
  )
}

export function normalizeStoredWindowBounds(value: unknown): StoredWindowBounds | null {
  const directBounds = normalizeBoundsCandidate(value)
  if (directBounds) {
    return {
      expanded: directBounds,
      collapsed: null
    }
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<Record<WindowSizeMode, unknown>>
  const expanded = normalizeBoundsCandidate(candidate.expanded)
  const collapsed = normalizeBoundsCandidate(candidate.collapsed)

  if (!expanded && !collapsed) {
    return null
  }

  return {
    expanded,
    collapsed
  }
}
