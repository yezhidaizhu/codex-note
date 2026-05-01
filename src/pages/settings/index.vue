<script setup lang="ts">
import { computed, ref } from 'vue'
import { CircleArrowLeft } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import Button from '@/components/ui/button.vue'
import AppearanceSettingsSection from '@/components/settings/appearance-settings-section.vue'
import AutomationSettingsSection from '@/components/settings/automation-settings-section.vue'
import GeneralSettingsSection from '@/components/settings/general-settings-section.vue'
import { usePanelResize } from '@/composables/use-panel-resize'
import {
  resolveAppearanceBackgroundColor,
  resolveAppearanceBackgroundOpacity,
  resolveAppearanceMode,
  useNoteStyleStore,
} from '@/state/note-style'
import { useNotesStore } from '@/state/notes'
import type { AppearanceDensity, AppearanceMode, AppearanceTheme } from '@/lib/types'

const router = useRouter()
const notesStore = useNotesStore()
const noteStyleStore = useNoteStyleStore()
const { notes, selectedPath, notesDir, quickCreate, sidebarWidth } = storeToRefs(notesStore)
const { appearance } = storeToRefs(noteStyleStore)

const sections = [
  { key: 'general', label: '通用' },
  { key: 'appearance', label: '外观' },
  { key: 'automation', label: '自动化' },
] as const
const activeSectionKey = ref<(typeof sections)[number]['key']>('general')
const settingsSidebarCollapsed = computed(() => false)
const { isResizing: isSettingsSidebarResizing, beginResize: beginSettingsSidebarResize } = usePanelResize(
  sidebarWidth,
  settingsSidebarCollapsed,
  { minWidth: 220, maxWidth: 420 },
)

const notesCount = computed(() => notes.value.length)
const hasSelectedNote = computed(() => Boolean(selectedPath.value))
const activeSection = computed(() => sections.find((section) => section.key === activeSectionKey.value) ?? sections[0])

const themeOptions: Array<{ key: AppearanceTheme; label: string; description: string }> = [
  { key: 'ember', label: 'Ember', description: '' },
  { key: 'ocean', label: 'Ocean', description: '' },
  { key: 'forest', label: 'Forest', description: '' },
]

const modeOptions: Array<{ key: AppearanceMode; label: string; description: string }> = [
  { key: 'system', label: '跟随系统', description: '' },
  { key: 'dark', label: '暗色', description: '' },
  { key: 'light', label: '亮色', description: '' },
]

const densityOptions: Array<{ key: AppearanceDensity; label: string; description: string }> = [
  { key: 'comfortable', label: '舒适', description: '' },
  { key: 'compact', label: '紧凑', description: '' },
]

const resolvedAppearanceMode = computed(() => resolveAppearanceMode(appearance.value.mode))
const effectiveBackgroundColor = computed(() => resolveAppearanceBackgroundColor(appearance.value, resolvedAppearanceMode.value))
const effectiveBackgroundOpacity = computed(() => resolveAppearanceBackgroundOpacity(appearance.value, resolvedAppearanceMode.value))

function updateMode(mode: AppearanceMode) {
  void noteStyleStore.updateAppearance({ ...appearance.value, mode })
}

function updateTheme(theme: AppearanceTheme) {
  void noteStyleStore.updateAppearance({ ...appearance.value, theme })
}

function updateDensity(density: AppearanceDensity) {
  void noteStyleStore.updateAppearance({ ...appearance.value, density })
}

function updateBackgroundColor(backgroundColor: string | null) {
  void noteStyleStore.updateAppearance({ ...appearance.value, backgroundColor })
}

function updateBackgroundOpacity(backgroundOpacity: number | null) {
  void noteStyleStore.updateAppearance({
    ...appearance.value,
    backgroundOpacity,
    transparentBackground: backgroundOpacity === null ? true : backgroundOpacity < 100,
  })
}

function resetAppearance() {
  void noteStyleStore.resetAppearance()
}

function updateQuickCreateDirectory(directory: string) {
  void notesStore.updateQuickCreateSettings({ ...quickCreate.value, directory })
}

function updateQuickCreateMode(mode: 'create' | 'open') {
  void notesStore.updateQuickCreateSettings({ ...quickCreate.value, mode })
}

function updateQuickCreateTargetPath(targetPath: string) {
  void notesStore.updateQuickCreateSettings({ ...quickCreate.value, targetPath })
}

function updateQuickCreateWriteClipboardOnCreate(writeClipboardOnCreate: boolean) {
  void notesStore.updateQuickCreateSettings({ ...quickCreate.value, writeClipboardOnCreate })
}

function updateQuickCreateNamingRule(namingRule: 'default' | 'datetime') {
  void notesStore.updateQuickCreateSettings({ ...quickCreate.value, namingRule })
}
</script>

