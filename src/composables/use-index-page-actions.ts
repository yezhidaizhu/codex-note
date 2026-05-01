import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useNoteSelection } from '@/composables/use-note-selection'
import { buildDeleteFolderMessage, buildDeleteMessage, getListLabel } from '@/state/notes'
import type { NotesStore } from '@/state/notes'

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
  selectedPaths?: string[]
  x: number
  y: number
} | null

function folderNameFromPath(pathValue: string): string {
  const segments = pathValue.split('/')
  return segments[segments.length - 1] || pathValue
}

function noteNameForRename(name: string): string {
  return name.replace(/\.md$/i, '')
}

function bindWindowCloseWhenOpen(source: Ref<NoteContextMenuState | boolean>, close: () => void) {
  watch(source, (value, _prev, onCleanup) => {
    if (!value) return
    window.addEventListener('click', close)
    window.addEventListener('blur', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', close)
    onCleanup(() => {
      window.removeEventListener('click', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', close)
    })
  })
}

export function useIndexPageActions(store: NotesStore) {
  const contextMenu = ref<NoteContextMenuState>(null)
  const listActionsMenuOpen = ref(false)
  const pendingConfirm = ref<PendingConfirmState>(null)
  const nameDialogState = ref<NameDialogState>(null)
  const selection = useNoteSelection()
  const { selectedPaths } = selection

  function closeContextMenu() {
    contextMenu.value = null
  }

  function closeListActionsMenu() {
    listActionsMenuOpen.value = false
  }

  function toggleListActionsMenu() {
    listActionsMenuOpen.value = !listActionsMenuOpen.value
  }

  function closeTransientMenus() {
    closeContextMenu()
    closeListActionsMenu()
  }

  function handleShellContextMenu(event: MouseEvent) {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.closest('[data-note-item="true"], [data-folder-item="true"]')) {
      closeContextMenu()
    }
  }

  function handleShellClick() {
    closeContextMenu()
  }

  function clearNoteSelection() {
    selection.clearSelection()
  }

  function requestNoteContextMenuForSelection(payload: { path: string; selectedPaths: string[]; x: number; y: number }) {
    contextMenu.value = { targetType: 'note', ...payload }
  }

  function requestFolderContextMenu(payload: { path: string; x: number; y: number }) {
    contextMenu.value = { targetType: 'folder', ...payload }
  }

  function confirmDeleteNotes(paths: string[]) {
    if (paths.length === 0) return
    const targetNote = paths.length === 1 ? store.notes.find((note) => note.path === paths[0]) : null

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
    closeTransientMenus()
  }

  function openRenameNoteDialog(path: string) {
    const target = store.notes.find((note) => note.path === path)
    if (!target) return
    nameDialogState.value = {
      mode: 'renameNote',
      path,
      title: '重命名文件',
      confirmLabel: '重命名',
      initialValue: noteNameForRename(target.name),
      entityType: 'note',
    }
    closeTransientMenus()
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
    closeTransientMenus()
  }

  async function confirmPendingAction() {
    const nextPending = pendingConfirm.value
    pendingConfirm.value = null
    if (!nextPending) return

    if (nextPending.action === 'deleteNotes') {
      await store.deleteNotesByPaths(nextPending.paths)
      selection.removePaths(nextPending.paths)
      return
    }

    await store.deleteFolder(nextPending.folderPath)
  }

  async function submitNameDialog(name: string) {
    const state = nameDialogState.value
    nameDialogState.value = null
    if (!state) return

    if (state.mode === 'createFolder') {
      await store.createFolder(state.parentPath, name)
      return
    }

    if (state.mode === 'renameNote') {
      await store.renameNote(state.path, name)
      return
    }

    await store.renameFolder(state.path, name)
  }

  function deleteNoteFromContextMenu() {
    const targetPaths = contextMenu.value?.targetType === 'note' ? contextMenu.value.selectedPaths ?? [contextMenu.value.path] : null
    closeContextMenu()
    if (targetPaths) confirmDeleteNotes(targetPaths)
  }

  function renameNoteFromContextMenu() {
    const targetPath = contextMenu.value?.targetType === 'note' ? contextMenu.value.path : null
    closeContextMenu()
    if (targetPath) openRenameNoteDialog(targetPath)
  }

  async function copyRelativePathFromContextMenu() {
    const targetPath = contextMenu.value?.targetType === 'note' ? contextMenu.value.path : null
    closeContextMenu()
    if (targetPath) await store.copyRelativeNotePath(targetPath)
  }

  async function copyAbsolutePathFromContextMenu() {
    const targetPath = contextMenu.value?.targetType === 'note' ? contextMenu.value.path : null
    closeContextMenu()
    if (targetPath) await store.copyAbsoluteNotePath(targetPath)
  }

  function createNoteInFolderFromContextMenu(createNoteAndFocus: (parentPath?: string | null) => void) {
    const targetPath = contextMenu.value?.targetType === 'folder' ? contextMenu.value.path : null
    closeContextMenu()
    if (targetPath) createNoteAndFocus(targetPath)
  }

  function createFolderInFolderFromContextMenu() {
    const targetPath = contextMenu.value?.targetType === 'folder' ? contextMenu.value.path : null
    closeContextMenu()
    if (targetPath) openCreateFolderDialog(targetPath)
  }

  function renameFolderFromContextMenu() {
    const targetPath = contextMenu.value?.targetType === 'folder' ? contextMenu.value.path : null
    closeContextMenu()
    if (targetPath) openRenameFolderDialog(targetPath)
  }

  function deleteFolderFromContextMenu() {
    const targetPath = contextMenu.value?.targetType === 'folder' ? contextMenu.value.path : null
    closeContextMenu()
    if (targetPath) confirmDeleteFolder(targetPath)
  }

  bindWindowCloseWhenOpen(contextMenu, closeContextMenu)
  bindWindowCloseWhenOpen(listActionsMenuOpen, closeListActionsMenu)

  return {
    contextMenu,
    listActionsMenuOpen,
    pendingConfirm,
    nameDialogState,
    selectedPaths,
    selection,
    clearNoteSelection,
    handleShellContextMenu,
    handleShellClick,
    toggleListActionsMenu,
    requestNoteContextMenuForSelection,
    requestFolderContextMenu,
    confirmDeleteNotes,
    confirmDeleteFolder,
    openCreateFolderDialog,
    openRenameNoteDialog,
    openRenameFolderDialog,
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
  }
}
