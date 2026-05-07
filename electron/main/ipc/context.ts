import type { BrowserWindow } from 'electron'
import type { createGitService } from '../git/service'
import type { createNotesService } from '../notes'
import type { createWorkspaceFileService } from '../file/service'
import type { computeDefaultWindowBounds, WindowBounds, WindowSizeMode } from '../window'
import type {
  readSettings,
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
  writeSettings,
} from '../settings/store'

export type IpcContext = {
  getMainWindow: () => BrowserWindow | null
  notesService: ReturnType<typeof createNotesService>
  gitService: ReturnType<typeof createGitService>
  workspaceFileService: ReturnType<typeof createWorkspaceFileService>
  readSettings: typeof readSettings
  writeSettings: typeof writeSettings
  sanitizeBackgroundColor: typeof sanitizeBackgroundColor
  sanitizeBackgroundOpacity: typeof sanitizeBackgroundOpacity
  sanitizeEditorEnabledFeatures: typeof sanitizeEditorEnabledFeatures
  sanitizeEditorImageDirectory: typeof sanitizeEditorImageDirectory
  sanitizeGitAutoCommitEnabled: typeof sanitizeGitAutoCommitEnabled
  sanitizeGitAutoCommitIntervalMinutes: typeof sanitizeGitAutoCommitIntervalMinutes
  sanitizePinnedNotePaths: typeof sanitizePinnedNotePaths
  sanitizeQuickCreateCenterWindowOnTrigger: typeof sanitizeQuickCreateCenterWindowOnTrigger
  sanitizeQuickCreateDirectory: typeof sanitizeQuickCreateDirectory
  sanitizeQuickCreateHideWindowOnTriggerWhenFocused: typeof sanitizeQuickCreateHideWindowOnTriggerWhenFocused
  sanitizeQuickCreateMode: typeof sanitizeQuickCreateMode
  sanitizeQuickCreateNamingRule: typeof sanitizeQuickCreateNamingRule
  sanitizeQuickCreateTargetPath: typeof sanitizeQuickCreateTargetPath
  sanitizeQuickCreateWriteClipboardOnCreate: typeof sanitizeQuickCreateWriteClipboardOnCreate
  currentSystemAppearance: () => 'dark' | 'light'
  buildNoteAssetPreviewUrl: (path: string) => string
  currentWorkArea: () => Electron.Rectangle
  computeDefaultWindowBounds: typeof computeDefaultWindowBounds
  persistWindowBounds: (bounds: Electron.Rectangle, mode?: WindowSizeMode) => Promise<void>
  applyWindowSizeMode: (mode: WindowSizeMode) => Promise<WindowBounds>
  getCurrentWindowSizeMode: () => WindowSizeMode
  scheduleAutoCommitFromActivity: () => Promise<void>
  cancelAutoCommit: () => void
  getNextAutoCommitAt: () => string | null
}
