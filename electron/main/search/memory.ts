import type { NoteListItem } from '../notes'

function searchableText(value: string): string {
  return value.replace(/\r/g, '\n').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function searchNotesInMemory(
  notes: NoteListItem[],
  searchTexts: ReadonlyMap<string, string>,
  query: string,
): NoteListItem[] {
  const keyword = searchableText(query)
  if (!keyword) {
    return notes
  }

  return notes.filter((item) => {
    const indexedContent = searchTexts.get(item.path) ?? ''
    return [item.title, item.path].some((field) => field.toLowerCase().includes(keyword)) || indexedContent.includes(keyword)
  })
}
