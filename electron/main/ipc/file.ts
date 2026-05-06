import { ipcMain } from 'electron'
import type { IpcContext } from './context'

export function registerFileIpc(context: IpcContext): void {
  ipcMain.handle('file:read-text', async (_event, relativePath: string) => {
    const settings = await context.readSettings()
    if (!settings.notesDir) {
      throw new Error('请先选择笔记目录。')
    }

    return context.workspaceFileService.readTextFile(settings.notesDir, relativePath)
  })

  ipcMain.handle('file:write-text', async (_event, payload: { path: string; content: string }) => {
    const settings = await context.readSettings()
    if (!settings.notesDir) {
      throw new Error('请先选择笔记目录。')
    }

    await context.workspaceFileService.writeTextFile(settings.notesDir, payload.path, payload.content)
    await context.scheduleAutoCommitFromActivity()
  })
}
