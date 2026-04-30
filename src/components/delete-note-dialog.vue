<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import Button from '@/components/ui/button.vue'

withDefaults(
  defineProps<{
    title?: string
    message: string
    confirmLabel?: string
  }>(),
  {
    title: '删除笔记？',
    confirmLabel: '删除',
  },
)

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm'): void
}>()

function cancel() {
  emit('cancel')
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-backdrop)] p-[var(--space-4)] backdrop-blur-[2px]"
    @click.self="cancel"
  >
    <div
      class="w-full max-w-sm rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_84%,transparent)] bg-[color-mix(in_srgb,var(--editor)_94%,white_6%)] p-[var(--space-4)] shadow-[0_14px_36px_var(--dialog-shadow)]"
    >
      <p class="text-ui-md font-medium text-[var(--foreground)]">{{ title }}</p>
      <p class="text-ui-sm mt-[var(--space-2)] text-[var(--muted-foreground)]">{{ message }}</p>
      <div class="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
        <Button variant="ghost" size="sm" class="text-ui-sm h-7 px-3 font-normal" @click="cancel">取消</Button>
        <Button
          variant="secondary"
          size="sm"
          class="text-ui-sm h-7 px-3 font-normal text-[var(--destructive)] hover:bg-[var(--interactive-hover)]"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </Button>
      </div>
    </div>
  </div>
</template>
