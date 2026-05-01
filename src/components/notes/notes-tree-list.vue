<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import NoteListItem from '@/components/notes/note-list-item.vue'
import NotesTreeFolderNode from '@/components/notes/notes-tree-folder-node.vue'
import { formatCompactDate, getListLabel } from '@/state/notes'
import type { FolderListItem as FolderListItemData, NoteListItem as NoteListItemData } from '@/lib/types'

type DraggingItem = {
  type: 'note' | 'folder'
  path: string
} | null

const props = defineProps<{
  notes: NoteListItemData[]
  folders: FolderListItemData[]
  filteredNotes: NoteListItemData[]
  query: string
  selectedPath: string | null
  searchActiveIndex: number
  isBatchSelecting: boolean
  selectedPaths: string[]
  pinnedNotePaths: string[]
  expandedFolderPaths: string[]
}>()

const emit = defineEmits<{
  (e: 'openNote', path: string): void
  (e: 'openSearchResultAt', index: number): void
  (e: 'toggleNoteSelection', path: string): void
  (e: 'requestNoteContextMenu', payload: { path: string; x: number; y: number }): void
  (e: 'requestFolderContextMenu', payload: { path: string; x: number; y: number }): void
  (e: 'toggleFolderExpanded', path: string): void
  (e: 'moveNoteToFolder', payload: { path: string; targetFolderPath: string | null }): void
  (e: 'moveFolderToFolder', payload: { path: string; targetFolderPath: string | null }): void
  (e: 'togglePinnedNote', path: string): void
}>()

const draggingItem = ref<DraggingItem>(null)
const dropTargetFolderPath = ref<string | null>(null)
const rootDropActive = ref(false)
const searchItemElements = ref<HTMLElement[]>([])

const isSearching = computed(() => props.query.trim().length > 0)

const rootFolders = computed(() =>
  props.folders
    .filter((folder) => folder.parentPath === null)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN')),
)

const pinnedNotes = computed(() =>
  props.pinnedNotePaths
    .map((path) => props.notes.find((note) => note.path === path))
    .filter((note): note is NoteListItemData => Boolean(note)),
)

const pinnedPathSet = computed(() => new Set(props.pinnedNotePaths))

const rootNotes = computed(() =>
  props.notes.filter((note) => note.parentPath === null && !pinnedPathSet.value.has(note.path)),
)

const foldersByParent = computed<Record<string, FolderListItemData[]>>(() => {
  const groups: Record<string, FolderListItemData[]> = {}
  for (const folder of props.folders) {
    const key = folder.parentPath ?? '__root__'
    ;(groups[key] ??= []).push(folder)
  }

  for (const key of Object.keys(groups)) {
    groups[key].sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))
  }

  return groups
})

const notesByParent = computed<Record<string, NoteListItemData[]>>(() => {
  const groups: Record<string, NoteListItemData[]> = {}
  for (const note of props.notes) {
    if (pinnedPathSet.value.has(note.path)) continue
    const key = note.parentPath ?? '__root__'
    ;(groups[key] ??= []).push(note)
  }
  return groups
})

function noteParent(pathValue: string): string | null {
  const segments = pathValue.split('/')
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('/')
}

function canDropToRoot() {
  if (!draggingItem.value) return false
  return noteParent(draggingItem.value.path) !== null
}

function onItemDragStart(type: 'note' | 'folder', path: string, event: DragEvent) {
  if (isSearching.value || props.isBatchSelecting) {
    event.preventDefault()
    return
  }

  draggingItem.value = { type, path }
  dropTargetFolderPath.value = null
  rootDropActive.value = false
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', path)
  }
}

function onItemDragEnd() {
  draggingItem.value = null
  dropTargetFolderPath.value = null
  rootDropActive.value = false
}

function onRootDragOver(event: DragEvent) {
  if (!canDropToRoot()) return
  event.preventDefault()
  event.dataTransfer && (event.dataTransfer.dropEffect = 'move')
  dropTargetFolderPath.value = null
  rootDropActive.value = true
}

function onRootDrop() {
  if (!draggingItem.value || !canDropToRoot()) return
  if (draggingItem.value.type === 'note') {
    emit('moveNoteToFolder', { path: draggingItem.value.path, targetFolderPath: null })
  } else {
    emit('moveFolderToFolder', { path: draggingItem.value.path, targetFolderPath: null })
  }
  onItemDragEnd()
}

function bindSearchItemElement(element: Element | { $el?: Element | null } | null, index: number) {
  const resolvedElement = element instanceof HTMLElement ? element : element && '$el' in element ? element.$el : null
  if (!(resolvedElement instanceof HTMLElement)) return
  searchItemElements.value[index] = resolvedElement
}

watch(
  () => [props.searchActiveIndex, props.query, props.filteredNotes.length] as const,
  async () => {
    if (!isSearching.value) return
    await nextTick()
    searchItemElements.value[props.searchActiveIndex]?.scrollIntoView({ block: 'nearest' })
  },
)
</script>

