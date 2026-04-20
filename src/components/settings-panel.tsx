import { FolderOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SettingsPanelProps = {
  notesDir: string | null
  notesCount: number
  hasSelectedNote: boolean
  onChooseDirectory: () => void
  onClose: () => void
}

export function SettingsPanel({
  notesDir,
  notesCount,
  hasSelectedNote,
  onChooseDirectory,
  onClose
}: SettingsPanelProps) {
  return (
    <section className="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
      <div className="w-full max-w-3xl space-y-[var(--space-5)]">
        <div className="flex items-start justify-between gap-[var(--space-5)]">
          <div>
            <p className="text-ui-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Settings</p>
            <h2 className="mt-[var(--space-2)] text-3xl font-semibold tracking-tight">工作区设置</h2>
            <p className="text-ui-md mt-[var(--space-3)] max-w-2xl leading-7 text-[var(--muted-foreground)]">
              笔记目录只在设置页管理。主编辑界面不再展示具体本地路径，避免信息噪音，也更像真正的编辑器。
            </p>
          </div>

          <Button variant="ghost" size="sm" className="text-ui-sm h-8 gap-[var(--space-2)] px-3" onClick={onClose}>
            <X className="h-4 w-4" />
            关闭设置
          </Button>
        </div>

        <div className="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] p-[var(--space-5)]">
          <div className="flex items-start justify-between gap-[var(--space-5)]">
            <div>
              <p className="text-ui-md font-medium">笔记目录</p>
              <p className="text-ui-md mt-[var(--space-2)] text-[var(--muted-foreground)]">
                {notesDir ? '当前已连接一个本地 Markdown 工作区。' : '当前还没有连接本地 Markdown 工作区。'}
              </p>
              <div className="text-ui-sm mt-[var(--space-4)] flex items-center gap-[var(--space-5)] text-[var(--muted-foreground)]">
                <span>{notesCount} 篇笔记</span>
                <span>{hasSelectedNote ? '已打开文档' : '未打开文档'}</span>
              </div>
            </div>

            <Button onClick={onChooseDirectory} className="gap-[var(--space-2)]">
              <FolderOpen className="h-4 w-4" />
              {notesDir ? '更换目录' : '选择目录'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
