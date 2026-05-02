import { wrapIn, lift, setBlockType, toggleMark, baseKeymap, chainCommands, exitCode, createParagraphNear, liftEmptyBlock, splitBlock } from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { inputRules, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules'
import { Schema, Slice } from 'prosemirror-model'
import { keymap } from 'prosemirror-keymap'
import { Plugin } from 'prosemirror-state'
import { EditorState, TextSelection } from 'prosemirror-state'
import type { Command, Transaction } from 'prosemirror-state'
import { MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer, schema as markdownBaseSchema } from 'prosemirror-markdown'
import { EditorView } from 'prosemirror-view'
import MarkdownIt from 'markdown-it'
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import type { MarkType, Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorFeatureKey } from '@/lib/types'

export type ProseMirrorEditorContext = {
  enabledFeatures: Set<EditorFeatureKey>
}

export function downgradeMarkdownForDisabledFeatures(markdown: string, enabledFeatures: Set<EditorFeatureKey>) {
  let next = markdown.replace(/\r/g, '')

  if (!enabledFeatures.has('codeBlock')) {
    next = next.replace(/^```([^\n]*)$/gm, '\\`\\`\\`$1')
  }

  if (!enabledFeatures.has('heading')) {
    next = next.replace(/^(#{1,6})\s+/gm, '')
  }

  if (!enabledFeatures.has('blockquote')) {
    next = next.replace(/^>\s?/gm, '')
  }

  if (!enabledFeatures.has('taskList')) {
    next = next.replace(/^(\s*)[-*+]\s+\[( |x|X)\]\s+/gm, '$1')
  }

  if (!enabledFeatures.has('orderedList')) {
    next = next.replace(/^(\s*)\d+\.\s+/gm, '$1')
  }

  if (!enabledFeatures.has('bulletList')) {
    next = next.replace(/^(\s*)[-*+]\s+/gm, '$1')
  }

  if (!enabledFeatures.has('link')) {
    next = next.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
  }

  if (!enabledFeatures.has('image')) {
    next = next.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt: string, src: string) => {
      const label = alt.trim() || src.trim()
      return `[图片: ${label}]`
    })
  }

  return next
}

export function looksLikeMarkdownPaste(text: string, enabledFeatures: Set<EditorFeatureKey>) {
  if (!text.trim()) return false
  if (text.includes('\n')) return true
  if (enabledFeatures.has('heading') && /^#{1,6}\s/m.test(text)) return true
  if (enabledFeatures.has('blockquote') && /^>\s/m.test(text)) return true
  if (enabledFeatures.has('bulletList') && /^\s*[-*+]\s/m.test(text)) return true
  if (enabledFeatures.has('orderedList') && /^\s*\d+\.\s/m.test(text)) return true
  if (enabledFeatures.has('taskList') && /^\s*[-*+]\s+\[( |x|X)\]\s/m.test(text)) return true
  if (enabledFeatures.has('codeBlock') && /```/.test(text)) return true
  if (enabledFeatures.has('link') && /\[[^\]]+\]\([^)]+\)/.test(text)) return true
  if (enabledFeatures.has('image') && /!\[[^\]]*\]\([^)]+\)/.test(text)) return true
  if (enabledFeatures.has('bold') && /(\*\*|__)[^*_]+(\*\*|__)/.test(text)) return true
  if (enabledFeatures.has('italic') && /(\*|_)[^*_]+(\*|_)/.test(text)) return true
  return false
}

function buildSchema() {
  const baseNodes = markdownBaseSchema.spec.nodes
  const nodes = baseNodes
    .update('bullet_list', {
      ...baseNodes.get('bullet_list'),
      attrs: {
        ...baseNodes.get('bullet_list')?.attrs,
        kind: { default: 'bullet' },
      },
      toDOM(node) {
        const attrs = node.attrs.kind === 'task' ? { 'data-type': 'taskList' } : {}
        return ['ul', attrs, 0]
      },
    })
    .update('list_item', {
      ...baseNodes.get('list_item'),
      attrs: {
        ...baseNodes.get('list_item')?.attrs,
        checked: { default: null },
      },
      toDOM(node) {
        if (node.attrs.checked === null) {
          return ['li', 0]
        }

        return [
          'li',
          { 'data-checked': node.attrs.checked ? 'true' : 'false' },
          [
            'label',
            { class: 'pm-task-checkbox', contenteditable: 'false' },
            [
              'input',
              {
                type: 'checkbox',
                checked: node.attrs.checked ? 'checked' : undefined,
                disabled: 'true',
              },
            ],
          ],
          ['div', 0],
        ]
      },
    })
    .update('image', {
      ...baseNodes.get('image'),
      toDOM(node) {
        return ['img', { ...node.attrs, class: 'pm-editor-image' }]
      },
    })

  return new Schema({
    marks: markdownBaseSchema.spec.marks,
    nodes,
  })
}

export const prosemirrorSchema = buildSchema()

function buildMarkdownParser() {
  const markdownIt = new MarkdownIt('commonmark', {
    html: false,
    linkify: false,
  })

  return new MarkdownParser(prosemirrorSchema, markdownIt, defaultMarkdownParser.tokens)
}

function getTaskMarker(item: ProseMirrorNode): boolean | null {
  const firstBlock = item.firstChild
  if (!firstBlock || firstBlock.type.name !== 'paragraph') return null
  const firstText = firstBlock.firstChild
  if (!firstText || !firstText.isText) return null

  const match = firstText.text?.match(/^\[( |x|X)\]\s/)
  if (!match) return null
  return match[1].toLowerCase() === 'x'
}

function stripTaskMarkerFromParagraph(paragraph: ProseMirrorNode) {
  const firstText = paragraph.firstChild
  if (!firstText || !firstText.isText || !firstText.text) return paragraph
  const nextText = firstText.text.replace(/^\[( |x|X)\]\s/, '')
  const content: ProseMirrorNode[] = []

  if (nextText.length > 0) {
    content.push(prosemirrorSchema.text(nextText, firstText.marks))
  }

  for (let index = 1; index < paragraph.childCount; index += 1) {
    content.push(paragraph.child(index))
  }

  return paragraph.type.create(paragraph.attrs, content)
}

function normalizeTaskLists(node: ProseMirrorNode): ProseMirrorNode {
  if (node.isText) {
    return node
  }

  const content: ProseMirrorNode[] = []

  if (node.type.name === 'bullet_list') {
    let isTaskList = node.childCount > 0
    const normalizedItems = []

    for (let index = 0; index < node.childCount; index += 1) {
      const child = node.child(index)
      const checked = child.type.name === 'list_item' ? getTaskMarker(child) : null
      if (checked === null) {
        isTaskList = false
      }

      let nextChild = normalizeTaskLists(child)
      if (checked !== null && nextChild.firstChild?.type.name === 'paragraph') {
        const firstParagraph = stripTaskMarkerFromParagraph(nextChild.firstChild)
        const restChildren: ProseMirrorNode[] = [firstParagraph]
        for (let childIndex = 1; childIndex < nextChild.childCount; childIndex += 1) {
          restChildren.push(nextChild.child(childIndex))
        }
        nextChild = nextChild.type.create(
          {
            ...nextChild.attrs,
            checked,
          },
          restChildren,
        )
      }

      normalizedItems.push(nextChild)
    }

    return node.type.create(
      {
        ...node.attrs,
        kind: isTaskList ? 'task' : 'bullet',
      },
      normalizedItems,
    )
  }

  for (let index = 0; index < node.childCount; index += 1) {
    content.push(normalizeTaskLists(node.child(index)))
  }

  return node.type.create(node.attrs, content, node.marks)
}

export const prosemirrorMarkdownParser = buildMarkdownParser()

export function parseMarkdown(markdown: string, enabledFeatures: Set<EditorFeatureKey>) {
  const downgraded = downgradeMarkdownForDisabledFeatures(markdown, enabledFeatures)
  const parsed = prosemirrorMarkdownParser.parse(downgraded)
  return normalizeTaskLists(parsed)
}

function buildMarkdownSerializer() {
  return new MarkdownSerializer(
    {
      ...defaultMarkdownSerializer.nodes,
      bullet_list(state, node) {
        if (node.attrs.kind === 'task') {
          state.renderList(node, '  ', (index) => `- [${node.child(index).attrs.checked ? 'x' : ' '}] `)
          return
        }

        state.renderList(node, '  ', () => '- ')
      },
      ordered_list(state, node) {
        const start = node.attrs.order || 1
        const maxW = String(start + node.childCount - 1).length
        const space = state.repeat(' ', maxW + 2)
        state.renderList(node, space, (index) => {
          const nStr = String(start + index)
          return state.repeat(' ', maxW - nStr.length) + nStr + '. '
        })
      },
      image(state, node) {
        const alt = node.attrs.alt || ''
        const src = node.attrs.src || ''
        const title = node.attrs.title
        state.write(`![${alt}](${src}${title ? ` "${title}"` : ''})`)
      },
      list_item(state, node) {
        state.renderContent(node)
      },
    },
    defaultMarkdownSerializer.marks,
  )
}

export const prosemirrorMarkdownSerializer = buildMarkdownSerializer()

export function serializeMarkdown(doc: ProseMirrorNode) {
  return prosemirrorMarkdownSerializer.serialize(doc).replace(/\r/g, '')
}

function markActive(state: EditorState, markType: MarkType) {
  const { from, $from, to, empty } = state.selection

  if (empty) return !!markType.isInSet(state.storedMarks || $from.marks())
  return state.doc.rangeHasMark(from, to, markType)
}

function blockActive(state: EditorState, typeName: string) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === typeName) return true
  }
  return false
}

function findParentList(state: EditorState) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type === prosemirrorSchema.nodes.bullet_list || node.type === prosemirrorSchema.nodes.ordered_list) {
      return {
        depth,
        node,
        pos: depth > 0 ? $from.before(depth) : 0,
      }
    }
  }
  return null
}

function setListKind(kind: 'bullet' | 'task', checked: boolean | null = null): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const list = findParentList(state)
    if (!list || list.node.type !== prosemirrorSchema.nodes.bullet_list) return false
    if (!dispatch) return true

    let tr = state.tr.setNodeMarkup(list.pos, undefined, { ...list.node.attrs, kind })
    list.node.forEach((child: ProseMirrorNode, offset: number) => {
      if (child.type !== prosemirrorSchema.nodes.list_item) return
      tr = tr.setNodeMarkup(list.pos + offset + 1, undefined, {
        ...child.attrs,
        checked,
      })
    })
    dispatch(tr.scrollIntoView())
    return true
  }
}

function toggleHeadingCommand(): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const headingType = prosemirrorSchema.nodes.heading
    const paragraphType = prosemirrorSchema.nodes.paragraph
    const active = blockActive(state, 'heading')
    return active
      ? setBlockType(paragraphType)(state, dispatch)
      : setBlockType(headingType, { level: 2 })(state, dispatch)
  }
}

function toggleBlockquoteCommand(): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    if (blockActive(state, 'blockquote')) {
      return lift(state, dispatch)
    }
    return wrapIn(prosemirrorSchema.nodes.blockquote)(state, dispatch)
  }
}

function toggleCodeBlockCommand(): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const codeBlockType = prosemirrorSchema.nodes.code_block
    const paragraphType = prosemirrorSchema.nodes.paragraph
    const active = blockActive(state, 'code_block')
    return active ? setBlockType(paragraphType)(state, dispatch) : setBlockType(codeBlockType)(state, dispatch)
  }
}

function toggleBulletListCommand(): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const list = findParentList(state)
    if (list && list.node.type === prosemirrorSchema.nodes.bullet_list && list.node.attrs.kind === 'bullet') {
      return liftListItem(prosemirrorSchema.nodes.list_item)(state, dispatch)
    }
    if (list && list.node.type === prosemirrorSchema.nodes.bullet_list && list.node.attrs.kind === 'task') {
      return setListKind('bullet', null)(state, dispatch)
    }
    return wrapInList(prosemirrorSchema.nodes.bullet_list, { kind: 'bullet' })(state, dispatch)
  }
}

function toggleOrderedListCommand(): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const list = findParentList(state)
    if (list?.node.type === prosemirrorSchema.nodes.ordered_list) {
      return liftListItem(prosemirrorSchema.nodes.list_item)(state, dispatch)
    }
    return wrapInList(prosemirrorSchema.nodes.ordered_list)(state, dispatch)
  }
}

function toggleTaskListCommand(): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const list = findParentList(state)
    if (list && list.node.type === prosemirrorSchema.nodes.bullet_list && list.node.attrs.kind === 'task') {
      return liftListItem(prosemirrorSchema.nodes.list_item)(state, dispatch)
    }
    if (list && list.node.type === prosemirrorSchema.nodes.bullet_list) {
      return setListKind('task', false)(state, dispatch)
    }

    const wrapped = wrapInList(prosemirrorSchema.nodes.bullet_list, { kind: 'task' })(state, dispatch)
    if (!wrapped || !dispatch) return wrapped
    return setListKind('task', false)(state, dispatch)
  }
}

function codeBlockInputRule(enabledFeatures: Set<EditorFeatureKey>) {
  if (!enabledFeatures.has('codeBlock')) return []
  return [textblockTypeInputRule(/^```([A-Za-z0-9_-]+)?\s$/, prosemirrorSchema.nodes.code_block, (match) => ({ params: match[1] || '' }))]
}

export function createInputRules(enabledFeatures: Set<EditorFeatureKey>) {
  const rules = []

  if (enabledFeatures.has('heading')) {
    rules.push(textblockTypeInputRule(/^(#{1,3})\s$/, prosemirrorSchema.nodes.heading, (match) => ({ level: match[1].length })))
  }

  if (enabledFeatures.has('blockquote')) {
    rules.push(wrappingInputRule(/^>\s$/, prosemirrorSchema.nodes.blockquote))
  }

  if (enabledFeatures.has('bulletList')) {
    rules.push(wrappingInputRule(/^\s*([-+*])\s$/, prosemirrorSchema.nodes.bullet_list, () => ({ kind: 'bullet' })))
  }

  if (enabledFeatures.has('orderedList')) {
    rules.push(wrappingInputRule(/^(\d+)\.\s$/, prosemirrorSchema.nodes.ordered_list, (match) => ({ order: Number(match[1]) || 1 })))
  }

  if (enabledFeatures.has('taskList')) {
    rules.push(wrappingInputRule(/^\s*[-*+]\s+\[(?: |x|X)\]\s$/, prosemirrorSchema.nodes.bullet_list, () => ({ kind: 'task' })))
  }

  rules.push(...codeBlockInputRule(enabledFeatures))
  return inputRules({ rules })
}

function enterKeyCommand(): Command {
  return (state: EditorState, dispatch?: (tr: Transaction) => void) => {
    const list = findParentList(state)
    if (list) {
      return splitListItem(prosemirrorSchema.nodes.list_item)(state, dispatch)
    }
    return chainCommands(exitCode, createParagraphNear, liftEmptyBlock, splitBlock)(state, dispatch)
  }
}

function taskCheckboxClickPlugin() {
  return new Plugin({
    props: {
      handleClickOn(view: EditorView, _pos: number, node: ProseMirrorNode, nodePos: number, event: MouseEvent) {
        const target = event.target
        if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return false
        if (node.type !== prosemirrorSchema.nodes.list_item || node.attrs.checked === null) return false

        const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
          ...node.attrs,
          checked: !node.attrs.checked,
        })
        view.dispatch(tr)
        return true
      },
    },
  })
}

function pasteMarkdownSlice(markdown: string, enabledFeatures: Set<EditorFeatureKey>) {
  const doc = parseMarkdown(markdown, enabledFeatures)
  return new Slice(doc.content, 0, 0)
}

export function createEditorState({
  enabledFeatures,
  markdown,
  onPasteImages,
}: {
  enabledFeatures: Set<EditorFeatureKey>
  markdown: string
  onPasteImages: (files: File[]) => void | Promise<void>
}) {
  const doc = parseMarkdown(markdown, enabledFeatures)

  const plugins = [
    history(),
    createInputRules(enabledFeatures),
    keymap({
      'Mod-z': undo,
      'Mod-y': redo,
      Enter: enterKeyCommand(),
      Tab: sinkListItem(prosemirrorSchema.nodes.list_item),
      'Shift-Tab': liftListItem(prosemirrorSchema.nodes.list_item),
    }),
    keymap(baseKeymap),
    taskCheckboxClickPlugin(),
    new Plugin({
      props: {
        handlePaste(view: EditorView, event: ClipboardEvent) {
          const imageFiles = Array.from(event.clipboardData?.items ?? [])
            .filter((item): item is DataTransferItem => item.kind === 'file' && item.type.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter((file): file is File => Boolean(file))

          if (imageFiles.length > 0) {
            if (!enabledFeatures.has('image')) {
              event.preventDefault()
              return true
            }

            event.preventDefault()
            void onPasteImages(imageFiles)
            return true
          }

          const text = event.clipboardData?.getData('text/plain') ?? ''
          if (!looksLikeMarkdownPaste(text, enabledFeatures)) {
            return false
          }

          event.preventDefault()
          const slice = pasteMarkdownSlice(text, enabledFeatures)
          view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())
          return true
        },
      },
    }),
  ]

  return EditorState.create({
    doc,
    plugins,
    schema: prosemirrorSchema,
  })
}

export function createEditorView({
  element,
  enabledFeatures,
  markdown,
  onPasteImages,
  onDocChange,
}: {
  element: HTMLElement
  enabledFeatures: Set<EditorFeatureKey>
  markdown: string
  onPasteImages: (files: File[]) => void | Promise<void>
  onDocChange: (markdown: string) => void
}) {
  let view!: EditorView
  view = new EditorView(element, {
    state: createEditorState({ enabledFeatures, markdown, onPasteImages }),
    dispatchTransaction(transaction: Transaction) {
      const nextState = view.state.apply(transaction)
      view.updateState(nextState)
      if (transaction.docChanged) {
        onDocChange(serializeMarkdown(nextState.doc))
      }
    },
  })
  return view
}

export function setEditorViewMarkdown(view: EditorView, markdown: string, enabledFeatures: Set<EditorFeatureKey>) {
  const doc = parseMarkdown(markdown, enabledFeatures)
  const state = EditorState.create({
    doc,
    plugins: view.state.plugins,
    schema: prosemirrorSchema,
  })
  view.updateState(state)
}

export function focusEditorView(view: EditorView, placeAtEnd = false) {
  view.focus()
  if (!placeAtEnd) return
  const end = view.state.doc.content.size
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, end))
  view.dispatch(tr)
}

export function runToolbarCommand(view: EditorView, command: Command) {
  return command(view.state, view.dispatch, view)
}

export function commandsForFeatures(enabledFeatures: Set<EditorFeatureKey>) {
  return {
    isBlockquoteActive: (state: EditorState) => blockActive(state, 'blockquote'),
    isBoldActive: (state: EditorState) => markActive(state, prosemirrorSchema.marks.strong),
    isCodeBlockActive: (state: EditorState) => blockActive(state, 'code_block'),
    isHeadingActive: (state: EditorState) => blockActive(state, 'heading'),
    isItalicActive: (state: EditorState) => markActive(state, prosemirrorSchema.marks.em),
    toggleBlockquote: enabledFeatures.has('blockquote') ? toggleBlockquoteCommand() : null,
    toggleBold: enabledFeatures.has('bold') ? toggleMark(prosemirrorSchema.marks.strong) : null,
    toggleBulletList: enabledFeatures.has('bulletList') ? toggleBulletListCommand() : null,
    toggleCodeBlock: enabledFeatures.has('codeBlock') ? toggleCodeBlockCommand() : null,
    toggleHeading: enabledFeatures.has('heading') ? toggleHeadingCommand() : null,
    toggleItalic: enabledFeatures.has('italic') ? toggleMark(prosemirrorSchema.marks.em) : null,
    toggleOrderedList: enabledFeatures.has('orderedList') ? toggleOrderedListCommand() : null,
    toggleTaskList: enabledFeatures.has('taskList') ? toggleTaskListCommand() : null,
  }
}
