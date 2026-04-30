<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'

defineProps<{
  notesDir: string | null
  notesCount: number
  hasSelectedNote: boolean
}>()

const emit = defineEmits<{
  (e: 'chooseDirectory'): void
}>()
</script>

<template>
  <section>
    <div class="flex items-start justify-between gap-[var(--space-5)]">
      <div class="min-w-0">
        <p class="text-ui-md font-medium">笔记目录</p>
        <p
          class="text-ui-md mt-[var(--space-2)] break-all text-[var(--muted-foreground)]"
          :class="notesDir ? 'font-mono text-ui-sm' : ''"
          :title="notesDir ?? undefined"
        >
          {{ notesDir ?? '当前还没有连接本地 Markdown 工作区。' }}
        </p>
        <div class="text-ui-sm mt-[var(--space-4)] flex items-center gap-[var(--space-5)] text-[var(--muted-foreground)]">
          <span>{{ notesCount }} 篇笔记</span>
          <span>{{ hasSelectedNote ? '已打开文档' : '未打开文档' }}</span>
        </div>
      </div>

      <Button class="gap-[var(--space-2)]" @click="emit('chooseDirectory')">
        <FolderOpen class="h-4 w-4" />
        {{ notesDir ? '更换目录' : '选择目录' }}
      </Button>
    </div>
  </section>
</template>
