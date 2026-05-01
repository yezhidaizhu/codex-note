import { searchNotesInMemory } from './memory'
import { searchNotesWithRipgrep } from './ripgrep'
import type { NotesSearchMode } from './types'
import type { NoteListItem } from '../notes'
type SearchNotesOptions = {
  mode: NotesSearchMode
  notesDir: string
  notes: NoteListItem[]
  searchTexts: ReadonlyMap<string, string>
  query: string
}

export { type NotesSearchMode } from './types'

export async function searchNotes(options: SearchNotesOptions): Promise<NoteListItem[]> {
  if (options.mode === 'ripgrep') {
    return searchNotesWithRipgrep(options.notesDir, options.notes, options.query)
  }

  return searchNotesInMemory(options.notes, options.searchTexts, options.query)
}
