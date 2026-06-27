import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AudioClip, Folder, Note, Reminder, SortMode, ViewId } from '../types';

const NOTES_KEY = 'bloknot.notes.v1';
const FOLDERS_KEY = 'bloknot.folders.v1';

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_FOLDERS: Folder[] = [
  { id: 'f-personal', name: 'Личное', emoji: '🏠' },
  { id: 'f-work', name: 'Работа', emoji: '💼' },
  { id: 'f-ideas', name: 'Идеи', emoji: '💡' },
];

function welcomeNotes(): Note[] {
  const now = Date.now();
  return [
    {
      id: uid(),
      title: 'Добро пожаловать в Блокнот 👋',
      content:
        '<p>Это ваш новый дом для мыслей. Несколько подсказок:</p><ul><li>Нажмите <b>＋</b>, чтобы создать текстовую заметку</li><li>Нажмите <b>микрофон</b> — голос превратится в текст автоматически</li><li>Закрепляйте важное 📌 и добавляйте в избранное ⭐</li><li>Установите <b>напоминание 🔔</b> чтобы не забыть о важном</li></ul><p>Удалённые заметки 30 дней хранятся в корзине.</p>',
      folderId: 'f-personal',
      tags: ['советы'],
      pinned: true,
      favorite: false,
      archived: false,
      deletedAt: null,
      audios: [],
      reminder: null,
      createdAt: now - 86400000,
      updatedAt: now - 86400000,
    },
    {
      id: uid(),
      title: 'Список покупок',
      content:
        '<div class="todo"><input type="checkbox" checked><span>Кофе в зёрнах</span></div><div class="todo"><input type="checkbox"><span>Овсяное молоко</span></div><div class="todo"><input type="checkbox"><span>Авокадо</span></div><div class="todo"><input type="checkbox"><span>Хлеб на закваске</span></div>',
      folderId: 'f-personal',
      tags: ['покупки'],
      pinned: false,
      favorite: true,
      archived: false,
      deletedAt: null,
      audios: [],
      reminder: null,
      createdAt: now - 3600000,
      updatedAt: now - 3600000,
    },
  ];
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useNotesStore() {
  const [notes, setNotes] = useState<Note[]>(() =>
    // Мигрируем старые заметки — добавляем поле reminder если его нет
    load<Note[]>(NOTES_KEY, welcomeNotes()).map(n => ({
      reminder: null,
      ...n,
    }))
  );
  const [folders, setFolders] = useState<Folder[]>(() =>
    load<Folder[]>(FOLDERS_KEY, DEFAULT_FOLDERS)
  );

  useEffect(() => {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch {}
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }, [folders]);

  // Автоочистка корзины (старше 30 дней)
  useEffect(() => {
    const cutoff = Date.now() - 30 * 86400000;
    setNotes(ns =>
      ns.filter(n => n.deletedAt === null || n.deletedAt > cutoff)
    );
  }, []);

  const createNote = useCallback((partial?: Partial<Note>): Note => {
    const now = Date.now();
    const note: Note = {
      id: uid(),
      title: '',
      content: '',
      folderId: null,
      tags: [],
      pinned: false,
      favorite: false,
      archived: false,
      deletedAt: null,
      audios: [],
      reminder: null,
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
    setNotes(ns => [note, ...ns]);
    return note;
  }, []);

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes(ns =>
      ns.map(n => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))
    );
  }, []);

  const toggleFlag = useCallback(
    (id: string, key: 'pinned' | 'favorite' | 'archived') => {
      setNotes(ns =>
        ns.map(n => (n.id === id ? { ...n, [key]: !n[key] } : n))
      );
    },
    []
  );

  const setReminder = useCallback((id: string, reminder: Reminder | null) => {
    setNotes(ns =>
      ns.map(n => (n.id === id ? { ...n, reminder } : n))
    );
  }, []);

  const markReminderFired = useCallback((id: string) => {
    setNotes(ns =>
      ns.map(n =>
        n.id === id && n.reminder
          ? { ...n, reminder: { ...n.reminder, fired: true } }
          : n
      )
    );
  }, []);

  const rescheduleReminder = useCallback((id: string, nextAt: number) => {
    setNotes(ns =>
      ns.map(n =>
        n.id === id && n.reminder
          ? { ...n, reminder: { ...n.reminder, at: nextAt } }
          : n
      )
    );
  }, []);

  const moveToTrash = useCallback((id: string) => {
    setNotes(ns =>
      ns.map(n =>
        n.id === id ? { ...n, deletedAt: Date.now(), pinned: false } : n
      )
    );
  }, []);

  const restoreNote = useCallback((id: string) => {
    setNotes(ns =>
      ns.map(n => (n.id === id ? { ...n, deletedAt: null } : n))
    );
  }, []);

  const deleteForever = useCallback((id: string) => {
    setNotes(ns => ns.filter(n => n.id !== id));
  }, []);

  const emptyTrash = useCallback(() => {
    setNotes(ns => ns.filter(n => n.deletedAt === null));
  }, []);

  const addAudio = useCallback((noteId: string, clip: AudioClip) => {
    setNotes(ns =>
      ns.map(n =>
        n.id === noteId
          ? { ...n, audios: [...n.audios, clip], updatedAt: Date.now() }
          : n
      )
    );
  }, []);

  const removeAudio = useCallback((noteId: string, clipId: string) => {
    setNotes(ns =>
      ns.map(n =>
        n.id === noteId
          ? { ...n, audios: n.audios.filter(a => a.id !== clipId), updatedAt: Date.now() }
          : n
      )
    );
  }, []);

  const createFolder = useCallback((name: string, emoji = '📁') => {
    const folder: Folder = { id: uid(), name, emoji };
    setFolders(fs => [...fs, folder]);
    return folder;
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders(fs => fs.filter(f => f.id !== id));
    setNotes(ns =>
      ns.map(n => (n.folderId === id ? { ...n, folderId: null } : n))
    );
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => {
      if (!n.deletedAt) n.tags.forEach(t => set.add(t));
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [notes]);

  // Заметки с активными напоминаниями
  const remindersCount = useMemo(
    () => notes.filter(n => n.reminder && !n.reminder.fired && !n.deletedAt).length,
    [notes]
  );

  return {
    notes,
    folders,
    allTags,
    remindersCount,
    createNote,
    updateNote,
    toggleFlag,
    setReminder,
    markReminderFired,
    rescheduleReminder,
    moveToTrash,
    restoreNote,
    deleteForever,
    emptyTrash,
    addAudio,
    removeAudio,
    createFolder,
    deleteFolder,
  };
}

export type NotesStore = ReturnType<typeof useNotesStore>;

export function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

export function filterNotes(
  notes: Note[],
  view: ViewId,
  query: string,
  sort: SortMode
): Note[] {
  let list = notes.filter(n => {
    if (view.kind === 'trash') return n.deletedAt !== null;
    if (n.deletedAt !== null) return false;
    if (view.kind === 'archive') return n.archived;
    if (n.archived) return false;
    if (view.kind === 'favorites') return n.favorite;
    if (view.kind === 'reminders') return n.reminder && !n.reminder.fired;
    if (view.kind === 'folder') return n.folderId === view.folderId;
    if (view.kind === 'tag') return n.tags.includes(view.tag);
    return true;
  });

  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(n => {
      const haystack = [
        n.title,
        stripHtml(n.content),
        ...n.tags,
        ...n.audios.map(a => a.transcript),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  const cmp: Record<SortMode, (a: Note, b: Note) => number> = {
    updated: (a, b) => b.updatedAt - a.updatedAt,
    created: (a, b) => b.createdAt - a.createdAt,
    title: (a, b) =>
      (a.title || 'Без названия').localeCompare(b.title || 'Без названия', 'ru'),
  };
  list.sort(cmp[sort]);

  if (view.kind !== 'trash') {
    list.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }
  return list;
}
