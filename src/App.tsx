import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  Cog,
  FolderOpen,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { DeleteNoteDialog } from "@/components/delete-note-dialog";
import { NoteContextMenu } from "@/components/note-context-menu";
import { NoteListItem } from "@/components/note-list-item";
import { SettingsPanel } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { NoteListItem as NoteListItemData } from "@/lib/types";

type DraftNote = {
  basename: string | null;
  content: string;
  updatedAt: string | null;
};

type NoteContextMenuState = {
  basename: string;
  x: number;
  y: number;
} | null;

type PendingDeleteState = {
  basenames: string[];
  title: string;
  message: string;
  confirmLabel?: string;
} | null;

const NOTE_LABEL_MAX_LENGTH = 36;
const MAC_WINDOW_CONTROLS_GAP = "pl-[78px]";
const SIDEBAR_DEFAULT_WIDTH = 312;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 520;

function getNotesApi() {
  if (!window.notesApi) {
    throw new Error(
      "未检测到 Electron 预加载接口。请用 `pnpm dev` 或 `pnpm dev:electron` 启动 Electron 窗口，不要直接打开 Vite 地址或 `index.html`。",
    );
  }

  return window.notesApi;
}

function emptyDraft(): DraftNote {
  return {
    basename: null,
    content: "",
    updatedAt: null,
  };
}

