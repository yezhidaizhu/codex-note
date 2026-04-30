<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'
import { cn } from '@/lib/utils'

const attrs = useAttrs()
const inputElement = ref<HTMLInputElement | null>(null)

const attrsWithoutClass = computed(() => {
  const { class: _class, ...rest } = attrs as Record<string, unknown>
  return rest
})

const mergedClass = computed(() =>
  cn(
    'flex h-8 w-full rounded-[calc(var(--radius)-0.15rem)] border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[color-mix(in_srgb,var(--card)_56%,transparent)] px-3 py-1.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
    (attrs as any).class,
  ),
)

defineExpose({
  focus: () => inputElement.value?.focus(),
  select: () => inputElement.value?.select(),
  el: inputElement,
})
</script>

<template>
  <input ref="inputElement" v-bind="attrsWithoutClass" :class="mergedClass" />
</template>
