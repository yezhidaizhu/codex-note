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
  }).map((item) => {
    const indexedContent = searchTexts.get(item.path) ?? ''
    const matchIndex = indexedContent.indexOf(keyword)
    if (matchIndex === -1) {
      return {
        ...item,
        matchPreview: null
      }
    }

    const contextRadius = 36
    const left = Math.max(0, matchIndex - contextRadius)
    const right = Math.min(indexedContent.length, matchIndex + keyword.length + contextRadius)
    const snippet = indexedContent.slice(left, right).trim()

    return {
      ...item,
      matchPreview: `${left > 0 ? '…' : ''}${snippet}${right < indexedContent.length ? '…' : ''}`
    }
  })
}
