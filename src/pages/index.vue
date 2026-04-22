<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { FolderOpen, Plus } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import DeleteNoteDialog from '@/components/delete-note-dialog.vue'
import NoteContextMenu from '@/components/note-context-menu.vue'
import TitleBar from '@/components/app/titlebar.vue'
import NotesSidebar from '@/components/app/notes-sidebar.vue'
import Button from '@/components/ui/button.vue'
import Textarea from '@/components/ui/textarea.vue'
import { buildDeleteMessage, getListLabel, useNotesStore } from '@/state/notes'

type PendingDeleteState = {
  basenames: string[]
  title: string
  message: string
  confirmLabel?: string
} | null

type NoteContextMenuState = {
  basename: string
  x: number
  y: number
} | null

const router = useRouter()
const store = useNotesStore()

const contextMenu = ref<NoteContextMenuState>(null)
const listActionsMenuOpen = ref(false)
const pendingDelete = ref<PendingDeleteState>(null)
const isBatchSelecting = ref(false)
const selectedBasenames = ref<string[]>([])
const isSidebarResizing = ref(false)
const sidebarResizeStart = ref<{ pointerX: number; width: number } | null>(null)
const pendingEditorFocus = ref(false)
const editorTextarea = ref<{ focus: () => void; setSelectionRange: (start: number, end: number) => void } | null>(null)

function handleShellContextMenu(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.closest('[data-note-item="true"]')) {
    contextMenu.value = null
  }
}

function handleShellClick() {
  contextMenu.value = null
}

function confirmDeleteNotes(basenames: string[]) {
  if (basenames.length === 0) return

  const targetNote = basenames.length === 1 ? store.notes.value.find((note) => note.basename === basenames[0]) : null
  pendingDelete.value = {
    basenames,
    title: basenames.length > 1 ? '批量删除笔记？' : '删除笔记？',
    message: buildDeleteMessage(basenames.length, targetNote ? getListLabel(targetNote) : undefined),
    confirmLabel: '删除',
  }
}

function toggleBatchSelect() {
  isBatchSelecting.value = !isBatchSelecting.value
  listActionsMenuOpen.value = false
}

function toggleNoteSelection(basename: string) {
  selectedBasenames.value = selectedBasenames.value.includes(basename)
    ? selectedBasenames.value.filter((item) => item !== basename)
    : [...selectedBasenames.value, basename]
}

watch(isBatchSelecting, (enabled) => {
  if (!enabled && selectedBasenames.value.length > 0) selectedBasenames.value = []
})

watch(contextMenu, (menu, _prev, onCleanup) => {
  if (!menu) return
  const closeMenu = () => (contextMenu.value = null)
  window.addEventListener('click', closeMenu)
  window.addEventListener('blur', closeMenu)
  window.addEventListener('resize', closeMenu)
  window.addEventListener('keydown', closeMenu)
  onCleanup(() => {
    window.removeEventListener('click', closeMenu)
    window.removeEventListener('blur', closeMenu)
    window.removeEventListener('resize', closeMenu)
    window.removeEventListener('keydown', closeMenu)
  })
})

watch(listActionsMenuOpen, (open, _prev, onCleanup) => {
  if (!open) return
  const closeMenu = () => (listActionsMenuOpen.value = false)
  window.addEventListener('click', closeMenu)
  window.addEventListener('blur', closeMenu)
  window.addEventListener('resize', closeMenu)
  window.addEventListener('keydown', closeMenu)
  onCleanup(() => {
    window.removeEventListener('click', closeMenu)
    window.removeEventListener('blur', closeMenu)
    window.removeEventListener('resize', closeMenu)
    window.removeEventListener('keydown', closeMenu)
  })
})

function beginSidebarResize(event: MouseEvent) {
  if (store.sidebarCollapsed.value) return
  event.preventDefault()
  sidebarResizeStart.value = { pointerX: event.clientX, width: store.sidebarWidth.value }
  isSidebarResizing.value = true
}

watch(isSidebarResizing, (resizing, _prev, onCleanup) => {
  if (!resizing) return

  const SIDEBAR_MIN_WIDTH = 220
  const SIDEBAR_MAX_WIDTH = 520

  const previousCursor = document.body.style.cursor
  const previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const stopResize = () => {
    sidebarResizeStart.value = null
    isSidebarResizing.value = false
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', stopResize)
    window.removeEventListener('blur', stopResize)
  }

  const onMouseMove = (event: MouseEvent) => {
    const state = sidebarResizeStart.value
    if (!state) return
    const nextWidth = state.width + event.clientX - state.pointerX
    store.sidebarWidth.value = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, nextWidth))
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', stopResize)
  window.addEventListener('blur', stopResize)
  onCleanup(stopResize)
})

watch(
  () => store.activeNote.value,
  async (note) => {
    if (!note || !pendingEditorFocus.value) return
    await nextTick()
    editorTextarea.value?.focus()
    const cursorPosition = note.content.length
    editorTextarea.value?.setSelectionRange(cursorPosition, cursorPosition)
    pendingEditorFocus.value = false
  },
)

function onEditorInput(event: Event) {
  if (!store.activeNote.value) return
  const target = event.target as HTMLTextAreaElement | null
  store.activeNote.value = { ...store.activeNote.value, content: target?.value ?? '' }
}

