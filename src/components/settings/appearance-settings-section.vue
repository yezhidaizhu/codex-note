<script setup lang="ts">
import { Droplets, Monitor, MoonStar, Palette, Pipette, RotateCcw, SlidersHorizontal, SunMedium } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import { themePresets } from '@/state/note-style'
import type { AppearanceDensity, AppearanceMode, AppearanceSettings, AppearanceTheme } from '@/lib/types'

const props = defineProps<{
  appearance: AppearanceSettings
  effectiveBackgroundColor: string
  effectiveBackgroundOpacity: number
  modeOptions: Array<{ key: AppearanceMode; label: string; description: string }>
  themeOptions: Array<{ key: AppearanceTheme; label: string; description: string }>
  densityOptions: Array<{ key: AppearanceDensity; label: string; description: string }>
}>()

const emit = defineEmits<{
  (e: 'updateMode', mode: AppearanceMode): void
  (e: 'updateTheme', theme: AppearanceTheme): void
  (e: 'updateDensity', density: AppearanceDensity): void
  (e: 'updateBackgroundColor', backgroundColor: string | null): void
  (e: 'updateBackgroundOpacity', backgroundOpacity: number | null): void
  (e: 'resetAppearance'): void
}>()

function iconForMode(mode: AppearanceMode) {
  if (mode === 'system') return Monitor
  return mode === 'dark' ? MoonStar : SunMedium
}

function compactOptionClass(active: boolean) {
  return [
    'inline-flex h-8 items-center justify-center gap-[var(--space-1)] rounded-[calc(var(--radius)-0.25rem)] px-2.5 text-ui-xs font-medium transition-colors',
    active
      ? 'bg-[var(--interactive-selected)] text-[var(--foreground)]'
      : 'text-[var(--muted-foreground)] hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]',
  ].join(' ')
}

const rowDescriptions = {
  mode: '控制应用整体的明暗外观。',
  theme: '切换界面的强调色。',
  backgroundColor: '统一调整编辑区和侧边栏所在容器的背景色。',
  backgroundOpacity: '100% 为实体背景，低于 100% 会透出后面的应用。',
  density: '调整列表和编辑区的留白密度。',
} as const

function updateBackgroundColor(event: Event) {
  emit('updateBackgroundColor', (event.target as HTMLInputElement).value)
}

function updateBackgroundOpacity(event: Event) {
  emit('updateBackgroundOpacity', Number((event.target as HTMLInputElement).value))
}
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
              <Palette class="h-3.5 w-3.5" />
            </span>
            <p class="text-[15px] font-semibold tracking-[0.01em] text-[var(--foreground)]">样式修改</p>
          </div>
          <Button variant="outline" size="sm" class="gap-[var(--space-1)]" @click="emit('resetAppearance')">
            <RotateCcw class="h-3.5 w-3.5" />
            恢复默认
          </Button>
        </div>
        <p class="text-ui-sm mt-[var(--space-2)] max-w-2xl leading-6 text-[var(--muted-foreground)]">
          重大选择保留明显层级，其余选项用更轻的设置行呈现；界面密度会同步影响列表、编辑区和设置页的留白。
        </p>
      </div>
    </div>

    <div class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] p-[calc(var(--settings-panel-pad)-0.1rem)]">
      <div class="grid items-center gap-[var(--space-3)] pt-0 pb-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <component :is="iconForMode(appearance.mode)" class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">明暗主题</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">{{ rowDescriptions.mode }}</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full lg:justify-end">
            <div class="inline-flex w-full max-w-full flex-wrap gap-[var(--space-1)] rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] p-1 lg:w-auto">
              <button
                v-for="option in modeOptions"
                :key="option.key"
                type="button"
                :class="compactOptionClass(appearance.mode === option.key)"
                @click="emit('updateMode', option.key)"
              >
                <component :is="iconForMode(option.key)" class="h-3.5 w-3.5" />
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Palette class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">主题色</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">{{ rowDescriptions.theme }}</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full lg:justify-end">
            <div class="inline-flex w-full max-w-full flex-wrap gap-[var(--space-1)] rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] p-1 lg:w-auto">
              <button
                v-for="option in themeOptions"
                :key="option.key"
                type="button"
                :class="compactOptionClass(appearance.theme === option.key)"
                @click="emit('updateTheme', option.key)"
              >
                <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: themePresets[option.key].primary }" />
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Pipette class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">背景颜色</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">{{ rowDescriptions.backgroundColor }}</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <div class="flex w-full flex-wrap items-center gap-[var(--space-2)] lg:w-auto lg:justify-end">
              <label
                class="inline-flex h-10 min-w-[168px] items-center gap-[var(--space-2)] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] px-2"
              >
                <input
                  :value="effectiveBackgroundColor"
                  type="color"
                  class="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                  @input="updateBackgroundColor"
                >
                <span class="text-ui-xs font-mono uppercase tracking-[0.08em] text-[var(--foreground)]">
                  {{ effectiveBackgroundColor }}
                </span>
              </label>
              <button
                type="button"
                :class="compactOptionClass(props.appearance.backgroundColor === null)"
                @click="emit('updateBackgroundColor', null)"
              >
                跟随主题
              </button>
            </div>
            <p class="text-ui-xs text-[var(--muted-foreground)] lg:text-right">
              {{ props.appearance.backgroundColor ? '当前使用自定义背景色。' : '当前跟随浅色 / 深色主题默认底色。' }}
            </p>
          </div>
        </div>
      </div>

      <div class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Droplets class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm whitespace-nowrap font-medium">窗口背景透明度</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">{{ rowDescriptions.backgroundOpacity }}</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <div class="flex w-full lg:justify-end">
              <input
                :value="effectiveBackgroundOpacity"
                type="range"
                min="0"
                max="100"
                step="1"
                class="h-2 w-full max-w-[220px] cursor-pointer accent-[var(--primary)]"
                @input="updateBackgroundOpacity"
              >
            </div>
            <p class="text-ui-xs text-[var(--muted-foreground)] lg:text-right">
              当前值 {{ effectiveBackgroundOpacity }}% · {{ effectiveBackgroundOpacity >= 100 ? '实体背景' : '透明模式' }}
            </p>
          </div>
        </div>
      </div>

      <div class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <SlidersHorizontal class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">界面密度</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">{{ rowDescriptions.density }}</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full lg:justify-end">
            <div class="inline-flex w-full max-w-full gap-[var(--space-1)] rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] p-1 sm:w-auto">
              <button
                v-for="option in densityOptions"
                :key="option.key"
                type="button"
                :class="compactOptionClass(appearance.density === option.key)"
                @click="emit('updateDensity', option.key)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
