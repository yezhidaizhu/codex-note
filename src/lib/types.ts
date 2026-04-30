export type NoteListItem = {
  path: string
  name: string
  parentPath: string | null
  title: string
  preview: string
  updatedAt: string
  size: number
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
  updatedAt: string
}

export type AppSettings = {
  notesDir: string | null
  notes: NoteListItem[]
  folders: FolderListItem[]
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
