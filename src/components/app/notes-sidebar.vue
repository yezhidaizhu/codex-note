<script setup lang="ts">
import { Cog, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
import NoteListItem from '@/components/note-list-item.vue'
import { formatCompactDate, getListLabel } from '@/state/notes'
import type { NoteListItem as NoteListItemData } from '@/lib/types'

const props = defineProps<{
  notesDir: string | null
  notes: NoteListItemData[]
  filteredNotes: NoteListItemData[]
  query: string
  selectedBasename: string | null
  sidebarCollapsed: boolean
  sidebarWidth: number
  isSidebarResizing: boolean
  isBatchSelecting: boolean
  selectedBasenames: string[]
  listActionsMenuOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'createNote'): void
  (e: 'openNote', basename: string): void
  (e: 'toggleListActionsMenu'): void
  (e: 'toggleBatchSelect'): void
  (e: 'toggleNoteSelection', basename: string): void
  (e: 'confirmDeleteSelected'): void
  (e: 'goSettings'): void
  (e: 'beginResize', event: MouseEvent): void
  (e: 'requestContextMenu', payload: { basename: string; x: number; y: number }): void
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
      <div class="panel-padding panel-stack flex flex-col border-b border-[color-mix(in_srgb,var(--border)_85%,transparent)]">
        <div class="relative">
          <Search
            class="pointer-events-none absolute left-[var(--space-3)] top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <Input
            :value="query"
            class="text-ui-sm h-7 border-none bg-[color-mix(in_srgb,var(--card)_58%,transparent)] pl-9 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0"
            placeholder="搜索笔记"
            @input="onQueryInput"
          />
        </div>
      </div>

      <div class="flex items-center justify-between px-[var(--space-3)] py-[var(--space-2)]">
        <p class="text-ui-xs text-[var(--muted-foreground)]">笔记 {{ filteredNotes.length }}</p>
        <div class="relative flex items-center gap-[var(--space-1)]">
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7"
            :disabled="!notesDir || isBatchSelecting"
            aria-label="新建笔记"
            @click="emit('createNote')"
          >
            <Plus class="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7"
            :disabled="filteredNotes.length === 0"
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
              class="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_80%,transparent)]"
              @click="emit('toggleBatchSelect')"
            >
              {{ isBatchSelecting ? '退出批量操作' : '批量操作' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredNotes.length === 0" class="px-[var(--space-3)] pb-[var(--space-3)]">
        <div
          class="rounded-[var(--radius)] border border-dashed border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--card)_42%,transparent)] p-[var(--space-4)] text-sm text-[var(--muted-foreground)]"
        >
          <p>{{ query ? '没有匹配的笔记。' : '这里还没有笔记。' }}</p>
          <p class="mt-2 text-xs">
            {{ query ? '试试别的关键词。' : '新建后会直接保存为本地 `.md` 文件。' }}
          </p>
        </div>
      </div>
      <div v-else class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-[var(--space-2)] pb-[var(--space-2)]">
        <NoteListItem
          v-for="item in filteredNotes"
          :key="item.basename"
          :label="getListLabel(item)"
          :date-label="formatCompactDate(item.updatedAt)"
          :selected="selectedBasename === item.basename"
          :selection-mode="isBatchSelecting"
          :checked="selectedBasenames.includes(item.basename)"
          @toggleChecked="emit('toggleNoteSelection', item.basename)"
          @open="emit('openNote', item.basename)"
          @context-menu="
            (event) => {
              if (isBatchSelecting) return
              emit('requestContextMenu', { basename: item.basename, x: event.clientX, y: event.clientY })
            }
          "
        />
      </div>

      <div class="mt-auto border-t border-[color-mix(in_srgb,var(--border)_85%,transparent)] px-[var(--space-2)] py-[var(--space-2)]">
        <div
          v-if="isBatchSelecting"
          class="mb-[var(--space-2)] flex items-center justify-between gap-[var(--space-2)] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_42%,transparent)] px-[var(--space-2)] py-[var(--space-2)]"
        >
          <p class="text-ui-xs text-[var(--muted-foreground)]">已选 {{ selectedBasenames.length }}</p>
          <div class="flex items-center gap-[var(--space-1)]">
            <Button
              variant="ghost"
              size="sm"
              class="text-ui-xs h-7 px-2 font-normal text-[var(--destructive)]"
              :disabled="selectedBasenames.length === 0"
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

        <Button variant="ghost" size="sm" class="text-ui-sm h-7 w-full justify-start gap-1.5 px-2 font-normal" @click="emit('goSettings')">
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
