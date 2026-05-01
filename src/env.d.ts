/// <reference types="vite/client" />

import type {
  AppSettings,
  AppearanceSettings,
  CopyTextResult,
  MoveFolderResult,
  NotePayload,
  NoteTreeResult,
  OpenPathResult,
  QuickCreateSettings,
  RenameFolderResult,
  SaveNoteResult
} from '@/lib/types'

declare global {
  interface Window {
    notesApi?: {
      getSettings: () => Promise<AppSettings>
      getSystemAppearance: () => Promise<'dark' | 'light'>
      onSystemAppearanceChange: (listener: (mode: 'dark' | 'light') => void) => () => void
      onNotesTreeChange: (listener: (tree: NoteTreeResult) => void) => () => void
      onQuickCreateTriggered: (
        listener: (payload: { action: 'create'; parentPath: string | null; initialContent: string; nameSeed?: string | null } | { action: 'open'; path: string }) => void,
      ) => () => void
      chooseDirectory: () => Promise<AppSettings | null>
      listNotes: () => Promise<NoteTreeResult>
      searchNotes: (query: string) => Promise<NoteTreeResult>
      getSearchMode: () => Promise<{ mode: 'memory' | 'ripgrep' }>
      setSearchMode: (mode: 'memory' | 'ripgrep') => Promise<{ mode: 'memory' | 'ripgrep' }>
      readNote: (path: string) => Promise<NotePayload>
      saveNote: (payload: { currentPath?: string | null; parentPath: string | null; name?: string; content: string }) => Promise<SaveNoteResult>
      deleteNote: (path: string) => Promise<NoteTreeResult>
      createFolder: (parentPath: string | null, name: string) => Promise<NoteTreeResult>
      deleteFolder: (path: string) => Promise<NoteTreeResult>
      moveNote: (path: string, targetFolderPath: string | null) => Promise<SaveNoteResult>
      moveFolder: (path: string, targetFolderPath: string | null) => Promise<MoveFolderResult>
      renameNote: (path: string, name: string) => Promise<SaveNoteResult>
      renameFolder: (path: string, name: string) => Promise<RenameFolderResult>
      getAbsoluteNotePath: (path: string) => Promise<{ path: string }>
      openNotesDirectory: () => Promise<OpenPathResult>
      writeClipboardText: (value: string) => Promise<CopyTextResult>
      updateAppearance: (appearance: AppearanceSettings) => Promise<AppearanceSettings>
      updateQuickCreateSettings: (quickCreate: QuickCreateSettings) => Promise<QuickCreateSettings>
      updatePinnedNotePaths: (paths: string[]) => Promise<string[]>
      setSidebarCollapsed: (collapsed: boolean) => Promise<void>
      getWindowState: () => Promise<{ isAlwaysOnTop: boolean }>
      setAlwaysOnTop: (pinned: boolean) => Promise<{ isAlwaysOnTop: boolean }>
    }
  }
}

export {}
