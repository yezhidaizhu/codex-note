<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useNoteStyleStore } from '@/state/note-style'

const noteStyleStore = useNoteStyleStore()

void noteStyleStore.ensureInitialized()
</script>

<template>
  <RouterView />
</template>
