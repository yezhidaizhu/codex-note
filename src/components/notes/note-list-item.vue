<script setup lang="ts">
import { computed } from 'vue'
import { FileText, Pin } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    path: string
    label: string
    matchPreview?: string | null
    highlightQuery?: string
    dateLabel: string
    selected: boolean
    isPinned?: boolean
    selectionMode?: boolean
    checked?: boolean
    draggable?: boolean
    insideFolder?: boolean
  }>(),
  {
    isPinned: false,
    selectionMode: false,
    checked: false,
    draggable: false,
    insideFolder: false,
    highlightQuery: '',
  },
)

const emit = defineEmits<{
  (e: 'activate', event: MouseEvent): void
  (e: 'contextMenu', event: MouseEvent): void
  (e: 'dragStart', event: DragEvent): void
  (e: 'dragEnd'): void
  (e: 'togglePinned', event: MouseEvent): void
  (e: 'navigate', direction: 1 | -1): void
}>()

function rowClass() {
  if (props.selected) {
    return 'bg-[var(--tree-item-selected)] text-[var(--foreground)] hover:bg-[var(--tree-item-selected-hover)] hover:text-[var(--foreground)]'
  }

  if (props.checked) {
    return 'bg-[color-mix(in_srgb,var(--interactive-selected)_68%,transparent)] text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--interactive-selected-hover)_72%,transparent)] hover:text-[var(--foreground)]'
  }

  return 'bg-transparent text-[var(--foreground)] hover:bg-[var(--tree-item-hover)] hover:text-[var(--foreground)]'
}

function iconClass() {
  if (props.selected) {
    return 'text-[var(--primary)]'
  }

  if (props.checked) {
    return 'text-[var(--foreground)]'
  }

  return 'text-[var(--muted-foreground)]'
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    emit('navigate', 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    emit('navigate', -1)
  }
}

function buildHighlightedParts(text: string, query: string) {
  const keyword = query.trim()
  if (!keyword) {
    return [{ text, highlighted: false }]
  }

  const lowerText = text.toLowerCase()
  const lowerQuery = keyword.toLowerCase()
  const parts: Array<{ text: string; highlighted: boolean }> = []
  let cursor = 0

  for (;;) {
    const matchIndex = lowerText.indexOf(lowerQuery, cursor)
    if (matchIndex === -1) {
      if (cursor < text.length) {
        parts.push({ text: text.slice(cursor), highlighted: false })
      }
      return parts.length > 0 ? parts : [{ text, highlighted: false }]
    }

    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), highlighted: false })
    }

    parts.push({
      text: text.slice(matchIndex, matchIndex + keyword.length),
      highlighted: true,
    })
    cursor = matchIndex + keyword.length
  }
}

const labelParts = computed(() => buildHighlightedParts(props.label, props.highlightQuery))
const previewParts = computed(() => buildHighlightedParts(props.matchPreview ?? '', props.highlightQuery))
</script>

<template>
  <Button
    type="button"
    variant="ghost"
    data-note-item="true"
    :data-note-path="path"
    :class="
      cn(
        'group h-auto w-full items-start justify-start rounded-[calc(var(--radius)-0.2rem)] px-[var(--tree-item-pad-x)] py-[var(--tree-item-pad-y)] text-left hover:text-[var(--foreground)]',
        rowClass(),
      )
    "
    :style="{ minHeight: 'var(--tree-item-min-height)' }"
    @click="emit('activate', $event)"
    @contextmenu.prevent="emit('contextMenu', $event)"
    @keydown="handleKeydown"
    :draggable="draggable"
    @dragstart="emit('dragStart', $event)"
    @dragend="emit('dragEnd')"
  >
    <div class="flex w-full items-center justify-between gap-[var(--space-2)]">
      <div class="flex min-w-0 flex-1 items-center gap-[var(--tree-branch-gap)]">
        <span
          v-if="selectionMode"
          :class="
            cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded-[0.3rem] border transition-colors',
              checked
                ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'border-[color-mix(in_srgb,var(--border)_92%,transparent)] bg-transparent text-transparent',
            )
          "
          aria-hidden="true"
        >
          <span class="text-[10px] leading-none">✓</span>
        </span>

        <span v-else class="h-[var(--tree-chevron-slot)] w-[var(--tree-chevron-slot)] shrink-0" aria-hidden="true" />

        <span
          :class="cn('flex shrink-0 items-center justify-center transition-colors', iconClass())"
          :style="{ width: 'var(--tree-item-icon-size)', height: 'var(--tree-item-icon-size)' }"
          aria-hidden="true"
        >
          <FileText class="h-3.5 w-3.5" />
        </span>

        <div class="min-w-0 flex-1">
          <strong class="text-ui-sm block truncate font-normal">
            <template v-for="(part, index) in labelParts" :key="`${part.text}-${index}`">
              <mark
                v-if="part.highlighted"
                class=" bg-yellow-300 px-0.5 text-gray-900"
              >
                {{ part.text }}
              </mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </strong>
          <p v-if="matchPreview" class="text-ui-xs mt-1 truncate text-[var(--muted-foreground)]">
            <template v-for="(part, index) in previewParts" :key="`${part.text}-${index}`">
              <mark
                v-if="part.highlighted"
                class=" bg-yellow-300 px-0.5 text-gray-900"
              >
                {{ part.text }}
              </mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </p>
        </div>
      </div>
      <div class="relative ml-auto h-6 min-w-[3.5rem] shrink-0">
        <span
          class="text-ui-xs absolute inset-y-0 right-0 flex items-center gap-1 text-[var(--muted-foreground)] group-hover:hidden"
        >
          <span>{{ dateLabel }}</span>
          <Pin v-if="isPinned" class="h-3 w-3 fill-current text-[var(--muted-foreground)]" />
        </span>
        <div
          class="absolute inset-y-0 right-0 hidden items-center justify-end group-hover:flex"
        >
          <button
            type="button"
            class="flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]"
            :aria-label="isPinned ? '取消置顶笔记' : '置顶笔记'"
            :title="isPinned ? '取消置顶笔记' : '置顶笔记'"
            @click.stop="emit('togglePinned', $event)"
          >
            <Pin
              :class="
                cn(
                  'h-3.5 w-3.5',
                  isPinned ? 'fill-current text-[var(--primary)]' : 'fill-transparent text-[var(--muted-foreground)]',
                )
              "
            />
          </button>
        </div>
      </div>
    </div>
  </Button>
</template>
