<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type NoteListItem = {
  basename: string
  title: string
  preview: string
  updatedAt: string
  size: number
}

type DraftNote = {
  basename: string | null
  title: string
  content: string
  updatedAt: string | null
}

const notesDir = ref<string | null>(null)
const notes = ref<NoteListItem[]>([])
const activeNote = ref<DraftNote | null>(null)
const selectedBasename = ref<string | null>(null)
const loading = ref(true)
const saving = ref(false)
const message = ref('正在初始化…')
const errorMessage = ref('')

function getNotesApi() {
  if (!window.notesApi) {
    throw new Error(
      '未检测到 Electron 预加载接口。请用 `pnpm dev` 或 `pnpm dev:electron` 启动 Electron 窗口，不要直接打开 Vite 地址或 `index.html`。'
    )
  }

  return window.notesApi
}

const emptyDraft = (): DraftNote => ({
  basename: null,
  title: 'Untitled',
  content: '# Untitled\n',
  updatedAt: null
})

const noteCountLabel = computed(() => `${notes.value.length} 篇笔记`)

const activeMeta = computed(() => {
  if (!activeNote.value?.updatedAt) {
    return '尚未保存'
  }

  const date = new Date(activeNote.value.updatedAt)
  return `上次保存 ${date.toLocaleString('zh-CN', { hour12: false })}`
})

async function boot() {
  loading.value = true
  errorMessage.value = ''

  try {
    const settings = await getNotesApi().getSettings()
    notesDir.value = settings.notesDir
    notes.value = settings.notes

    if (settings.notes.length > 0) {
      await openNote(settings.notes[0].basename)
      message.value = '已载入最近更新的笔记。'
    } else if (settings.notesDir) {
      activeNote.value = emptyDraft()
      selectedBasename.value = null
      message.value = '目录已连接，可以开始写第一篇笔记。'
    } else {
      activeNote.value = null
      selectedBasename.value = null
      message.value = '先选择一个本地目录，应用会在其中保存 `.md` 文件。'
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '初始化失败。'
  } finally {
    loading.value = false
  }
}

async function chooseDirectory() {
  try {
    const result = await getNotesApi().chooseDirectory()
    if (!result) {
      return
    }

    notesDir.value = result.notesDir
    notes.value = result.notes
    if (result.notes.length > 0) {
      await openNote(result.notes[0].basename)
      message.value = '已切换笔记目录。'
    } else {
      createNote()
      message.value = '目录已设置，先写一篇新的 Markdown 笔记。'
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '选择目录失败。'
  }
}

function createNote() {
  selectedBasename.value = null
  activeNote.value = emptyDraft()
  message.value = '新建草稿中。'
}

async function openNote(basename: string) {
  try {
    const note = await getNotesApi().readNote(basename)
    selectedBasename.value = basename
    activeNote.value = {
      basename: note.basename,
      title: note.title,
      content: note.content,
      updatedAt: note.updatedAt
    }
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '打开笔记失败。'
  }
}

async function saveNote() {
  if (!activeNote.value || !notesDir.value) {
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    const result = await getNotesApi().saveNote({
      currentBasename: activeNote.value.basename,
      title: activeNote.value.title,
      content: activeNote.value.content
    })

    notes.value = result.notes
    selectedBasename.value = result.note.basename
    activeNote.value = {
      basename: result.note.basename,
      title: result.note.title,
      content: result.note.content,
      updatedAt: result.note.updatedAt
    }
    message.value = `已保存为 ${result.note.basename}`
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存失败。'
  } finally {
    saving.value = false
  }
}

async function deleteCurrentNote() {
  if (!activeNote.value?.basename) {
    createNote()
    return
  }

  try {
    const nextNotes = await getNotesApi().deleteNote(activeNote.value.basename)
    notes.value = nextNotes

    if (nextNotes.length > 0) {
      await openNote(nextNotes[0].basename)
    } else {
      createNote()
    }

    message.value = '笔记已删除。'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除失败。'
  }
}

function installShortcuts() {
  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      void saveNote()
    }
  })
}

onMounted(async () => {
  installShortcuts()
  await boot()
})
</script>

