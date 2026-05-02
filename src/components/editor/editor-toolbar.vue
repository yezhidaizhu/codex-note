<script setup lang="ts">
import { Bold, Code2, Heading1, ImagePlus, Italic, Link2, List, ListChecks, ListOrdered, Quote } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import type { EditorFeatureKey } from '@/lib/types'

defineProps<{
  enabledFeatures: Set<EditorFeatureKey>
}>()

const emit = defineEmits<{
  (e: 'toggleHeading'): void
  (e: 'toggleBold'): void
  (e: 'toggleItalic'): void
  (e: 'toggleBlockquote'): void
  (e: 'toggleBulletList'): void
  (e: 'toggleOrderedList'): void
  (e: 'toggleTaskList'): void
  (e: 'toggleCodeBlock'): void
  (e: 'toggleLink'): void
  (e: 'insertImage'): void
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-[var(--space-2)] border-b border-[color-mix(in_srgb,var(--border)_74%,transparent)] px-[var(--editor-pad-x)] py-[calc(var(--space-3)-1px)]">
    <Button v-if="enabledFeatures.has('heading')" variant="ghost" size="sm" class="gap-1.5" @click="emit('toggleHeading')">
      <Heading1 class="h-3.5 w-3.5" />
      标题
    </Button>
    <Button v-if="enabledFeatures.has('bold')" variant="ghost" size="sm" class="gap-1.5" @click="emit('toggleBold')">
      <Bold class="h-3.5 w-3.5" />
      粗体
    </Button>
    <Button v-if="enabledFeatures.has('italic')" variant="ghost" size="sm" class="gap-1.5" @click="emit('toggleItalic')">
      <Italic class="h-3.5 w-3.5" />
      斜体
    </Button>
    <Button v-if="enabledFeatures.has('blockquote')" variant="ghost" size="sm" class="gap-1.5" @click="emit('toggleBlockquote')">
      <Quote class="h-3.5 w-3.5" />
      引用
    </Button>
    <Button v-if="enabledFeatures.has('bulletList')" variant="ghost" size="sm" class="gap-1.5" @click="emit('toggleBulletList')">
      <List class="h-3.5 w-3.5" />
      无序列表
    </Button>
    <Button v-if="enabledFeatures.has('orderedList')" variant="ghost" size="sm" class="gap-1.5" @click="emit('toggleOrderedList')">
      <ListOrdered class="h-3.5 w-3.5" />
      有序列表
    </Button>
    <Button v-if="enabledFeatures.has('taskList')" variant="ghost" size="sm" class="gap-1.5" @click="emit('toggleTaskList')">
      <ListChecks class="h-3.5 w-3.5" />
      任务列表
    </Button>
    <Button v-if="enabledFeatures.has('codeBlock')" variant="ghost" size="sm" class="gap-1.5" @click="emit('toggleCodeBlock')">
      <Code2 class="h-3.5 w-3.5" />
      代码块
    </Button>
    <Button v-if="enabledFeatures.has('link')" variant="ghost" size="sm" class="gap-1.5" @click="emit('toggleLink')">
      <Link2 class="h-3.5 w-3.5" />
      链接
    </Button>
    <Button v-if="enabledFeatures.has('image')" variant="ghost" size="sm" class="gap-1.5" @click="emit('insertImage')">
      <ImagePlus class="h-3.5 w-3.5" />
      图片
    </Button>
  </div>
</template>
