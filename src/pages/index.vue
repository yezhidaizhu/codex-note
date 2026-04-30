<script setup lang="ts">
import { FilePlus2, FolderOpen } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/confirm-dialog.vue'
import EntityNameDialog from '@/components/notes/entity-name-dialog.vue'
import NoteContextMenu from '@/components/notes/note-context-menu.vue'
import TitleBar from '@/components/app/titlebar.vue'
import NotesSidebar from '@/components/notes/notes-sidebar.vue'
import Button from '@/components/ui/button.vue'
import Textarea from '@/components/ui/textarea.vue'
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
  activeNote,
  selectedPath,
  errorMessage,
  query,
  sidebarCollapsed,
  sidebarWidth,
  isPinned,
  expandedFolderPaths,
} = storeToRefs(store)

const {
  contextMenu,
  listActionsMenuOpen,
  pendingConfirm,
  nameDialogState,
  isBatchSelecting,
  selectedPaths,
  handleShellContextMenu,
  handleShellClick,
  toggleListActionsMenu,
  requestNoteContextMenu,
  requestFolderContextMenu,
  confirmDeleteNotes,
  openCreateFolderDialog,
  toggleBatchSelect,
  toggleNoteSelection,
  confirmPendingAction,
  submitNameDialog,
  deleteNoteFromContextMenu,
  renameNoteFromContextMenu,
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
      @toggleSidebar="store.sidebarCollapsed = !store.sidebarCollapsed"
      @createNote="noteEditor.createNoteAndFocus()"
      @togglePinned="store.togglePinned"
    />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <NotesSidebar
        :notes-dir="notesDir"
        :notes="notes"
        :folders="folders"
        :filtered-notes="filteredNotes"
        :query="query"
        :selected-path="selectedPath"
        :sidebar-collapsed="sidebarCollapsed"
        :sidebar-width="sidebarWidth"
        :is-sidebar-resizing="isSidebarResizing"
        :is-batch-selecting="isBatchSelecting"
        :selected-paths="selectedPaths"
        :expanded-folder-paths="expandedFolderPaths"
        :list-actions-menu-open="listActionsMenuOpen"
        @update:query="store.query = $event"
        @createNote="noteEditor.createNoteAndFocus()"
        @openNote="store.openNote($event)"
        @toggleListActionsMenu="toggleListActionsMenu"
        @toggleBatchSelect="toggleBatchSelect"
        @toggleNoteSelection="toggleNoteSelection($event)"
        @confirmDeleteSelected="confirmDeleteNotes(selectedPaths)"
        @goSettings="router.push('/settings')"
        @beginResize="beginSidebarResize"
        @requestNoteContextMenu="requestNoteContextMenu($event)"
        @requestFolderContextMenu="requestFolderContextMenu($event)"
        @toggleFolderExpanded="store.toggleFolderExpanded($event)"
        @moveNoteToFolder="store.moveNote($event.path, $event.targetFolderPath)"
        @moveFolderToFolder="store.moveFolder($event.path, $event.targetFolderPath)"
        @requestCreateFolder="openCreateFolderDialog($event)"
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

        <section v-else-if="activeNote" class="editor-surface flex min-h-0 flex-1 flex-col overflow-hidden">
          <Textarea
            :ref="noteEditor.bindEditorTextarea"
            :value="activeNote.content"
            class="scrollbar-thin h-full min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-[var(--editor-pad-x)] py-[var(--editor-pad-y)] text-[15px] leading-8 shadow-none focus-visible:ring-0 placeholder:text-[color-mix(in_srgb,var(--muted-foreground)_52%,transparent)]"
            placeholder="写点什么"
            @input="noteEditor.onEditorInput"
          />
        </section>

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
      @delete-note="deleteNoteFromContextMenu"
      @rename-note="renameNoteFromContextMenu"
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