function createNoteAndFocus() {
  pendingEditorFocus.value = true
  store.createNote()
}

const onSaveHotkey = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void store.saveNote()
  }
}

onMounted(() => window.addEventListener('keydown', onSaveHotkey))
onUnmounted(() => window.removeEventListener('keydown', onSaveHotkey))
</script>

<template>
  <div
    class="app-shell-glass app-shell-surface flex h-full flex-col overflow-hidden bg-transparent text-[var(--foreground)] border !border-gray-600 rounded-xl"
    @contextmenu="handleShellContextMenu"
    @click="handleShellClick"
  >
    <TitleBar
      :sidebar-collapsed="store.sidebarCollapsed.value"
      :notes-dir="store.notesDir.value"
      :is-pinned="store.isPinned.value"
      @toggleSidebar="store.sidebarCollapsed.value = !store.sidebarCollapsed.value"
      @createNote="createNoteAndFocus"
      @togglePinned="store.togglePinned"
    />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <NotesSidebar
        :notes-dir="store.notesDir.value"
        :notes="store.notes.value"
        :filtered-notes="store.filteredNotes.value"
        :query="store.query.value"
        :selected-basename="store.selectedBasename.value"
        :sidebar-collapsed="store.sidebarCollapsed.value"
        :sidebar-width="store.sidebarWidth.value"
        :is-sidebar-resizing="isSidebarResizing"
        :is-batch-selecting="isBatchSelecting"
        :selected-basenames="selectedBasenames"
        :list-actions-menu-open="listActionsMenuOpen"
        @update:query="store.query.value = $event"
        @createNote="createNoteAndFocus"
        @openNote="store.openNote($event)"
        @toggleListActionsMenu="listActionsMenuOpen = !listActionsMenuOpen"
        @toggleBatchSelect="toggleBatchSelect"
        @toggleNoteSelection="toggleNoteSelection($event)"
        @confirmDeleteSelected="confirmDeleteNotes(selectedBasenames)"
        @goSettings="router.push('/settings')"
        @beginResize="beginSidebarResize"
        @requestContextMenu="contextMenu = $event"
      />

      <main class="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        <section v-if="!store.notesDir.value" class="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
          <div
            class="w-full max-w-2xl rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] p-[var(--space-5)]"
          >
            <p class="text-ui-xs uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Start here</p>
            <h3 class="mt-[var(--space-3)] text-3xl font-semibold tracking-tight">先把笔记目录接进来</h3>
            <p class="text-ui-md mt-[var(--space-4)] max-w-xl leading-7 text-[var(--muted-foreground)]">
              应用只负责写入和管理本地 `.md` 文件，不做私有格式封装，也不绑定固定目录。
            </p>
            <div class="mt-[var(--space-5)]">
              <Button class="gap-[var(--space-2)]" @click="store.chooseDirectory">
                <FolderOpen class="h-4 w-4" />
                选择目录
              </Button>
            </div>
          </div>
        </section>

        <section v-else-if="store.activeNote.value" class="editor-surface flex min-h-0 flex-1 flex-col overflow-hidden">
          <Textarea
            ref="editorTextarea"
            :value="store.activeNote.value.content"
            class="scrollbar-thin h-full min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-[var(--space-5)] py-[var(--space-5)] text-[15px] leading-8 shadow-none focus-visible:ring-0 placeholder:text-[color-mix(in_srgb,var(--muted-foreground)_52%,transparent)]"
            placeholder="写点什么"
            @input="onEditorInput"
          />
        </section>

        <section v-else class="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
          <div
            class="w-full max-w-xl rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_16%,transparent)] p-[var(--space-5)]"
          >
            <p class="text-ui-xs uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Ready</p>
            <h3 class="mt-[var(--space-3)] text-2xl font-semibold tracking-tight">选一篇笔记，或者新建一篇</h3>
            <p class="text-ui-md mt-[var(--space-4)] leading-7 text-[var(--muted-foreground)]">
              左侧读取所选目录里的 `.md` 文件，右侧直接编辑原始 Markdown 文本。
            </p>
            <Button class="mt-[var(--space-5)] gap-[var(--space-2)]" @click="createNoteAndFocus">
              <Plus class="h-4 w-4" />
              新建笔记
            </Button>
          </div>
        </section>

        <div
          v-if="store.errorMessage.value"
          class="text-ui-xs border-t border-[color-mix(in_srgb,var(--border)_80%,transparent)] px-[var(--space-4)] py-[var(--space-2)] text-right text-[var(--destructive)]"
        >
          {{ store.errorMessage.value }}
        </div>
      </main>
    </div>

    <NoteContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @delete="
        () => {
          const target = store.notes.value.find((note) => note.basename === contextMenu?.basename)
          contextMenu = null
          if (target) confirmDeleteNotes([target.basename])
        }
      "
    />

    <DeleteNoteDialog
      v-if="pendingDelete"
      :title="pendingDelete.title"
      :message="pendingDelete.message"
      :confirm-label="pendingDelete.confirmLabel"
      @cancel="pendingDelete = null"
      @confirm="
        () => {
          const targets = pendingDelete?.basenames ?? []
          pendingDelete = null
          void store.deleteNotesByBasenames(targets)
          if (targets.length > 1) isBatchSelecting = false
        }
      "
    />
  </div>
</template>
