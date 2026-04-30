<script setup lang="ts">
import { ChevronRight, Folder, FolderOpen } from 'lucide-vue-next'
import NoteListItem from '@/components/notes/note-list-item.vue'
import { cn } from '@/lib/utils'
import { formatCompactDate, getListLabel } from '@/state/notes'
import type { FolderListItem as FolderListItemData, NoteListItem as NoteListItemData } from '@/lib/types'

type DraggingItem = {
  type: 'note' | 'folder'
  path: string
} | null

defineOptions({ name: 'NotesTreeFolderNode' })

const props = defineProps<{
  folder: FolderListItemData
  depth: number
  foldersByParent: Record<string, FolderListItemData[]>
  notesByParent: Record<string, NoteListItemData[]>
  expandedFolderPaths: string[]
  selectedPath: string | null
  isBatchSelecting: boolean
  selectedPaths: string[]
  draggingItem: DraggingItem
  dropTargetFolderPath: string | null
}>()

const emit = defineEmits<{
  (e: 'openNote', path: string): void
  (e: 'toggleNoteSelection', path: string): void
  (e: 'requestNoteContextMenu', payload: { path: string; x: number; y: number }): void
  (e: 'requestFolderContextMenu', payload: { path: string; x: number; y: number }): void
  (e: 'toggleFolderExpanded', path: string): void
  (e: 'moveNoteToFolder', payload: { path: string; targetFolderPath: string | null }): void
  (e: 'moveFolderToFolder', payload: { path: string; targetFolderPath: string | null }): void
  (e: 'itemDragStart', payload: { type: 'note' | 'folder'; path: string; event: DragEvent }): void
  (e: 'itemDragEnd'): void
  (e: 'setDropTarget', path: string): void
  (e: 'clearDropTarget'): void
}>()

function noteParent(pathValue: string): string | null {
  const segments = pathValue.split('/')
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('/')
}

function canDropToFolder(folderPath: string): boolean {
  if (!props.draggingItem) return false

  if (props.draggingItem.type === 'note') {
    return noteParent(props.draggingItem.path) !== folderPath
  }

  if (props.draggingItem.path === folderPath) return false
  if (folderPath.startsWith(`${props.draggingItem.path}/`)) return false
  return noteParent(props.draggingItem.path) !== folderPath
}

function onFolderDragOver(event: DragEvent) {
  if (!canDropToFolder(props.folder.path)) return
  event.stopPropagation()
  event.dataTransfer && (event.dataTransfer.dropEffect = 'move')
  emit('setDropTarget', props.folder.path)
}

function onFolderDrop() {
  if (!props.draggingItem || !canDropToFolder(props.folder.path)) return
  if (props.draggingItem.type === 'note') {
    emit('moveNoteToFolder', { path: props.draggingItem.path, targetFolderPath: props.folder.path })
  } else {
    emit('moveFolderToFolder', { path: props.draggingItem.path, targetFolderPath: props.folder.path })
  }
  emit('clearDropTarget')
}

function rowClass() {
  if (props.dropTargetFolderPath === props.folder.path) {
    return 'bg-[var(--tree-item-selected)] text-[var(--foreground)] hover:bg-[var(--tree-item-selected-hover)]'
  }

  return 'bg-transparent hover:bg-[var(--tree-item-hover)]'
}

function iconClass() {
  if (props.dropTargetFolderPath === props.folder.path) {
    return 'bg-[var(--tree-item-icon-active)] text-[var(--primary)]'
  }

  return 'bg-[var(--tree-item-icon)] text-[var(--muted-foreground)]'
}
</script>

