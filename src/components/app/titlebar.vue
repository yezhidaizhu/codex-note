<script setup lang="ts">
import { FilePlus2, PanelLeftClose, PanelLeftOpen, Pin } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'

defineProps<{
  sidebarCollapsed: boolean
  notesDir: string | null
  isPinned: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleSidebar'): void
  (e: 'createNote'): void
  (e: 'togglePinned'): void
}>()

const MAC_WINDOW_CONTROLS_GAP = 'pl-[78px]'
</script>

<template>
  <div
    class="drag-region flex h-9 shrink-0 items-center justify-between border-b border-[var(--separator)] px-[var(--space-3)] text-[var(--muted-foreground)]"
  >
    <div :class="`no-drag flex min-w-0 items-center gap-[var(--space-2)] ${MAC_WINDOW_CONTROLS_GAP}`">
      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6 hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]"
        :aria-label="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
        @click="emit('toggleSidebar')"
      >
        <PanelLeftOpen v-if="sidebarCollapsed" class="h-3.5 w-3.5" />
        <PanelLeftClose v-else class="h-3.5 w-3.5" />
      </Button>
    </div>

    <div class="no-drag flex items-center gap-[var(--space-2)]">
      <Button
        variant="ghost"
        size="icon"
        class="h-6 w-6 transition-all duration-200 hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]"
        :disabled="!notesDir || !sidebarCollapsed"
        aria-label="新建笔记"
        title="新建笔记"
        :tabindex="sidebarCollapsed ? 0 : -1"
        @click="emit('createNote')"
      >
        <FilePlus2 :class="['size-3.5', sidebarCollapsed ? 'opacity-100' : 'opacity-0'].join(' ')" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        :class="
          [
            'h-6 w-6 transition-all duration-200',
            isPinned
              ? 'bg-[var(--interactive-icon-surface-active)] text-[var(--primary)] hover:bg-[var(--interactive-selected-hover)] hover:text-[var(--primary)]'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]',
          ].join(' ')
        "
        :aria-label="isPinned ? '取消置顶' : '置顶窗口'"
        :title="isPinned ? '取消置顶' : '置顶窗口'"
        @click="emit('togglePinned')"
      >
        <Pin :class="['size-3.5', isPinned ? 'rotate-0' : 'rotate-45'].join(' ')" />
      </Button>
    </div>
  </div>
</template>
