import { clipboard, ipcMain, shell } from 'electron'
import type { IpcContext } from './context'

export function registerSystemIpc(context: IpcContext): void {
  ipcMain.handle('system:get-appearance', async () => context.currentSystemAppearance())

  ipcMain.handle('clipboard:write-text', async (_event, value: string) => {
    try {
      clipboard.writeText(value)
      return {
        ok: true,
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '复制失败。',
      }
    }
  })

  ipcMain.handle('shell:open-directory-path', async (_event, directoryPath: string) => {
    try {
      const error = await shell.openPath(directoryPath)

      if (error) {
        return {
          ok: false,
          error,
        }
      }

      return {
        ok: true,
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : '打开目录失败。',
      }
    }
  })
}
