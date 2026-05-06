import { contextBridge, ipcRenderer } from 'electron'
import type { AppearanceSettings, CleanupUnusedImagesResult, EditorSettings, GitAutomationSettings, GitStatus, NoteTreeResult, QuickCreateSettings } from '@/lib/types'

const api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getSystemAppearance: () => ipcRenderer.invoke('system:get-appearance') as Promise<'dark' | 'light'>,
  onSystemAppearanceChange: (listener: (mode: 'dark' | 'light') => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, mode: 'dark' | 'light') => listener(mode)
    ipcRenderer.on('system-appearance:changed', wrappedListener)
    return () => ipcRenderer.removeListener('system-appearance:changed', wrappedListener)
  },
  onNotesTreeChange: (listener: (tree: NoteTreeResult) => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, tree: NoteTreeResult) => listener(tree)
    ipcRenderer.on('notes:tree-changed', wrappedListener)
    return () => ipcRenderer.removeListener('notes:tree-changed', wrappedListener)
  },
  onQuickCreateTriggered: (listener: (payload: { action: 'create'; parentPath: string | null; initialContent: string; nameSeed?: string | null } | { action: 'open'; path: string }) => void) => {
    const wrappedListener = (
      _event: Electron.IpcRendererEvent,
      payload: { action: 'create'; parentPath: string | null; initialContent: string; nameSeed?: string | null } | { action: 'open'; path: string },
    ) => listener(payload)
    ipcRenderer.on('quick-create:triggered', wrappedListener)
    return () => ipcRenderer.removeListener('quick-create:triggered', wrappedListener)
  },
  chooseDirectory: () => ipcRenderer.invoke('notes:choose-directory'),
  listNotes: () => ipcRenderer.invoke('notes:list'),
  searchNotes: (query: string) => ipcRenderer.invoke('notes:search', query),
  getSearchMode: () => ipcRenderer.invoke('notes:get-search-mode') as Promise<{ mode: 'memory' | 'ripgrep' }>,
  setSearchMode: (mode: 'memory' | 'ripgrep') => ipcRenderer.invoke('notes:set-search-mode', mode) as Promise<{ mode: 'memory' | 'ripgrep' }>,
  readNote: (path: string) => ipcRenderer.invoke('notes:read', path),
  saveNote: (payload: { currentPath?: string | null; parentPath: string | null; name?: string; content: string }) =>
    ipcRenderer.invoke('notes:save', payload),
  saveImageAsset: (payload: { notePath: string; directory: string; fileName: string; mimeType: string; bytes: Uint8Array }) =>
    ipcRenderer.invoke('notes:save-image-asset', payload) as Promise<{ relativePath: string }>,
  resolveNoteAssetPath: (notePath: string, assetPath: string) =>
    ipcRenderer.invoke('notes:resolve-note-asset-path', notePath, assetPath) as Promise<{ path: string; fileUrl: string }>,
  resolveImageDirectoryPath: (payload: { notePath: string | null; directory: string }) =>
    ipcRenderer.invoke('notes:resolve-image-directory-path', payload) as Promise<{ path: string }>,
  cleanupUnusedImages: (directory: string) =>
    ipcRenderer.invoke('notes:cleanup-unused-images', directory) as Promise<CleanupUnusedImagesResult>,
  deleteNote: (path: string) => ipcRenderer.invoke('notes:delete', path),
  createFolder: (parentPath: string | null, name: string) => ipcRenderer.invoke('notes:create-folder', parentPath, name),
  deleteFolder: (path: string) => ipcRenderer.invoke('notes:delete-folder', path),
  moveNote: (path: string, targetFolderPath: string | null) => ipcRenderer.invoke('notes:move', path, targetFolderPath),
  moveFolder: (path: string, targetFolderPath: string | null) => ipcRenderer.invoke('notes:move-folder', path, targetFolderPath),
  renameNote: (path: string, name: string) => ipcRenderer.invoke('notes:rename-note', path, name),
  renameFolder: (path: string, name: string) => ipcRenderer.invoke('notes:rename-folder', path, name),
  getAbsoluteNotePath: (path: string) => ipcRenderer.invoke('notes:get-absolute-path', path) as Promise<{ path: string }>,
  openDirectoryPath: (path: string) => ipcRenderer.invoke('shell:open-directory-path', path),
  writeClipboardText: (value: string) => ipcRenderer.invoke('clipboard:write-text', value),
  updateAppearance: (appearance: AppearanceSettings) => ipcRenderer.invoke('settings:update-appearance', appearance),
  updateQuickCreateSettings: (quickCreate: QuickCreateSettings) => ipcRenderer.invoke('settings:update-quick-create', quickCreate),
  getGitStatus: () => ipcRenderer.invoke('git:get-status') as Promise<GitStatus>,
  initGitRepo: () => ipcRenderer.invoke('git:init-repo') as Promise<GitStatus>,
  readWorkspaceTextFile: (path: string) => ipcRenderer.invoke('file:read-text', path) as Promise<{ content: string; exists: boolean }>,
  writeWorkspaceTextFile: (payload: { path: string; content: string }) => ipcRenderer.invoke('file:write-text', payload) as Promise<void>,
  commitGitNow: () => ipcRenderer.invoke('git:commit-now') as Promise<GitStatus>,
  updateGitAutomationSettings: (gitAutomation: GitAutomationSettings) =>
    ipcRenderer.invoke('settings:update-git-automation', gitAutomation) as Promise<GitAutomationSettings>,
  updateEditorSettings: (editor: EditorSettings) => ipcRenderer.invoke('settings:update-editor', editor) as Promise<EditorSettings>,
  updatePinnedNotePaths: (paths: string[]) => ipcRenderer.invoke('settings:update-pinned-note-paths', paths) as Promise<string[]>,
  setSidebarCollapsed: (collapsed: boolean) => ipcRenderer.invoke('window:set-sidebar-collapsed', collapsed),
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  setAlwaysOnTop: (pinned: boolean) => ipcRenderer.invoke('window:set-always-on-top', pinned)
}

contextBridge.exposeInMainWorld('notesApi', api)
