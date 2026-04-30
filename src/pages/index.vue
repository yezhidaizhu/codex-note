<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { FilePlus2, FolderOpen } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/confirm-dialog.vue'
import EntityNameDialog from '@/components/entity-name-dialog.vue'
import NoteContextMenu from '@/components/note-context-menu.vue'
import TitleBar from '@/components/app/titlebar.vue'
import NotesSidebar from '@/components/app/notes-sidebar.vue'
import Button from '@/components/ui/button.vue'
import Textarea from '@/components/ui/textarea.vue'
import { buildDeleteFolderMessage, buildDeleteMessage, getListLabel, useNotesStore } from '@/state/notes'

type PendingConfirmState =
  | {
      action: 'deleteNotes'
      paths: string[]
      title: string
      message: string
      confirmLabel?: string
    }
  | {
      action: 'deleteFolder'
      folderPath: string
      title: string
      message: string
      confirmLabel?: string
    }
  | null

type NameDialogState =
  | {
      mode: 'createFolder'
      parentPath: string | null
      title: string
      confirmLabel: string
      initialValue: string
      entityType: 'folder'
    }
  | {
      mode: 'renameNote'
      path: string
      title: string
      confirmLabel: string
      initialValue: string
      entityType: 'note'
    }
  | {
      mode: 'renameFolder'
      path: string
      title: string
      confirmLabel: string
      initialValue: string
      entityType: 'folder'
    }
  | null

type NoteContextMenuState = {
  targetType: 'note' | 'folder'
  path: string
  x: number
  y: number
} | null

const router = useRouter()
const store = useNotesStore()

const contextMenu = ref<NoteContextMenuState>(null)
const listActionsMenuOpen = ref(false)
const pendingConfirm = ref<PendingConfirmState>(null)
const nameDialogState = ref<NameDialogState>(null)
const isBatchSelecting = ref(false)
const selectedPaths = ref<string[]>([])
const isSidebarResizing = ref(false)
const sidebarResizeStart = ref<{ pointerX: number; width: number } | null>(null)
const pendingEditorFocus = ref(false)
const editorTextarea = ref<{ focus: () => void; setSelectionRange: (start: number, end: number) => void } | null>(null)

function folderNameFromPath(pathValue: string): string {
  const segments = pathValue.split('/')
  return segments[segments.length - 1] || pathValue
}

function noteNameForRename(name: string): string {
  return name.replace(/\.md$/i, '')
}

function handleShellContextMenu(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.closest('[data-note-item="true"], [data-folder-item="true"]')) {
    contextMenu.value = null
  }
}

function handleShellClick() {
  contextMenu.value = null
}

function confirmDeleteNotes(paths: string[]) {
  if (paths.length === 0) return
  const targetNote = paths.length === 1 ? store.notes.value.find((note) => note.path === paths[0]) : null

  pendingConfirm.value = {
    action: 'deleteNotes',
    paths,
    title: paths.length > 1 ? '批量删除笔记？' : '删除笔记？',
    message: buildDeleteMessage(paths.length, targetNote ? getListLabel(targetNote) : undefined),
    confirmLabel: '删除',
  }
}

function confirmDeleteFolder(folderPath: string) {
  const notesCount = store.countNotesInFolder(folderPath)
  const folderLabel = folderNameFromPath(folderPath)
  pendingConfirm.value = {
    action: 'deleteFolder',
    folderPath,
    title: '删除目录？',
    message: buildDeleteFolderMessage(folderLabel, notesCount),
    confirmLabel: '删除',
  }
}

function openCreateFolderDialog(parentPath: string | null) {
  const folderLabel = parentPath ? `在「${folderNameFromPath(parentPath)}」中新建目录` : '新建目录'
  nameDialogState.value = {
    mode: 'createFolder',
    parentPath,
    title: folderLabel,
    confirmLabel: '创建',
    initialValue: '',
    entityType: 'folder',
  }
  listActionsMenuOpen.value = false
  contextMenu.value = null
}

function openRenameNoteDialog(path: string) {
  const target = store.notes.value.find((note) => note.path === path)
  if (!target) return
  nameDialogState.value = {
    mode: 'renameNote',
    path,
    title: '重命名文件',
    confirmLabel: '重命名',
    initialValue: noteNameForRename(target.name),
    entityType: 'note',
  }
  listActionsMenuOpen.value = false
  contextMenu.value = null
}

function openRenameFolderDialog(path: string) {
  nameDialogState.value = {
    mode: 'renameFolder',
    path,
    title: '重命名目录',
    confirmLabel: '重命名',
    initialValue: folderNameFromPath(path),
    entityType: 'folder',
  }
  listActionsMenuOpen.value = false
  contextMenu.value = null
}

function toggleBatchSelect() {
  isBatchSelecting.value = !isBatchSelecting.value
  listActionsMenuOpen.value = false
}

function toggleNoteSelection(path: string) {
  selectedPaths.value = selectedPaths.value.includes(path)
    ? selectedPaths.value.filter((item) => item !== path)
    : [...selectedPaths.value, path]
}

