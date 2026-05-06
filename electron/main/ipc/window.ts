import { ipcMain } from 'electron'
import type { IpcContext } from './context'

export function registerWindowIpc(context: IpcContext): void {
  ipcMain.handle('window:set-sidebar-collapsed', async (_event, collapsed: boolean) => {
    const mainWindow = context.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return context.computeDefaultWindowBounds(context.currentWorkArea(), collapsed ? 'collapsed' : 'expanded')
    }

    await context.persistWindowBounds(mainWindow.getBounds(), context.getCurrentWindowSizeMode())
    return context.applyWindowSizeMode(collapsed ? 'collapsed' : 'expanded')
  })

  ipcMain.handle('window:get-state', async () => {
    return {
      isAlwaysOnTop: context.getMainWindow()?.isAlwaysOnTop() ?? false,
    }
  })

  ipcMain.handle('window:set-always-on-top', async (_event, pinned: boolean) => {
    const mainWindow = context.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) {
      return {
        isAlwaysOnTop: false,
      }
    }

    mainWindow.setAlwaysOnTop(pinned, 'floating')

    return {
      isAlwaysOnTop: mainWindow.isAlwaysOnTop(),
    }
  })
}
