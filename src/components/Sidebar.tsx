import { useState } from "react";
import {
  Archive,
  Bell,
  FolderPlus,
  Hash,
  Moon,
  NotebookPen,
  Star,
  Sun,
  SunMoon,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Folder, Note, ThemeMode, ViewId } from "../types";
import { cn } from "../utils/cn";

interface Props {
  view: ViewId;
  onView: (v: ViewId) => void;
  folders: Folder[];
  tags: string[];
  notes: Note[];
  remindersCount: number;
  theme: ThemeMode;
  onTheme: (t: ThemeMode) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onCloseMobile?: () => void;
}

const viewEq = (a: ViewId, b: ViewId) =>
  a.kind === b.kind &&
  (a.kind !== "folder" || (b.kind === "folder" && a.folderId === b.folderId)) &&
  (a.kind !== "tag" || (b.kind === "tag" && a.tag === b.tag));

function Item({
  active,
  onClick,
  icon,
  label,
  count,
  trailing,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-accent-100 text-accent-700 dark:bg-accent-600/20 dark:text-accent-300"
          : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
      )}
    >
      <span className={cn("shrink-0", active && "text-accent-600 dark:text-accent-400")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {trailing}
      {count !== undefined && (
        <span className="text-xs tabular-nums text-ink-400">{count}</span>
      )}
    </button>
  );
}

export default function Sidebar({
  view,
  onView,
  folders,
  tags,
  notes,
  remindersCount,
  theme,
  onTheme,
  onCreateFolder,
  onDeleteFolder,
  onCloseMobile,
}: Props) {
  const [newFolder, setNewFolder] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);

  const active = notes.filter((n) => !n.deletedAt && !n.archived);
  const counts = {
    all: active.length,
    favorites: active.filter((n) => n.favorite).length,
    archive: notes.filter((n) => !n.deletedAt && n.archived).length,
    trash: notes.filter((n) => n.deletedAt).length,
  };

  const pick = (v: ViewId) => {
    onView(v);
    onCloseMobile?.();
  };

  const themeOptions: { mode: ThemeMode; icon: React.ReactNode; label: string }[] = [
    { mode: "light", icon: <Sun className="size-4" />, label: "Светлая" },
    { mode: "dark", icon: <Moon className="size-4" />, label: "Тёмная" },
    { mode: "system", icon: <SunMoon className="size-4" />, label: "Системная" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Логотип */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-md shadow-accent-600/30">
          <NotebookPen className="size-5" />
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-ink-900 dark:text-ink-50">
            Блокнот
          </h1>
          <p className="text-[11px] text-ink-400 -mt-0.5">заметки и голос</p>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Закрыть меню"
            className="ml-auto rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 lg:hidden"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Навигация">
        <Item
          active={viewEq(view, { kind: "all" })}
          onClick={() => pick({ kind: "all" })}
          icon={<NotebookPen className="size-4" />}
          label="Все заметки"
          count={counts.all}
        />
        <Item
          active={viewEq(view, { kind: "favorites" })}
          onClick={() => pick({ kind: "favorites" })}
          icon={<Star className="size-4" />}
          label="Избранное"
          count={counts.favorites}
        />
        <Item
          active={viewEq(view, { kind: "reminders" })}
          onClick={() => pick({ kind: "reminders" })}
          icon={<Bell className="size-4" />}
          label="Напоминания"
          count={remindersCount || undefined}
        />
        <Item
          active={viewEq(view, { kind: "archive" })}
          onClick={() => pick({ kind: "archive" })}
          icon={<Archive className="size-4" />}
          label="Архив"
          count={counts.archive}
        />
        <Item
          active={viewEq(view, { kind: "trash" })}
          onClick={() => pick({ kind: "trash" })}
          icon={<Trash2 className="size-4" />}
          label="Корзина"
          count={counts.trash}
        />

        {/* Папки */}
        <div className="flex items-center justify-between px-3 pt-5 pb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
            Папки
          </span>
          <button
            onClick={() => setAddingFolder((s) => !s)}
            aria-label="Новая папка"
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-accent-600 dark:hover:bg-ink-800 transition-colors"
          >
            <FolderPlus className="size-4" />
          </button>
        </div>

        {addingFolder && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (newFolder.trim()) {
                onCreateFolder(newFolder.trim());
                setNewFolder("");
                setAddingFolder(false);
              }
            }}
            className="px-1 pb-1"
          >
            <input
              autoFocus
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Название папки…"
              className="w-full rounded-xl border border-accent-300 dark:border-accent-600/50 bg-white dark:bg-ink-800 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent-400/40 text-ink-800 dark:text-ink-100"
            />
          </motion.form>
        )}

        {folders.map((f) => (
          <Item
            key={f.id}
            active={viewEq(view, { kind: "folder", folderId: f.id })}
            onClick={() => pick({ kind: "folder", folderId: f.id })}
            icon={<span className="text-sm leading-none">{f.emoji}</span>}
            label={f.name}
            count={active.filter((n) => n.folderId === f.id).length}
            trailing={
              <span
                role="button"
                tabIndex={0}
                aria-label={`Удалить папку ${f.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(f.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    onDeleteFolder(f.id);
                  }
                }}
                className="hidden rounded p-0.5 text-ink-300 hover:text-red-500 group-hover:block"
              >
                <X className="size-3.5" />
              </span>
            }
          />
        ))}

        {/* Теги */}
        {tags.length > 0 && (
          <>
            <div className="px-3 pt-5 pb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                Теги
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 px-2">
              {tags.map((t) => {
                const isActive = viewEq(view, { kind: "tag", tag: t });
                return (
                  <button
                    key={t}
                    onClick={() => pick({ kind: "tag", tag: t })}
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                      isActive
                        ? "bg-accent-600 text-white"
                        : "bg-ink-100 text-ink-500 hover:bg-accent-100 hover:text-accent-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-accent-600/20"
                    )}
                  >
                    <Hash className="size-3" />
                    {t}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Переключатель темы */}
      <div className="border-t border-ink-100 dark:border-ink-800 p-3">
        <div className="flex rounded-xl bg-ink-100 dark:bg-ink-800 p-1" role="radiogroup" aria-label="Тема оформления">
          {themeOptions.map((o) => (
            <button
              key={o.mode}
              role="radio"
              aria-checked={theme === o.mode}
              title={o.label}
              onClick={() => onTheme(o.mode)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
                theme === o.mode
                  ? "bg-white text-accent-700 shadow-sm dark:bg-ink-900 dark:text-accent-300"
                  : "text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
              )}
            >
              {o.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
