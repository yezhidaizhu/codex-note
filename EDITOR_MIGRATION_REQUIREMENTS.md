# Editor Migration Requirements

## Purpose

这份文档用于约束当前和未来任何编辑器实现，不绑定具体库。

适用范围包括但不限于：

- Milkdown
- ProseMirror 自定义实现
- CodeMirror
- Monaco
- 其他 Markdown 编辑器方案

目标是保证：即使以后继续迁移编辑器，产品体验和数据行为也不会偏离。

## Product Goal

这个项目的编辑器定位是：

- 一个简单、稳定、Markdown-first 的备忘录编辑器

不是：

- 一个功能复杂的富文本系统
- 一个重交互块编辑器
- 一个依赖工具栏完成输入的写作器

## Core Principles

### 1. Markdown First

- 用户应能按 Markdown 习惯自然输入内容。
- 编辑器不能强迫用户依赖富文本按钮完成常见格式。
- 如果某个交互和 Markdown 直觉冲突，应优先保留 Markdown 直觉。

### 2. Stable Notes Experience

- 目标是快速记录，不是复杂排版。
- 输入、粘贴、选择、复制必须稳定。
- 样式不能随意漂移或自动乱改。

### 3. Local Markdown Files

- 最终保存结果必须是原始 `.md` 文件。
- 不允许引入私有笔记格式。
- 迁移编辑器时，不能破坏现有 Markdown 文件兼容性。

## Required UX Behavior

### 1. Focus Appearance

- 禁止出现浏览器原生或编辑器默认的刺眼 outline。
- 如果需要聚焦反馈，必须使用产品统一、轻量的视觉风格。
- 不允许出现明显的亮蓝色输入框边框。

### 2. Placeholder

- 空文档时必须显示 placeholder。
- placeholder 文案：

`开始写点什么，或粘贴一段 Markdown…`

- 输入开始后 placeholder 立即消失。
- placeholder 不能阻挡点击、选择、拖拽、输入。

### 3. Click To Focus

- 点击编辑区空白处，应直接进入可输入状态。
- 点击文档下方空白区域，也应能自然聚焦编辑器。
- 不要求必须精确落点，但不能出现“点空白没法开始输入”的情况。

### 4. Text Selection

- 用户必须能从文字下方空白区域向上拖拽选中文字。
- 不允许只能从字符本身开始拖才能选中。
- 编辑器实现不能破坏浏览器/系统默认的拖选直觉。

### 5. Input Method Compatibility

- 中文拼音输入法必须稳定。
- 新建空白笔记首次输入时，不能打断 IME composition。
- 不允许出现类似：
  - 首字母被单独落下
  - 拼音中途被打断
  - 输入 `测试` 结果变成 `c而是`

### 6. Copy / Paste Behavior

- 从外部粘贴 Markdown 内容时，应尽量保留 Markdown 结构。
- 不应明显吞掉或改坏这些结构：
  - 标题
  - 引用
  - 无序列表
  - 有序列表
  - 任务列表
  - 代码块
  - 链接
- 从编辑器复制内容时，应该尽量保留 Markdown 语义，而不是只复制一份丢结构的视觉结果。

### 7. Markdown Editing Experience

常见 Markdown 输入必须尽量自然：

- `#` 标题
- `>` 引用
- `-` 无序列表
- `1.` 有序列表
- `- [ ]` 任务列表
- fenced code block

### 8. Fenced Code Block Support

以下写法应尽量自然工作：

```md
```
ceshi
```
```

要求：

- 输入开始 fence 后，能进入代码块。
- 输入结束 fence 后，能退出代码块。
- 不要求必须 100% 等同源码编辑器，但不能明显违背 Markdown 直觉。

### 9. Immediate Rendering

- 用户输入 Markdown 后，应能“马上看到效果”。
- 这里的“马上看到效果”可以通过以下任一方式实现：
  - 所见即所得编辑
  - 实时预览
  - 半结构化实时渲染
- 但不能以牺牲 Markdown 输入自然度为代价。

## Image Requirements

- 保留当前本地图片落盘逻辑。
- 粘贴图片或上传图片时，仍然写入笔记附件目录。
- 编辑器显示图片时，不能破坏 Markdown 文件保存结果。
- 图片功能属于支持项，但优先级低于：
  - 输入稳定
  - 粘贴稳定
  - 选择稳定

## Save Model Requirements

- 继续保存为原始 `.md` 文件。
- 保留现有自动保存机制。
- 不引入私有数据层。
- 编辑器切换或迁移后，旧笔记仍应可直接打开和保存。

## Non-Goals

当前阶段不追求：

- 复杂富文本工具栏
- 重型块编辑菜单
- 高复杂度排版能力
- 高级表格体验
- 数学公式
- 花哨特效或“编辑器感”

## Migration Decision Standard

任何候选编辑器方案都必须先看这些点，而不是只看 demo：

1. Markdown 输入是否自然
2. 输入法是否稳定
3. 粘贴 Markdown 是否容易丢结构
4. 选择和拖拽是否自然
5. 是否容易写回原始 `.md`
6. 是否容易接现有图片落盘逻辑
7. 是否会引入明显 UI 噪音
8. 是否符合“备忘录”而不是“富文本系统”的目标

## Acceptance Checklist

未来无论换成什么编辑器，至少要满足：

- 没有刺眼默认 outline
- 空文档有 placeholder
- 点击空白能聚焦
- 从空白往上拖能选中文字
- 中文拼音输入稳定
- fenced code block 基本可用
- 粘贴 Markdown 不明显丢结构
- 复制时尽量保留 Markdown 语义
- 自动保存正常
- 图片落盘正常
- 最终保存仍是 `.md`
