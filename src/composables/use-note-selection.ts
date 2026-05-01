import { ref } from 'vue'

export type NoteSelectionModifiers = {
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}

function normalizeUniquePaths(paths: string[]) {
  return Array.from(new Set(paths.filter(Boolean)))
}

function replacePathPrefix(pathValue: string, sourcePrefix: string, targetPrefix: string): string {
  if (pathValue === sourcePrefix) return targetPrefix
  if (!pathValue.startsWith(`${sourcePrefix}/`)) return pathValue
  return `${targetPrefix}${pathValue.slice(sourcePrefix.length)}`
}

export function useNoteSelection() {
  const selectedPaths = ref<string[]>([])
  const anchorPath = ref<string | null>(null)

  function clearSelection() {
    selectedPaths.value = []
    anchorPath.value = null
  }

  function setSelectedPaths(paths: string[], nextAnchor: string | null = null) {
    selectedPaths.value = normalizeUniquePaths(paths)
    anchorPath.value = nextAnchor ?? selectedPaths.value.at(-1) ?? null
  }

  function setSingleSelection(path: string) {
    setSelectedPaths([path], path)
  }

  function togglePathSelection(path: string) {
    if (selectedPaths.value.includes(path)) {
      const nextPaths = selectedPaths.value.filter((item) => item !== path)
      selectedPaths.value = nextPaths
      if (anchorPath.value === path) {
        anchorPath.value = nextPaths.at(-1) ?? null
      }
      return
    }

    selectedPaths.value = [...selectedPaths.value, path]
    anchorPath.value = path
  }

  function selectRange(path: string, orderedPaths: string[]) {
    const resolvedAnchor = anchorPath.value && orderedPaths.includes(anchorPath.value) ? anchorPath.value : path
    const anchorIndex = orderedPaths.indexOf(resolvedAnchor)
    const targetIndex = orderedPaths.indexOf(path)

    if (anchorIndex === -1 || targetIndex === -1) {
      setSingleSelection(path)
      return
    }

    const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
    setSelectedPaths(orderedPaths.slice(start, end + 1), path)
  }

  function handleNoteActivation(path: string, orderedPaths: string[], modifiers: NoteSelectionModifiers) {
    const additive = modifiers.metaKey || modifiers.ctrlKey

    if (modifiers.shiftKey) {
      selectRange(path, orderedPaths)
      return true
    }

    if (additive) {
      togglePathSelection(path)
      return false
    }

    setSingleSelection(path)
    return true
  }

  function ensureContextSelection(path: string) {
    if (selectedPaths.value.includes(path)) {
      return [...selectedPaths.value]
    }

    setSingleSelection(path)
    return [path]
  }

  function pathsForDrag(path: string) {
    if (selectedPaths.value.includes(path)) {
      return [...selectedPaths.value]
    }

    setSingleSelection(path)
    return [path]
  }

  function removePaths(paths: string[]) {
    const targets = new Set(paths)
    const nextPaths = selectedPaths.value.filter((path) => !targets.has(path))
    selectedPaths.value = nextPaths
    if (anchorPath.value && targets.has(anchorPath.value)) {
      anchorPath.value = nextPaths.at(-1) ?? null
    }
  }

  function replaceSelectedPath(currentPath: string, nextPath: string) {
    if (!selectedPaths.value.includes(currentPath)) return
    selectedPaths.value = normalizeUniquePaths(selectedPaths.value.map((path) => (path === currentPath ? nextPath : path)))
    if (anchorPath.value === currentPath) {
      anchorPath.value = nextPath
    }
  }

  function replaceSelectedPrefix(sourcePrefix: string, targetPrefix: string) {
    selectedPaths.value = normalizeUniquePaths(selectedPaths.value.map((path) => replacePathPrefix(path, sourcePrefix, targetPrefix)))
    if (anchorPath.value) {
      anchorPath.value = replacePathPrefix(anchorPath.value, sourcePrefix, targetPrefix)
    }
  }

  return {
    selectedPaths,
    clearSelection,
    setSelectedPaths,
    setSingleSelection,
    handleNoteActivation,
    ensureContextSelection,
    pathsForDrag,
    removePaths,
    replaceSelectedPath,
    replaceSelectedPrefix,
  }
}
