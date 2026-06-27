import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Archive, ArchiveRestore, Bell, BellOff, Bold, CheckSquare,
  Download, FolderOpen, Heading1, Heading2, Italic, List,
  ListOrdered, Pin, Quote, Share2, Star, Trash2, Underline, X,
} from 'lucide-react';
import type { Folder, Note, Reminder } from '../types';
import { stripHtml } from '../store/useNotesStore';
import AudioPlayer from './AudioPlayer';
import ReminderModal from './ReminderModal';
import { cn } from '../utils/cn';

interface Props {
  note: Note;
  folders: Folder[];
  onPatch: (patch: Partial<Note>) => void;
  onToggleFlag: (key: 'pinned' | 'favorite' | 'archived') => void;
  onSetReminder: (reminder: Reminder | null) => void;
  onDelete: () => void;
  onRemoveAudio: (clipId: string) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

function ToolBtn({ onClick, label, children }: {
  onClick: () => void; label: string; children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-accent-600 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-accent-400 transition-colors"
    >
      {children}
    </button>
  );
}

export default function NoteEditor({
  note, folders, onPatch, onToggleFlag, onSetReminder,
  onDelete, onRemoveAudio, onClose, onToast,
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const lastNoteId = useRef<string | null>(null);

  useEffect(() => {
    if (lastNoteId.current !== note.id && editorRef.current) {
      editorRef.current.innerHTML = note.content;
      lastNoteId.current = note.id;
    }
  }, [note.id, note.content]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncContent();
  };

  const insertChecklist = () => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false,
      '<div class="todo"><input type="checkbox"><span>&nbsp;Пункт</span></div>');
    syncContent();
  };