<template>
  <div class="app-shell-glass app-shell-surface flex h-full overflow-hidden rounded-xl border border-[var(--shell-border)] bg-transparent text-[var(--foreground)]">
    <aside
      :class="['relative flex shrink-0 flex-col overflow-hidden', isSettingsSidebarResizing ? 'transition-none' : 'transition-[width] duration-300 ease-out'].join(' ')"
      :style="{ width: `${sidebarWidth}px` }"
    >
      <div
        :class="
          [
            'pointer-events-none absolute inset-y-0 right-0 z-10 w-px transition-[background-color,opacity] duration-200',
            isSettingsSidebarResizing ? 'bg-[var(--primary)] opacity-80' : 'bg-[var(--separator)] opacity-55',
          ].join(' ')
        "
        aria-hidden="true"
      />

      <div class="drag-region h-9 shrink-0" />

      <div class="no-drag px-[var(--space-3)] pb-[var(--space-2)]">
        <p class="text-ui-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">设置</p>
      </div>

      <nav class="no-drag px-[var(--space-2)] pb-[var(--space-3)]">
        <Button
          v-for="section in sections"
          :key="section.key"
          variant="ghost"
          size="sm"
          type="button"
          :class="
            [
              'text-ui-sm h-8 w-full justify-start px-3',
              section.key === activeSectionKey
                ? 'bg-[var(--interactive-selected)] text-[var(--foreground)] hover:bg-[var(--interactive-selected-hover)]'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]',
            ].join(' ')
          "
          @click="activeSectionKey = section.key"
        >
          {{ section.label }}
        </Button>
      </nav>

      <div
        class="mt-auto"
        :style="{
          paddingLeft: 'var(--sidebar-footer-pad-x)',
          paddingRight: 'var(--sidebar-footer-pad-x)',
          paddingTop: 'var(--sidebar-footer-pad-y)',
          paddingBottom: 'var(--sidebar-footer-pad-y)',
        }"
      >
        <Button variant="ghost" size="sm" class="text-ui-sm h-8 w-full justify-start gap-2 px-3" @click="router.push('/')">
          <CircleArrowLeft class="h-4 w-4" />
          返回编辑器
        </Button>
      </div>

      <div
        class="absolute inset-y-0 right-[-4px] z-20 w-2 cursor-col-resize transition-opacity duration-200"
        aria-hidden="true"
        @mousedown="beginSettingsSidebarResize"
      />
    </aside>

    <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header class="drag-region flex shrink-0 items-start justify-between gap-[var(--settings-page-gap)] p-[var(--settings-page-pad)]">
        <div>
          <template v-if="activeSection.key === 'general'">
            <p class="text-ui-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">General</p>
            <h1 class="mt-[var(--space-2)] text-3xl font-semibold tracking-tight">通用设置</h1>
            <p class="text-ui-md mt-[var(--space-3)] max-w-2xl leading-7 text-[var(--muted-foreground)]">
              工作区目录、基础状态与编辑器全局行为放在这里管理。
            </p>
          </template>

          <template v-else-if="activeSection.key === 'automation'">
            <p class="text-ui-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Automation</p>
            <h1 class="mt-[var(--space-2)] text-3xl font-semibold tracking-tight">自动化设置</h1>
            <p class="text-ui-md mt-[var(--space-3)] max-w-2xl leading-7 text-[var(--muted-foreground)]">
              管理 Alt + A 这类快速触发动作，以及快速创建时的默认行为与命名规则。
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

      <div class="no-drag flex min-h-0 flex-1 flex-col gap-[var(--settings-page-gap)] overflow-y-auto p-[var(--settings-page-pad)]">
        <GeneralSettingsSection
          v-if="activeSection.key === 'general'"
          :notes-dir="notesDir"
          :notes-count="notesCount"
          :has-selected-note="hasSelectedNote"
          @choose-directory="notesStore.chooseDirectory"
          @open-directory="notesStore.openNotesDirectory"
        />

        <AutomationSettingsSection
          v-else-if="activeSection.key === 'automation'"
          :quick-create="quickCreate"
          @update-quick-create-mode="updateQuickCreateMode"
          @update-quick-create-directory="updateQuickCreateDirectory"
          @update-quick-create-target-path="updateQuickCreateTargetPath"
          @update-quick-create-write-clipboard-on-create="updateQuickCreateWriteClipboardOnCreate"
          @update-quick-create-naming-rule="updateQuickCreateNamingRule"
        />

        <AppearanceSettingsSection
          v-else
          :appearance="appearance"
          :effective-background-color="effectiveBackgroundColor"
          :effective-background-opacity="effectiveBackgroundOpacity"
          :mode-options="modeOptions"
          :theme-options="themeOptions"
          :density-options="densityOptions"
          @update-background-color="updateBackgroundColor"
          @update-background-opacity="updateBackgroundOpacity"
          @update-mode="updateMode"
          @update-theme="updateTheme"
          @update-density="updateDensity"
          @reset-appearance="resetAppearance"
        />
      </div>
    </main>
  </div>
</template>
