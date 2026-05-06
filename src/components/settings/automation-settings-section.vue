<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Clipboard, FilePlus2, Keyboard, Link2, Sparkles } from 'lucide-vue-next'
import Input from '@/components/ui/input.vue'
import type { QuickCreateSettings } from '@/lib/types'

const props = defineProps<{
  quickCreate: QuickCreateSettings
}>()

const emit = defineEmits<{
  (e: 'updateQuickCreateMode', mode: 'create' | 'open'): void
  (e: 'updateQuickCreateDirectory', directory: string): void
  (e: 'updateQuickCreateTargetPath', targetPath: string): void
  (e: 'updateQuickCreateWriteClipboardOnCreate', writeClipboardOnCreate: boolean): void
  (e: 'updateQuickCreateNamingRule', namingRule: 'default' | 'datetime'): void
  (e: 'updateQuickCreateCenterWindowOnTrigger', centerWindowOnTrigger: boolean): void
  (e: 'updateQuickCreateHideWindowOnTriggerWhenFocused', hideWindowOnTriggerWhenFocused: boolean): void
}>()

const quickCreateDirectoryDraft = ref(props.quickCreate.directory)
const quickCreateTargetPathDraft = ref(props.quickCreate.targetPath)

const effectiveQuickCreateDirectory = computed(() => props.quickCreate.directory || '/')
const effectiveQuickCreateTargetPath = computed(() => props.quickCreate.targetPath || '未设置')

function compactOptionClass(active: boolean) {
  return [
    'inline-flex h-8 items-center justify-center gap-[var(--space-1)] rounded-[calc(var(--radius)-0.25rem)] px-2.5 text-ui-xs font-medium transition-colors',
    active
      ? 'bg-[var(--interactive-selected)] text-[var(--foreground)]'
      : 'text-[var(--muted-foreground)] hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]',
  ].join(' ')
}

watch(
  () => props.quickCreate.directory,
  (directory) => {
    quickCreateDirectoryDraft.value = directory
  },
  { immediate: true },
)

watch(
  () => props.quickCreate.targetPath,
  (targetPath) => {
    quickCreateTargetPathDraft.value = targetPath
  },
  { immediate: true },
)

function updateQuickCreateMode(mode: 'create' | 'open') {
  emit('updateQuickCreateMode', mode)
}

function updateQuickCreateDirectoryDraft(event: Event) {
  quickCreateDirectoryDraft.value = (event.target as HTMLInputElement).value
}

function submitQuickCreateDirectory() {
  emit('updateQuickCreateDirectory', quickCreateDirectoryDraft.value)
}

function onQuickCreateDirectoryKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  submitQuickCreateDirectory()
}

function updateQuickCreateWriteClipboardOnCreate(event: Event) {
  emit('updateQuickCreateWriteClipboardOnCreate', (event.target as HTMLInputElement).checked)
}

function updateQuickCreateCenterWindowOnTrigger(event: Event) {
  emit('updateQuickCreateCenterWindowOnTrigger', (event.target as HTMLInputElement).checked)
}

function updateQuickCreateHideWindowOnTriggerWhenFocused(event: Event) {
  emit('updateQuickCreateHideWindowOnTriggerWhenFocused', (event.target as HTMLInputElement).checked)
}

function updateQuickCreateTargetPathDraft(event: Event) {
  quickCreateTargetPathDraft.value = (event.target as HTMLInputElement).value
}

function submitQuickCreateTargetPath() {
  emit('updateQuickCreateTargetPath', quickCreateTargetPathDraft.value)
}

function onQuickCreateTargetPathKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  submitQuickCreateTargetPath()
}
</script>

