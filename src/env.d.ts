/// <reference types="vite/client" />

import type { AppSettings, MoveFolderResult, NotePayload, NoteTreeResult, RenameFolderResult, SaveNoteResult } from '@/lib/types'

declare global {
  interface Window {
    notesApi?: {
      getSettings: () => Promise<AppSettings>
      chooseDirectory: () => Promise<AppSettings | null>
      listNotes: () => Promise<NoteTreeResult>
      readNote: (path: string) => Promise<NotePayload>
      saveNote: (payload: { currentPath?: string | null; parentPath: string | null; title: string; content: string }) => Promise<SaveNoteResult>
      deleteNote: (path: string) => Promise<NoteTreeResult>
      createFolder: (parentPath: string | null, name: string) => Promise<NoteTreeResult>
      deleteFolder: (path: string) => Promise<NoteTreeResult>
      moveNote: (path: string, targetFolderPath: string | null) => Promise<SaveNoteResult>
      moveFolder: (path: string, targetFolderPath: string | null) => Promise<MoveFolderResult>
      renameNote: (path: string, name: string) => Promise<SaveNoteResult>
      renameFolder: (path: string, name: string) => Promise<RenameFolderResult>
      setSidebarCollapsed: (collapsed: boolean) => Promise<void>
      getWindowState: () => Promise<{ isAlwaysOnTop: boolean }>
      setAlwaysOnTop: (pinned: boolean) => Promise<{ isAlwaysOnTop: boolean }>
    }
  }
}

export {}
