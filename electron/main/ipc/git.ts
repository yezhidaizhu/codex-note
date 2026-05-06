import { ipcMain } from 'electron'
import type { IpcContext } from './context'

export function registerGitIpc(context: IpcContext): void {
  ipcMain.handle('git:get-status', async () => {
    const settings = await context.readSettings()
    return context.gitService.getStatus(settings.notesDir, {
      nextAutoCommitAt: context.getNextAutoCommitAt(),
    })
  })

  ipcMain.handle('git:init-repo', async () => {
    const settings = await context.readSettings()
    if (!settings.notesDir) {
      throw new Error('请先选择笔记目录。')
    }

    const status = await context.gitService.initRepo(settings.notesDir)
    await context.scheduleAutoCommitFromActivity()
    return status
  })

  ipcMain.handle('git:commit-now', async () => {
    const settings = await context.readSettings()
    if (!settings.notesDir) {
      throw new Error('请先选择笔记目录。')
    }

    context.cancelAutoCommit()
    return context.gitService.commitAll(settings.notesDir, 'notes: manual commit')
  })
}