<template>
  <div v-if="isSearching && filteredNotes.length === 0" class="px-[var(--tree-list-pad-x)] pb-[var(--tree-list-pad-bottom)]">
    <div
      class="rounded-[var(--radius)] border border-dashed border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--card)_42%,transparent)] p-[var(--space-4)] text-sm text-[var(--muted-foreground)]"
    >
      <p>没有匹配的笔记。</p>
      <p class="mt-2 text-xs">试试别的关键词。</p>
    </div>
  </div>

  <div
    v-else-if="!isSearching && rootFolders.length === 0 && rootNotes.length === 0 && pinnedNotes.length === 0"
    class="px-[var(--tree-list-pad-x)] pb-[var(--tree-list-pad-bottom)]"
  >
    <div
      class="rounded-[var(--radius)] border border-dashed border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--card)_42%,transparent)] p-[var(--space-4)] text-sm text-[var(--muted-foreground)]"
    >
      <p>这里还没有笔记。</p>
      <p class="mt-2 text-xs">新建后会直接保存为本地 `.md` 文件。</p>
    </div>
  </div>

  <div
    v-else
    :class="[
      'scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[calc(var(--radius)-0.2rem)] px-[var(--tree-list-pad-x)] pb-[var(--tree-list-pad-bottom)] transition-colors duration-150',
      rootDropActive ? 'bg-[var(--tree-item-selected)]' : '',
    ]"
    :style="{ gap: 'var(--tree-list-gap)' }"
    @dragover="onRootDragOver"
    @dragleave="rootDropActive = false"
    @drop.prevent="onRootDrop"
  >
    <template v-if="isSearching">
      <NoteListItem
        v-for="(note, index) in filteredNotes"
        :key="note.path"
        :ref="(element) => bindSearchItemElement(element, index)"
        :label="getListLabel(note)"
        :match-preview="note.matchPreview"
        :highlight-query="query"
        :date-label="formatCompactDate(note.updatedAt)"
        :selected="searchActiveIndex === index"
        :is-pinned="pinnedNotePaths.includes(note.path)"
        :selection-mode="isBatchSelecting"
        :checked="selectedPaths.includes(note.path)"
        @toggleChecked="emit('toggleNoteSelection', note.path)"
        @togglePinned="emit('togglePinnedNote', note.path)"
        @open="emit('openSearchResultAt', index)"
        @context-menu="
          (event) => {
            if (isBatchSelecting) return
            emit('requestNoteContextMenu', { path: note.path, x: event.clientX, y: event.clientY })
          }
        "
      />
    </template>

    <template v-else>
      <div v-if="pinnedNotes.length > 0" class="flex flex-col" :style="{ gap: 'var(--tree-list-gap)' }">
        <NoteListItem
          v-for="note in pinnedNotes"
          :key="note.path"
          :label="getListLabel(note)"
          :match-preview="note.matchPreview"
          :highlight-query="''"
          :date-label="formatCompactDate(note.updatedAt)"
          :selected="selectedPath === note.path"
          :is-pinned="true"
          :selection-mode="isBatchSelecting"
          :checked="selectedPaths.includes(note.path)"
          :draggable="!isBatchSelecting"
          @togglePinned="emit('togglePinnedNote', note.path)"
          @toggleChecked="emit('toggleNoteSelection', note.path)"
          @open="emit('openNote', note.path)"
          @context-menu="
            (event) => {
              if (isBatchSelecting) return
              emit('requestNoteContextMenu', { path: note.path, x: event.clientX, y: event.clientY })
            }
          "
          @drag-start="onItemDragStart('note', note.path, $event)"
          @drag-end="onItemDragEnd"
        />
      </div>

      <NotesTreeFolderNode
        v-for="folder in rootFolders"
        :key="folder.path"
        :folder="folder"
        :depth="0"
        :folders-by-parent="foldersByParent"
        :notes-by-parent="notesByParent"
        :expanded-folder-paths="expandedFolderPaths"
        :selected-path="selectedPath"
        :is-batch-selecting="isBatchSelecting"
        :selected-paths="selectedPaths"
        :pinned-note-paths="pinnedNotePaths"
        :dragging-item="draggingItem"
        :drop-target-folder-path="dropTargetFolderPath"
        @open-note="emit('openNote', $event)"
        @toggle-note-selection="emit('toggleNoteSelection', $event)"
        @request-note-context-menu="emit('requestNoteContextMenu', $event)"
        @request-folder-context-menu="emit('requestFolderContextMenu', $event)"
        @toggle-folder-expanded="emit('toggleFolderExpanded', $event)"
        @move-note-to-folder="emit('moveNoteToFolder', $event)"
        @move-folder-to-folder="emit('moveFolderToFolder', $event)"
        @toggle-pinned-note="emit('togglePinnedNote', $event)"
        @open-search-result-at="emit('openSearchResultAt', $event)"
        @item-drag-start="onItemDragStart($event.type, $event.path, $event.event)"
        @item-drag-end="onItemDragEnd"
        @set-drop-target="
          (path) => {
            dropTargetFolderPath = path
            rootDropActive = false
          }
        "
        @clear-drop-target="
          () => {
            dropTargetFolderPath = null
            rootDropActive = false
          }
        "
      />

      <div v-if="rootNotes.length > 0" class="flex flex-col" :style="{ gap: 'var(--tree-list-gap)' }">
        <NoteListItem
          v-for="note in rootNotes"
          :key="note.path"
          :label="getListLabel(note)"
          :match-preview="note.matchPreview"
          :highlight-query="''"
        :date-label="formatCompactDate(note.updatedAt)"
        :selected="selectedPath === note.path"
        :is-pinned="pinnedNotePaths.includes(note.path)"
          :selection-mode="isBatchSelecting"
          :checked="selectedPaths.includes(note.path)"
          :draggable="!isBatchSelecting"
          @togglePinned="emit('togglePinnedNote', note.path)"
          @toggleChecked="emit('toggleNoteSelection', note.path)"
          @open="emit('openNote', note.path)"
          @context-menu="
            (event) => {
              if (isBatchSelecting) return
              emit('requestNoteContextMenu', { path: note.path, x: event.clientX, y: event.clientY })
            }
          "
          @drag-start="onItemDragStart('note', note.path, $event)"
          @drag-end="onItemDragEnd"
        />
      </div>
    </template>
  </div>
</template>
