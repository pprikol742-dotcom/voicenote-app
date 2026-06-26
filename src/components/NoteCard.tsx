import { motion } from "framer-motion";
import { Mic, Pin, RotateCcw, Star, Trash2 } from "lucide-react";
import type { Folder, Note } from "../types";
import { stripHtml } from "../store/useNotesStore";
import { cn } from "../utils/cn";

interface Props {
  note: Note;
  folder?: Folder;
  active: boolean;
  inTrash: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onToggleFavorite: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay)
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export default function NoteCard({
  note,
  folder,
  active,
  inTrash,
  onSelect,
  onTogglePin,
  onToggleFavorite,
  onRestore,
  onDeleteForever,
}: Props) {
  const preview =
    stripHtml(note.content).slice(0, 140) ||
    note.audios[0]?.transcript.slice(0, 140) ||
    "Пустая заметка";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      aria-label={note.title || "Без названия"}
      className={cn(
        "group cursor-pointer rounded-2xl border p-3.5 transition-all",
        active
          ? "border-accent-400 bg-accent-50 shadow-md shadow-accent-500/10 dark:border-accent-500/60 dark:bg-accent-600/10"
          : "border-ink-150 border-ink-200/70 bg-white hover:border-accent-300 hover:shadow-md hover:shadow-ink-900/5 dark:border-ink-800 dark:bg-ink-850 dark:hover:border-accent-600/40"
      )}
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-ink-900 dark:text-ink-50">
          {note.pinned && (
            <Pin className="mr-1 inline size-3.5 -rotate-45 text-accent-600 dark:text-accent-400" fill="currentColor" />
          )}
          {note.title || "Без названия"}
        </h3>

        {!inTrash ? (
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              aria-label={note.pinned ? "Открепить" : "Закрепить"}
              className={cn(
                "rounded-md p-1 transition-colors",
                note.pinned
                  ? "text-accent-600"
                  : "text-ink-300 hover:text-accent-600"
              )}
            >
              <Pin className="size-3.5" fill={note.pinned ? "currentColor" : "none"} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              aria-label={note.favorite ? "Убрать из избранного" : "В избранное"}
              className={cn(
                "rounded-md p-1 transition-colors",
                note.favorite
                  ? "text-amber-500"
                  : "text-ink-300 hover:text-amber-500"
              )}
            >
              <Star className="size-3.5" fill={note.favorite ? "currentColor" : "none"} />
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              aria-label="Восстановить"
              className="rounded-md p-1 text-ink-300 hover:text-emerald-500 transition-colors"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteForever();
              }}
              aria-label="Удалить навсегда"
              className="rounded-md p-1 text-ink-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
        {note.favorite && !inTrash && (
          <Star className="size-3.5 shrink-0 text-amber-500 group-hover:hidden" fill="currentColor" />
        )}
      </div>

      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-500 dark:text-ink-400">
        {preview}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
        <span className="tabular-nums">{fmtDate(note.updatedAt)}</span>
        {note.audios.length > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-100 dark:bg-accent-600/20 px-1.5 py-0.5 font-semibold text-accent-700 dark:text-accent-300">
            <Mic className="size-3" />
            {note.audios.length}
          </span>
        )}
        {folder && (
          <span className="rounded-full bg-ink-100 dark:bg-ink-800 px-1.5 py-0.5 font-medium">
            {folder.emoji} {folder.name}
          </span>
        )}
        {note.tags.slice(0, 3).map((t) => (
          <span key={t} className="font-semibold text-accent-600/80 dark:text-accent-400/80">
            #{t}
          </span>
        ))}
      </div>
    </motion.article>
  );
}