function getMeaningfulLines(content: string): string[] {
  return content
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripMarkdownLabel(value: string): string {
  return value
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/[`*_~>[\\\]|]/g, "")
    .trim();
}

function normalizeNoteLabel(value: string, fallback: string): string {
  const cleaned = stripMarkdownLabel(value)
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || fallback).slice(0, NOTE_LABEL_MAX_LENGTH).trim();
}

function inferTitleFromContent(content: string): string {
  const firstLine = getMeaningfulLines(content)[0] ?? "";
  return normalizeNoteLabel(firstLine, "Untitled");
}

function formatCompactDate(value: string | null): string {
  if (!value) {
    return "今天";
  }

  const target = dayjs(value);
  const now = dayjs();
  const diffDays = now.startOf("day").diff(target.startOf("day"), "day");

  if (diffDays === 0) {
    return "今天";
  }

  if (diffDays === 1) {
    return "昨天";
  }

  if (diffDays === 2) {
    return "前天";
  }

  if (target.year() === now.year()) {
    return target.format("M月D日");
  }

  return target.format("YYYY年M月D日");
}

function getListLabel(item: NoteListItemData): string {
  const normalizedTitle = normalizeNoteLabel(item.title, "");

  return normalizedTitle || formatCompactDate(item.updatedAt);
}

function buildDeleteMessage(count: number, label?: string): string {
  if (count <= 1 && label) {
    return `将删除「${label}」，这个操作不可撤销。`;
  }

  return `将删除 ${count} 篇笔记，这个操作不可撤销。`;
}

export default function App() {
  const [view, setView] = useState<"editor" | "settings">("editor");
  const [notesDir, setNotesDir] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteListItemData[]>([]);
  const [activeNote, setActiveNote] = useState<DraftNote | null>(null);
  const [selectedBasename, setSelectedBasename] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<NoteContextMenuState>(null);
  const [listActionsMenuOpen, setListActionsMenuOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isBatchSelecting, setIsBatchSelecting] = useState(false);
  const [selectedBasenames, setSelectedBasenames] = useState<string[]>([]);
  const lastSavedSnapshotRef = useRef<{
    basename: string | null;
    content: string;
  } | null>(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef<DraftNote | null>(null);
  const sidebarResizeStartRef = useRef<{
    pointerX: number;
    width: number;
  } | null>(null);

  const filteredNotes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return notes;
    }

    return notes.filter((item) => {
      return [item.title, item.preview, item.basename].some((field) =>
        field.toLowerCase().includes(keyword),
      );
    });
  }, [notes, query]);

  async function openNote(basename: string) {
    try {
      const note = await getNotesApi().readNote(basename);
      setSelectedBasename(basename);
      lastSavedSnapshotRef.current = {
        basename: note.basename,
        content: note.content,
      };
      setActiveNote({
        basename: note.basename,
        content: note.content,
        updatedAt: note.updatedAt,
      });
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "打开笔记失败。",
      );
    }
  }

  async function boot() {
    setErrorMessage("");

    try {
      const settings = await getNotesApi().getSettings();
      setNotesDir(settings.notesDir);
      setNotes(settings.notes);

      if (settings.notes.length > 0) {
        await openNote(settings.notes[0].basename);
      } else if (settings.notesDir) {
        setActiveNote(emptyDraft());
        setSelectedBasename(null);
      } else {
        setActiveNote(null);
        setSelectedBasename(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "初始化失败。");
    }
  }

  async function chooseDirectory() {
    try {
      const result = await getNotesApi().chooseDirectory();
      if (!result) {
        return;
      }

      setNotesDir(result.notesDir);
      setNotes(result.notes);
      setQuery("");

      if (result.notes.length > 0) {
        await openNote(result.notes[0].basename);
        setView("editor");
      } else {
        createNote();
        setView("editor");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "选择目录失败。",
      );
    }
  }

  function createNote() {
    setView("editor");
    setSelectedBasename(null);
    lastSavedSnapshotRef.current = {
      basename: null,
      content: "",
    };
    setActiveNote(emptyDraft());
    setErrorMessage("");
  }

  async function saveNote(noteToSave = activeNote) {
    if (!noteToSave || !notesDir) {
      return;
    }

    if (!noteToSave.basename && !noteToSave.content.trim()) {
      return;
    }

    if (saveInFlightRef.current) {
      queuedSaveRef.current = noteToSave;
      return;
    }

    saveInFlightRef.current = true;
    setErrorMessage("");

    try {
      const title = inferTitleFromContent(noteToSave.content);
      const result = await getNotesApi().saveNote({
        currentBasename: noteToSave.basename,
        title,
        content: noteToSave.content,
      });

      setNotes(result.notes);
      setSelectedBasename(result.note.basename);
      lastSavedSnapshotRef.current = {
        basename: result.note.basename,
        content: noteToSave.content,
      };
      setActiveNote((current) => {
        if (!current) {
          return current;
        }

        if (
          current.basename === noteToSave.basename &&
          current.content === noteToSave.content
        ) {
          return {
            basename: result.note.basename,
            content: result.note.content,
            updatedAt: result.note.updatedAt,
          };
        }

        return {
          ...current,
          basename: result.note.basename,
        };
      });
      if (queuedSaveRef.current) {
        queuedSaveRef.current = {
          ...queuedSaveRef.current,
          basename: result.note.basename,
        };
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      saveInFlightRef.current = false;

      const queuedSave = queuedSaveRef.current;
      queuedSaveRef.current = null;

      if (queuedSave) {
        const lastSavedSnapshot = lastSavedSnapshotRef.current;
        const alreadySaved =
          lastSavedSnapshot?.basename === queuedSave.basename &&
          lastSavedSnapshot?.content === queuedSave.content;

        if (!alreadySaved) {
          void saveNote(queuedSave);
        }
      }
    }
  }

  async function deleteNotesByBasenames(basenames: string[]) {
    const targets = Array.from(new Set(basenames));
    if (targets.length === 0) {
      return;
    }

    try {
      let nextNotes = notes;

      for (const basename of targets) {
        nextNotes = await getNotesApi().deleteNote(basename);
      }

      setNotes(nextNotes);
      setSelectedBasenames((current) =>
        current.filter((basename) => !targets.includes(basename)),
      );

      if (selectedBasename && targets.includes(selectedBasename)) {
        if (nextNotes.length > 0) {
          await openNote(nextNotes[0].basename);
        } else {
          setSelectedBasename(null);
          setActiveNote(emptyDraft());
        }
      }

      if (targets.length > 1) {
        setIsBatchSelecting(false);
      }

      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除失败。");
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", closeMenu);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!listActionsMenuOpen) {
      return;
    }

    const closeMenu = () => setListActionsMenuOpen(false);
    window.addEventListener("click", closeMenu);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", closeMenu);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, [listActionsMenuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveNote();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeNote, notesDir]);

  useEffect(() => {
    if (!activeNote || !notesDir) {
      return;
    }

    const currentSnapshot: DraftNote = {
      basename: activeNote.basename,
      content: activeNote.content,
      updatedAt: activeNote.updatedAt,
    };
    const lastSavedSnapshot = lastSavedSnapshotRef.current;
    const unchanged =
      lastSavedSnapshot?.basename === currentSnapshot.basename &&
      lastSavedSnapshot?.content === currentSnapshot.content;

    if (unchanged) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveNote(currentSnapshot);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [activeNote, notesDir]);

  useEffect(() => {
    void getNotesApi()
      .getWindowState()
      .then((state) => {
        setIsPinned(state.isAlwaysOnTop);
      })
      .catch(() => {
        setIsPinned(false);
      });
  }, []);

  useEffect(() => {
    void getNotesApi().setSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!isBatchSelecting && selectedBasenames.length > 0) {
      setSelectedBasenames([]);
    }
  }, [isBatchSelecting, selectedBasenames.length]);

  useEffect(() => {
    if (!isSidebarResizing) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const stopResize = () => {
      sidebarResizeStartRef.current = null;
      setIsSidebarResizing(false);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopResize);
      window.removeEventListener("blur", stopResize);
    };

    const onMouseMove = (event: MouseEvent) => {
      const currentResizeState = sidebarResizeStartRef.current;
      if (!currentResizeState) {
        return;
      }

      const nextWidth = currentResizeState.width + event.clientX - currentResizeState.pointerX;
      setSidebarWidth(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, nextWidth)));
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopResize);
    window.addEventListener("blur", stopResize);

    return stopResize;
  }, [isSidebarResizing]);

  async function togglePinned() {
    try {
      const state = await getNotesApi().setAlwaysOnTop(!isPinned);
      setIsPinned(state.isAlwaysOnTop);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "设置置顶失败。",
      );
    }
  }

  function toggleBatchSelect() {
    setIsBatchSelecting((current) => !current);
    setListActionsMenuOpen(false);
  }

  function toggleNoteSelection(basename: string) {
    setSelectedBasenames((current) =>
      current.includes(basename)
        ? current.filter((item) => item !== basename)
        : [...current, basename],
    );
  }

  function confirmDeleteNotes(basenames: string[]) {
    if (basenames.length === 0) {
      return;
    }

    const targetNote =
      basenames.length === 1
        ? notes.find((note) => note.basename === basenames[0])
        : null;

    setPendingDelete({
      basenames,
      title: basenames.length > 1 ? "批量删除笔记？" : "删除笔记？",
      message: buildDeleteMessage(
        basenames.length,
        targetNote ? getListLabel(targetNote) : undefined,
      ),
      confirmLabel: "删除",
    });
  }

  return (
    <div
      className="app-shell-glass app-shell-surface flex h-full flex-col overflow-hidden bg-transparent text-[var(--foreground)] border !border-gray-800 rounded-xl "
      onContextMenu={(event) => {
        if (
          !(event.target instanceof HTMLElement) ||
          !event.target.closest('[data-note-item="true"]')
        ) {
          setContextMenu(null);
        }
      }}
      onClick={() => setContextMenu(null)}
    >
      <div className="drag-region flex h-9 shrink-0 items-center justify-between border-b border-[color-mix(in_srgb,white_10%,transparent)] px-[var(--space-3)] text-[var(--muted-foreground)]">
        <div
          className={`no-drag flex min-w-0 items-center gap-[var(--space-2)] ${MAC_WINDOW_CONTROLS_GAP}`}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <div className="no-drag flex items-center gap-[var(--space-2)]">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 transition-all duration-200"
            onClick={createNote}
            disabled={!notesDir || !sidebarCollapsed}
            aria-label="新建笔记"
            title="新建笔记"
            tabIndex={sidebarCollapsed ? 0 : -1}
          >
            <Plus
              className={[
                "h-3 w-3 transition-opacity duration-200",
                sidebarCollapsed ? "opacity-100" : "opacity-0",
              ].join(" ")}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={[
              "h-6 w-6 transition-all duration-200",
              isPinned
                ? "bg-[color-mix(in_srgb,var(--primary)_16%,transparent)] text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_24%,transparent)] hover:text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_72%,transparent)] hover:text-[var(--foreground)]",
            ].join(" ")}
            onClick={() => void togglePinned()}
            aria-label={isPinned ? "取消置顶" : "置顶窗口"}
            title={isPinned ? "取消置顶" : "置顶窗口"}
          >
            <Pin
              className={[
                "h-3.5 w-3.5 transition-transform duration-200",
                isPinned ? "rotate-0" : "rotate-45",
              ].join(" ")}
            />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={[
            "relative flex min-h-0 shrink-0 flex-col overflow-hidden bg-transparent",
            isSidebarResizing
              ? "transition-none"
              : "transition-[width,border-color,opacity] duration-300 ease-out",
            sidebarCollapsed
              ? "border-r border-transparent opacity-0"
              : "border-r border-[color-mix(in_srgb,white_8%,transparent)] opacity-100",
          ].join(" ")}
          style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
          aria-hidden={sidebarCollapsed}
        >
          <div
            className={[
              "flex h-full min-h-0 flex-col",
              isSidebarResizing
                ? "transition-none"
                : "transition-[transform,opacity] duration-300 ease-out",
              sidebarCollapsed
                ? "pointer-events-none -translate-x-6 opacity-0"
                : "translate-x-0 opacity-100",
            ].join(" ")}
            style={{ width: sidebarWidth }}
          >
            <div className="panel-padding panel-stack flex flex-col border-b border-[color-mix(in_srgb,var(--border)_85%,transparent)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-[var(--space-3)] top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="text-ui-sm h-7 border-none bg-[color-mix(in_srgb,var(--card)_58%,transparent)] pl-9 shadow-none focus-visible:ring-1 focus-visible:ring-offset-0"
                  placeholder="搜索笔记"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-[var(--space-3)] py-[var(--space-2)]">
              <p className="text-ui-xs text-[var(--muted-foreground)]">
                笔记 {filteredNotes.length}
              </p>
              <div className="relative flex items-center gap-[var(--space-1)]">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={createNote}
                  disabled={!notesDir || isBatchSelecting}
                  aria-label="新建笔记"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    setListActionsMenuOpen((current) => !current);
                  }}
                  disabled={filteredNotes.length === 0}
                  aria-label="更多操作"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>

                {listActionsMenuOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+0.35rem)] z-30 min-w-[132px] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_92%,transparent)] bg-[color-mix(in_srgb,var(--card)_96%,transparent)] p-1 shadow-[0_12px_28px_rgba(0,0,0,0.45)] backdrop-blur"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="text-ui-sm flex w-full items-center rounded-[calc(var(--radius)-0.25rem)] px-2 py-1.5 text-left text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_80%,transparent)]"
                      onClick={toggleBatchSelect}
                    >
                      {isBatchSelecting ? "退出批量操作" : "批量操作"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {filteredNotes.length === 0 ? (
              <div className="px-[var(--space-3)] pb-[var(--space-3)]">
                <div className="rounded-[var(--radius)] border border-dashed border-[color-mix(in_srgb,var(--border)_85%,transparent)] bg-[color-mix(in_srgb,var(--card)_42%,transparent)] p-[var(--space-4)] text-sm text-[var(--muted-foreground)]">
                  <p>{query ? "没有匹配的笔记。" : "这里还没有笔记。"}</p>
                  <p className="mt-2 text-xs">
                    {query
                      ? "试试别的关键词。"
                      : "新建后会直接保存为本地 `.md` 文件。"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-[var(--space-2)] pb-[var(--space-2)]">
                {filteredNotes.map((item) => (
                  <NoteListItem
                    key={item.basename}
                    label={getListLabel(item)}
                    dateLabel={formatCompactDate(item.updatedAt)}
                    selected={selectedBasename === item.basename}
                    selectionMode={isBatchSelecting}
                    checked={selectedBasenames.includes(item.basename)}
                    onToggleChecked={() => toggleNoteSelection(item.basename)}
                    onOpen={() => void openNote(item.basename)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (isBatchSelecting) {
                        return;
                      }
                      setContextMenu({
                        basename: item.basename,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                  />
                ))}
              </div>
            )}

            <div className="mt-auto border-t border-[color-mix(in_srgb,var(--border)_85%,transparent)] px-[var(--space-2)] py-[var(--space-2)]">
              {isBatchSelecting ? (
                <div className="mb-[var(--space-2)] flex items-center justify-between gap-[var(--space-2)] rounded-[calc(var(--radius)-0.1rem)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_42%,transparent)] px-[var(--space-2)] py-[var(--space-2)]">
                  <p className="text-ui-xs text-[var(--muted-foreground)]">
                    已选 {selectedBasenames.length}
                  </p>
                  <div className="flex items-center gap-[var(--space-1)]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-ui-xs h-7 px-2 font-normal text-[var(--destructive)]"
                      onClick={() => confirmDeleteNotes(selectedBasenames)}
                      disabled={selectedBasenames.length === 0}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      删除
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-ui-xs h-7 px-2 font-normal"
                      onClick={toggleBatchSelect}
                    >
                      完成
                    </Button>
                  </div>
                </div>
              ) : null}
              <Button
                variant={view === "settings" ? "secondary" : "ghost"}
                size="sm"
                className="text-ui-sm h-7 w-full justify-start gap-1.5 px-2 font-normal"
                onClick={() => setView("settings")}
              >
                <Cog className="h-3.5 w-3.5" />
                设置
              </Button>
            </div>
          </div>

          <div
            className={[
              "absolute inset-y-0 right-[-4px] z-20 w-2 cursor-col-resize transition-opacity duration-200",
              sidebarCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
            ].join(" ")}
            onMouseDown={(event) => {
              if (sidebarCollapsed) {
                return;
              }

              event.preventDefault();
              sidebarResizeStartRef.current = {
                pointerX: event.clientX,
                width: sidebarWidth,
              };
              setIsSidebarResizing(true);
            }}
            aria-hidden="true"
          />
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
          {view === "settings" ? (
            <SettingsPanel
              notesDir={notesDir}
              notesCount={notes.length}
              hasSelectedNote={Boolean(selectedBasename)}
              onChooseDirectory={() => void chooseDirectory()}
              onClose={() => setView("editor")}
            />
          ) : !notesDir ? (
            <section className="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
              <div className="w-full max-w-2xl rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_20%,transparent)] p-[var(--space-5)]">
                <p className="text-ui-xs uppercase tracking-[0.26em] text-[var(--muted-foreground)]">
                  Start here
                </p>
                <h3 className="mt-[var(--space-3)] text-3xl font-semibold tracking-tight">
                  先把笔记目录接进来
                </h3>
                <p className="text-ui-md mt-[var(--space-4)] max-w-xl leading-7 text-[var(--muted-foreground)]">
                  应用只负责写入和管理本地 `.md`
                  文件，不做私有格式封装，也不绑定固定目录。
                </p>
                <div className="mt-[var(--space-5)]">
                  <Button
                    onClick={chooseDirectory}
                    className="gap-[var(--space-2)]"
                  >
                    <FolderOpen className="h-4 w-4" />
                    选择目录
                  </Button>
                </div>
              </div>
            </section>
          ) : activeNote ? (
            <section className="editor-surface flex min-h-0 flex-1 flex-col overflow-hidden">
              <Textarea
                value={activeNote.content}
                onChange={(event) =>
                  setActiveNote((current) =>
                    current
                      ? { ...current, content: event.target.value }
                      : current,
                  )
                }
                className="scrollbar-thin h-full min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-[var(--space-5)] py-[var(--space-5)] text-[15px] leading-8 shadow-none focus-visible:ring-0 placeholder:text-[color-mix(in_srgb,var(--muted-foreground)_52%,transparent)]"
                placeholder="写点什么"
              />
            </section>
          ) : (
            <section className="flex min-h-0 flex-1 items-center justify-center p-[var(--space-5)]">
              <div className="w-full max-w-xl rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--border)_88%,transparent)] bg-[color-mix(in_srgb,var(--card)_16%,transparent)] p-[var(--space-5)]">
                <p className="text-ui-xs uppercase tracking-[0.26em] text-[var(--muted-foreground)]">
                  Ready
                </p>
                <h3 className="mt-[var(--space-3)] text-2xl font-semibold tracking-tight">
                  选一篇笔记，或者新建一篇
                </h3>
                <p className="text-ui-md mt-[var(--space-4)] leading-7 text-[var(--muted-foreground)]">
                  左侧读取所选目录里的 `.md` 文件，右侧直接编辑原始 Markdown
                  文本。
                </p>
                <Button
                  className="mt-[var(--space-5)] gap-[var(--space-2)]"
                  onClick={createNote}
                >
                  <Plus className="h-4 w-4" />
                  新建笔记
                </Button>
              </div>
            </section>
          )}

          {errorMessage ? (
            <div className="text-ui-xs border-t border-[color-mix(in_srgb,var(--border)_80%,transparent)] px-[var(--space-4)] py-[var(--space-2)] text-right text-[var(--destructive)]">
              {errorMessage}
            </div>
          ) : null}
        </main>
      </div>

      {contextMenu ? (
        <NoteContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => {
            const targetNote = notes.find(
              (note) => note.basename === contextMenu.basename,
            );
            setContextMenu(null);
            if (targetNote) {
              confirmDeleteNotes([targetNote.basename]);
            }
          }}
        />
      ) : null}

      {pendingDelete ? (
        <DeleteNoteDialog
          title={pendingDelete.title}
          message={pendingDelete.message}
          confirmLabel={pendingDelete.confirmLabel}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const targetBasenames = pendingDelete.basenames;
            setPendingDelete(null);
            void deleteNotesByBasenames(targetBasenames);
          }}
        />
      ) : null}
    </div>
  );
}
