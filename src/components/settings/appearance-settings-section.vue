<script setup lang="ts">
import { Layers3, Monitor, MoonStar, Palette, SlidersHorizontal, SunMedium } from 'lucide-vue-next'
import { themePresets } from '@/state/notes'
import type { AppearanceDensity, AppearanceMode, AppearanceSettings, AppearanceTheme } from '@/lib/types'

const props = defineProps<{
  appearance: AppearanceSettings
  modeOptions: Array<{ key: AppearanceMode; label: string; description: string }>
  themeOptions: Array<{ key: AppearanceTheme; label: string; description: string }>
  densityOptions: Array<{ key: AppearanceDensity; label: string; description: string }>
}>()

const emit = defineEmits<{
  (e: 'updateMode', mode: AppearanceMode): void
  (e: 'updateTheme', theme: AppearanceTheme): void
  (e: 'updateDensity', density: AppearanceDensity): void
  (e: 'updateTransparentBackground', transparentBackground: boolean): void
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
  transparent: '控制窗口是否保留玻璃透感。',
  density: '调整列表和编辑区的留白密度。',
} as const
</script>

<template>
  <section class="space-y-[var(--space-4)]">
    <div class="min-w-0">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-[var(--space-2)]">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--primary)_26%,var(--border))] bg-[color-mix(in_srgb,var(--interactive-selected)_58%,var(--card))] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <Palette class="h-3.5 w-3.5" />
          </span>
          <p class="text-[15px] font-semibold tracking-[0.01em] text-[var(--foreground)]">样式修改</p>
        </div>
        <p class="text-ui-sm mt-[var(--space-2)] max-w-2xl leading-6 text-[var(--muted-foreground)]">
          重大选择保留明显层级，其余选项用更轻的设置行呈现；界面密度会同步影响列表、编辑区和设置页的留白。
        </p>
      </div>
    </div>

    <div class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] p-[calc(var(--settings-panel-pad)-0.1rem)]">
      <div class="grid items-center gap-[var(--space-3)] pt-0 pb-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[112px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
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

      <div class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[112px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
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

      <div class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[112px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Layers3 class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">背景透明</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">{{ rowDescriptions.transparent }}</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full lg:justify-end">
            <div class="inline-flex w-full max-w-full gap-[var(--space-1)] rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] p-1 sm:w-auto">
              <button
                type="button"
                :class="compactOptionClass(appearance.transparentBackground)"
                @click="emit('updateTransparentBackground', true)"
              >
                开启
              </button>
              <button
                type="button"
                :class="compactOptionClass(!appearance.transparentBackground)"
                @click="emit('updateTransparentBackground', false)"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[112px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
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
