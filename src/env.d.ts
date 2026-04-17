/// <reference types="vite/client" />

type NoteListItem = {
  basename: string
  title: string
  preview: string
  updatedAt: string
  size: number
}

type NotePayload = {
  basename: string
  title: string
  content: string
  updatedAt: string
}

type AppSettings = {
  notesDir: string | null
  notes: NoteListItem[]
}

type SaveNoteResult = {
  note: NotePayload
  notes: NoteListItem[]
}

declare global {
  interface Window {
    notesApi: {
      getSettings: () => Promise<AppSettings>
      chooseDirectory: () => Promise<AppSettings | null>
      listNotes: () => Promise<NoteListItem[]>
      readNote: (basename: string) => Promise<NotePayload>
      saveNote: (payload: { currentBasename?: string | null; title: string; content: string }) => Promise<SaveNoteResult>
      deleteNote: (basename: string) => Promise<NoteListItem[]>
    }
  }
}

export {}
