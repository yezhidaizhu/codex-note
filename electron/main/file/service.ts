import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

function normalizeWorkspaceRelativePath(pathValue: string): string {
  const normalized = pathValue
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.')

  if (normalized.some((segment) => segment === '..') || normalized.length === 0) {
    throw new Error('路径非法。')
  }

  return normalized.join('/')
}

function resolveInWorkspace(rootPath: string, relativePath: string): string {
  const normalizedPath = normalizeWorkspaceRelativePath(relativePath)
  const absolutePath = resolve(join(rootPath, normalizedPath))
  const relativeToRoot = relative(resolve(rootPath), absolutePath)

  if (relativeToRoot.startsWith('..') || relativeToRoot.includes('/../') || relativeToRoot.includes('\\..\\')) {
    throw new Error('路径越界。')
  }

  return absolutePath
}

async function pathExists(pathValue: string): Promise<boolean> {
  try {
    await access(pathValue)
    return true
  } catch {
    return false
  }
}

export function createWorkspaceFileService() {
  async function readTextFile(rootPath: string, relativePath: string): Promise<{ content: string; exists: boolean }> {
    const absolutePath = resolveInWorkspace(rootPath, relativePath)
    const exists = await pathExists(absolutePath)
    if (!exists) {
      return {
        content: '',
        exists: false,
      }
    }

    return {
      content: await readFile(absolutePath, 'utf8'),
      exists: true,
    }
  }

  async function writeTextFile(rootPath: string, relativePath: string, content: string): Promise<void> {
    const absolutePath = resolveInWorkspace(rootPath, relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content, 'utf8')
  }

  return {
    readTextFile,
    writeTextFile,
  }
}
