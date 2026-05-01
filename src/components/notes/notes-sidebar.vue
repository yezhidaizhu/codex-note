<script setup lang="ts">
import { Cog, FilePlus2, FolderPlus, Search } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
import NotesTreeList from '@/components/notes/notes-tree-list.vue'
import type { FolderListItem as FolderListItemData, NoteListItem as NoteListItemData } from '@/lib/types'

defineProps<{
  notesDir: string | null
  notes: NoteListItemData[]
  folders: FolderListItemData[]
  filteredNotes: NoteListItemData[]
  query: string
  selectedPath: string | null
  searchActiveIndex: number
  sidebarCollapsed: boolean
  sidebarWidth: number
  isSidebarResizing: boolean
  selectedPaths: string[]
  pinnedNotePaths: string[]
  expandedFolderPaths: string[]
}>()

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'createNote'): void
  (e: 'openNote', path: string): void
  (e: 'activateNoteSelection', payload: { path: string; orderedPaths: string[]; modifiers: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean } }): boolean
  (e: 'requestDeleteSelected', paths: string[]): void
  (e: 'goSettings'): void
  (e: 'beginResize', event: MouseEvent): void
  (e: 'requestNoteContextMenu', payload: { path: string; selectedPaths: string[]; x: number; y: number }): void
  (e: 'requestFolderContextMenu', payload: { path: string; x: number; y: number }): void
  (e: 'toggleFolderExpanded', path: string): void
  (e: 'moveNoteToFolder', payload: { path: string; targetFolderPath: string | null }): void
  (e: 'moveFolderToFolder', payload: { path: string; targetFolderPath: string | null }): void
  (e: 'togglePinnedNote', path: string): void
  (e: 'requestCreateFolder', parentPath: string | null): void
  (e: 'openSearchResultAt', index: number): void
  (e: 'moveSearchSelection', direction: 1 | -1): void
  (e: 'openActiveSearchResult'): void
}>()

function onQueryInput(event: Event) {
  emit('update:query', (event.target as HTMLInputElement).value)
}

function onQueryKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    emit('moveSearchSelection', 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    emit('moveSearchSelection', -1)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    emit('openActiveSearchResult')
  }
}
</script>

<template>
  <aside
    :class="
      [
        'relative flex min-h-0 shrink-0 flex-col overflow-hidden bg-transparent',
        isSidebarResizing ? 'transition-none' : 'transition-[width,opacity] duration-300 ease-out',
        sidebarCollapsed ? 'opacity-0' : 'opacity-100',
      ].join(' ')
    "
    :style="{ width: sidebarCollapsed ? '0px' : `${sidebarWidth}px` }"
    :aria-hidden="sidebarCollapsed"
  >
    <div
      :class="
        [
          'pointer-events-none absolute inset-y-0 right-0 z-10 w-px transition-[background-color,opacity] duration-200',
          sidebarCollapsed ? 'opacity-0' : isSidebarResizing ? 'bg-[var(--primary)] opacity-80' : 'bg-[var(--separator)] opacity-55',
        ].join(' ')
      "
      aria-hidden="true"
    />
    <div
      :class="
        [
          'flex h-full min-h-0 flex-col',
          isSidebarResizing ? 'transition-none' : 'transition-[transform,opacity] duration-300 ease-out',
          sidebarCollapsed ? 'pointer-events-none -translate-x-6 opacity-0' : 'translate-x-0 opacity-100',
        ].join(' ')
      "
      :style="{ width: `${sidebarWidth}px` }"
    >
      <div
        class="flex flex-col"
        :style="{
          paddingLeft: 'var(--sidebar-search-pad-x)',
          paddingRight: 'var(--sidebar-search-pad-x)',
          paddingTop: 'var(--sidebar-search-pad-top)',
          paddingBottom: 'var(--sidebar-search-pad-bottom)',
        }"
      >
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-[var(--space-3)] top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <Input
            :value="query"
            class="text-ui-sm border-none bg-[color-mix(in_srgb,var(--card)_58%,transparent)] pl-9 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0"
            :style="{ height: 'var(--sidebar-search-input-height)' }"
            placeholder="搜索笔记"
            @input="onQueryInput"
            @keydown="onQueryKeydown"
          />
        </div>
      </div>

      <div
        class="flex items-center justify-between"
        :style="{
          paddingLeft: 'var(--sidebar-toolbar-pad-x)',
          paddingRight: 'var(--sidebar-toolbar-pad-x)',
          paddingTop: 'var(--sidebar-toolbar-pad-y)',
          paddingBottom: 'var(--sidebar-toolbar-pad-y)',
        }"
      >
        <p class="text-ui-xs text-[var(--muted-foreground)]">笔记 {{ filteredNotes.length }}</p>
        <div class="flex items-center gap-[var(--space-1)]">
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
            :disabled="!notesDir"
            aria-label="新建笔记"
            @click="emit('createNote')"
          >
            <FilePlus2 class="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
            :disabled="!notesDir"
            aria-label="新建目录"
            @click="emit('requestCreateFolder', null)"
          >
            <FolderPlus class="h-3.5 w-3.5" />
          </Button>

        </div>
      </div>

      <NotesTreeList
        :notes="notes"
        :folders="folders"
        :filtered-notes="filteredNotes"
        :query="query"
        :selected-path="selectedPath"
        :search-active-index="searchActiveIndex"
        :selected-paths="selectedPaths"
        :pinned-note-paths="pinnedNotePaths"
        :expanded-folder-paths="expandedFolderPaths"
        @open-note="emit('openNote', $event)"
        @activate-note-selection="emit('activateNoteSelection', $event)"
        @request-note-context-menu="emit('requestNoteContextMenu', $event)"
        @request-folder-context-menu="emit('requestFolderContextMenu', $event)"
        @toggle-folder-expanded="emit('toggleFolderExpanded', $event)"
        @move-note-to-folder="emit('moveNoteToFolder', $event)"
        @move-folder-to-folder="emit('moveFolderToFolder', $event)"
        @toggle-pinned-note="emit('togglePinnedNote', $event)"
        @open-search-result-at="emit('openSearchResultAt', $event)"
      />

      <div
        class="mt-auto"
        :style="{
          paddingLeft: 'var(--sidebar-footer-pad-x)',
          paddingRight: 'var(--sidebar-footer-pad-x)',
          paddingTop: 'var(--sidebar-footer-pad-y)',
          paddingBottom: 'var(--sidebar-footer-pad-y)',
        }"
      >
        <Button
          variant="ghost"
          size="sm"
          class="text-ui-sm h-8 w-full justify-start gap-2 px-3 font-normal hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]"
          @click="emit('goSettings')"
        >
          <Cog class="h-4 w-4" />
          设置
        </Button>
      </div>
    </div>

    <div
      :class="
        [
          'absolute inset-y-0 right-[-4px] z-20 w-2 cursor-col-resize transition-opacity duration-200',
          sidebarCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100',
        ].join(' ')
      "
      aria-hidden="true"
      @mousedown="emit('beginResize', $event)"
    />
  </aside>
</template>
