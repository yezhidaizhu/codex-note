import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { EditorFeatureKey, EditorSettings } from '@/lib/types'

const defaultEditorSettings: EditorSettings = {
  enabledFeatures: ['heading', 'bold', 'italic', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'codeBlock', 'link', 'image'],
  imageDirectory: '.assets',
}

function getNotesApi() {
  if (!window.notesApi) {
    throw new Error(
      '未检测到 Electron 预加载接口。请用 `pnpm dev` 或 `pnpm dev:electron` 启动 Electron 窗口，不要直接打开 Vite 地址或 `index.html`。',
    )
  }

  return window.notesApi
}

export const useEditorSettingsStore = defineStore('editorSettings', () => {
  const settings = ref<EditorSettings>({ ...defaultEditorSettings })
  const errorMessage = ref('')
  const initialized = ref(false)
  let bootPromise: Promise<void> | null = null

  const enabledFeatureSet = computed(() => new Set(settings.value.enabledFeatures))

  async function bootOnce() {
    errorMessage.value = ''

    try {
      const appSettings = await getNotesApi().getSettings()
      settings.value = appSettings.editor
      initialized.value = true
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '初始化编辑器设置失败。'
    }
  }

  async function ensureInitialized() {
    if (initialized.value) return
    if (!bootPromise) {
      bootPromise = bootOnce().finally(() => {
        bootPromise = null
      })
    }
    await bootPromise
  }

  async function updateEditorSettings(nextSettings: EditorSettings) {
    try {
      settings.value = await getNotesApi().updateEditorSettings(nextSettings)
      initialized.value = true
      errorMessage.value = ''
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '更新编辑器设置失败。'
    }
  }

  async function setFeatureEnabled(feature: EditorFeatureKey, enabled: boolean) {
    const nextFeatures = enabled
      ? Array.from(new Set([...settings.value.enabledFeatures, feature]))
      : settings.value.enabledFeatures.filter((item) => item !== feature)

    await updateEditorSettings({
      ...settings.value,
      enabledFeatures: nextFeatures,
    })
  }

  async function updateImageDirectory(imageDirectory: string) {
    await updateEditorSettings({
      ...settings.value,
      imageDirectory,
    })
  }

  return {
    settings,
    errorMessage,
    initialized,
    enabledFeatureSet,
    ensureInitialized,
    updateEditorSettings,
    setFeatureEnabled,
    updateImageDirectory,
  }
})
