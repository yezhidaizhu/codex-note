<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    label: string
    dateLabel: string
    selected: boolean
    selectionMode?: boolean
    checked?: boolean
    draggable?: boolean
    insideFolder?: boolean
  }>(),
  {
    selectionMode: false,
    checked: false,
    draggable: false,
    insideFolder: false,
  },
)

const emit = defineEmits<{
  (e: 'toggleChecked'): void
  (e: 'open'): void
  (e: 'contextMenu', event: MouseEvent): void
  (e: 'dragStart', event: DragEvent): void
  (e: 'dragEnd'): void
}>()

function rowClass() {
  if (props.selected) {
    return 'bg-[var(--tree-item-selected)] text-[var(--foreground)] hover:bg-[var(--tree-item-selected-hover)] hover:text-[var(--foreground)]'
  }

  return 'bg-transparent text-[var(--foreground)] hover:bg-[var(--tree-item-hover)] hover:text-[var(--foreground)]'
}

function iconClass() {
  if (props.selected) {
    return 'bg-[var(--tree-item-icon-active)] text-[var(--primary)]'
  }

  return 'bg-[var(--tree-item-icon)] text-[var(--muted-foreground)]'
}

function handleClick() {
  if (props.selectionMode) {
    emit('toggleChecked')
    return
  }
  emit('open')
}
</script>

<template>
  <Button
    type="button"
    variant="ghost"
    data-note-item="true"
    :class="
      cn(
        'h-auto w-full items-start justify-start rounded-[calc(var(--radius)-0.2rem)] px-[var(--space-2)] py-[0.4rem] text-left hover:text-[var(--foreground)]',
        rowClass(),
      )
    "
    @click="handleClick"
    @contextmenu.prevent="emit('contextMenu', $event)"
    :draggable="draggable"
    @dragstart="emit('dragStart', $event)"
    @dragend="emit('dragEnd')"
  >
    <div class="flex w-full items-center justify-between gap-[var(--space-2)]">
      <div class="flex min-w-0 flex-1 items-center gap-[var(--space-2)]">
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

        <span v-else class="h-5 w-5 shrink-0" aria-hidden="true" />

        <span
          :class="cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors', iconClass())"
          aria-hidden="true"
        >
          <FileText class="h-3.5 w-3.5" />
        </span>

        <strong class="text-ui-sm min-w-0 flex-1 truncate font-normal">{{ label }}</strong>
      </div>
      <span class="text-ui-xs shrink-0 text-[var(--muted-foreground)]">{{ dateLabel }}</span>
    </div>
  </Button>
</template>
