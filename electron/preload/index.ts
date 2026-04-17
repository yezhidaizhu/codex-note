import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  chooseDirectory: () => ipcRenderer.invoke('notes:choose-directory'),
  listNotes: () => ipcRenderer.invoke('notes:list'),
  readNote: (basename: string) => ipcRenderer.invoke('notes:read', basename),
  saveNote: (payload: { currentBasename?: string | null; title: string; content: string }) =>
    ipcRenderer.invoke('notes:save', payload),
  deleteNote: (basename: string) => ipcRenderer.invoke('notes:delete', basename)
}

contextBridge.exposeInMainWorld('notesApi', api)
