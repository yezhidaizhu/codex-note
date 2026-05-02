<script setup lang="ts">
import { FilePlus2, FolderOpen } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/confirm-dialog.vue'
import EntityNameDialog from '@/components/notes/entity-name-dialog.vue'
import NoteContextMenu from '@/components/notes/note-context-menu.vue'
import TitleBar from '@/components/app/titlebar.vue'
import NotesSidebar from '@/components/notes/notes-sidebar.vue'
import NoteMarkdownEditor from '@/components/editor/note-markdown-editor.vue'
import Button from '@/components/ui/button.vue'
import { useIndexPageActions } from '@/composables/use-index-page-actions'
import { useNoteEditor } from '@/composables/use-note-editor'
import { usePanelResize } from '@/composables/use-panel-resize'
import { useNotesStore } from '@/state/notes'

const router = useRouter()
const store = useNotesStore()
const {
  notesDir,
  notes,
  folders,
  filteredNotes,
  searchActiveIndex,
  activeNote,
  selectedPath,
  errorMessage,
  query,
  sidebarCollapsed,
  sidebarWidth,
  isPinned,
  pinnedNotePaths,
  expandedFolderPaths,
} = storeToRefs(store)

const {
  contextMenu,
  pendingConfirm,
  nameDialogState,
  selectedPaths,
  selection,
  clearNoteSelection,
  handleShellContextMenu,
  handleShellClick,
  requestNoteContextMenuForSelection,
  requestFolderContextMenu,
  confirmDeleteNotes,
  openCreateFolderDialog,
  confirmPendingAction,
  submitNameDialog,
  deleteNoteFromContextMenu,
  renameNoteFromContextMenu,
  copyRelativePathFromContextMenu,
  copyAbsolutePathFromContextMenu,
  createNoteInFolderFromContextMenu,
  createFolderInFolderFromContextMenu,
  renameFolderFromContextMenu,
  deleteFolderFromContextMenu,
} = useIndexPageActions(store)

const noteEditor = useNoteEditor(store)
const { isResizing: isSidebarResizing, beginResize: beginSidebarResize } = usePanelResize(sidebarWidth, sidebarCollapsed, {
  minWidth: 220,
  maxWidth: 520,
})

function handleActivateNoteSelection(payload: { path: string; orderedPaths: string[]; modifiers: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean } }) {
  return selection.handleNoteActivation(payload.path, payload.orderedPaths, payload.modifiers)
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  clearNoteSelection()
}

