<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { GitBranch, GitCommitHorizontal, GitPullRequestArrow, ShieldEllipsis } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
import Textarea from '@/components/ui/textarea.vue'
import type { GitAutomationSettings, GitStatus } from '@/lib/types'

const props = defineProps<{
  notesDir: string | null
  gitStatus: GitStatus
  gitAutomation: GitAutomationSettings
  gitignoreDraft: string
}>()

const emit = defineEmits<{
  (e: 'initGitRepo'): void
  (e: 'updateGitAutomationEnabled', enabled: boolean): void
  (e: 'updateGitAutomationInterval', minutes: number): void
  (e: 'updateGitignoreDraft', content: string): void
  (e: 'commitGitNow'): void
}>()

const repoStatusText = computed(() => {
  if (!props.notesDir) return '请先选择笔记目录。'
  if (!props.gitStatus.isGitAvailable) return '当前系统未安装 Git。'
  return props.gitStatus.isRepoInitialized ? '当前目录已初始化 Git 仓库。' : '当前目录还没有 Git 仓库。'
})

const nowMs = ref(Date.now())
let countdownTimer: number | null = null

const lastCommitText = computed(() => {
  if (!props.gitStatus.lastCommitAt) return '暂无提交记录'
  return new Date(props.gitStatus.lastCommitAt).toLocaleString()
})