<template>
  <div class="surface-grid min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <div class="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 p-4 lg:flex-row lg:p-6">
      <aside
        class="app-card panel-shadow flex w-full shrink-0 flex-col gap-4 border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[color-mix(in_srgb,var(--sidebar)_92%,transparent)] p-4 lg:w-[360px]"
      >
        <div class="rounded-2xl border border-[var(--border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4">
          <div class="mb-4 flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]"
            >
              CN
            </div>
            <div>
              <p class="text-[11px] uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Local notes</p>
              <h1 class="text-lg font-semibold tracking-tight">Codex Note</h1>
            </div>
          </div>

          <div class="space-y-3">
            <button class="app-button-primary w-full" type="button" @click="chooseDirectory">
              {{ notesDir ? '切换保存目录' : '选择保存目录' }}
            </button>

            <div class="app-card rounded-xl border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_68%,transparent)] p-3">
              <p class="text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Storage</p>
              <p class="mt-2 break-all text-sm font-medium text-[var(--foreground)]">
                {{ notesDir || '尚未选择目录' }}
              </p>
              <p class="mt-2 text-xs text-[var(--muted-foreground)]">{{ noteCountLabel }}</p>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between px-1">
          <div>
            <p class="text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Notes</p>
            <h2 class="mt-1 text-sm font-medium">Markdown Files</h2>
          </div>
          <button class="app-button-secondary" type="button" @click="createNote" :disabled="!notesDir">新建</button>
        </div>

        <div v-if="notes.length === 0" class="app-card border-dashed p-4 text-sm text-[var(--muted-foreground)]">
          <p>这里还没有笔记。</p>
          <p class="mt-2 text-xs">新建后会直接保存为本地 `.md` 文件。</p>
        </div>

        <div v-else class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          <button
            v-for="item in notes"
            :key="item.basename"
            class="app-card panel-shadow w-full border p-3 text-left transition hover:border-[color-mix(in_srgb,var(--primary)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_70%,transparent)]"
            :class="
              selectedBasename === item.basename
                ? 'border-[color-mix(in_srgb,var(--primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                : 'border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_62%,transparent)]'
            "
            type="button"
            @click="openNote(item.basename)"
          >
            <div class="flex items-start justify-between gap-3">
              <strong class="line-clamp-1 text-sm font-medium">{{ item.title }}</strong>
              <span class="rounded-md bg-[var(--secondary)] px-2 py-1 text-[10px] text-[var(--muted-foreground)]">
                md
              </span>
            </div>
            <p class="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">
              {{ item.preview || '空白笔记' }}
            </p>
            <div class="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--muted-foreground)]">
              <span>{{ new Date(item.updatedAt).toLocaleDateString('zh-CN') }}</span>
              <span>{{ Math.max(1, Math.round(item.size / 1024)) }} KB</span>
            </div>
          </button>
        </div>
      </aside>

      <main class="app-card panel-shadow flex min-h-[calc(100vh-2rem)] flex-1 flex-col border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[color-mix(in_srgb,var(--editor)_92%,transparent)]">
        <header class="flex flex-col gap-4 border-b px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-[11px] uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Writing desk</p>
            <h2 class="mt-1 text-xl font-semibold tracking-tight">
              {{ activeNote?.title || '本地 Markdown 笔记' }}
            </h2>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button class="app-button-ghost" type="button" @click="deleteCurrentNote" :disabled="!activeNote">删除</button>
            <button class="app-button-primary min-w-24" type="button" @click="saveNote" :disabled="!notesDir || saving">
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </div>
        </header>

        <section v-if="!notesDir" class="flex flex-1 items-center justify-center p-5">
          <div class="app-card panel-shadow w-full max-w-2xl border p-8">
            <p class="text-[11px] uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Start here</p>
            <h3 class="mt-3 text-3xl font-semibold tracking-tight">先把笔记目录接进来</h3>
            <p class="mt-4 max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
              应用只负责写入和管理本地 `.md` 文件，不做私有格式封装，也不绑定固定目录。
            </p>
            <div class="mt-6 flex gap-3">
              <button class="app-button-primary" type="button" @click="chooseDirectory">选择目录</button>
            </div>
          </div>
        </section>

        <section v-else-if="activeNote" class="flex min-h-0 flex-1 flex-col gap-4 p-5">
          <div
            class="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_50%,transparent)] px-4 py-3 text-xs text-[var(--muted-foreground)] md:flex-row md:items-center md:justify-between"
          >
            <span>{{ activeMeta }}</span>
            <span class="truncate">{{ activeNote.basename || '未命名草稿' }}</span>
          </div>

          <div class="grid min-h-0 flex-1 gap-4">
            <label class="grid gap-2">
              <span class="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Title</span>
              <input v-model="activeNote.title" class="app-input" type="text" placeholder="输入标题，保存时会作为文件名基础" />
            </label>

            <label class="flex min-h-0 flex-1 flex-col gap-2">
              <span class="text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Markdown</span>
              <textarea v-model="activeNote.content" class="app-textarea scrollbar-thin" placeholder="# New note&#10;&#10;开始写内容…" />
            </label>
          </div>
        </section>

        <section v-else class="flex flex-1 items-center justify-center p-5">
          <div class="app-card panel-shadow w-full max-w-xl border p-8">
            <p class="text-[11px] uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Ready</p>
            <h3 class="mt-3 text-2xl font-semibold tracking-tight">选一篇笔记，或者新建一篇</h3>
            <p class="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
              左侧读取所选目录里的 `.md` 文件，右侧直接编辑原始 Markdown 文本。
            </p>
            <button class="app-button-primary mt-6" type="button" @click="createNote">新建笔记</button>
          </div>
        </section>

        <footer
          class="flex flex-col gap-2 border-t px-5 py-3 text-xs text-[var(--muted-foreground)] md:flex-row md:items-center md:justify-between"
        >
          <span>{{ loading ? '加载中…' : message }}</span>
          <span v-if="errorMessage" class="text-[var(--destructive)]">{{ errorMessage }}</span>
        </footer>
      </main>
    </div>
  </div>
</template>
