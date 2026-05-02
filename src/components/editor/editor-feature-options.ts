import type { EditorFeatureKey } from '@/lib/types'

export const editorFeatureOptions: Array<{ key: EditorFeatureKey; label: string; description: string }> = [
  { key: 'heading', label: '标题', description: '支持 H1-H3 标题和层级结构。' },
  { key: 'bold', label: '粗体', description: '强调重要文本。' },
  { key: 'italic', label: '斜体', description: '保留轻量语气强调。' },
  { key: 'blockquote', label: '引用', description: '支持引用段落。' },
  { key: 'bulletList', label: '无序列表', description: '支持项目符号列表。' },
  { key: 'orderedList', label: '有序列表', description: '支持数字列表。' },
  { key: 'taskList', label: '任务列表', description: '支持可勾选的任务项。' },
  { key: 'codeBlock', label: '代码块', description: '支持多行代码块。' },
  { key: 'link', label: '链接', description: '支持插入和编辑链接。' },
  { key: 'image', label: '图片', description: '支持粘贴图片并自动保存到附件目录。' },
]