watch(isBatchSelecting, (enabled) => {
  if (!enabled && selectedPaths.value.length > 0) selectedPaths.value = []
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

function createNoteAndFocus(parentPath: string | null = null) {
  pendingEditorFocus.value = true
  store.createNote(parentPath)
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
      @createNote="createNoteAndFocus()"
      @togglePinned="store.togglePinned"
    />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <NotesSidebar
        :notes-dir="store.notesDir.value"
        :notes="store.notes.value"
        :folders="store.folders.value"
        :filtered-notes="store.filteredNotes.value"
        :query="store.query.value"
        :selected-path="store.selectedPath.value"
        :sidebar-collapsed="store.sidebarCollapsed.value"
        :sidebar-width="store.sidebarWidth.value"
        :is-sidebar-resizing="isSidebarResizing"
        :is-batch-selecting="isBatchSelecting"
        :selected-paths="selectedPaths"
        :expanded-folder-paths="store.expandedFolderPaths.value"
        :list-actions-menu-open="listActionsMenuOpen"
        @update:query="store.query.value = $event"
        @createNote="createNoteAndFocus()"
        @openNote="store.openNote($event)"
        @toggleListActionsMenu="listActionsMenuOpen = !listActionsMenuOpen"
        @toggleBatchSelect="toggleBatchSelect"
        @toggleNoteSelection="toggleNoteSelection($event)"
        @confirmDeleteSelected="confirmDeleteNotes(selectedPaths)"
        @goSettings="router.push('/settings')"
        @beginResize="beginSidebarResize"
        @requestNoteContextMenu="contextMenu = { targetType: 'note', path: $event.path, x: $event.x, y: $event.y }"
        @requestFolderContextMenu="contextMenu = { targetType: 'folder', path: $event.path, x: $event.x, y: $event.y }"
        @toggleFolderExpanded="store.toggleFolderExpanded($event)"
        @moveNoteToFolder="store.moveNote($event.path, $event.targetFolderPath)"
        @moveFolderToFolder="store.moveFolder($event.path, $event.targetFolderPath)"
        @requestCreateFolder="openCreateFolderDialog($event)"
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
            <Button class="mt-[var(--space-5)] gap-[var(--space-2)]" @click="createNoteAndFocus()">
              <FilePlus2 class="h-4 w-4" />
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
      :target-type="contextMenu.targetType"
      @delete-note="
        () => {
          const target = store.notes.value.find((note) => note.path === contextMenu?.path)
          contextMenu = null
          if (target) confirmDeleteNotes([target.path])
        }
      "
      @rename-note="
        () => {
          const targetPath = contextMenu?.targetType === 'note' ? contextMenu.path : null
          contextMenu = null
          if (targetPath) openRenameNoteDialog(targetPath)
        }
      "
      @create-note-in-folder="
        () => {
          const targetPath = contextMenu?.targetType === 'folder' ? contextMenu.path : null
          contextMenu = null
          if (targetPath) createNoteAndFocus(targetPath)
        }
      "
      @create-folder-in-folder="
        () => {
          const targetPath = contextMenu?.targetType === 'folder' ? contextMenu.path : null
          contextMenu = null
          if (targetPath) openCreateFolderDialog(targetPath)
        }
      "
      @rename-folder="
        () => {
          const targetPath = contextMenu?.targetType === 'folder' ? contextMenu.path : null
          contextMenu = null
          if (targetPath) openRenameFolderDialog(targetPath)
        }
      "
      @delete-folder="
        () => {
          const targetPath = contextMenu?.targetType === 'folder' ? contextMenu.path : null
          contextMenu = null
          if (targetPath) confirmDeleteFolder(targetPath)
        }
      "
    />

    <ConfirmDialog
      v-if="pendingConfirm"
      :title="pendingConfirm.title"
      :message="pendingConfirm.message"
      :confirm-label="pendingConfirm.confirmLabel"
      @cancel="pendingConfirm = null"
      @confirm="
        () => {
          const nextPending = pendingConfirm
          pendingConfirm = null
          if (!nextPending) return
          if (nextPending.action === 'deleteNotes') {
            void store.deleteNotesByPaths(nextPending.paths)
            if (nextPending.paths.length > 1) isBatchSelecting = false
          } else {
            void store.deleteFolder(nextPending.folderPath)
          }
        }
      "
    />

    <EntityNameDialog
      v-if="nameDialogState"
      :title="nameDialogState.title"
      :confirm-label="nameDialogState.confirmLabel"
      :initial-value="nameDialogState.initialValue"
      :entity-type="nameDialogState.entityType"
      @cancel="nameDialogState = null"
      @confirm="
        (name) => {
          const state = nameDialogState
          nameDialogState = null
          if (!state) return
          if (state.mode === 'createFolder') {
            void store.createFolder(state.parentPath, name)
          } else if (state.mode === 'renameNote') {
            void store.renameNote(state.path, name)
          } else {
            void store.renameFolder(state.path, name)
          }
        }
      "
    />
  </div>
</template>
