<script setup lang="ts">
import { Cog, FilePlus2, FolderPlus, MoreHorizontal, Search, Trash2 } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
import NotesTreeList from '@/components/notes-tree-list.vue'
import type { FolderListItem as FolderListItemData, NoteListItem as NoteListItemData } from '@/lib/types'

defineProps<{
  notesDir: string | null
  notes: NoteListItemData[]
  folders: FolderListItemData[]
  filteredNotes: NoteListItemData[]
  query: string
  selectedPath: string | null
  sidebarCollapsed: boolean
  sidebarWidth: number
  isSidebarResizing: boolean
  isBatchSelecting: boolean
  selectedPaths: string[]
  expandedFolderPaths: string[]
  listActionsMenuOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'createNote'): void
  (e: 'openNote', path: string): void
  (e: 'toggleListActionsMenu'): void
  (e: 'toggleBatchSelect'): void
  (e: 'toggleNoteSelection', path: string): void
  (e: 'confirmDeleteSelected'): void
  (e: 'goSettings'): void
  (e: 'beginResize', event: MouseEvent): void
  (e: 'requestNoteContextMenu', payload: { path: string; x: number; y: number }): void
  (e: 'requestFolderContextMenu', payload: { path: string; x: number; y: number }): void
  (e: 'toggleFolderExpanded', path: string): void
  (e: 'moveNoteToFolder', payload: { path: string; targetFolderPath: string | null }): void
  (e: 'moveFolderToFolder', payload: { path: string; targetFolderPath: string | null }): void
  (e: 'requestCreateFolder', parentPath: string | null): void
}>()

function onQueryInput(event: Event) {
  emit('update:query', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <aside
    :class="
      [
        'relative flex min-h-0 shrink-0 flex-col overflow-hidden bg-transparent',
        isSidebarResizing ? 'transition-none' : 'transition-[width,border-color,opacity] duration-300 ease-out',
        sidebarCollapsed ? 'border-r border-transparent opacity-0' : 'border-r border-[color-mix(in_srgb,white_8%,transparent)] opacity-100',
      ].join(' ')
    "
    :style="{ width: sidebarCollapsed ? '0px' : `${sidebarWidth}px` }"
    :aria-hidden="sidebarCollapsed"
  >
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
        class="flex flex-col border-b border-[color-mix(in_srgb,var(--border)_85%,transparent)]"
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
        <div class="relative flex items-center gap-[var(--space-1)]">
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
            :disabled="!notesDir || isBatchSelecting"
            aria-label="新建笔记"
            @click="emit('createNote')"
          >
            <FilePlus2 class="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
            :disabled="!notesDir || isBatchSelecting"
            aria-label="新建目录"
            @click="emit('requestCreateFolder', null)"
          >
            <FolderPlus class="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7 hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
            :disabled="filteredNotes.length === 0 && !notesDir"
            aria-label="更多操作"
            @click.stop="emit('toggleListActionsMenu')"
          >
            <MoreHorizontal class="h-3.5 w-3.5" />
          </Button>

          <div
            v-if="listActionsMenuOpen"
            class="absolute right-0 top-[calc(100%+0.35rem)] z-30 min-w-[132px] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_92%,transparent)] bg-[color-mix(in_srgb,var(--card)_96%,transparent)] p-1 shadow-[0_12px_28px_rgba(0,0,0,0.45)] backdrop-blur"
            @click.stop
          >
            <button
              type="button"
              class="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--foreground)] hover:bg-[var(--interactive-hover)]"
              @click="emit('toggleBatchSelect')"
            >
              {{ isBatchSelecting ? '退出批量操作' : '批量操作' }}
            </button>
          </div>
        </div>
      </div>

      <NotesTreeList
        :notes="notes"
        :folders="folders"
        :filtered-notes="filteredNotes"
        :query="query"
        :selected-path="selectedPath"
        :is-batch-selecting="isBatchSelecting"
        :selected-paths="selectedPaths"
        :expanded-folder-paths="expandedFolderPaths"
        @open-note="emit('openNote', $event)"
        @toggle-note-selection="emit('toggleNoteSelection', $event)"
        @request-note-context-menu="emit('requestNoteContextMenu', $event)"
        @request-folder-context-menu="emit('requestFolderContextMenu', $event)"
        @toggle-folder-expanded="emit('toggleFolderExpanded', $event)"
        @move-note-to-folder="emit('moveNoteToFolder', $event)"
        @move-folder-to-folder="emit('moveFolderToFolder', $event)"
      />

      <div
        class="mt-auto border-t border-[color-mix(in_srgb,var(--border)_85%,transparent)]"
        :style="{
          paddingLeft: 'var(--sidebar-footer-pad-x)',
          paddingRight: 'var(--sidebar-footer-pad-x)',
          paddingTop: 'var(--sidebar-footer-pad-y)',
          paddingBottom: 'var(--sidebar-footer-pad-y)',
        }"
      >
        <div
          v-if="isBatchSelecting"
          class="flex items-center justify-between gap-[var(--space-2)] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_42%,transparent)] px-[var(--space-2)] py-[var(--space-2)]"
          :style="{ marginBottom: 'var(--sidebar-footer-stack-gap)' }"
        >
          <p class="text-ui-xs text-[var(--muted-foreground)]">已选 {{ selectedPaths.length }}</p>
          <div class="flex items-center gap-[var(--space-1)]">
            <Button
              variant="ghost"
              size="sm"
              class="text-ui-xs h-7 px-2 font-normal text-[var(--destructive)] hover:bg-[var(--interactive-hover)]"
              :disabled="selectedPaths.length === 0"
              @click="emit('confirmDeleteSelected')"
            >
              <Trash2 class="mr-1 h-3.5 w-3.5" />
              删除
            </Button>
            <Button variant="secondary" size="sm" class="text-ui-xs h-7 px-2 font-normal" @click="emit('toggleBatchSelect')">
              完成
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          class="text-ui-sm h-7 w-full justify-start gap-1.5 px-2 font-normal hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]"
          @click="emit('goSettings')"
        >
          <Cog class="h-3.5 w-3.5" />
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
