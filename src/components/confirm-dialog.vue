<script setup lang="ts">
import Button from '@/components/ui/button.vue'

withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
  }>(),
  {
    confirmLabel: '确认',
  },
)

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-backdrop)] p-[var(--space-4)] backdrop-blur-[2px]">
    <div
      class="w-full max-w-sm rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_84%,transparent)] bg-[color-mix(in_srgb,var(--editor)_94%,white_6%)] p-[var(--space-4)] shadow-[0_14px_36px_var(--dialog-shadow)]"
    >
      <p class="text-ui-md font-medium text-[var(--foreground)]">{{ title }}</p>
      <p class="text-ui-sm mt-[var(--space-2)] text-[var(--muted-foreground)]">{{ message }}</p>
      <div class="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
        <Button variant="ghost" size="sm" class="text-ui-sm h-7 px-3 font-normal" @click="emit('cancel')">取消</Button>
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