<template>
  <section class="space-y-[var(--space-4)]">
    <div class="min-w-0 pt-[var(--space-2)]">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-[var(--space-2)]">
          <div class="flex items-center gap-[var(--space-2)]">
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--primary)_26%,var(--border))] bg-[color-mix(in_srgb,var(--interactive-selected)_58%,var(--card))] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            >
              <Keyboard class="h-3.5 w-3.5" />
            </span>
            <p class="text-[15px] font-semibold tracking-[0.01em] text-[var(--foreground)]">快速创建</p>
          </div>
        </div>
        <p class="text-ui-sm mt-[var(--space-2)] max-w-2xl leading-6 text-[var(--muted-foreground)]">
          配置快捷唤起后的默认行为。
        </p>
      </div>
    </div>

    <div class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] p-[calc(var(--settings-panel-pad)-0.1rem)]">
      <div class="grid items-center gap-[var(--space-3)] pt-0 pb-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Keyboard class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">默认动作</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">快捷唤起后执行“新建”或“打开”。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full lg:justify-end">
            <div class="inline-flex w-full max-w-full flex-wrap gap-[var(--space-1)] rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] p-1 lg:w-auto">
              <button
                type="button"
                :class="compactOptionClass(props.quickCreate.mode === 'create')"
                @click="updateQuickCreateMode('create')"
              >
                新建笔记
              </button>
              <button
                type="button"
                :class="compactOptionClass(props.quickCreate.mode === 'open')"
                @click="updateQuickCreateMode('open')"
              >
                打开指定文件
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="props.quickCreate.mode === 'create'"
        class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <FilePlus2 class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">新建目录</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">默认是 `/快速创建`。留空时写到工作区根目录。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <Input
              :value="quickCreateDirectoryDraft"
              class="text-ui-xs h-7 max-w-[280px] px-2.5 lg:w-[280px]"
              placeholder="/快速创建"
              @input="updateQuickCreateDirectoryDraft"
              @blur="submitQuickCreateDirectory"
              @keydown="onQuickCreateDirectoryKeydown"
            />
            <p class="text-ui-xs text-[var(--muted-foreground)] lg:text-right">
              当前生效路径：{{ effectiveQuickCreateDirectory }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="props.quickCreate.mode === 'create'"
        class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Sparkles class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">命名规则</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">控制新建笔记时的默认文件名来源。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full lg:justify-end">
            <div class="inline-flex w-full max-w-full flex-wrap gap-[var(--space-1)] rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] p-1 lg:w-auto">
              <button
                type="button"
                :class="compactOptionClass(props.quickCreate.namingRule === 'default')"
                @click="emit('updateQuickCreateNamingRule', 'default')"
              >
                默认命名
              </button>
              <button
                type="button"
                :class="compactOptionClass(props.quickCreate.namingRule === 'datetime')"
                @click="emit('updateQuickCreateNamingRule', 'datetime')"
              >
                日期时间
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Link2 class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">目标文件</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">相对工作区根目录，例如 `Daily/inbox.md`。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <Input
              :value="quickCreateTargetPathDraft"
              class="text-ui-xs h-7 max-w-[280px] px-2.5 lg:w-[280px]"
              placeholder="Daily/inbox.md"
              @input="updateQuickCreateTargetPathDraft"
              @blur="submitQuickCreateTargetPath"
              @keydown="onQuickCreateTargetPathKeydown"
            />
            <p class="text-ui-xs text-[var(--muted-foreground)] lg:text-right">
              当前生效路径：{{ effectiveQuickCreateTargetPath }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="props.quickCreate.mode === 'create'"
        class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Clipboard class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">写入剪贴板内容</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">开启后，会把当前剪贴板文本带进草稿里。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full lg:justify-end">
            <label
              class="flex w-full max-w-[360px] cursor-pointer items-center justify-between gap-[var(--space-4)] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] px-3 py-2.5"
            >
              <span class="text-ui-sm text-[var(--foreground)]">
                {{ props.quickCreate.writeClipboardOnCreate ? '已开启，创建时直接写入。' : '已关闭，创建时保持空白。' }}
              </span>
              <span class="relative flex h-4 w-4 shrink-0 items-center justify-center">
                <input
                  :checked="props.quickCreate.writeClipboardOnCreate"
                  type="checkbox"
                  class="peer absolute inset-0 z-10 cursor-pointer opacity-0"
                  @change="updateQuickCreateWriteClipboardOnCreate"
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
      </div>
    </div>

    <div class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] p-[calc(var(--settings-panel-pad)-0.1rem)]">
      <div
        class="grid items-center gap-[var(--space-3)] pt-0 pb-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Keyboard class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">唤起时居中</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">开启后快捷唤起会把窗口居中显示；关闭后按上次位置显示。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full lg:justify-end">
            <label
              class="flex w-full max-w-[360px] cursor-pointer items-center justify-between gap-[var(--space-4)] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] px-3 py-2.5"
            >
              <span class="text-ui-sm text-[var(--foreground)]">
                {{ props.quickCreate.centerWindowOnTrigger ? '已开启，唤起时重新居中。' : '已关闭，唤起时保持上次位置。' }}
              </span>
              <span class="relative flex h-4 w-4 shrink-0 items-center justify-center">
                <input
                  :checked="props.quickCreate.centerWindowOnTrigger"
                  type="checkbox"
                  class="peer absolute inset-0 z-10 cursor-pointer opacity-0"
                  @change="updateQuickCreateCenterWindowOnTrigger"
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
      </div>

      <div
        class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <Keyboard class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">聚焦时收起窗口</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">开启后，如果窗口当前已在前台聚焦，再次快捷唤起会直接收起窗口。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full lg:justify-end">
            <label
              class="flex w-full max-w-[360px] cursor-pointer items-center justify-between gap-[var(--space-4)] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] px-3 py-2.5"
            >
              <span class="text-ui-sm text-[var(--foreground)]">
                {{ props.quickCreate.hideWindowOnTriggerWhenFocused ? '已开启，聚焦时会收起窗口。' : '已关闭，聚焦时仍执行快速创建。' }}
              </span>
              <span class="relative flex h-4 w-4 shrink-0 items-center justify-center">
                <input
                  :checked="props.quickCreate.hideWindowOnTriggerWhenFocused"
                  type="checkbox"
                  class="peer absolute inset-0 z-10 cursor-pointer opacity-0"
                  @change="updateQuickCreateHideWindowOnTriggerWhenFocused"
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
      </div>
    </div>
  </section>
</template>
