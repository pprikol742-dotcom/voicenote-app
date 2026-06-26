import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownWideNarrow,
  Menu,
  Mic,
  NotebookPen,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { SortMode, ThemeMode, ViewId } from "./types";
import { filterNotes, uid, useNotesStore } from "./store/useNotesStore";
import type { RecordingResult } from "./hooks/useVoiceRecorder";
import Sidebar from "./components/Sidebar";
import NoteCard from "./components/NoteCard";
import NoteEditor from "./components/NoteEditor";
import RecorderModal from "./components/RecorderModal";
import { cn } from "./utils/cn";

/* ---------- Тема ---------- */
function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(
    () => (localStorage.getItem("bloknot.theme") as ThemeMode) || "system"
  );
  useEffect(() => {
    localStorage.setItem("bloknot.theme", theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return { theme, setTheme };
}

const VIEW_TITLES: Record<string, string> = {
  all: "Все заметки",
  favorites: "Избранное",
  archive: "Архив",
  trash: "Корзина",
};

const SORT_LABELS: Record<SortMode, string> = {
  updated: "По изменению",
  created: "По созданию",
  title: "По названию",
};

export default function App() {
  const store = useNotesStore();
  const { theme, setTheme } = useTheme();

  const [view, setView] = useState<ViewId>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("updated");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Skeleton-загрузка при первом запуске
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(t);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const visible = useMemo(
    () => filterNotes(store.notes, view, query, sort),
    [store.notes, view, query, sort]
  );

  const selected = store.notes.find((n) => n.id === selectedId) ?? null;
  const inTrash = view.kind === "trash";

  const viewTitle =
    view.kind === "folder"
      ? store.folders.find((f) => f.id === view.folderId)?.name ?? "Папка"
      : view.kind === "tag"
        ? `#${view.tag}`
        : VIEW_TITLES[view.kind];

  /* ---------- Действия ---------- */
  const handleCreate = () => {
    const note = store.createNote({
      folderId: view.kind === "folder" ? view.folderId : null,
      tags: view.kind === "tag" ? [view.tag] : [],
      favorite: view.kind === "favorites",
    });
    if (view.kind === "archive" || view.kind === "trash") setView({ kind: "all" });
    setSelectedId(note.id);
  };

  const handleVoiceSave = (result: RecordingResult) => {
    const clip = {
      id: uid(),
      dataUrl: result.dataUrl,
      duration: result.duration,
      transcript: result.transcript,
      createdAt: Date.now(),
    };
    if (selected && !selected.deletedAt) {
      store.addAudio(selected.id, clip);
      showToast("Запись добавлена в заметку 🎙");
    } else {
      const title = result.transcript
        ? result.transcript.split(" ").slice(0, 6).join(" ")
        : "Голосовая заметка";
      const note = store.createNote({
        title,
        content: result.transcript ? `<p>${result.transcript}</p>` : "",
        audios: [clip],
        folderId: view.kind === "folder" ? view.folderId : null,
      });
      setSelectedId(note.id);
      showToast("Голосовая заметка создана 🎙");
    }
  };

  // Горячая клавиша: Ctrl/Cmd+N — новая заметка
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleCreate();
      }
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <div className="flex h-dvh overflow-hidden bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-ink-100">
      {/* ===== Sidebar (desktop) ===== */}
      <aside className="hidden w-64 shrink-0 border-r border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 lg:block">
        <Sidebar
          view={view}
          onView={(v) => {
            setView(v);
            setSelectedId(null);
          }}
          folders={store.folders}
          tags={store.allTags}
          notes={store.notes}
          theme={theme}
          onTheme={setTheme}
          onCreateFolder={(name) => store.createFolder(name)}
          onDeleteFolder={store.deleteFolder}
        />
      </aside>

      {/* ===== Sidebar (mobile drawer) ===== */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -290 }}
              animate={{ x: 0 }}
              exit={{ x: -290 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-ink-900 shadow-2xl lg:hidden"
            >
              <Sidebar
                view={view}
                onView={(v) => {
                  setView(v);
                  setSelectedId(null);
                }}
                folders={store.folders}
                tags={store.allTags}
                notes={store.notes}
                theme={theme}
                onTheme={setTheme}
                onCreateFolder={(name) => store.createFolder(name)}
                onDeleteFolder={store.deleteFolder}
                onCloseMobile={() => setSidebarOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ===== Список заметок ===== */}
      <section
        className={cn(
          "flex w-full shrink-0 flex-col border-r border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-950 md:w-[360px]",
          selected && "hidden md:flex"
        )}
        aria-label="Список заметок"
      >
        {/* Шапка списка */}
        <div className="space-y-3 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Открыть меню"
              className="rounded-xl p-2 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <h2 className="text-lg font-extrabold tracking-tight">{viewTitle}</h2>
            <span className="text-sm font-medium text-ink-400">{visible.length}</span>

            <div className="relative ml-auto">
              <button
                onClick={() => setSortMenuOpen((s) => !s)}
                aria-label="Сортировка"
                aria-expanded={sortMenuOpen}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              >
                <ArrowDownWideNarrow className="size-4" />
                <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
              </button>
              <AnimatePresence>
                {sortMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-ink-100 dark:border-ink-700 bg-white dark:bg-ink-800 shadow-xl"
                  >
                    {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setSort(m);
                          setSortMenuOpen(false);
                        }}
                        className={cn(
                          "block w-full px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent-50 dark:hover:bg-ink-700",
                          sort === m
                            ? "text-accent-600 dark:text-accent-400"
                            : "text-ink-600 dark:text-ink-300"
                        )}
                      >
                        {SORT_LABELS[m]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Поиск */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по заметкам и расшифровкам…"
              aria-label="Поиск"
              className="w-full rounded-2xl border border-ink-200/70 dark:border-ink-800 bg-white dark:bg-ink-900 py-2.5 pl-10 pr-9 text-sm outline-none transition-shadow placeholder:text-ink-400 focus:border-accent-400 focus:ring-4 focus:ring-accent-400/15"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Очистить поиск"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {inTrash && visible.length > 0 && (
            <button
              onClick={() => {
                store.emptyTrash();
                setSelectedId(null);
                showToast("Корзина очищена");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-500/30 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="size-4" /> Очистить корзину
            </button>
          )}
        </div>

        {/* Карточки */}
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-32">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-ink-100 dark:border-ink-800 p-3.5">
                <div className="skeleton h-4 w-2/3 rounded-md" />
                <div className="skeleton mt-2.5 h-3 w-full rounded-md" />
                <div className="skeleton mt-1.5 h-3 w-1/2 rounded-md" />
              </div>
            ))
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <div className="grid size-16 place-items-center rounded-3xl bg-accent-100 dark:bg-accent-600/15 text-accent-600 dark:text-accent-400">
                <NotebookPen className="size-7" />
              </div>
              <p className="mt-4 font-bold text-ink-700 dark:text-ink-200">
                {query ? "Ничего не найдено" : inTrash ? "Корзина пуста" : "Пока пусто"}
              </p>
              <p className="mt-1 max-w-[220px] text-sm text-ink-400">
                {query
                  ? "Попробуйте изменить запрос"
                  : inTrash
                    ? "Удалённые заметки появятся здесь"
                    : "Создайте первую заметку — текстом или голосом"}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {visible.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  folder={store.folders.find((f) => f.id === n.folderId)}
                  active={n.id === selectedId}
                  inTrash={inTrash}
                  onSelect={() => setSelectedId(n.id)}
                  onTogglePin={() => store.toggleFlag(n.id, "pinned")}
                  onToggleFavorite={() => store.toggleFlag(n.id, "favorite")}
                  onRestore={() => {
                    store.restoreNote(n.id);
                    showToast("Заметка восстановлена ✨");
                  }}
                  onDeleteForever={() => {
                    store.deleteForever(n.id);
                    if (selectedId === n.id) setSelectedId(null);
                  }}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* ===== Редактор ===== */}
      <main
        className={cn("min-w-0 flex-1 bg-white dark:bg-ink-900", !selected && "hidden md:block")}
      >
        {selected ? (
          <NoteEditor
            note={selected}
            folders={store.folders}
            onPatch={(patch) => store.updateNote(selected.id, patch)}
            onToggleFlag={(key) => store.toggleFlag(selected.id, key)}
            onDelete={() => {
              store.moveToTrash(selected.id);
              setSelectedId(null);
            }}
            onRemoveAudio={(clipId) => store.removeAudio(selected.id, clipId)}
            onClose={() => setSelectedId(null)}
            onToast={showToast}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="grid size-20 place-items-center rounded-[28px] bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-xl shadow-accent-600/25">
              <NotebookPen className="size-9" />
            </div>
            <h2 className="mt-6 text-xl font-extrabold tracking-tight">
              Выберите заметку
            </h2>
            <p className="mt-2 max-w-xs text-sm text-ink-400">
              …или создайте новую: <kbd className="rounded-md bg-ink-100 dark:bg-ink-800 px-1.5 py-0.5 text-xs font-bold">Ctrl&nbsp;N</kbd> для текста, кнопка с микрофоном — для голоса
            </p>
          </div>
        )}
      </main>

      {/* ===== FAB ===== */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setRecorderOpen(true)}
          aria-label="Записать голосовую заметку"
          className="grid size-13 h-13 w-13 place-items-center rounded-2xl bg-white dark:bg-ink-800 text-accent-600 dark:text-accent-400 shadow-lg shadow-ink-900/10 border border-ink-100 dark:border-ink-700"
        >
          <Mic className="size-5.5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={handleCreate}
          aria-label="Новая заметка"
          className="grid size-15 h-15 w-15 place-items-center rounded-[22px] bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-xl shadow-accent-600/40"
        >
          <Plus className="size-7" />
        </motion.button>
      </div>

      {/* ===== Запись голоса ===== */}
      <RecorderModal
        open={recorderOpen}
        onClose={() => setRecorderOpen(false)}
        onSave={handleVoiceSave}
      />

      {/* ===== Toast ===== */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            role="status"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-ink-900 dark:bg-ink-100 px-5 py-3 text-sm font-semibold text-white dark:text-ink-900 shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
