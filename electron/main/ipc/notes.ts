import { ipcMain } from 'electron'
import { resolve } from 'node:path'
import type { IpcContext } from './context'

export function registerNotesIpc(context: IpcContext): void {
  ipcMain.handle('notes:list', async () => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    return context.notesService.currentNotesTree(notesDir)
  })

  ipcMain.handle('notes:search', async (_event, query: string) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    return context.notesService.searchNotes(notesDir, query)
  })

  ipcMain.handle('notes:get-search-mode', async () => {
    return {
      mode: context.notesService.getSearchMode(),
    }
  })

  ipcMain.handle('notes:set-search-mode', async (_event, mode: 'memory' | 'ripgrep') => {
    context.notesService.setSearchMode(mode)
    return {
      mode: context.notesService.getSearchMode(),
    }
  })

  ipcMain.handle('notes:read', async (_event, notePath: string) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    return context.notesService.readNote(notesDir, notePath)
  })

  ipcMain.handle(
    'notes:save',
    async (_event, payload: { currentPath?: string | null; parentPath: string | null; name?: string; content: string }) => {
      const notesDir = await context.notesService.getNotesDirOrThrow()
      const result = await context.notesService.saveNote(notesDir, payload)
      await context.scheduleAutoCommitFromActivity()
      return result
    },
  )

  ipcMain.handle('notes:delete', async (_event, notePath: string) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    const result = await context.notesService.deleteNote(notesDir, notePath)
    await context.scheduleAutoCommitFromActivity()
    return result
  })

  ipcMain.handle('notes:create-folder', async (_event, parentPath: string | null, name: string) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    const result = await context.notesService.createFolder(notesDir, parentPath, name)
    await context.scheduleAutoCommitFromActivity()
    return result
  })

  ipcMain.handle('notes:delete-folder', async (_event, folderPath: string) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    const result = await context.notesService.deleteFolder(notesDir, folderPath)
    await context.scheduleAutoCommitFromActivity()
    return result
  })

  ipcMain.handle('notes:move', async (_event, notePath: string, targetFolderPath: string | null) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    const result = await context.notesService.moveNote(notesDir, notePath, targetFolderPath)
    await context.scheduleAutoCommitFromActivity()
    return result
  })

  ipcMain.handle('notes:move-folder', async (_event, folderPath: string, targetFolderPath: string | null) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    const result = await context.notesService.moveFolder(notesDir, folderPath, targetFolderPath)
    await context.scheduleAutoCommitFromActivity()
    return result
  })

  ipcMain.handle('notes:rename-note', async (_event, notePath: string, name: string) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    const result = await context.notesService.renameNote(notesDir, notePath, name)
    await context.scheduleAutoCommitFromActivity()
    return result
  })

  ipcMain.handle('notes:rename-folder', async (_event, folderPath: string, name: string) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    const result = await context.notesService.renameFolder(notesDir, folderPath, name)
    await context.scheduleAutoCommitFromActivity()
    return result
  })

  ipcMain.handle('notes:get-absolute-path', async (_event, relativePath: string) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    const normalized = relativePath
      .replace(/\\/g, '/')
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0 && segment !== '.')

    if (normalized.some((segment) => segment === '..') || normalized.length === 0) {
      throw new Error('路径非法。')
    }

    return {
      path: resolve(notesDir, normalized.join('/')),
    }
  })

  ipcMain.handle(
    'notes:save-image-asset',
    async (_event, payload: { notePath: string; directory: string; fileName: string; mimeType: string; bytes: Uint8Array }) => {
      const notesDir = await context.notesService.getNotesDirOrThrow()
      const result = await context.notesService.saveImageAsset(notesDir, payload)
      await context.scheduleAutoCommitFromActivity()
      return result
    },
  )

  ipcMain.handle('notes:resolve-note-asset-path', async (_event, notePath: string, assetPath: string) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    const { path } = context.notesService.resolveNoteAssetPath(notesDir, notePath, assetPath)
    return {
      path,
      fileUrl: context.buildNoteAssetPreviewUrl(path),
    }
  })

  ipcMain.handle('notes:resolve-image-directory-path', async (_event, payload: { notePath: string | null; directory: string }) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    return context.notesService.ensureImageDirectory(notesDir, payload.notePath, payload.directory)
  })

  ipcMain.handle('notes:cleanup-unused-images', async (_event, directory: string) => {
    const notesDir = await context.notesService.getNotesDirOrThrow()
    const result = await context.notesService.cleanupUnusedImages(notesDir, directory)
    await context.scheduleAutoCommitFromActivity()
    return result
  })
}
