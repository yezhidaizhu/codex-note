import type { NotesSearchMode } from './search/types'

export const MAIN_CONFIG = {
  // Controls which full-text search strategy the main process uses by default.
  search: {
    defaultMode: 'ripgrep' as NotesSearchMode
  },
  // Prevents transient cross-display resize jitter right after the window moves to another screen.
  window: {
    displayChangeResizeLockMs: 1600
  }
} as const
