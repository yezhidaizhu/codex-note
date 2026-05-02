import { $prose } from '@milkdown/kit/utils'
import { Plugin } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

const PLACEHOLDER_TEXT = '点击这里开始输入'

function isEffectivelyEmpty(doc: Parameters<typeof DecorationSet.create>[0]) {
  if (doc.childCount !== 1) return false
  const firstChild = doc.firstChild
  return firstChild?.type.name === 'paragraph' && firstChild.content.size === 0
}

export const placeholder = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          if (!isEffectivelyEmpty(state.doc)) {
            return null
          }

          const firstChild = state.doc.firstChild
          if (!firstChild) return null

          return DecorationSet.create(state.doc, [
            Decoration.node(0, state.doc.content.size, {
              class: 'milkdown-placeholder-root',
            }),
            Decoration.node(0, firstChild.nodeSize, {
              class: 'milkdown-placeholder-paragraph',
              'data-placeholder': PLACEHOLDER_TEXT,
            }),
          ])
        },
      },
    }),
)
