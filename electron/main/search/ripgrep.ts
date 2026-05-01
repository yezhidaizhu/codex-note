import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import type { NoteListItem } from '../notes'

type RipgrepMatch = {
  data?: {
    path?: { text?: string }
  }
}

function normalizeRelativePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').split('/').filter(Boolean).join('/')
}

function resolveRipgrepPath(): string {
  const require = createRequire(import.meta.url)
  return (require('@vscode/ripgrep') as { rgPath: string }).rgPath
}

export async function searchNotesWithRipgrep(notesDir: string, notes: NoteListItem[], query: string): Promise<NoteListItem[]> {
  const keyword = query.trim()
  if (!keyword) {
    return notes
  }

  const matchedPaths = new Set<string>()

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(resolveRipgrepPath(), ['--json', '--ignore-case', '--glob', '*.md', keyword, notesDir], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    let stdoutBuffer = ''

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString()
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const event = JSON.parse(trimmed) as { type?: string; data?: RipgrepMatch['data'] }
          if (event.type !== 'match') continue
          const pathText = event.data?.path?.text
          if (!pathText) continue
          matchedPaths.add(normalizeRelativePath(pathText.slice(notesDir.length).replace(/^[/\\]/, '')))
        } catch {
          // Ignore malformed JSON lines from ripgrep output.
        }
      }
    })

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      rejectPromise(error)
    })

    child.on('close', (code) => {
      if (stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(stdoutBuffer.trim()) as { type?: string; data?: RipgrepMatch['data'] }
          if (event.type === 'match') {
            const pathText = event.data?.path?.text
            if (pathText) {
              matchedPaths.add(normalizeRelativePath(pathText.slice(notesDir.length).replace(/^[/\\]/, '')))
            }
          }
        } catch {
          // Ignore trailing partial data.
        }
      }

      if (code === 0 || code === 1) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(stderr.trim() || `ripgrep 搜索失败（退出码 ${code ?? 'unknown'}）。`))
    })
  })

  return notes.filter((note) => matchedPaths.has(note.path))
}
