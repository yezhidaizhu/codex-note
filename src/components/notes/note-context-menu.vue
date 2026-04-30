<script setup lang="ts">
import { FilePlus2, FolderPlus, Trash2 } from 'lucide-vue-next'

defineProps<{
  x: number
  y: number
  targetType: 'note' | 'folder'
}>()

const emit = defineEmits<{
  (e: 'deleteNote'): void
  (e: 'renameNote'): void
  (e: 'createNoteInFolder'): void
  (e: 'createFolderInFolder'): void
  (e: 'renameFolder'): void
  (e: 'deleteFolder'): void
}>()
</script>

<template>
  <div
    class="fixed z-50 min-w-[152px] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_92%,transparent)] bg-[color-mix(in_srgb,var(--card)_96%,transparent)] p-1 shadow-[0_12px_28px_var(--popup-shadow)] backdrop-blur"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
  >
    <template v-if="targetType === 'note'">
      <button
        type="button"
        class="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--foreground)] hover:bg-[var(--interactive-hover)]"
        @click="emit('renameNote')"
      >
        重命名
      </button>
      <button
        type="button"
        class="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--destructive)] hover:bg-[var(--interactive-hover)]"
        @click="emit('deleteNote')"
      >
        <Trash2 class="mr-1.5 h-3.5 w-3.5" />
        删除笔记
      </button>
    </template>

    <template v-else>
      <button
        type="button"
        class="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--foreground)] hover:bg-[var(--interactive-hover)]"
        @click="emit('createNoteInFolder')"
      >
        <FilePlus2 class="mr-1.5 h-3.5 w-3.5" />
        新建笔记
      </button>
      <button
        type="button"
        class="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--foreground)] hover:bg-[var(--interactive-hover)]"
        @click="emit('createFolderInFolder')"
      >
        <FolderPlus class="mr-1.5 h-3.5 w-3.5" />
        新建目录
      </button>
      <button
        type="button"
        class="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--foreground)] hover:bg-[var(--interactive-hover)]"
        @click="emit('renameFolder')"
      >
        重命名
      </button>
      <button
        type="button"
        class="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--destructive)] hover:bg-[var(--interactive-hover)]"
        @click="emit('deleteFolder')"
      >
        <Trash2 class="mr-1.5 h-3.5 w-3.5" />
        删除目录
      </button>
    </template>
  </div>
</template>
