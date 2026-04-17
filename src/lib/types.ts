export type NoteListItem = {
  basename: string
  title: string
  preview: string
  updatedAt: string
  size: number
}

export type NotePayload = {
  basename: string
  title: string
  content: string
  updatedAt: string
}

export type AppSettings = {
  notesDir: string | null
  notes: NoteListItem[]
}

export type SaveNoteResult = {
  note: NotePayload
  notes: NoteListItem[]
}
