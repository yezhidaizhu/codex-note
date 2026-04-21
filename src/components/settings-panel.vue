<script setup lang="ts">
import { FolderOpen, X } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'

defineProps<{
  notesDir: string | null
  notesCount: number
  hasSelectedNote: boolean
}>()

const emit = defineEmits<{
  (e: 'chooseDirectory'): void
  (e: 'close'): void
}>()
</script>

<template>
  <section class="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
    <div class="w-full max-w-3xl space-y-[var(--space-5)]">
      <div class="flex items-start justify-between gap-[var(--space-5)]">
        <div>
          <p class="text-ui-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Settings</p>
          <h2 class="mt-[var(--space-2)] text-3xl font-semibold tracking-tight">工作区设置</h2>
          <p class="text-ui-md mt-[var(--space-3)] max-w-2xl leading-7 text-[var(--muted-foreground)]">
            笔记目录只在设置页管理。主编辑界面不再展示具体本地路径，避免信息噪音，也更像真正的编辑器。
          </p>
        </div>

        <Button variant="ghost" size="sm" class="text-ui-sm h-8 gap-[var(--space-2)] px-3" @click="emit('close')">
          <X class="h-4 w-4" />
          关闭设置
        </Button>
      </div>

      <div
        class="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] p-[var(--space-5)]"
      >
        <div class="flex items-start justify-between gap-[var(--space-5)]">
          <div>
            <p class="text-ui-md font-medium">笔记目录</p>
            <p class="text-ui-md mt-[var(--space-2)] text-[var(--muted-foreground)]">
              {{ notesDir ? '当前已连接一个本地 Markdown 工作区。' : '当前还没有连接本地 Markdown 工作区。' }}
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
      </div>
    </div>
  </section>
</template>

