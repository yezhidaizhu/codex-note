export type AppearanceTheme = 'ember' | 'ocean' | 'forest'

export type AppearanceMode = 'system' | 'dark' | 'light'

export type AppearanceDensity = 'comfortable' | 'compact'

export type QuickCreateMode = 'create' | 'open' | 'toggle'

export type AppearanceSettings = {
  mode: AppearanceMode
  theme: AppearanceTheme
  density: AppearanceDensity
  transparentBackground: boolean
  backgroundColor: string | null
  backgroundOpacity: number | null
}

export type QuickCreateSettings = {
  mode: QuickCreateMode
  directory: string
  targetPath: string
  writeClipboardOnCreate: boolean
  namingRule: 'default' | 'datetime'
  centerWindowOnTrigger: boolean
  hideWindowOnTriggerWhenFocused: boolean
}

export type GitAutomationSettings = {
  autoCommitEnabled: boolean
  autoCommitIntervalMinutes: number
}

export type GitStatus = {
  isGitAvailable: boolean
  isRepoInitialized: boolean
  hasGitignore: boolean
  hasPendingChanges: boolean
  repoPath: string | null
  lastCommitAt: string | null
  nextAutoCommitAt: string | null
}

export type EditorFeatureKey =
  | 'heading'
  | 'bold'
  | 'italic'
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'codeBlock'
  | 'link'
  | 'image'

export type EditorSettings = {
  enabledFeatures: EditorFeatureKey[]
  imageDirectory: string
}

export type OpenPathResult = {
  ok: boolean
  error?: string
}

export type CopyTextResult = {
  ok: boolean
  error?: string
}

export type CleanupUnusedImagesResult = {
  deletedCount: number
  deletedPaths: string[]
}

export type NoteListItem = {
  path: string
  name: string
  parentPath: string | null
  title: string
  createdAt: string
  updatedAt: string
  size: number
  matchPreview?: string | null
}

export type FolderListItem = {
  path: string
  name: string
  parentPath: string | null
}

export type NotePayload = {
  path: string
  name: string
  parentPath: string | null
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export type AppSettings = {
  notesDir: string | null
  notes: NoteListItem[]
  folders: FolderListItem[]
  appearance: AppearanceSettings
  quickCreate: QuickCreateSettings
  gitAutomation: GitAutomationSettings
  editor: EditorSettings
  pinnedNotePaths: string[]
}

export type SaveNoteResult = {
  note: NotePayload
  notes: NoteListItem[]
  folders: FolderListItem[]
}

export type RenameFolderResult = {
  path: string
  notes: NoteListItem[]
  folders: FolderListItem[]
}

export type MoveFolderResult = {
  path: string
  notes: NoteListItem[]
  folders: FolderListItem[]
}

export type NoteTreeResult = {
  notes: NoteListItem[]
  folders: FolderListItem[]
}
