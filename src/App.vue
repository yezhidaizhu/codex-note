<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import {
  Cog,
  FolderOpen,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Search,
  Trash2,
} from 'lucide-vue-next'
import DeleteNoteDialog from '@/components/delete-note-dialog.vue'
import NoteContextMenu from '@/components/note-context-menu.vue'
import NoteListItem from '@/components/note-list-item.vue'
import SettingsPanel from '@/components/settings-panel.vue'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
import Textarea from '@/components/ui/textarea.vue'
import type { NoteListItem as NoteListItemData } from '@/lib/types'

type DraftNote = {
  basename: string | null
  content: string
  updatedAt: string | null
}

type PendingDeleteState = {
  basenames: string[]
  title: string
  message: string
  confirmLabel?: string
} | null

type NoteContextMenuState = {
  basename: string
  x: number
  y: number
} | null

const NOTE_LABEL_MAX_LENGTH = 36
const MAC_WINDOW_CONTROLS_GAP = 'pl-[78px]'
const SIDEBAR_DEFAULT_WIDTH = 312
const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 520

function getNotesApi() {
  if (!window.notesApi) {
    throw new Error(
      '未检测到 Electron 预加载接口。请用 `pnpm dev` 或 `pnpm dev:electron` 启动 Electron 窗口，不要直接打开 Vite 地址或 `index.html`。',
    )
  }

  return window.notesApi
}

function emptyDraft(): DraftNote {
  return {
    basename: null,
    content: '',
    updatedAt: null,
  }
}

