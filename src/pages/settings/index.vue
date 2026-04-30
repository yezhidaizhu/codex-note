<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, FolderOpen, Settings2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/button.vue'
import { useNotesStore } from '@/state/notes'

const router = useRouter()
const store = useNotesStore()

const sections = [{ key: 'general', label: '通用' }] as const
const activeSectionKey = 'general'
const MAC_WINDOW_CONTROLS_GAP = 'pl-[78px]'

const notesCount = computed(() => store.notes.value.length)
const hasSelectedNote = computed(() => Boolean(store.selectedPath.value))
</script>

<template>
  <div class="app-shell-glass app-shell-surface flex h-full overflow-hidden bg-transparent text-[var(--foreground)] border !border-gray-600 rounded-xl">
    <aside class="flex w-[280px] shrink-0 flex-col border-r border-[color-mix(in_srgb,white_8%,transparent)]">
      <div class="drag-region flex h-9 shrink-0 items-center justify-between border-b border-[color-mix(in_srgb,white_10%,transparent)] px-[var(--space-3)]">
        <div :class="`no-drag flex items-center gap-2 text-[var(--muted-foreground)] ${MAC_WINDOW_CONTROLS_GAP}`">
          <Settings2 class="h-4 w-4" />
          <span class="text-ui-xs uppercase tracking-[0.26em]">Settings</span>
        </div>
      </div>

      <div class="no-drag p-[var(--space-3)]">
        <Button variant="ghost" size="sm" class="text-ui-sm h-8 w-full justify-start gap-2 px-3" @click="router.push('/')">
          <ChevronLeft class="h-4 w-4" />
          返回编辑器
        </Button>
      </div>

      <nav class="no-drag px-[var(--space-2)] pb-[var(--space-3)]">
        <button
          v-for="section in sections"
          :key="section.key"
          type="button"
          :class="
            [
              'text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.1rem)] px-3 py-2 text-left transition',
              section.key === activeSectionKey
                ? 'bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_68%,transparent)] hover:text-[var(--foreground)]',
            ].join(' ')
          "
        >
          {{ section.label }}
        </button>
      </nav>

      <div class="mt-auto border-t border-[color-mix(in_srgb,var(--border)_85%,transparent)] p-[var(--space-3)]">
        <p class="text-ui-xs text-[var(--muted-foreground)]">{{ notesCount }} 篇笔记</p>
        <p class="text-ui-xs text-[var(--muted-foreground)]">{{ hasSelectedNote ? '已打开文档' : '未打开文档' }}</p>
      </div>
    </aside>

    <main class="no-drag flex min-w-0 flex-1 flex-col overflow-hidden">
      <header class="flex shrink-0 items-start justify-between gap-[var(--space-5)] border-b border-[color-mix(in_srgb,white_10%,transparent)] p-[var(--space-5)]">
        <div>
          <p class="text-ui-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">General</p>
          <h1 class="mt-[var(--space-2)] text-3xl font-semibold tracking-tight">通用设置</h1>
          <p class="text-ui-md mt-[var(--space-3)] max-w-2xl leading-7 text-[var(--muted-foreground)]">
            目前只有工作区目录设置。后续新增更多设置时，可以继续归类到这里或新增分类。
          </p>
        </div>
      </header>

      <div class="flex min-h-0 flex-1 flex-col gap-[var(--space-5)] overflow-y-auto p-[var(--space-5)]">
        <section class="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] p-[var(--space-5)]">
          <div class="flex items-start justify-between gap-[var(--space-5)]">
            <div class="min-w-0">
              <p class="text-ui-md font-medium">笔记目录</p>
              <p
                class="text-ui-md mt-[var(--space-2)] break-all text-[var(--muted-foreground)]"
                :class="store.notesDir.value ? 'font-mono text-ui-sm' : ''"
                :title="store.notesDir.value ?? undefined"
              >
                {{ store.notesDir.value ?? '当前还没有连接本地 Markdown 工作区。' }}
              </p>
              <div class="text-ui-sm mt-[var(--space-4)] flex items-center gap-[var(--space-5)] text-[var(--muted-foreground)]">
                <span>{{ notesCount }} 篇笔记</span>
                <span>{{ hasSelectedNote ? '已打开文档' : '未打开文档' }}</span>
              </div>
            </div>

            <Button class="gap-[var(--space-2)]" @click="store.chooseDirectory">
              <FolderOpen class="h-4 w-4" />
              {{ store.notesDir.value ? '更换目录' : '选择目录' }}
            </Button>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
