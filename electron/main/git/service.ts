import { access, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

export type GitStatus = {
  isGitAvailable: boolean
  isRepoInitialized: boolean
  hasGitignore: boolean
  hasPendingChanges: boolean
  repoPath: string | null
  lastCommitAt: string | null
  nextAutoCommitAt: string | null
}

type RunGitResult = {
  code: number
  stdout: string
  stderr: string
}

const DEFAULT_GITIGNORE_CONTENT = ['.DS_Store', 'Thumbs.db', '*.swp', '*.swo', '*.tmp'].join('\n')

async function pathExists(pathValue: string): Promise<boolean> {
  try {
    await access(pathValue)
    return true
  } catch {
    return false
  }
}

function runCommand(command: string, args: string[], cwd?: string): Promise<RunGitResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      })
    })
  })
}

async function isGitAvailable(): Promise<boolean> {
  try {
    const result = await runCommand('git', ['--version'])
    return result.code === 0
  } catch {
    return false
  }
}

function gitignorePath(notesDir: string): string {
  return join(notesDir, '.gitignore')
}

function gitDirPath(notesDir: string): string {
  return join(notesDir, '.git')
}

export function createGitService() {
  async function getStatus(notesDir: string | null, options: { nextAutoCommitAt?: string | null } = {}): Promise<GitStatus> {
    const available = await isGitAvailable()
    if (!notesDir) {
      return {
        isGitAvailable: available,
        isRepoInitialized: false,
        hasGitignore: false,
        hasPendingChanges: false,
        repoPath: null,
        lastCommitAt: null,
        nextAutoCommitAt: null,
      }
    }

    const isRepoInitialized = await pathExists(gitDirPath(notesDir))
    const hasGitignore = await pathExists(gitignorePath(notesDir))
    let hasPendingChanges = false
    let lastCommitAt: string | null = null

    if (available && isRepoInitialized) {
      const result = await runCommand('git', ['status', '--porcelain'], notesDir)
      hasPendingChanges = result.code === 0 && result.stdout.length > 0

      const lastCommitResult = await runCommand('git', ['log', '-1', '--format=%cI'], notesDir)
      if (lastCommitResult.code === 0 && lastCommitResult.stdout.length > 0) {
        lastCommitAt = lastCommitResult.stdout
      }
    }

    return {
      isGitAvailable: available,
      isRepoInitialized,
      hasGitignore,
      hasPendingChanges,
      repoPath: notesDir,
      lastCommitAt,
      nextAutoCommitAt: options.nextAutoCommitAt ?? null,
    }
  }

  async function initRepo(notesDir: string): Promise<GitStatus> {
    const available = await isGitAvailable()
    if (!available) {
      throw new Error('当前系统未安装 Git。')
    }

    const result = await runCommand('git', ['init'], notesDir)
    if (result.code !== 0) {
      throw new Error(result.stderr || '初始化 Git 仓库失败。')
    }

    const ignorePath = gitignorePath(notesDir)
    if (!(await pathExists(ignorePath))) {
      await writeFile(ignorePath, `${DEFAULT_GITIGNORE_CONTENT}\n`, 'utf8')
    }

    return getStatus(notesDir)
  }

  async function readGitignore(notesDir: string): Promise<{ content: string; exists: boolean; defaultContent: string }> {
    const ignorePath = gitignorePath(notesDir)
    const exists = await pathExists(ignorePath)
    if (!exists) {
      return {
        content: DEFAULT_GITIGNORE_CONTENT,
        exists: false,
        defaultContent: DEFAULT_GITIGNORE_CONTENT,
      }
    }

    return {
      content: await readFile(ignorePath, 'utf8'),
      exists: true,
      defaultContent: DEFAULT_GITIGNORE_CONTENT,
    }
  }

  async function writeGitignoreContent(notesDir: string, content: string): Promise<void> {
    await writeFile(gitignorePath(notesDir), content, 'utf8')
  }

  async function commitAll(notesDir: string, message: string): Promise<GitStatus> {
    const available = await isGitAvailable()
    if (!available) {
      throw new Error('当前系统未安装 Git。')
    }

    if (!(await pathExists(gitDirPath(notesDir)))) {
      throw new Error('当前目录还没有初始化 Git 仓库。')
    }

    const statusBefore = await getStatus(notesDir)
    if (!statusBefore.hasPendingChanges) {
      return statusBefore
    }

    const addResult = await runCommand('git', ['add', '-A', '.'], notesDir)
    if (addResult.code !== 0) {
      throw new Error(addResult.stderr || '暂存 Git 改动失败。')
    }

    const commitResult = await runCommand('git', ['commit', '-m', message], notesDir)
    if (commitResult.code !== 0) {
      const combinedMessage = `${commitResult.stdout}\n${commitResult.stderr}`.trim()
      if (combinedMessage.includes('nothing to commit')) {
        return getStatus(notesDir)
      }
      throw new Error(commitResult.stderr || commitResult.stdout || '提交 Git 改动失败。')
    }

    return getStatus(notesDir)
  }

  return {
    getStatus,
    initRepo,
    readGitignore,
    writeGitignoreContent,
    commitAll,
    defaultGitignoreContent: DEFAULT_GITIGNORE_CONTENT,
  }
}
