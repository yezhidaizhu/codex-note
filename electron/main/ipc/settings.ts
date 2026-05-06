import { app, dialog, ipcMain } from 'electron'
import type { IpcContext } from './context'
import type { StoredSettings } from '../settings/store'

export function registerSettingsIpc(context: IpcContext): void {
  ipcMain.handle('settings:get', async () => {
    const settings = await context.readSettings()
    const noteTree = settings.notesDir ? await context.notesService.currentNotesTree(settings.notesDir) : { notes: [], folders: [] }

    return {
      ...settings,
      notes: noteTree.notes,
      folders: noteTree.folders,
      appearance: settings.appearance,
      quickCreate: settings.quickCreate,
      gitAutomation: settings.gitAutomation,
      editor: settings.editor,
      pinnedNotePaths: settings.pinnedNotePaths,
    }
  })

  ipcMain.handle('notes:choose-directory', async () => {
    const current = await context.readSettings()
    const result = await dialog.showOpenDialog(context.getMainWindow()!, {
      title: '选择 Markdown 笔记保存目录',
      defaultPath: current.notesDir ?? app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const notesDir = result.filePaths[0]
    await context.writeSettings({ ...current, notesDir })
    context.cancelAutoCommit()
    const noteTree = await context.notesService.currentNotesTree(notesDir)

    return {
      notesDir,
      notes: noteTree.notes,
      folders: noteTree.folders,
      appearance: current.appearance,
      quickCreate: current.quickCreate,
      gitAutomation: current.gitAutomation,
      editor: current.editor,
      pinnedNotePaths: current.pinnedNotePaths,
    }
  })

  ipcMain.handle('settings:update-appearance', async (_event, appearance: StoredSettings['appearance']) => {
    const current = await context.readSettings()
    const nextAppearance = {
      mode: appearance.mode ?? current.appearance.mode,
      theme: appearance.theme ?? current.appearance.theme,
      density: appearance.density ?? current.appearance.density,
      transparentBackground: appearance.transparentBackground ?? current.appearance.transparentBackground,
      backgroundColor:
        appearance.backgroundColor === undefined ? current.appearance.backgroundColor : context.sanitizeBackgroundColor(appearance.backgroundColor),
      backgroundOpacity:
        appearance.backgroundOpacity === undefined
          ? current.appearance.backgroundOpacity
          : context.sanitizeBackgroundOpacity(appearance.backgroundOpacity),
    }

    await context.writeSettings({
      ...current,
      appearance: nextAppearance,
    })

    return nextAppearance
  })

  ipcMain.handle('settings:update-quick-create', async (_event, quickCreate: StoredSettings['quickCreate']) => {
    const current = await context.readSettings()
    const nextQuickCreate = {
      mode: quickCreate.mode === undefined ? current.quickCreate.mode : context.sanitizeQuickCreateMode(quickCreate.mode),
      directory:
        quickCreate.directory === undefined
          ? current.quickCreate.directory
          : context.sanitizeQuickCreateDirectory(quickCreate.directory),
      targetPath:
        quickCreate.targetPath === undefined
          ? current.quickCreate.targetPath
          : context.sanitizeQuickCreateTargetPath(quickCreate.targetPath),
      writeClipboardOnCreate:
        quickCreate.writeClipboardOnCreate === undefined
          ? current.quickCreate.writeClipboardOnCreate
          : context.sanitizeQuickCreateWriteClipboardOnCreate(quickCreate.writeClipboardOnCreate),
      namingRule:
        quickCreate.namingRule === undefined
          ? current.quickCreate.namingRule
          : context.sanitizeQuickCreateNamingRule(quickCreate.namingRule),
      centerWindowOnTrigger:
        quickCreate.centerWindowOnTrigger === undefined
          ? current.quickCreate.centerWindowOnTrigger
          : context.sanitizeQuickCreateCenterWindowOnTrigger(quickCreate.centerWindowOnTrigger),
      hideWindowOnTriggerWhenFocused:
        quickCreate.hideWindowOnTriggerWhenFocused === undefined
          ? current.quickCreate.hideWindowOnTriggerWhenFocused
          : context.sanitizeQuickCreateHideWindowOnTriggerWhenFocused(quickCreate.hideWindowOnTriggerWhenFocused),
    }

    await context.writeSettings({
      ...current,
      quickCreate: nextQuickCreate,
    })

    return nextQuickCreate
  })

  ipcMain.handle('settings:update-git-automation', async (_event, gitAutomation: StoredSettings['gitAutomation']) => {
    const current = await context.readSettings()
    const nextGitAutomation = {
      autoCommitEnabled:
        gitAutomation.autoCommitEnabled === undefined
          ? current.gitAutomation.autoCommitEnabled
          : context.sanitizeGitAutoCommitEnabled(gitAutomation.autoCommitEnabled),
      autoCommitIntervalMinutes:
        gitAutomation.autoCommitIntervalMinutes === undefined
          ? current.gitAutomation.autoCommitIntervalMinutes
          : context.sanitizeGitAutoCommitIntervalMinutes(gitAutomation.autoCommitIntervalMinutes),
    }

    await context.writeSettings({
      ...current,
      gitAutomation: nextGitAutomation,
    })

    if (nextGitAutomation.autoCommitEnabled) {
      await context.scheduleAutoCommitFromActivity()
    } else {
      context.cancelAutoCommit()
    }

    return nextGitAutomation
  })

  ipcMain.handle('settings:update-editor', async (_event, editor: StoredSettings['editor']) => {
    const current = await context.readSettings()
    const nextEditor = {
      enabledFeatures:
        editor.enabledFeatures === undefined ? current.editor.enabledFeatures : context.sanitizeEditorEnabledFeatures(editor.enabledFeatures),
      imageDirectory:
        editor.imageDirectory === undefined ? current.editor.imageDirectory : context.sanitizeEditorImageDirectory(editor.imageDirectory),
    }

    await context.writeSettings({
      ...current,
      editor: nextEditor,
    })

    return nextEditor
  })

  ipcMain.handle('settings:update-pinned-note-paths', async (_event, pinnedNotePaths: string[]) => {
    const current = await context.readSettings()
    const nextPinnedNotePaths = context.sanitizePinnedNotePaths(pinnedNotePaths)

    await context.writeSettings({
      ...current,
      pinnedNotePaths: nextPinnedNotePaths,
    })

    return nextPinnedNotePaths
  })
}
