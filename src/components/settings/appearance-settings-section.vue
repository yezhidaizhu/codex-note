<script setup lang="ts">
import { Layers3, Monitor, MoonStar, Palette, SlidersHorizontal, SunMedium } from 'lucide-vue-next'
import { themePresets } from '@/state/notes'
import type { AppearanceDensity, AppearanceMode, AppearanceSettings, AppearanceTheme } from '@/lib/types'

defineProps<{
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
</script>

<template>
  <section class="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] p-[var(--space-5)]">
    <div class="flex items-start gap-[var(--space-3)]">
      <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--card)_65%,transparent)] text-[var(--primary)]">
        <Palette class="h-4 w-4" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-ui-md font-medium">样式修改</p>
        <p class="text-ui-md mt-[var(--space-2)] max-w-2xl leading-7 text-[var(--muted-foreground)]">
          现在可以分别调整明暗模式、主题色、应用背景透明和界面密度，改动会即时应用到编辑器与侧边栏。
        </p>

        <div class="mt-[var(--space-5)]">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <component :is="iconForMode(appearance.mode)" class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">明暗主题</p>
          </div>
          <div class="mt-[var(--space-3)] grid gap-[var(--space-3)] md:grid-cols-3">
            <button
              v-for="option in modeOptions"
              :key="option.key"
              type="button"
              :class="
                [
                  'rounded-[calc(var(--radius)-0.05rem)] border px-[var(--space-3)] py-[var(--space-3)] text-left transition',
                  appearance.mode === option.key
                    ? 'border-[color-mix(in_srgb,var(--primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]'
                    : 'border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_34%,transparent)] hover:bg-[var(--interactive-hover)]',
                ].join(' ')
              "
              @click="emit('updateMode', option.key)"
            >
              <div class="flex items-center gap-[var(--space-2)]">
                <component :is="iconForMode(option.key)" class="h-4 w-4 text-[var(--muted-foreground)]" />
                <p class="text-ui-sm font-medium text-[var(--foreground)]">{{ option.label }}</p>
              </div>
              <p class="text-ui-xs mt-[var(--space-2)] leading-6 text-[var(--muted-foreground)]">{{ option.description }}</p>
            </button>
          </div>
        </div>

        <div class="mt-[var(--space-5)]">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Palette class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">主题色</p>
          </div>
          <div class="mt-[var(--space-3)] grid gap-[var(--space-3)] md:grid-cols-3">
            <button
              v-for="option in themeOptions"
              :key="option.key"
              type="button"
              :class="
                [
                  'rounded-[calc(var(--radius)-0.05rem)] border px-[var(--space-3)] py-[var(--space-3)] text-left transition',
                  appearance.theme === option.key
                    ? 'border-[color-mix(in_srgb,var(--primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]'
                    : 'border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_34%,transparent)] hover:bg-[var(--interactive-hover)]',
                ].join(' ')
              "
              @click="emit('updateTheme', option.key)"
            >
              <div class="flex items-center gap-[var(--space-2)]">
                <span
                  class="h-3.5 w-3.5 rounded-full border border-white/10"
                  :style="{ backgroundColor: themePresets[option.key].primary }"
                />
                <p class="text-ui-sm font-medium text-[var(--foreground)]">{{ option.label }}</p>
              </div>
              <p class="text-ui-xs mt-[var(--space-2)] leading-6 text-[var(--muted-foreground)]">{{ option.description }}</p>
            </button>
          </div>
        </div>

        <div class="mt-[var(--space-5)]">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Layers3 class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">应用背景透明</p>
          </div>
          <div class="mt-[var(--space-3)] grid gap-[var(--space-3)] md:grid-cols-2">
            <button
              type="button"
              :class="
                [
                  'rounded-[calc(var(--radius)-0.05rem)] border px-[var(--space-3)] py-[var(--space-3)] text-left transition',
                  appearance.transparentBackground
                    ? 'border-[color-mix(in_srgb,var(--primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]'
                    : 'border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_34%,transparent)] hover:bg-[var(--interactive-hover)]',
                ].join(' ')
              "
              @click="emit('updateTransparentBackground', true)"
            >
              <p class="text-ui-sm font-medium text-[var(--foreground)]">开启</p>
              <p class="text-ui-xs mt-[var(--space-2)] leading-6 text-[var(--muted-foreground)]">窗口底部会透出背后的应用，并保留玻璃模糊感。</p>
            </button>
            <button
              type="button"
              :class="
                [
                  'rounded-[calc(var(--radius)-0.05rem)] border px-[var(--space-3)] py-[var(--space-3)] text-left transition',
                  !appearance.transparentBackground
                    ? 'border-[color-mix(in_srgb,var(--primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]'
                    : 'border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_34%,transparent)] hover:bg-[var(--interactive-hover)]',
                ].join(' ')
              "
              @click="emit('updateTransparentBackground', false)"
            >
              <p class="text-ui-sm font-medium text-[var(--foreground)]">关闭</p>
              <p class="text-ui-xs mt-[var(--space-2)] leading-6 text-[var(--muted-foreground)]">窗口底改成实体背景，不再透出后面的应用。</p>
            </button>
          </div>
        </div>

        <div class="mt-[var(--space-5)]">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <SlidersHorizontal class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">界面密度</p>
          </div>
          <div class="mt-[var(--space-3)] grid gap-[var(--space-3)] md:grid-cols-2">
            <button
              v-for="option in densityOptions"
              :key="option.key"
              type="button"
              :class="
                [
                  'rounded-[calc(var(--radius)-0.05rem)] border px-[var(--space-3)] py-[var(--space-3)] text-left transition',
                  appearance.density === option.key
                    ? 'border-[color-mix(in_srgb,var(--primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]'
                    : 'border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_34%,transparent)] hover:bg-[var(--interactive-hover)]',
                ].join(' ')
              "
              @click="emit('updateDensity', option.key)"
            >
              <p class="text-ui-sm font-medium text-[var(--foreground)]">{{ option.label }}</p>
              <p class="text-ui-xs mt-[var(--space-2)] leading-6 text-[var(--muted-foreground)]">{{ option.description }}</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
