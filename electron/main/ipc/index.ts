import type { IpcContext } from './context'
import { registerFileIpc } from './file'
import { registerGitIpc } from './git'
import { registerNotesIpc } from './notes'
import { registerSettingsIpc } from './settings'
import { registerSystemIpc } from './system'
import { registerWindowIpc } from './window'

export function registerIpcHandlers(context: IpcContext): void {
  registerSettingsIpc(context)
  registerNotesIpc(context)
  registerGitIpc(context)
  registerFileIpc(context)
  registerSystemIpc(context)
  registerWindowIpc(context)
}