function getMeaningfulLines(content: string): string[] {
  return content
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function stripMarkdownLabel(value: string): string {
  return value
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[`*_~>[\\\]|]/g, '')
    .trim()
}

function normalizeNoteLabel(value: string, fallback: string): string {
  const cleaned = stripMarkdownLabel(value)
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return (cleaned || fallback).slice(0, NOTE_LABEL_MAX_LENGTH).trim()
}

function inferTitleFromContent(content: string): string {
  const firstLine = getMeaningfulLines(content)[0] ?? ''
  return normalizeNoteLabel(firstLine, 'Untitled')
}

function formatCompactDate(value: string | null): string {
  if (!value) {
    return '今天'
  }

  const target = dayjs(value)
  const now = dayjs()
  const diffDays = now.startOf('day').diff(target.startOf('day'), 'day')

  if (diffDays === 0) {
    return '今天'
  }

  if (diffDays === 1) {
    return '昨天'
  }

  if (diffDays === 2) {
    return '前天'
  }

  if (target.year() === now.year()) {
    return target.format('M月D日')
  }

  return target.format('YYYY年M月D日')
}

function getListLabel(item: NoteListItemData): string {
  const normalizedTitle = normalizeNoteLabel(item.title, '')
  return normalizedTitle || formatCompactDate(item.updatedAt)
}

function buildDeleteMessage(count: number, label?: string): string {
  if (count <= 1 && label) {
    return `将删除「${label}」，这个操作不可撤销。`
  }

  return `将删除 ${count} 篇笔记，这个操作不可撤销。`
}

const view = ref<'editor' | 'settings'>('editor')
const notesDir = ref<string | null>(null)
const notes = ref<NoteListItemData[]>([])
const activeNote = ref<DraftNote | null>(null)
const selectedBasename = ref<string | null>(null)
const errorMessage = ref('')
const query = ref('')
const contextMenu = ref<NoteContextMenuState>(null)
const listActionsMenuOpen = ref(false)
const pendingDelete = ref<PendingDeleteState>(null)
const sidebarCollapsed = ref(false)
const sidebarWidth = ref(SIDEBAR_DEFAULT_WIDTH)
const isSidebarResizing = ref(false)
const isPinned = ref(false)
const isBatchSelecting = ref(false)
const selectedBasenames = ref<string[]>([])

const lastSavedSnapshot = ref<{ basename: string | null; content: string } | null>(null)
let saveInFlight = false
let queuedSave: DraftNote | null = null
const sidebarResizeStart = ref<{ pointerX: number; width: number } | null>(null)

const filteredNotes = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) {
    return notes.value
  }

  return notes.value.filter((item) => {
    return [item.title, item.preview, item.basename].some((field) =>
      field.toLowerCase().includes(keyword),
    )
  })
})

async function openNote(basename: string) {
  try {
    const note = await getNotesApi().readNote(basename)
    selectedBasename.value = basename
    lastSavedSnapshot.value = { basename: note.basename, content: note.content }
    activeNote.value = { basename: note.basename, content: note.content, updatedAt: note.updatedAt }
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '打开笔记失败。'
  }
}

async function boot() {
  errorMessage.value = ''

  try {
    const settings = await getNotesApi().getSettings()
    notesDir.value = settings.notesDir
    notes.value = settings.notes

    if (settings.notes.length > 0) {
      await openNote(settings.notes[0].basename)
    } else if (settings.notesDir) {
      activeNote.value = emptyDraft()
      selectedBasename.value = null
    } else {
      activeNote.value = null
      selectedBasename.value = null
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '初始化失败。'
  }
}

async function chooseDirectory() {
  try {
    const result = await getNotesApi().chooseDirectory()
    if (!result) return

    notesDir.value = result.notesDir
    notes.value = result.notes
    query.value = ''

    if (result.notes.length > 0) {
      await openNote(result.notes[0].basename)
      view.value = 'editor'
    } else {
      createNote()
      view.value = 'editor'
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '选择目录失败。'
  }
}

function createNote() {
  view.value = 'editor'
  selectedBasename.value = null
  lastSavedSnapshot.value = { basename: null, content: '' }
  activeNote.value = emptyDraft()
  errorMessage.value = ''
}

async function saveNote(noteToSave = activeNote.value) {
  if (!noteToSave || !notesDir.value) return
  if (!noteToSave.basename && !noteToSave.content.trim()) return

  if (saveInFlight) {
    queuedSave = noteToSave
    return
  }

  saveInFlight = true
  errorMessage.value = ''

  try {
    const title = inferTitleFromContent(noteToSave.content)
    const result = await getNotesApi().saveNote({
      currentBasename: noteToSave.basename,
      title,
      content: noteToSave.content,
    })

    notes.value = result.notes
    selectedBasename.value = result.note.basename
    lastSavedSnapshot.value = { basename: result.note.basename, content: noteToSave.content }

    if (activeNote.value && activeNote.value.basename === noteToSave.basename && activeNote.value.content === noteToSave.content) {
      activeNote.value = { basename: result.note.basename, content: result.note.content, updatedAt: result.note.updatedAt }
    } else if (activeNote.value) {
      activeNote.value = { ...activeNote.value, basename: result.note.basename }
    }

    if (queuedSave) {
      queuedSave = { ...queuedSave, basename: result.note.basename }
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '保存失败。'
  } finally {
    saveInFlight = false

    const nextQueued = queuedSave
    queuedSave = null

    if (nextQueued) {
      const snapshot = lastSavedSnapshot.value
      const alreadySaved = snapshot?.basename === nextQueued.basename && snapshot?.content === nextQueued.content
      if (!alreadySaved) {
        void saveNote(nextQueued)
      }
    }
  }
}

async function deleteNotesByBasenames(basenames: string[]) {
  const targets = Array.from(new Set(basenames))
  if (targets.length === 0) return

  try {
    let nextNotes = notes.value
    for (const basename of targets) {
      nextNotes = await getNotesApi().deleteNote(basename)
    }

    notes.value = nextNotes
    selectedBasenames.value = selectedBasenames.value.filter((basename) => !targets.includes(basename))

    if (selectedBasename.value && targets.includes(selectedBasename.value)) {
      if (nextNotes.length > 0) {
        await openNote(nextNotes[0].basename)
      } else {
        selectedBasename.value = null
        activeNote.value = emptyDraft()
      }
    }

    if (targets.length > 1) {
      isBatchSelecting.value = false
    }

    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '删除失败。'
  }
}

async function togglePinned() {
  try {
    const state = await getNotesApi().setAlwaysOnTop(!isPinned.value)
    isPinned.value = state.isAlwaysOnTop
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '设置置顶失败。'
  }
}

function toggleBatchSelect() {
  isBatchSelecting.value = !isBatchSelecting.value
  listActionsMenuOpen.value = false
}

function toggleNoteSelection(basename: string) {
  selectedBasenames.value = selectedBasenames.value.includes(basename)
    ? selectedBasenames.value.filter((item) => item !== basename)
    : [...selectedBasenames.value, basename]
}

function confirmDeleteNotes(basenames: string[]) {
  if (basenames.length === 0) return

  const targetNote = basenames.length === 1 ? notes.value.find((note) => note.basename === basenames[0]) : null
  pendingDelete.value = {
    basenames,
    title: basenames.length > 1 ? '批量删除笔记？' : '删除笔记？',
    message: buildDeleteMessage(basenames.length, targetNote ? getListLabel(targetNote) : undefined),
    confirmLabel: '删除',
  }
}

function handleShellContextMenu(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.closest('[data-note-item="true"]')) {
    contextMenu.value = null
  }
}

function handleShellClick() {
  contextMenu.value = null
}

function beginSidebarResize(event: MouseEvent) {
  if (sidebarCollapsed.value) return
  event.preventDefault()
  sidebarResizeStart.value = { pointerX: event.clientX, width: sidebarWidth.value }
  isSidebarResizing.value = true
}

function onEditorInput(event: Event) {
  if (!activeNote.value) return
  const target = event.target as HTMLTextAreaElement | null
  activeNote.value = { ...activeNote.value, content: target?.value ?? '' }
}

onMounted(() => {
  void boot()

  void getNotesApi()
    .getWindowState()
    .then((state) => (isPinned.value = state.isAlwaysOnTop))
    .catch(() => (isPinned.value = false))
})

watch(sidebarCollapsed, (collapsed) => {
  void getNotesApi().setSidebarCollapsed(collapsed)
})

watch(isBatchSelecting, (enabled) => {
  if (!enabled && selectedBasenames.value.length > 0) {
    selectedBasenames.value = []
  }
})

watch(contextMenu, (menu, _prev, onCleanup) => {
  if (!menu) return
  const closeMenu = () => (contextMenu.value = null)
  window.addEventListener('click', closeMenu)
  window.addEventListener('blur', closeMenu)
  window.addEventListener('resize', closeMenu)
  window.addEventListener('keydown', closeMenu)
  onCleanup(() => {
    window.removeEventListener('click', closeMenu)
    window.removeEventListener('blur', closeMenu)
    window.removeEventListener('resize', closeMenu)
    window.removeEventListener('keydown', closeMenu)
  })
})

watch(listActionsMenuOpen, (open, _prev, onCleanup) => {
  if (!open) return
  const closeMenu = () => (listActionsMenuOpen.value = false)
  window.addEventListener('click', closeMenu)
  window.addEventListener('blur', closeMenu)
  window.addEventListener('resize', closeMenu)
  window.addEventListener('keydown', closeMenu)
  onCleanup(() => {
    window.removeEventListener('click', closeMenu)
    window.removeEventListener('blur', closeMenu)
    window.removeEventListener('resize', closeMenu)
    window.removeEventListener('keydown', closeMenu)
  })
})

watch(
  () => ({ note: activeNote.value, dir: notesDir.value }),
  ({ note, dir }, _prev, onCleanup) => {
    if (!note || !dir) return

    const currentSnapshot: DraftNote = { basename: note.basename, content: note.content, updatedAt: note.updatedAt }
    const snapshot = lastSavedSnapshot.value
    const unchanged = snapshot?.basename === currentSnapshot.basename && snapshot?.content === currentSnapshot.content
    if (unchanged) return

    const timer = window.setTimeout(() => void saveNote(currentSnapshot), 700)
    onCleanup(() => window.clearTimeout(timer))
  },
  { deep: true },
)

watch(isSidebarResizing, (resizing, _prev, onCleanup) => {
  if (!resizing) return

  const previousCursor = document.body.style.cursor
  const previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const stopResize = () => {
    sidebarResizeStart.value = null
    isSidebarResizing.value = false
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', stopResize)
    window.removeEventListener('blur', stopResize)
  }

  const onMouseMove = (event: MouseEvent) => {
    const state = sidebarResizeStart.value
    if (!state) return
    const nextWidth = state.width + event.clientX - state.pointerX
    sidebarWidth.value = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, nextWidth))
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', stopResize)
  window.addEventListener('blur', stopResize)

  onCleanup(stopResize)
})

const onSaveHotkey = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void saveNote()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onSaveHotkey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onSaveHotkey)
})
</script>

<template>
  <div
    class="app-shell-glass app-shell-surface flex h-full flex-col overflow-hidden bg-transparent text-[var(--foreground)] border !border-gray-600 rounded-xl"
    @contextmenu="handleShellContextMenu"
    @click="handleShellClick"
  >
    <div
      class="drag-region flex h-9 shrink-0 items-center justify-between border-b border-[color-mix(in_srgb,white_10%,transparent)] px-[var(--space-3)] text-[var(--muted-foreground)]"
    >
      <div :class="`no-drag flex min-w-0 items-center gap-[var(--space-2)] ${MAC_WINDOW_CONTROLS_GAP}`">
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6"
          :aria-label="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <PanelLeftOpen v-if="sidebarCollapsed" class="h-3.5 w-3.5" />
          <PanelLeftClose v-else class="h-3.5 w-3.5" />
        </Button>
      </div>

      <div class="no-drag flex items-center gap-[var(--space-2)]">
        <Button
          variant="ghost"
          size="icon"
          class="h-6 w-6 transition-all duration-200"
          :disabled="!notesDir || !sidebarCollapsed"
          aria-label="新建笔记"
          title="新建笔记"
          :tabindex="sidebarCollapsed ? 0 : -1"
          @click="createNote"
        >
          <Plus :class="['size-3.5', sidebarCollapsed ? 'opacity-100' : 'opacity-0'].join(' ')" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          :class="
            [
              'h-6 w-6 transition-all duration-200',
              isPinned
                ? 'bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_24%,transparent)] hover:text-[var(--primary)]'
                : 'text-[var(--muted-foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_72%,transparent)] hover:text-[var(--foreground)]',
            ].join(' ')
          "
          :aria-label="isPinned ? '取消置顶' : '置顶窗口'"
          :title="isPinned ? '取消置顶' : '置顶窗口'"
          @click="togglePinned"
        >
          <Pin :class="['size-3.5', isPinned ? 'rotate-0' : 'rotate-45'].join(' ')" />
        </Button>
      </div>
    </div>

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <aside
        :class="
          [
            'relative flex min-h-0 shrink-0 flex-col overflow-hidden bg-transparent',
            isSidebarResizing ? 'transition-none' : 'transition-[width,border-color,opacity] duration-300 ease-out',
            sidebarCollapsed ? 'border-r border-transparent opacity-0' : 'border-r border-[color-mix(in_srgb,white_8%,transparent)] opacity-100',
          ].join(' ')
        "
        :style="{ width: sidebarCollapsed ? '0px' : `${sidebarWidth}px` }"
        :aria-hidden="sidebarCollapsed"
      >
        <div
          :class="
            [
              'flex h-full min-h-0 flex-col',
              isSidebarResizing ? 'transition-none' : 'transition-[transform,opacity] duration-300 ease-out',
              sidebarCollapsed ? 'pointer-events-none -translate-x-6 opacity-0' : 'translate-x-0 opacity-100',
            ].join(' ')
          "
          :style="{ width: `${sidebarWidth}px` }"
        >
          <div class="panel-padding panel-stack flex flex-col border-b border-[color-mix(in_srgb,var(--border)_85%,transparent)]">
            <div class="relative">
              <Search
                class="pointer-events-none absolute left-[var(--space-3)] top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
              <Input
                :value="query"
                class="text-ui-sm h-7 border-none bg-[color-mix(in_srgb,var(--card)_58%,transparent)] pl-9 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0"
                placeholder="搜索笔记"
                @input="query = ($event.target as HTMLInputElement).value"
              />
            </div>
          </div>

          <div class="flex items-center justify-between px-[var(--space-3)] py-[var(--space-2)]">
            <p class="text-ui-xs text-[var(--muted-foreground)]">笔记 {{ filteredNotes.length }}</p>
            <div class="relative flex items-center gap-[var(--space-1)]">
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :disabled="!notesDir || isBatchSelecting"
                aria-label="新建笔记"
                @click="createNote"
              >
                <Plus class="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :disabled="filteredNotes.length === 0"
                aria-label="更多操作"
                @click.stop="listActionsMenuOpen = !listActionsMenuOpen"
              >
                <MoreHorizontal class="h-3.5 w-3.5" />
              </Button>

              <div
                v-if="listActionsMenuOpen"
                class="absolute right-0 top-[calc(100%+0.35rem)] z-30 min-w-[132px] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_92%,transparent)] bg-[color-mix(in_srgb,var(--card)_96%,transparent)] p-1 shadow-[0_12px_28px_rgba(0,0,0,0.45)] backdrop-blur"
                @click.stop
              >
                <button
                  type="button"
                  class="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_80%,transparent)]"
                  @click="toggleBatchSelect"
                >
                  {{ isBatchSelecting ? '退出批量操作' : '批量操作' }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="filteredNotes.length === 0" class="px-[var(--space-3)] pb-[var(--space-3)]">
            <div
              class="rounded-[var(--radius)] border border-dashed border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--card)_42%,transparent)] p-[var(--space-4)] text-sm text-[var(--muted-foreground)]"
            >
              <p>{{ query ? '没有匹配的笔记。' : '这里还没有笔记。' }}</p>
              <p class="mt-2 text-xs">
                {{ query ? '试试别的关键词。' : '新建后会直接保存为本地 `.md` 文件。' }}
              </p>
            </div>
          </div>
          <div v-else class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-[var(--space-2)] pb-[var(--space-2)]">
            <NoteListItem
              v-for="item in filteredNotes"
              :key="item.basename"
              :label="getListLabel(item)"
              :date-label="formatCompactDate(item.updatedAt)"
              :selected="selectedBasename === item.basename"
              :selection-mode="isBatchSelecting"
              :checked="selectedBasenames.includes(item.basename)"
              @toggleChecked="toggleNoteSelection(item.basename)"
              @open="openNote(item.basename)"
              @context-menu="
                (event) => {
                  if (isBatchSelecting) return
                  contextMenu = { basename: item.basename, x: event.clientX, y: event.clientY }
                }
              "
            />
          </div>

          <div class="mt-auto border-t border-[color-mix(in_srgb,var(--border)_85%,transparent)] px-[var(--space-2)] py-[var(--space-2)]">
            <div
              v-if="isBatchSelecting"
              class="mb-[var(--space-2)] flex items-center justify-between gap-[var(--space-2)] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_42%,transparent)] px-[var(--space-2)] py-[var(--space-2)]"
            >
              <p class="text-ui-xs text-[var(--muted-foreground)]">已选 {{ selectedBasenames.length }}</p>
              <div class="flex items-center gap-[var(--space-1)]">
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-ui-xs h-7 px-2 font-normal text-[var(--destructive)]"
                  :disabled="selectedBasenames.length === 0"
                  @click="confirmDeleteNotes(selectedBasenames)"
                >
                  <Trash2 class="mr-1 h-3.5 w-3.5" />
                  删除
                </Button>
                <Button variant="secondary" size="sm" class="text-ui-xs h-7 px-2 font-normal" @click="toggleBatchSelect">
                  完成
                </Button>
              </div>
            </div>

            <Button
              :variant="view === 'settings' ? 'secondary' : 'ghost'"
              size="sm"
              class="text-ui-sm h-7 w-full justify-start gap-1.5 px-2 font-normal"
              @click="view = 'settings'"
            >
              <Cog class="h-3.5 w-3.5" />
              设置
            </Button>
          </div>
        </div>

        <div
          :class="
            [
              'absolute inset-y-0 right-[-4px] z-20 w-2 cursor-col-resize transition-opacity duration-200',
              sidebarCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100',
            ].join(' ')
          "
          aria-hidden="true"
          @mousedown="beginSidebarResize"
        />
      </aside>

      <main class="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        <SettingsPanel
          v-if="view === 'settings'"
          :notes-dir="notesDir"
          :notes-count="notes.length"
          :has-selected-note="Boolean(selectedBasename)"
          @chooseDirectory="chooseDirectory"
          @close="view = 'editor'"
        />

        <section v-else-if="!notesDir" class="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
          <div
            class="w-full max-w-2xl rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] p-[var(--space-5)]"
          >
            <p class="text-ui-xs uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Start here</p>
            <h3 class="mt-[var(--space-3)] text-3xl font-semibold tracking-tight">先把笔记目录接进来</h3>
            <p class="text-ui-md mt-[var(--space-4)] max-w-xl leading-7 text-[var(--muted-foreground)]">
              应用只负责写入和管理本地 `.md` 文件，不做私有格式封装，也不绑定固定目录。
            </p>
            <div class="mt-[var(--space-5)]">
              <Button class="gap-[var(--space-2)]" @click="chooseDirectory">
                <FolderOpen class="h-4 w-4" />
                选择目录
              </Button>
            </div>
          </div>
        </section>

        <section v-else-if="activeNote" class="editor-surface flex min-h-0 flex-1 flex-col overflow-hidden">
          <Textarea
            :value="activeNote.content"
            class="scrollbar-thin h-full min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-[var(--space-5)] py-[var(--space-5)] text-[15px] leading-8 shadow-none focus-visible:ring-0 placeholder:text-[color-mix(in_srgb,var(--muted-foreground)_52%,transparent)]"
            placeholder="写点什么"
            @input="onEditorInput"
          />
        </section>

        <section v-else class="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
          <div
            class="w-full max-w-xl rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_16%,transparent)] p-[var(--space-5)]"
          >
            <p class="text-ui-xs uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Ready</p>
            <h3 class="mt-[var(--space-3)] text-2xl font-semibold tracking-tight">选一篇笔记，或者新建一篇</h3>
            <p class="text-ui-md mt-[var(--space-4)] leading-7 text-[var(--muted-foreground)]">
              左侧读取所选目录里的 `.md` 文件，右侧直接编辑原始 Markdown 文本。
            </p>
            <Button class="mt-[var(--space-5)] gap-[var(--space-2)]" @click="createNote">
              <Plus class="h-4 w-4" />
              新建笔记
            </Button>
          </div>
        </section>

        <div
          v-if="errorMessage"
          class="text-ui-xs border-t border-[color-mix(in_srgb,var(--border)_80%,transparent)] px-[var(--space-4)] py-[var(--space-2)] text-right text-[var(--destructive)]"
        >
          {{ errorMessage }}
        </div>
      </main>
    </div>

    <NoteContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @delete="
        () => {
          const target = notes.find((note) => note.basename === contextMenu?.basename)
          contextMenu = null
          if (target) confirmDeleteNotes([target.basename])
        }
      "
    />

    <DeleteNoteDialog
      v-if="pendingDelete"
      :title="pendingDelete.title"
      :message="pendingDelete.message"
      :confirm-label="pendingDelete.confirmLabel"
      @cancel="pendingDelete = null"
      @confirm="
        () => {
          const targets = pendingDelete?.basenames ?? []
          pendingDelete = null
          void deleteNotesByBasenames(targets)
        }
      "
    />
  </div>
</template>
