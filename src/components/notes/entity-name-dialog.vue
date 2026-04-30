<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'

const props = withDefaults(
  defineProps<{
    title: string
    confirmLabel?: string
    initialValue?: string
    entityType?: 'note' | 'folder'
  }>(),
  {
    confirmLabel: '确认',
    initialValue: '',
    entityType: 'folder',
  },
)

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm', value: string): void
}>()

const nameValue = ref(props.initialValue)

function onInput(event: Event) {
  nameValue.value = (event.target as HTMLInputElement).value
}

function confirm() {
  const value = nameValue.value.trim()
  if (!value) return
  emit('confirm', value)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-backdrop)] p-[var(--space-4)] backdrop-blur-[2px]">
    <div
      class="w-full max-w-sm rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_84%,transparent)] bg-[color-mix(in_srgb,var(--editor)_94%,white_6%)] p-[var(--space-4)] shadow-[0_14px_36px_var(--dialog-shadow)]"
    >
      <p class="text-ui-md font-medium text-[var(--foreground)]">{{ title }}</p>
      <Input
        :value="nameValue"
        class="mt-[var(--space-3)] focus-visible:ring-1 focus-visible:ring-offset-0"
        :placeholder="entityType === 'note' ? '输入文件名' : '输入目录名'"
        @input="onInput"
        @keydown.enter.prevent="confirm"
      />
      <div class="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
        <Button variant="ghost" size="sm" class="text-ui-sm h-7 px-3 font-normal" @click="emit('cancel')">取消</Button>
        <Button
          variant="secondary"
          size="sm"
          class="text-ui-sm h-7 px-3 font-normal"
          :disabled="nameValue.trim().length === 0"
          @click="confirm"
        >
          {{ confirmLabel }}
        </Button>
      </div>
    </div>
  </div>
</template>