<template>
  <div
    :class="cn('rounded-[calc(var(--radius)-0.15rem)] transition-colors duration-150', dropTargetFolderPath === folder.path ? 'bg-[var(--tree-item-selected)]' : '')"
    :style="{ marginLeft: `calc(${depth} * var(--tree-indent-step))` }"
    @dragover.prevent.stop="onFolderDragOver"
    @dragleave.stop="emit('clearDropTarget')"
    @drop.prevent.stop="onFolderDrop"
  >
    <div
      data-folder-item="true"
      :class="cn('flex w-full items-center gap-[var(--tree-branch-gap)] rounded-[calc(var(--radius)-0.2rem)] px-[var(--tree-item-pad-x)] py-[var(--tree-item-pad-y)] text-[var(--foreground)] transition-[background-color,color] duration-200', rowClass())"
      :style="{ minHeight: 'var(--tree-item-min-height)' }"
      draggable="true"
      @click="emit('toggleFolderExpanded', folder.path)"
      @contextmenu.prevent="
        (event) => {
          if (isBatchSelecting) return
          emit('requestFolderContextMenu', { path: folder.path, x: event.clientX, y: event.clientY })
        }
      "
      @dragstart="emit('itemDragStart', { type: 'folder', path: folder.path, event: $event })"
      @dragend="emit('itemDragEnd')"
    >
      <button
        type="button"
        class="flex h-[var(--tree-chevron-slot)] w-[var(--tree-chevron-slot)] shrink-0 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-[var(--sidebar-hover-strong)]"
        tabindex="-1"
        aria-hidden="true"
      >
        <ChevronRight
          :class="cn('h-3.5 w-3.5 transition-transform', expandedFolderPaths.includes(folder.path) ? 'rotate-90' : 'rotate-0')"
        />
      </button>

      <span
        :class="cn('flex shrink-0 items-center justify-center rounded-md transition-colors', iconClass())"
        :style="{ width: 'var(--tree-item-icon-size)', height: 'var(--tree-item-icon-size)' }"
        aria-hidden="true"
      >
        <FolderOpen v-if="expandedFolderPaths.includes(folder.path)" class="h-4 w-4" />
        <Folder v-else class="h-4 w-4" />
      </span>

      <p class="text-ui-sm min-w-0 flex-1 truncate text-[var(--foreground)]">{{ folder.name }}</p>
    </div>

    <div
      v-if="expandedFolderPaths.includes(folder.path)"
      class="ml-[var(--tree-guide-offset)] flex flex-col border-l border-[var(--tree-item-guide)] pl-[var(--tree-guide-padding)]"
      :style="{ gap: 'var(--tree-list-gap)' }"
    >
      <NotesTreeFolderNode
        v-for="childFolder in foldersByParent[folder.path] ?? []"
        :key="childFolder.path"
        :folder="childFolder"
        :depth="0"
        :folders-by-parent="foldersByParent"
        :notes-by-parent="notesByParent"
        :expanded-folder-paths="expandedFolderPaths"
        :selected-path="selectedPath"
        :is-batch-selecting="isBatchSelecting"
        :selected-paths="selectedPaths"
        :dragging-item="draggingItem"
        :drop-target-folder-path="dropTargetFolderPath"
        @open-note="emit('openNote', $event)"
        @toggle-note-selection="emit('toggleNoteSelection', $event)"
        @request-note-context-menu="emit('requestNoteContextMenu', $event)"
        @request-folder-context-menu="emit('requestFolderContextMenu', $event)"
        @toggle-folder-expanded="emit('toggleFolderExpanded', $event)"
        @move-note-to-folder="emit('moveNoteToFolder', $event)"
        @move-folder-to-folder="emit('moveFolderToFolder', $event)"
        @item-drag-start="emit('itemDragStart', $event)"
        @item-drag-end="emit('itemDragEnd')"
        @set-drop-target="emit('setDropTarget', $event)"
        @clear-drop-target="emit('clearDropTarget')"
      />

      <NoteListItem
        v-for="note in notesByParent[folder.path] ?? []"
        :key="note.path"
        :label="getListLabel(note)"
        :date-label="formatCompactDate(note.updatedAt)"
        :selected="selectedPath === note.path"
        :selection-mode="isBatchSelecting"
        :checked="selectedPaths.includes(note.path)"
        :draggable="!isBatchSelecting"
        :inside-folder="true"
        @toggleChecked="emit('toggleNoteSelection', note.path)"
        @open="emit('openNote', note.path)"
        @context-menu="
          (event) => {
            if (isBatchSelecting) return
            emit('requestNoteContextMenu', { path: note.path, x: event.clientX, y: event.clientY })
          }
        "
        @drag-start="emit('itemDragStart', { type: 'note', path: note.path, event: $event })"
        @drag-end="emit('itemDragEnd')"
      />
    </div>
  </div>
</template>
