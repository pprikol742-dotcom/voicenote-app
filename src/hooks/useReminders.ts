/**
 * Хук для управления напоминаниями через Web Notifications API
 * Проверяет напоминания каждые 30 секунд
 */
import { useCallback, useEffect } from 'react';
import type { Note } from '../types';

export type NotifPermission = 'default' | 'granted' | 'denied';

/** Запросить разрешение на уведомления */
export async function requestNotifPermission(): Promise<NotifPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission() as NotifPermission;
}

export function notifSupported(): boolean {
  return 'Notification' in window;
}

/**
 * Показать уведомление для заметки
 */
function fireNotification(note: Note) {
  if (Notification.permission !== 'granted') return;

  const title = note.title || 'Напоминание';
  const body = note.content
    ? note.content.replace(/<[^>]+>/g, '').slice(0, 100)
    : 'Голосовая заметка';

  const notif = new Notification(`🔔 ${title}`, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `reminder-${note.id}`,
    requireInteraction: false,
  });

  notif.onclick = () => {
    window.focus();
    notif.close();
  };

  // Автозакрытие через 8 секунд
  setTimeout(() => notif.close(), 8000);
}

/**
 * Хук — принимает заметки и колбэк для обновления reminder.fired
 * Проверяет каждые 30 секунд есть ли просроченные напоминания
 */
export function useReminders(
  notes: Note[],
  onFired: (noteId: string) => void,
  onReschedule: (noteId: string, nextAt: number) => void,
) {
  const check = useCallback(() => {
    const now = Date.now();
    notes.forEach(note => {
      const r = note.reminder;
      if (!r || r.fired || note.deletedAt) return;
      if (r.at > now) return;

      // Сработало!
      fireNotification(note);

      if (r.repeat === 'none') {
        onFired(note.id);
      } else {
        // Переносим на следующий период
        const delta = r.repeat === 'daily' ? 86400000 : 604800000;
        let next = r.at + delta;
        // Если очень просрочено — ставим от текущего момента
        while (next < now) next += delta;
        onReschedule(note.id, next);
      }
    });
  }, [notes, onFired, onReschedule]);

  useEffect(() => {
    check(); // сразу при монтировании
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [check]);
}
