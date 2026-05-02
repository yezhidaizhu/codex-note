<template>
  <MilkdownProvider>
    <NoteMarkdownEditorSurface />
  </MilkdownProvider>
</template>

<script setup lang="ts">
import { MilkdownProvider } from '@milkdown/vue'
import NoteMarkdownEditorSurface from './note-markdown-editor-surface.vue'
</script>
