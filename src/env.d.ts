/// <reference types="vite/client" />

import type { AppSettings, NoteListItem, NotePayload, SaveNoteResult } from '@/lib/types'

declare global {
  interface Window {
    notesApi?: {
      getSettings: () => Promise<AppSettings>
      chooseDirectory: () => Promise<AppSettings | null>
      listNotes: () => Promise<NoteListItem[]>
      readNote: (basename: string) => Promise<NotePayload>
      saveNote: (payload: { currentBasename?: string | null; title: string; content: string }) => Promise<SaveNoteResult>
      deleteNote: (basename: string) => Promise<NoteListItem[]>
      setSidebarCollapsed: (collapsed: boolean) => Promise<void>
      getWindowState: () => Promise<{ isAlwaysOnTop: boolean }>
      setAlwaysOnTop: (pinned: boolean) => Promise<{ isAlwaysOnTop: boolean }>
    }
  }
}

export {}
