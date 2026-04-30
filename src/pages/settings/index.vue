<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, Settings2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/button.vue'
import AppearanceSettingsSection from '@/components/settings/appearance-settings-section.vue'
import GeneralSettingsSection from '@/components/settings/general-settings-section.vue'
import { useNotesStore } from '@/state/notes'
import type { AppearanceDensity, AppearanceMode, AppearanceTheme } from '@/lib/types'

const router = useRouter()
const store = useNotesStore()
const { notes, selectedPath, appearance, notesDir } = storeToRefs(store)

const sections = [
  { key: 'general', label: '通用' },
  { key: 'appearance', label: '外观' },
] as const
const activeSectionKey = ref<(typeof sections)[number]['key']>('general')
const MAC_WINDOW_CONTROLS_GAP = 'pl-[78px]'

const notesCount = computed(() => notes.value.length)
const hasSelectedNote = computed(() => Boolean(selectedPath.value))
const activeSection = computed(() => sections.find((section) => section.key === activeSectionKey.value) ?? sections[0])

const themeOptions: Array<{ key: AppearanceTheme; label: string; description: string }> = [
  { key: 'ember', label: 'Ember', description: '当前这套暖橙强调色，适合编辑器氛围。' },
  { key: 'ocean', label: 'Ocean', description: '更冷静的蓝色强调，层次会更利落。' },
  { key: 'forest', label: 'Forest', description: '偏绿的柔和强调，视觉更安静。' },
]

const modeOptions: Array<{ key: AppearanceMode; label: string; description: string }> = [
  { key: 'system', label: '跟随系统', description: '跟着电脑当前主题走，系统切换明暗时这里会自动更新。' },
  { key: 'dark', label: '暗色', description: '更聚焦内容，适合长时间编辑与夜间环境。' },
  { key: 'light', label: '亮色', description: '整体更轻快，适合白天与高亮环境。' },
]

const densityOptions: Array<{ key: AppearanceDensity; label: string; description: string }> = [
  { key: 'comfortable', label: '舒适', description: '保留更多留白，阅读更轻松。' },
  { key: 'compact', label: '紧凑', description: '压缩列表与工具区间距，信息密度更高。' },
]

function updateMode(mode: AppearanceMode) {
  void store.updateAppearance({ ...appearance.value, mode })
}

function updateTheme(theme: AppearanceTheme) {
  void store.updateAppearance({ ...appearance.value, theme })
}

function updateDensity(density: AppearanceDensity) {
  void store.updateAppearance({ ...appearance.value, density })
}

function updateTransparentBackground(transparentBackground: boolean) {
  void store.updateAppearance({ ...appearance.value, transparentBackground })
}
</script>

<template>
  <div class="app-shell-glass app-shell-surface flex h-full overflow-hidden rounded-xl border border-[var(--shell-border)] bg-transparent text-[var(--foreground)]">
    <aside class="flex w-[280px] shrink-0 flex-col border-r border-[var(--separator)]">
      <div class="drag-region flex h-9 shrink-0 items-center justify-between border-b border-[var(--separator)] px-[var(--space-3)]">
        <div :class="`no-drag flex items-center gap-2 text-[var(--muted-foreground)] ${MAC_WINDOW_CONTROLS_GAP}`">
          <Settings2 class="h-4 w-4" />
          <span class="text-ui-xs uppercase tracking-[0.26em]">Settings</span>
        </div>
      </div>

      <div class="no-drag px-[var(--space-2)] py-[var(--space-3)]">
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
                ? 'bg-[var(--interactive-selected)] text-[var(--foreground)] hover:bg-[var(--interactive-selected-hover)]'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]',
            ].join(' ')
          "
          @click="activeSectionKey = section.key"
        >
          {{ section.label }}
        </button>
      </nav>

      <div class="mt-auto border-t border-[color-mix(in_srgb,var(--border)_85%,transparent)] p-[var(--space-3)]">
        <p class="text-ui-xs text-[var(--muted-foreground)]">{{ notesCount }} 篇笔记</p>
        <p class="text-ui-xs text-[var(--muted-foreground)]">{{ hasSelectedNote ? '已打开文档' : '未打开文档' }}</p>
      </div>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header class="drag-region flex shrink-0 items-start justify-between gap-[var(--space-5)] border-b border-[var(--separator)] p-[var(--space-5)]">
        <div>
          <template v-if="activeSection.key === 'general'">
            <p class="text-ui-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">General</p>
            <h1 class="mt-[var(--space-2)] text-3xl font-semibold tracking-tight">通用设置</h1>
            <p class="text-ui-md mt-[var(--space-3)] max-w-2xl leading-7 text-[var(--muted-foreground)]">
              工作区目录、基础状态与编辑器全局行为放在这里管理。
            </p>
          </template>

          <template v-else>
            <p class="text-ui-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Appearance</p>
            <h1 class="mt-[var(--space-2)] text-3xl font-semibold tracking-tight">外观设置</h1>
            <p class="text-ui-md mt-[var(--space-3)] max-w-2xl leading-7 text-[var(--muted-foreground)]">
              明暗模式、主题色与界面密度会即时应用到编辑器和侧边栏。
            </p>
          </template>
        </div>
      </header>

      <div class="no-drag flex min-h-0 flex-1 flex-col gap-[var(--space-5)] overflow-y-auto p-[var(--space-5)]">
        <GeneralSettingsSection
          v-if="activeSection.key === 'general'"
          :notes-dir="notesDir"
          :notes-count="notesCount"
          :has-selected-note="hasSelectedNote"
          @choose-directory="store.chooseDirectory"
        />

        <AppearanceSettingsSection
          v-else
          :appearance="appearance"
          :mode-options="modeOptions"
          :theme-options="themeOptions"
          :density-options="densityOptions"
          @update-transparent-background="updateTransparentBackground"
          @update-mode="updateMode"
          @update-theme="updateTheme"
          @update-density="updateDensity"
        />
      </div>
    </main>
  </div>
</template>
