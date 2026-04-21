<script setup lang="ts">
import Button from '@/components/ui/button.vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    label: string
    dateLabel: string
    selected: boolean
    selectionMode?: boolean
    checked?: boolean
  }>(),
  {
    selectionMode: false,
    checked: false,
  },
)

const emit = defineEmits<{
  (e: 'toggleChecked'): void
  (e: 'open'): void
  (e: 'contextMenu', event: MouseEvent): void
}>()

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
        'h-auto w-full items-start justify-start rounded-[calc(var(--radius)-0.1rem)] border px-[var(--space-2)] py-[var(--space-2)] text-left',
        selected
          ? 'border-[color-mix(in_srgb,var(--primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--foreground)]'
          : 'border-transparent bg-transparent text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_68%,transparent)]',
      )
    "
    @click="handleClick"
    @contextmenu.prevent="emit('contextMenu', $event)"
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

        <strong class="text-ui-sm min-w-0 flex-1 truncate font-normal">{{ label }}</strong>
      </div>
      <span class="text-ui-xs shrink-0 text-[var(--muted-foreground)]">{{ dateLabel }}</span>
    </div>
  </Button>
</template>

