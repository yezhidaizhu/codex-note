<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[calc(var(--radius)-0.15rem)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--button-shadow)] hover:brightness-110',
        secondary:
          'border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[color-mix(in_srgb,var(--secondary)_88%,transparent)] text-[var(--secondary-foreground)] hover:bg-[var(--interactive-hover)]',
        ghost:
          'text-[var(--muted-foreground)] hover:bg-[var(--interactive-hover)] hover:text-[var(--foreground)]',
        outline:
          'border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-transparent text-[var(--foreground)] hover:bg-[var(--interactive-hover)]',
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm: 'h-7 px-2.5 text-xs',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonVariantProps = VariantProps<typeof buttonVariants>

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariantProps['variant']
    size?: ButtonVariantProps['size']
  }>(),
  {
    variant: 'default',
    size: 'default',
  },
)

const attrs = useAttrs()

const attrsWithoutClass = computed(() => {
  const { class: _class, ...rest } = attrs as Record<string, unknown>
  return rest
})

const mergedClass = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), (attrs as any).class),
)
</script>

<template>
  <button v-bind="attrsWithoutClass" :class="mergedClass">
    <slot />
  </button>
</template>
