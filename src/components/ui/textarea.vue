<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cn } from '@/lib/utils'

const attrs = useAttrs()

const attrsWithoutClass = computed(() => {
  const { class: _class, ...rest } = attrs as Record<string, unknown>
  return rest
})

const mergedClass = computed(() =>
  cn(
    'flex min-h-[80px] w-full rounded-[calc(var(--radius)-0.15rem)] border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[color-mix(in_srgb,var(--card)_34%,transparent)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50',
    (attrs as any).class,
  ),
)
</script>

<template>
  <textarea v-bind="attrsWithoutClass" :class="mergedClass" />
</template>