const nextAutoCommitCountdownText = computed(() => {
  if (!props.gitAutomation.autoCommitEnabled) return '自动提交未开启'
  if (!props.gitStatus.nextAutoCommitAt) return '等待新的编辑活动'

  const diffMs = new Date(props.gitStatus.nextAutoCommitAt).getTime() - nowMs.value
  if (diffMs <= 0) return '即将提交'

  const totalSeconds = Math.ceil(diffMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes} 分 ${seconds} 秒后`
})

onMounted(() => {
  countdownTimer = window.setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
})
</script>

<template>
  <section class="space-y-[var(--space-4)]">
    <div class="min-w-0">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-[var(--space-2)]">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--primary)_26%,var(--border))] bg-[color-mix(in_srgb,var(--interactive-selected)_58%,var(--card))] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <GitBranch class="h-3.5 w-3.5" />
          </span>
          <p class="text-[15px] font-semibold tracking-[0.01em] text-[var(--foreground)]">Git</p>
        </div>
        <p class="text-ui-sm mt-[var(--space-2)] max-w-2xl leading-6 text-[var(--muted-foreground)]">
          管理笔记仓库初始化、自动提交和忽略规则。
        </p>
      </div>
    </div>

    <div class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] p-[calc(var(--settings-panel-pad)-0.1rem)]">
      <div class="grid items-center gap-[var(--space-3)] pt-0 pb-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <GitBranch class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">仓库初始化</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">检测 Git 可用性，并在当前笔记目录里初始化仓库。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <p class="text-ui-sm text-[var(--foreground)] lg:text-right">{{ repoStatusText }}</p>
            <p
              class="text-ui-xs break-all text-[var(--muted-foreground)] lg:max-w-[420px] lg:text-right"
              :class="props.gitStatus.repoPath ? 'font-mono' : ''"
            >
              {{ props.gitStatus.repoPath ?? '未连接笔记目录' }}
            </p>
            <p class="text-ui-xs text-[var(--muted-foreground)] lg:text-right">
              {{ props.gitStatus.hasPendingChanges ? '有未提交改动' : '当前没有未提交改动' }}
            </p>
            <div class="flex w-full lg:justify-end">
              <Button
                size="sm"
                class="gap-[var(--space-1)]"
                :disabled="!props.notesDir || !props.gitStatus.isGitAvailable || props.gitStatus.isRepoInitialized"
                @click="emit('initGitRepo')"
              >
                <GitPullRequestArrow class="h-3.5 w-3.5" />
                {{ props.gitStatus.isRepoInitialized ? '已初始化' : '初始化仓库' }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] p-[calc(var(--settings-panel-pad)-0.1rem)]">
      <div class="grid items-center gap-[var(--space-3)] pt-0 pb-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <GitCommitHorizontal class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">自动提交</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">有改动时，达到设定时间后自动提交整个仓库。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full lg:justify-end">
            <label
              class="flex w-full max-w-[360px] cursor-pointer items-center justify-between gap-[var(--space-4)] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_82%,transparent)] bg-[color-mix(in_srgb,var(--card)_36%,transparent)] px-3 py-2.5"
            >
              <span class="text-ui-sm text-[var(--foreground)]">
                {{ props.gitAutomation.autoCommitEnabled ? '已开启自动提交。' : '已关闭自动提交。' }}
              </span>
              <span class="relative flex h-4 w-4 shrink-0 items-center justify-center">
                <input
                  :checked="props.gitAutomation.autoCommitEnabled"
                  type="checkbox"
                  class="peer absolute inset-0 z-10 cursor-pointer opacity-0"
                  @change="emit('updateGitAutomationEnabled', ($event.target as HTMLInputElement).checked)"
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

      <div class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <GitCommitHorizontal class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">提交间隔</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">默认 30 分钟，按分钟计。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <Input
              :value="String(props.gitAutomation.autoCommitIntervalMinutes)"
              type="number"
              min="1"
              max="1440"
              class="text-ui-xs h-7 max-w-[160px] px-2.5 lg:w-[160px]"
              :disabled="!props.gitAutomation.autoCommitEnabled"
              @change="emit('updateGitAutomationInterval', Number(($event.target as HTMLInputElement).value))"
            />
            <p class="text-ui-xs text-[var(--muted-foreground)] lg:text-right">
              仅在开启自动提交后可调整。
            </p>
          </div>
        </div>
      </div>

      <div class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <GitCommitHorizontal class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">提交状态</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">查看最近一次提交时间，以及距离下一次自动提交的时间。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <p class="text-ui-sm text-[var(--foreground)] lg:text-right">
              上次提交：
              <span class="font-mono tabular-nums">{{ lastCommitText }}</span>
            </p>
            <p class="text-ui-xs text-[var(--muted-foreground)] lg:text-right">
              距离下次提交：
              <span class="inline-block min-w-[9ch] text-right font-mono tabular-nums">
                {{ nextAutoCommitCountdownText }}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] p-[calc(var(--settings-panel-pad)-0.1rem)]">
      <div class="grid gap-[var(--space-3)] pt-0 pb-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <ShieldEllipsis class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">.gitignore</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">手动维护忽略规则；初始化仓库时如果文件不存在，会自动写入预设。</p>
        </div>
        <div class="min-w-0">
          <Textarea
            :value="props.gitignoreDraft"
            class="min-h-[180px] px-3 py-2 font-mono text-ui-xs leading-6 lg:max-w-[520px]"
            placeholder=".DS_Store"
            @input="emit('updateGitignoreDraft', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
      </div>

      <div class="grid items-center gap-[var(--space-3)] border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] py-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <p class="text-ui-sm font-medium text-[var(--foreground)]">文件状态</p>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">当前工作区里的真实 `.gitignore` 文件状态。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <p class="text-ui-sm text-[var(--foreground)] lg:text-right">
              {{ props.gitStatus.hasGitignore ? '当前已存在 .gitignore 文件。' : '当前还没有 .gitignore 文件。' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="props.gitStatus.isRepoInitialized"
      class="rounded-[calc(var(--radius)-0.05rem)] border border-[color-mix(in_srgb,var(--border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card)_18%,transparent)] p-[calc(var(--settings-panel-pad)-0.1rem)]"
    >
      <div class="grid items-center gap-[var(--space-3)] pt-0 pb-[calc(var(--settings-panel-pad)-0.05rem)] lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-[var(--space-4)]">
        <div class="min-w-0">
          <div class="flex items-center gap-[var(--space-2)] text-[var(--foreground)]">
            <GitCommitHorizontal class="h-4 w-4 text-[var(--muted-foreground)]" />
            <p class="text-ui-sm font-medium">立即提交</p>
          </div>
          <p class="text-ui-xs mt-1 text-[var(--muted-foreground)]">将当前仓库的全部未提交改动立即保存为一次 commit。</p>
        </div>
        <div class="min-w-0">
          <div class="flex w-full flex-col gap-[var(--space-2)] lg:items-end">
            <p class="text-ui-xs text-[var(--muted-foreground)] lg:text-right">
              {{ props.gitStatus.hasPendingChanges ? '当前有未提交改动。' : '当前没有未提交改动。' }}
            </p>
            <div class="flex w-full lg:justify-end">
              <Button
                size="sm"
                class="gap-[var(--space-1)]"
                :disabled="!props.gitStatus.isGitAvailable || !props.gitStatus.hasPendingChanges"
                @click="emit('commitGitNow')"
              >
                <GitCommitHorizontal class="h-3.5 w-3.5" />
                手动提交
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