  const syncContent = () => {
    if (editorRef.current) onPatch({ content: editorRef.current.innerHTML });
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      if (target.checked) target.setAttribute('checked', '');
      else target.removeAttribute('checked');
      syncContent();
    }
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (t && !note.tags.includes(t)) onPatch({ tags: [...note.tags, t] });
    setTagInput('');
  };

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
    onToast('Файл сохранён 📄');
  };

  const asMarkdown = () => {
    const text = stripHtml(note.content);
    const audios = note.audios
      .map((a, i) => `> 🎙 Голосовая заметка ${i + 1}: ${a.transcript || '(без расшифровки)'}`)
      .join('\n\n');
    return `# ${note.title || 'Без названия'}\n\n${text}\n\n${audios}`.trim();
  };

  const share = async () => {
    const text = `${note.title || 'Заметка'}\n\n${stripHtml(note.content)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: note.title || 'Заметка', text });
      } else {
        await navigator.clipboard.writeText(text);
        onToast('Скопировано в буфер обмена 📋');
      }
    } catch {}
  };

  const hasReminder = note.reminder && !note.reminder.fired;

  return (
    <motion.div
      key={note.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col bg-white dark:bg-ink-900"
    >
      {/* Верхняя панель */}
      <header className="glass sticky top-0 z-10 flex items-center gap-1 border-b border-ink-100 dark:border-ink-800 px-3 py-2">
        <button
          onClick={onClose}
          aria-label="Назад к списку"
          className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 lg:hidden"
        >
          <X className="size-5" />
        </button>

        <span className="hidden text-xs text-ink-400 sm:block px-2">
          Изменено{' '}
          {new Date(note.updatedAt).toLocaleString('ru-RU', {
            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
          })}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <ToolBtn onClick={() => onToggleFlag('pinned')} label={note.pinned ? 'Открепить' : 'Закрепить'}>
            <Pin className={cn('size-4.5 -rotate-45', note.pinned && 'text-accent-600')} fill={note.pinned ? 'currentColor' : 'none'} />
          </ToolBtn>
          <ToolBtn onClick={() => onToggleFlag('favorite')} label={note.favorite ? 'Убрать из избранного' : 'В избранное'}>
            <Star className={cn('size-4.5', note.favorite && 'text-amber-500')} fill={note.favorite ? 'currentColor' : 'none'} />
          </ToolBtn>

          {/* Кнопка напоминания */}
          <ToolBtn onClick={() => setReminderOpen(true)} label={hasReminder ? 'Изменить напоминание' : 'Добавить напоминание'}>
            {hasReminder
              ? <Bell className="size-4.5 text-accent-500" fill="currentColor" />
              : <BellOff className="size-4.5" />
            }
          </ToolBtn>

          <ToolBtn
            onClick={() => {
              onToggleFlag('archived');
              onToast(note.archived ? 'Возвращено из архива' : 'Перемещено в архив 🗄');
            }}
            label={note.archived ? 'Из архива' : 'В архив'}
          >
            {note.archived ? <ArchiveRestore className="size-4.5" /> : <Archive className="size-4.5" />}
          </ToolBtn>
          <ToolBtn onClick={share} label="Поделиться"><Share2 className="size-4.5" /></ToolBtn>

          <div className="relative">
            <ToolBtn onClick={() => setShowExport(s => !s)} label="Экспорт">
              <Download className="size-4.5" />
            </ToolBtn>
            {showExport && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-ink-100 dark:border-ink-700 bg-white dark:bg-ink-800 shadow-xl"
              >
                {[
                  { label: 'Markdown (.md)', fn: () => download(`${note.title || 'заметка'}.md`, asMarkdown(), 'text/markdown') },
                  { label: 'Текст (.txt)', fn: () => download(`${note.title || 'заметка'}.txt`, `${note.title}\n\n${stripHtml(note.content)}`, 'text/plain') },
                  { label: 'PDF (печать)', fn: () => { setShowExport(false); window.print(); } },
                ].map(o => (
                  <button key={o.label} onClick={o.fn}
                    className="block w-full px-3.5 py-2.5 text-left text-sm font-medium text-ink-700 dark:text-ink-200 hover:bg-accent-50 dark:hover:bg-ink-700 transition-colors">
                    {o.label}
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          <ToolBtn onClick={() => { onDelete(); onToast('Заметка перемещена в корзину 🗑'); }} label="В корзину">
            <Trash2 className="size-4.5 hover:text-red-500" />
          </ToolBtn>
        </div>
      </header>

      {/* Баннер активного напоминания */}
      {hasReminder && (
        <div
          onClick={() => setReminderOpen(true)}
          className="mx-4 mt-3 flex cursor-pointer items-center gap-2 rounded-2xl bg-accent-50 dark:bg-accent-600/10 px-4 py-2.5 border border-accent-200 dark:border-accent-600/30"
        >
          <Bell className="size-4 text-accent-500 shrink-0" />
          <span className="text-xs font-semibold text-accent-700 dark:text-accent-300">
            🔔 {new Date(note.reminder!.at).toLocaleString('ru-RU', {
              day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
            })}
            {note.reminder!.repeat !== 'none' && (
              <span className="ml-2 opacity-70">
                · {note.reminder!.repeat === 'daily' ? 'каждый день' : 'каждую неделю'}
              </span>
            )}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
          {/* Заголовок */}
          <input
            value={note.title}
            onChange={e => onPatch({ title: e.target.value })}
            placeholder="Заголовок заметки…"
            aria-label="Заголовок заметки"
            className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900 dark:text-ink-50 outline-none placeholder:text-ink-300 dark:placeholder:text-ink-600"
          />

          {/* Папка + теги */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative inline-flex items-center gap-1.5 rounded-full bg-ink-100 dark:bg-ink-800 pl-2.5 pr-1 py-1 text-xs font-semibold text-ink-600 dark:text-ink-300">
              <FolderOpen className="size-3.5 text-accent-500" />
              <select
                value={note.folderId ?? ''}
                onChange={e => onPatch({ folderId: e.target.value || null })}
                aria-label="Папка"
                className="cursor-pointer appearance-none bg-transparent pr-1 outline-none"
              >
                <option value="">Без папки</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>
                ))}
              </select>
            </div>

            {note.tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent-100 dark:bg-accent-600/20 px-2.5 py-1 text-xs font-semibold text-accent-700 dark:text-accent-300">
                #{t}
                <button onClick={() => onPatch({ tags: note.tags.filter(x => x !== t) })} aria-label={`Удалить тег ${t}`} className="hover:text-red-500">
                  <X className="size-3" />
                </button>
              </span>
            ))}

            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
              onBlur={() => tagInput && addTag()}
              placeholder="+ тег"
              aria-label="Добавить тег"
              className="w-20 bg-transparent px-1 py-1 text-xs font-medium text-ink-600 dark:text-ink-300 outline-none placeholder:text-ink-400"
            />
          </div>

          {/* Панель форматирования */}
          <div className="sticky top-0 z-[5] mt-4 flex flex-wrap items-center gap-0.5 rounded-2xl border border-ink-100 dark:border-ink-800 bg-white/90 dark:bg-ink-900/90 backdrop-blur p-1 shadow-sm" role="toolbar" aria-label="Форматирование">
            <ToolBtn onClick={() => exec('bold')} label="Жирный"><Bold className="size-4" /></ToolBtn>
            <ToolBtn onClick={() => exec('italic')} label="Курсив"><Italic className="size-4" /></ToolBtn>
            <ToolBtn onClick={() => exec('underline')} label="Подчёркнутый"><Underline className="size-4" /></ToolBtn>
            <span className="mx-1 h-5 w-px bg-ink-200 dark:bg-ink-700" />
            <ToolBtn onClick={() => exec('formatBlock', 'h1')} label="Заголовок 1"><Heading1 className="size-4" /></ToolBtn>
            <ToolBtn onClick={() => exec('formatBlock', 'h2')} label="Заголовок 2"><Heading2 className="size-4" /></ToolBtn>
            <ToolBtn onClick={() => exec('formatBlock', 'blockquote')} label="Цитата"><Quote className="size-4" /></ToolBtn>
            <span className="mx-1 h-5 w-px bg-ink-200 dark:bg-ink-700" />
            <ToolBtn onClick={() => exec('insertUnorderedList')} label="Список"><List className="size-4" /></ToolBtn>
            <ToolBtn onClick={() => exec('insertOrderedList')} label="Нумерованный список"><ListOrdered className="size-4" /></ToolBtn>
            <ToolBtn onClick={insertChecklist} label="Чек-лист"><CheckSquare className="size-4" /></ToolBtn>
          </div>

          {/* Голосовые записи */}
          {note.audios.length > 0 && (
            <div className="mt-4 space-y-2.5">
              {note.audios.map(clip => (
                <AudioPlayer key={clip.id} clip={clip} onDelete={() => onRemoveAudio(clip.id)} />
              ))}
            </div>
          )}

          {/* Редактор */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Текст заметки"
            data-placeholder="Начните писать… или нажмите на микрофон, чтобы надиктовать 🎙"
            className="note-editor mt-4 min-h-[40vh] pb-28 text-ink-800 dark:text-ink-100"
            onInput={syncContent}
            onClick={handleEditorClick}
          />
        </div>
      </div>

      {/* Модал напоминания */}
      <ReminderModal
        open={reminderOpen}
        reminder={note.reminder}
        onSave={r => {
          onSetReminder(r);
          onToast(r ? 'Напоминание установлено 🔔' : 'Напоминание удалено');
        }}
        onClose={() => setReminderOpen(false)}
      />
    </motion.div>
  );
}
