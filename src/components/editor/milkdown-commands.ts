import { commandsCtx } from '@milkdown/core'
import type { Ctx } from '@milkdown/ctx'
import {
  createCodeBlockCommand,
  toggleEmphasisCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
  type UpdateLinkCommandPayload,
} from '@milkdown/preset-commonmark'
import { insertImageCommand } from '@milkdown/preset-commonmark'

function callCommand<T>(ctx: Ctx, command: { key?: unknown }, payload?: T) {
  ctx.get(commandsCtx).call(command.key as never, payload as never)
}

export function toggleHeading(ctx: Ctx) {
  callCommand(ctx, wrapInHeadingCommand, 2)
}

export function toggleBold(ctx: Ctx) {
  callCommand(ctx, toggleStrongCommand)
}

export function toggleItalic(ctx: Ctx) {
  callCommand(ctx, toggleEmphasisCommand)
}

export function toggleBlockquote(ctx: Ctx) {
  callCommand(ctx, wrapInBlockquoteCommand)
}

export function toggleBulletList(ctx: Ctx) {
  callCommand(ctx, wrapInBulletListCommand)
}

export function toggleOrderedList(ctx: Ctx) {
  callCommand(ctx, wrapInOrderedListCommand)
}

export function toggleCodeBlock(ctx: Ctx) {
  callCommand(ctx, createCodeBlockCommand)
}

export function toggleLink(ctx: Ctx, payload: UpdateLinkCommandPayload) {
  callCommand(ctx, toggleLinkCommand, payload)
}

export function insertImage(ctx: Ctx, src: string, alt = '') {
  callCommand(ctx, insertImageCommand, { src, alt })
}
