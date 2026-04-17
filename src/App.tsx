import { useEffect, useMemo, useState } from 'react'
import {
  Cog,
  FileText,
  FolderOpen,
  LayoutList,
  PencilLine,
  Plus,
  Save,
  Search,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { NoteListItem } from '@/lib/types'
import { cn } from '@/lib/utils'

type DraftNote = {
  basename: string | null
  title: string
  content: string
  updatedAt: string | null
}

function getNotesApi() {
  if (!window.notesApi) {
    throw new Error(
      '未检测到 Electron 预加载接口。请用 `pnpm dev` 或 `pnpm dev:electron` 启动 Electron 窗口，不要直接打开 Vite 地址或 `index.html`。'
    )
  }

  return window.notesApi
}

function emptyDraft(): DraftNote {
  return {
    basename: null,
    title: 'Untitled',
    content: '# Untitled\n\n',
    updatedAt: null
  }
}

function inferTitleFromContent(content: string): string {
  const lines = content
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const heading = lines.find((line) => /^#\s+/.test(line))
  if (heading) {
    return heading.replace(/^#\s+/, '').trim()
  }

  return lines[0] ?? 'Untitled'
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '尚未保存'
  }

  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN')
}

export default function App() {
  const [view, setView] = useState<'editor' | 'settings'>('editor')
  const [notesDir, setNotesDir] = useState<string | null>(null)
  const [notes, setNotes] = useState<NoteListItem[]>([])
  const [activeNote, setActiveNote] = useState<DraftNote | null>(null)
  const [selectedBasename, setSelectedBasename] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('正在初始化…')
  const [errorMessage, setErrorMessage] = useState('')
  const [query, setQuery] = useState('')

  const filteredNotes = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) {
      return notes
    }

    return notes.filter((item) => {
      return [item.title, item.preview, item.basename].some((field) => field.toLowerCase().includes(keyword))
    })
  }, [notes, query])

  async function openNote(basename: string) {
    try {
      const note = await getNotesApi().readNote(basename)
      setSelectedBasename(basename)
      setActiveNote({
        basename: note.basename,
        title: note.title,
        content: note.content,
        updatedAt: note.updatedAt
      })
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '打开笔记失败。')
    }
  }

  async function boot() {
    setLoading(true)
    setErrorMessage('')

    try {
      const settings = await getNotesApi().getSettings()
      setNotesDir(settings.notesDir)
      setNotes(settings.notes)

      if (settings.notes.length > 0) {
        await openNote(settings.notes[0].basename)
        setMessage('已载入最近更新的笔记。')
      } else if (settings.notesDir) {
        setActiveNote(emptyDraft())
        setSelectedBasename(null)
        setMessage('目录已连接，可以开始写第一篇笔记。')
      } else {
        setActiveNote(null)
        setSelectedBasename(null)
        setMessage('先选择一个本地目录，应用会在其中保存 `.md` 文件。')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '初始化失败。')
    } finally {
      setLoading(false)
    }
  }

  async function chooseDirectory() {
    try {
      const result = await getNotesApi().chooseDirectory()
      if (!result) {
        return
      }

      setNotesDir(result.notesDir)
      setNotes(result.notes)
      setQuery('')

      if (result.notes.length > 0) {
        await openNote(result.notes[0].basename)
        setMessage('已切换笔记目录。')
        setView('editor')
      } else {
        createNote()
        setMessage('目录已设置，开始写第一篇笔记。')
        setView('editor')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '选择目录失败。')
    }
  }

  function createNote() {
    setView('editor')
    setSelectedBasename(null)
    setActiveNote(emptyDraft())
    setMessage('新建草稿中。')
    setErrorMessage('')
  }

  async function saveNote() {
    if (!activeNote || !notesDir) {
      return
    }

    setSaving(true)
    setErrorMessage('')

    try {
      const title = inferTitleFromContent(activeNote.content)
      const result = await getNotesApi().saveNote({
        currentBasename: activeNote.basename,
        title,
        content: activeNote.content
      })

      setNotes(result.notes)
      setSelectedBasename(result.note.basename)
      setActiveNote({
        basename: result.note.basename,
        title: result.note.title,
        content: result.note.content,
        updatedAt: result.note.updatedAt
      })
      setMessage(`已保存为 ${result.note.basename}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCurrentNote() {
    if (!activeNote?.basename) {
      createNote()
      return
    }

    try {
      const nextNotes = await getNotesApi().deleteNote(activeNote.basename)
      setNotes(nextNotes)

      if (nextNotes.length > 0) {
        await openNote(nextNotes[0].basename)
      } else {
        createNote()
      }

      setMessage('笔记已删除。')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '删除失败。')
    }
  }

  useEffect(() => {
    void boot()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveNote()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeNote, notesDir])

  return (
    <div className="surface-grid app-shell flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex min-h-0 w-[312px] shrink-0 flex-col overflow-hidden border-r border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[color-mix(in_srgb,var(--sidebar)_96%,transparent)]">
          <div className="drag-region h-10 shrink-0 border-b border-[color-mix(in_srgb,var(--border)_85%,transparent)]" />

          <div className="panel-padding border-b border-[color-mix(in_srgb,var(--border)_85%,transparent)]">
            <div className="flex items-center gap-[var(--space-2)] rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--card)_55%,transparent)] px-[var(--space-3)] py-[var(--space-2)]">
              <div className="flex h-8 w-8 items-center justify-center rounded-[calc(var(--radius)-0.1rem)] bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]">
                CN
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Codex Note</p>
                <p className="truncate text-[11px] text-[var(--muted-foreground)]">{notesDir ? '已连接本地目录' : '请先连接目录'}</p>
              </div>
            </div>
          </div>

          <div className="panel-padding panel-stack flex flex-col border-b border-[color-mix(in_srgb,var(--border)_85%,transparent)]">
            <Button
              variant={view === 'editor' ? 'secondary' : 'ghost'}
              className="w-full justify-start gap-[var(--space-2)]"
              onClick={createNote}
              disabled={!notesDir}
            >
              <PencilLine className="h-4 w-4" />
              新建笔记
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-[var(--space-3)] top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="border-none bg-[color-mix(in_srgb,var(--card)_58%,transparent)] pl-9 shadow-none"
                placeholder="搜索笔记"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">项目</p>
              <p className="mt-1 text-sm font-medium">Markdown Files</p>
            </div>
            <div className="flex items-center gap-[var(--space-2)] text-[11px] text-[var(--muted-foreground)]">
              <LayoutList className="h-4 w-4" />
              <span>{filteredNotes.length}</span>
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="px-[var(--space-3)] pb-[var(--space-3)]">
              <div className="rounded-[var(--radius)] border border-dashed border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--card)_42%,transparent)] p-[var(--space-4)] text-sm text-[var(--muted-foreground)]">
                <p>{query ? '没有匹配的笔记。' : '这里还没有笔记。'}</p>
                <p className="mt-2 text-xs">{query ? '试试别的关键词。' : '新建后会直接保存为本地 `.md` 文件。'}</p>
              </div>
            </div>
          ) : (
            <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-[var(--space-2)] overflow-y-auto px-[var(--space-2)] pb-[var(--space-2)]">
              {filteredNotes.map((item) => (
                <Button
                  key={item.basename}
                  type="button"
                  onClick={() => void openNote(item.basename)}
                  variant="ghost"
                  className={cn(
                    'h-auto w-full items-start justify-start rounded-[var(--radius)] border px-[var(--space-3)] py-[var(--space-3)] text-left',
                    selectedBasename === item.basename
                      ? 'border-[color-mix(in_srgb,var(--primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--foreground)]'
                      : 'border-transparent bg-transparent text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_68%,transparent)]'
                  )}
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-[var(--space-3)]">
                    <strong className="line-clamp-1 text-sm font-medium">{item.title}</strong>
                    <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]">{formatDay(item.updatedAt)}</span>
                    </div>
                    <p className="mt-[var(--space-2)] line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">{item.preview || '空白笔记'}</p>
                    <div className="mt-[var(--space-2)] flex items-center justify-between gap-[var(--space-3)] text-[11px] text-[var(--muted-foreground)]">
                      <span className="truncate">{item.basename}</span>
                      <span>{Math.max(1, Math.round(item.size / 1024))} KB</span>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}

          <div className="px-[var(--space-2)] py-[var(--space-2)] border-t border-[color-mix(in_srgb,var(--border)_85%,transparent)]">
            <Button
              variant={view === 'settings' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 w-full justify-start gap-1.5 px-2 text-xs font-normal"
              onClick={() => setView('settings')}
            >
              <Cog className="h-3.5 w-3.5" />
              设置
            </Button>
          </div>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[color-mix(in_srgb,var(--editor)_98%,transparent)]">
          {view === 'settings' ? (
            <section className="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
              <div className="w-full max-w-3xl space-y-[var(--space-5)]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Settings</p>
                  <h2 className="mt-[var(--space-2)] text-3xl font-semibold tracking-tight">工作区设置</h2>
                  <p className="mt-[var(--space-3)] max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
                    笔记目录只在设置页管理。主编辑界面不再展示具体本地路径，避免信息噪音，也更像真正的编辑器。
                  </p>
                </div>

                <div className="grid gap-[var(--space-4)]">
                  <div className="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] p-[var(--space-5)]">
                    <div className="flex items-start justify-between gap-[var(--space-5)]">
                      <div>
                        <p className="text-sm font-medium">笔记目录</p>
                        <p className="mt-[var(--space-2)] text-sm text-[var(--muted-foreground)]">
                          {notesDir ? '当前已连接一个本地 Markdown 工作区。' : '当前还没有连接本地 Markdown 工作区。'}
                        </p>
                        <div className="mt-[var(--space-4)] flex items-center gap-[var(--space-5)] text-sm text-[var(--muted-foreground)]">
                          <span>{notes.length} 篇笔记</span>
                          <span>{selectedBasename ? '已打开文档' : '未打开文档'}</span>
                        </div>
                      </div>

                      <Button onClick={chooseDirectory} className="gap-[var(--space-2)]">
                        <FolderOpen className="h-4 w-4" />
                        {notesDir ? '更换目录' : '选择目录'}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_16%,transparent)] p-[var(--space-5)]">
                    <p className="text-sm font-medium">写作规则</p>
                    <div className="mt-[var(--space-4)] space-y-[var(--space-3)] text-sm leading-7 text-[var(--muted-foreground)]">
                      <p>文件名会从 Markdown 内容自动推导，优先使用一级标题，没有标题时回退到第一条非空文本。</p>
                      <p>主界面只展示文档名、列表和编辑器，不展示具体本地路径。</p>
                      <p>使用 <span className="rounded bg-[color-mix(in_srgb,var(--accent)_90%,transparent)] px-1.5 py-0.5 text-[var(--foreground)]">Cmd/Ctrl + S</span> 可以快速保存。</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : !notesDir ? (
            <section className="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
              <div className="w-full max-w-2xl rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] p-[var(--space-5)]">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Start here</p>
                <h3 className="mt-[var(--space-3)] text-3xl font-semibold tracking-tight">先把笔记目录接进来</h3>
                <p className="mt-[var(--space-4)] max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
                  应用只负责写入和管理本地 `.md` 文件，不做私有格式封装，也不绑定固定目录。
                </p>
                <div className="mt-[var(--space-5)]">
                  <Button onClick={chooseDirectory} className="gap-[var(--space-2)]">
                    <FolderOpen className="h-4 w-4" />
                    选择目录
                  </Button>
                </div>
              </div>
            </section>
          ) : activeNote ? (
            <>
              <div className="flex shrink-0 items-center justify-between border-b border-[color-mix(in_srgb,var(--border)_80%,transparent)] px-[var(--space-5)] py-[var(--space-3)] text-xs text-[var(--muted-foreground)]">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-[var(--space-2)]">
                    <FileText className="h-4 w-4" />
                    <span className="truncate">{activeNote.basename || 'draft.md'}</span>
                  </div>
                </div>

                <div className="no-drag flex items-center gap-[var(--space-2)]">
                  <span className="mr-[var(--space-3)] hidden text-[11px] text-[var(--muted-foreground)] md:inline">上次保存 {formatDateTime(activeNote.updatedAt)}</span>
                  <Button variant="ghost" size="icon" onClick={createNote} disabled={!notesDir} aria-label="新建笔记">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={chooseDirectory} aria-label="选择目录">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={deleteCurrentNote} disabled={!activeNote} aria-label="删除笔记">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button onClick={saveNote} disabled={!notesDir || saving} className="gap-[var(--space-2)] rounded-[calc(var(--radius)+0.15rem)] px-3.5">
                    <Save className="h-4 w-4" />
                    {saving ? '保存中' : '保存'}
                  </Button>
                </div>
              </div>

              <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Textarea
                  value={activeNote.content}
                  onChange={(event) =>
                    setActiveNote((current) => (current ? { ...current, content: event.target.value, title: inferTitleFromContent(event.target.value) } : current))
                  }
                  className="scrollbar-thin h-full min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-[var(--space-5)] py-[var(--space-5)] text-[15px] leading-7 shadow-none focus-visible:ring-0"
                  placeholder="# New note&#10;&#10;开始写内容…"
                />
              </section>
            </>
          ) : (
            <section className="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
              <div className="w-full max-w-xl rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_16%,transparent)] p-[var(--space-5)]">
                <p className="text-[11px] uppercase tracking-[0.26em] text-[var(--muted-foreground)]">Ready</p>
                <h3 className="mt-[var(--space-3)] text-2xl font-semibold tracking-tight">选一篇笔记，或者新建一篇</h3>
                <p className="mt-[var(--space-4)] text-sm leading-7 text-[var(--muted-foreground)]">
                  左侧读取所选目录里的 `.md` 文件，右侧直接编辑原始 Markdown 文本。
                </p>
                <Button className="mt-[var(--space-5)] gap-[var(--space-2)]" onClick={createNote}>
                  <Plus className="h-4 w-4" />
                  新建笔记
                </Button>
              </div>
            </section>
          )}

          <footer className="flex shrink-0 items-center justify-between border-t border-[color-mix(in_srgb,var(--border)_80%,transparent)] px-[var(--space-4)] py-[var(--space-2)] text-[11px] text-[var(--muted-foreground)]">
            <span>{loading ? '加载中…' : message}</span>
            <span className="truncate pl-[var(--space-4)] text-right text-[var(--destructive)]">{errorMessage}</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
