<script setup lang="ts">
import { FolderOpen, ImagePlus, SlidersHorizontal, Trash2 } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import { editorFeatureOptions } from '@/components/editor/editor-feature-options'
import type { EditorFeatureKey, EditorSettings } from '@/lib/types'

defineProps<{
  editorSettings: EditorSettings
  notesDir: string | null
  resolvedImageDirectoryPath: string | null
}>()

const emit = defineEmits<{
  (e: 'toggleFeature', feature: EditorFeatureKey, enabled: boolean): void
  (e: 'requestEditImageDirectory'): void
  (e: 'openImageDirectory'): void
  (e: 'cleanupUnusedImages'): void
}>()
</script>

<template>
  <section class="space-y-[var(--space-4)]">
    <div class="min-w-0">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-[var(--space-2)]">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--primary)_26%,var(--border))] bg-[color-mix(in_srgb,var(--interactive-selected)_58%,var(--card))] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <SlidersHorizontal class="h-3.5 w-3.5" />
          </span>
          <p class="text-[15px] font-semibold tracking-[0.01em] text-[var(--foreground)]">编辑器能力</p>
        </div>
        <p class="text-ui-sm mt-[var(--space-2)] max-w-2xl leading-6 text-[var(--muted-foreground)]">
          控制右侧 Markdown 编辑器暴露出来的常用能力。关闭后对应按钮会隐藏，图片粘贴也会一起禁用。
        </p>
      </div>
    </div>

    <div class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] px-[calc(var(--settings-panel-pad)-0.1rem)] py-[calc(var(--settings-panel-pad)-0.28rem)]">
      <div class="grid gap-[var(--space-3)] md:grid-cols-2">
        <label
          v-for="feature in editorFeatureOptions"
          :key="feature.key"
          class="flex cursor-pointer items-start justify-between gap-[var(--space-4)] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_30%,transparent)] px-3 py-2.5"
        >
          <div>
            <p class="text-ui-sm font-medium text-[var(--foreground)]">{{ feature.label }}</p>
            <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">{{ feature.description }}</p>
          </div>
          <span class="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
            <input
              :checked="editorSettings.enabledFeatures.includes(feature.key)"
              type="checkbox"
              class="peer absolute inset-0 z-10 cursor-pointer opacity-0"
              @change="emit('toggleFeature', feature.key, ($event.target as HTMLInputElement).checked)"
            >
                <span
                  class="h-4 w-4 rounded-[4px] border border-red-500 bg-transparent transition-colors peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary)]"
                />
                <svg
                  viewBox="0 0 16 16"
                  class="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
                  aria-hidden="true"
                >
                  <path
                    d="M4 8.2 6.6 10.8 12 5.4"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.35"
                  />
                </svg>
              </span>
        </label>
      </div>

    </div>

    <div class="min-w-0 pt-[var(--space-2)]">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-[var(--space-2)]">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--primary)_26%,var(--border))] bg-[color-mix(in_srgb,var(--interactive-selected)_58%,var(--card))] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <ImagePlus class="h-3.5 w-3.5" />
          </span>
          <p class="text-[15px] font-semibold tracking-[0.01em] text-[var(--foreground)]">图片目录</p>
        </div>
        <p class="text-ui-sm mt-[var(--space-2)] max-w-2xl leading-6 text-[var(--muted-foreground)]">
          单独管理图片保存位置。
        </p>
      </div>
    </div>

    <div class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] p-[calc(var(--settings-panel-pad)-0.1rem)]">
      <div class="grid gap-[var(--space-3)] pt-0 pb-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <p class="text-ui-sm font-medium text-[var(--foreground)]">目录规则</p>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">定义新插入图片保存到笔记目录里的哪个位置。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <div
              class="text-ui-xs flex min-h-9 w-full items-center rounded-[calc(var(--radius)-0.15rem)] border border-[color-mix(in_srgb,var(--border)_84%,transparent)] bg-[color-mix(in_srgb,var(--editor)_20%,transparent)] px-3 font-mono text-[var(--foreground)] lg:max-w-[420px]"
            >
              {{ editorSettings.imageDirectory }}
            </div>
            <p class="text-ui-xs text-[var(--muted-foreground)] lg:max-w-[420px] lg:text-right">
              当前目录：{{ resolvedImageDirectoryPath ?? '未连接笔记目录' }}
            </p>
            <p class="text-ui-xs text-[var(--muted-foreground)] lg:max-w-[420px] lg:text-right">
              修改后只影响新图片。
            </p>
          </div>
        </div>
      </div>

      <div class="grid gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <p class="text-ui-sm font-medium text-[var(--foreground)]">目录操作</p>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">打开当前图片目录，或更新之后新图片的保存规则。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-wrap gap-[var(--space-2)] lg:justify-end">
            <Button variant="ghost" size="sm" class="gap-[var(--space-1)]" @click="emit('openImageDirectory')">
              <FolderOpen class="h-3.5 w-3.5" />
              打开目录
            </Button>
            <Button variant="secondary" size="sm" class="gap-[var(--space-1)]" @click="emit('requestEditImageDirectory')">
              修改目录
            </Button>
          </div>
        </div>
      </div>

      <div class="grid gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--destructive)_22%,var(--border))] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <p class="text-ui-sm font-medium text-[var(--foreground)]">清理未引用图片</p>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">按整个笔记库里的 Markdown 引用，清理当前图片目录中未被使用的文件。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <p class="text-ui-xs break-all font-mono text-[var(--muted-foreground)] lg:max-w-[420px] lg:text-right">
              清理目录：{{ resolvedImageDirectoryPath ?? '未连接笔记目录' }}
            </p>
            <div class="flex w-full lg:justify-end">
              <Button variant="ghost" size="sm" class="gap-[var(--space-1)] text-[var(--destructive)]" @click="emit('cleanupUnusedImages')">
                <Trash2 class="h-3.5 w-3.5" />
                清理未引用
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