function handleSidebarBlankPointerDown(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (target.closest('[data-note-item="true"], [data-folder-item="true"], [data-note-list-shell="true"]')) return
  clearNoteSelection()
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>

<template>
  <div
    class="app-shell-glass app-shell-surface flex h-full flex-col overflow-hidden rounded-xl border border-[var(--shell-border)] bg-transparent text-[var(--foreground)]"
    @contextmenu="handleShellContextMenu"
    @click="handleShellClick"
  >
    <TitleBar
      :sidebar-collapsed="sidebarCollapsed"
      :notes-dir="notesDir"
      :is-pinned="isPinned"
      @toggleSidebar="store.toggleSidebarCollapsed()"
      @createNote="noteEditor.createNoteAndFocus()"
      @togglePinned="store.togglePinned"
    />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <NotesSidebar
        @mousedown.capture="handleSidebarBlankPointerDown"
        :notes-dir="notesDir"
        :notes="notes"
        :folders="folders"
        :filtered-notes="filteredNotes"
        :query="query"
        :selected-path="selectedPath"
        :search-active-index="searchActiveIndex"
        :sidebar-collapsed="sidebarCollapsed"
        :sidebar-width="sidebarWidth"
        :is-sidebar-resizing="isSidebarResizing"
        :selected-paths="selectedPaths"
        :pinned-note-paths="pinnedNotePaths"
        :expanded-folder-paths="expandedFolderPaths"
        @update:query="store.query = $event"
        @createNote="noteEditor.createNoteAndFocus()"
        @openNote="store.openNote($event)"
        @activateNoteSelection="handleActivateNoteSelection($event)"
        @requestDeleteSelected="confirmDeleteNotes($event)"
        @goSettings="router.push('/settings')"
        @beginResize="beginSidebarResize"
        @requestNoteContextMenu="requestNoteContextMenuForSelection($event)"
        @requestFolderContextMenu="requestFolderContextMenu($event)"
        @toggleFolderExpanded="store.toggleFolderExpanded($event)"
        @moveNoteToFolder="store.moveNote($event.path, $event.targetFolderPath)"
        @moveFolderToFolder="store.moveFolder($event.path, $event.targetFolderPath)"
        @togglePinnedNote="store.togglePinnedNote($event)"
        @requestCreateFolder="openCreateFolderDialog($event)"
        @openSearchResultAt="store.openSearchResultAt($event)"
        @moveSearchSelection="store.moveSearchSelection($event)"
        @openActiveSearchResult="store.openActiveSearchResult()"
      />

      <main class="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        <section v-if="!notesDir" class="flex min-h-0 flex-1 items-center justify-center p-[var(--content-area-pad)]">
          <div
            class="w-full max-w-2xl rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] p-[var(--panel-pad)]"
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

        <NoteMarkdownEditor v-else-if="activeNote" />

        <section v-else class="flex min-h-0 flex-1 items-center justify-center p-[var(--content-area-pad)]">
          <div
            class="w-full max-w-xl rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_16%,transparent)] p-[var(--panel-pad)]"
          >
            <p class="text-ui-xs uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Ready</p>
            <h3 class="mt-[var(--space-3)] text-2xl font-semibold tracking-tight">选一篇笔记，或者新建一篇</h3>
            <p class="text-ui-md mt-[var(--space-4)] leading-7 text-[var(--muted-foreground)]">
              左侧读取所选目录里的 `.md` 文件，右侧直接编辑原始 Markdown 文本。
            </p>
            <Button class="mt-[var(--space-5)] gap-[var(--space-2)]" @click="noteEditor.createNoteAndFocus()">
              <FilePlus2 class="h-4 w-4" />
              新建笔记
            </Button>
          </div>
        </section>

        <div
          v-if="errorMessage"
          class="text-ui-xs border-t border-[color-mix(in_srgb,var(--border)_80%,transparent)] px-[var(--space-4)] py-[var(--space-2)] text-right text-[var(--destructive)]"
        >
          {{ errorMessage }}
        </div>
      </main>
    </div>

    <NoteContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :target-type="contextMenu.targetType"
      :note-selection-count="contextMenu.targetType === 'note' ? contextMenu.selectedPaths?.length ?? 1 : undefined"
      @delete-note="deleteNoteFromContextMenu"
      @rename-note="renameNoteFromContextMenu"
      @copy-relative-path="copyRelativePathFromContextMenu"
      @copy-absolute-path="copyAbsolutePathFromContextMenu"
      @create-note-in-folder="createNoteInFolderFromContextMenu(noteEditor.createNoteAndFocus)"
      @create-folder-in-folder="createFolderInFolderFromContextMenu"
      @rename-folder="renameFolderFromContextMenu"
      @delete-folder="deleteFolderFromContextMenu"
    />

    <ConfirmDialog
      v-if="pendingConfirm"
      :title="pendingConfirm.title"
      :message="pendingConfirm.message"
      :confirm-label="pendingConfirm.confirmLabel"
      @cancel="pendingConfirm = null"
      @confirm="confirmPendingAction"
    />

    <EntityNameDialog
      v-if="nameDialogState"
      :title="nameDialogState.title"
      :confirm-label="nameDialogState.confirmLabel"
      :initial-value="nameDialogState.initialValue"
      :entity-type="nameDialogState.entityType"
      @cancel="nameDialogState = null"
      @confirm="submitNameDialog"
    />
  </div>
</template>
