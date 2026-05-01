<script setup lang="ts">
import { FolderOpen, SquareArrowOutUpRight } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'

const props = defineProps<{
  notesDir: string | null
  notesCount: number
  hasSelectedNote: boolean
}>()

const emit = defineEmits<{
  (e: 'chooseDirectory'): void
  (e: 'openDirectory'): void
}>()
</script>

<template>
  <section class="space-y-[var(--space-4)]">
    <div class="min-w-0">
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-[var(--space-3)]">
          <div class="flex items-center gap-[var(--space-2)]">
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--primary)_26%,var(--border))] bg-[color-mix(in_srgb,var(--interactive-selected)_58%,var(--card))] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <FolderOpen class="h-3.5 w-3.5" />
            </span>
            <p class="text-[15px] font-semibold tracking-[0.01em] text-[var(--foreground)]">工作区</p>
          </div>
          <div class="flex items-center gap-[var(--space-2)]">
            <Button
              variant="secondary"
              size="sm"
              class="gap-[var(--space-1)]"
              :disabled="!notesDir"
              @click="emit('openDirectory')"
            >
              <SquareArrowOutUpRight class="h-3.5 w-3.5" />
              打开目录
            </Button>
            <Button size="sm" class="gap-[var(--space-1)]" @click="emit('chooseDirectory')">
              <FolderOpen class="h-3.5 w-3.5" />
              {{ notesDir ? '更换目录' : '选择目录' }}
            </Button>
          </div>
        </div>
        <p class="text-ui-sm mt-[var(--space-2)] max-w-2xl leading-6 text-[var(--muted-foreground)]">
          管理当前连接的 Markdown 工作区，以及笔记的基础状态信息。
        </p>
      </div>
    </div>

    <div class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] p-[calc(var(--settings-panel-pad)-0.1rem)]">
      <div class="grid items-center gap-[var(--space-3)] pt-0 pb-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <FolderOpen class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">笔记目录</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">当前工作区、笔记数量和打开状态。</p>
        </div>
        <div class="min-w-0">
          <p
            class="text-ui-sm break-all text-[var(--muted-foreground)] lg:text-right"
            :class="notesDir ? 'font-mono text-ui-xs text-[var(--foreground)]' : ''"
            :title="notesDir ?? undefined"
          >
            {{ notesDir ?? '当前还没有连接本地 Markdown 工作区。' }}
          </p>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)] lg:text-right">
            {{ notesCount }} 篇笔记 · {{ hasSelectedNote ? '已打开文档' : '未打开文档' }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
