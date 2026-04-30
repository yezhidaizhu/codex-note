import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  chooseDirectory: () => ipcRenderer.invoke('notes:choose-directory'),
  listNotes: () => ipcRenderer.invoke('notes:list'),
  readNote: (path: string) => ipcRenderer.invoke('notes:read', path),
  saveNote: (payload: { currentPath?: string | null; parentPath: string | null; title: string; content: string }) =>
    ipcRenderer.invoke('notes:save', payload),
  deleteNote: (path: string) => ipcRenderer.invoke('notes:delete', path),
  createFolder: (parentPath: string | null, name: string) => ipcRenderer.invoke('notes:create-folder', parentPath, name),
  deleteFolder: (path: string) => ipcRenderer.invoke('notes:delete-folder', path),
  moveNote: (path: string, targetFolderPath: string | null) => ipcRenderer.invoke('notes:move', path, targetFolderPath),
  moveFolder: (path: string, targetFolderPath: string | null) => ipcRenderer.invoke('notes:move-folder', path, targetFolderPath),
  renameNote: (path: string, name: string) => ipcRenderer.invoke('notes:rename-note', path, name),
  renameFolder: (path: string, name: string) => ipcRenderer.invoke('notes:rename-folder', path, name),
  setSidebarCollapsed: (collapsed: boolean) => ipcRenderer.invoke('window:set-sidebar-collapsed', collapsed),
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  setAlwaysOnTop: (pinned: boolean) => ipcRenderer.invoke('window:set-always-on-top', pinned)
}

contextBridge.exposeInMainWorld('notesApi', api)
