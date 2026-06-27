import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellOff, Check, Clock, RefreshCw, Trash2, X } from 'lucide-react';
import type { Reminder } from '../types';
import { cn } from '../utils/cn';
import { notifSupported, requestNotifPermission } from '../hooks/useReminders';

interface Props {
  open: boolean;
  reminder: Reminder | null;
  onSave: (reminder: Reminder | null) => void;
  onClose: () => void;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalDatetimeValue(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nearestFuture(minutesAhead = 60): string {
  const d = new Date(Date.now() + minutesAhead * 60000);
  d.setSeconds(0, 0);
  return toLocalDatetimeValue(d.getTime());
}

export default function ReminderModal({ open, reminder, onSave, onClose }: Props) {
  const [datetime, setDatetime] = useState<string>(
    reminder && !reminder.fired ? toLocalDatetimeValue(reminder.at) : nearestFuture()
  );
  const [repeat, setRepeat] = useState<Reminder['repeat']>(reminder?.repeat ?? 'none');
  const [permError, setPermError] = useState(false);

  const hasReminder = reminder && !reminder.fired;

  const handleSave = async () => {
    if (!notifSupported()) {
      setPermError(true);
      return;
    }
    const perm = await requestNotifPermission();
    if (perm !== 'granted') {
      setPermError(true);
      return;
    }

    const at = new Date(datetime).getTime();
    if (isNaN(at) || at <= Date.now()) {
      alert('Выберите время в будущем');
      return;
    }

    onSave({ at, repeat, fired: false });
    onClose();
  };

  const handleRemove = () => {
    onSave(null);
    onClose();
  };

  // Быстрые варианты времени
  const quickOptions = [
    { label: 'Через 1 час', minutes: 60 },
    { label: 'Через 3 часа', minutes: 180 },
    { label: 'Завтра утром', minutes: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return Math.round((d.getTime() - Date.now()) / 60000);
    })() },
    { label: 'В эту неделю', minutes: (() => {
      const d = new Date();
      const day = d.getDay();
      const daysUntilMon = day === 0 ? 1 : 8 - day;
      d.setDate(d.getDate() + daysUntilMon);
      d.setHours(9, 0, 0, 0);
      return Math.round((d.getTime() - Date.now()) / 60000);
    })() },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-ink-900 p-6 shadow-2xl border border-ink-100 dark:border-ink-800"
          >
            {/* Заголовок */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="size-5 text-accent-500" />
                <h2 className="font-bold text-ink-900 dark:text-ink-50">Напоминание</h2>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800">
                <X className="size-4" />
              </button>
            </div>

            {/* Текущее напоминание */}
            {hasReminder && (
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-accent-50 dark:bg-accent-600/10 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-accent-600 dark:text-accent-400">Активное напоминание</p>
                  <p className="text-sm font-bold text-ink-800 dark:text-ink-100">
                    {new Date(reminder.at).toLocaleString('ru-RU', {
                      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                  {reminder.repeat !== 'none' && (
                    <p className="text-xs text-accent-500 mt-0.5">
                      🔄 {reminder.repeat === 'daily' ? 'Каждый день' : 'Каждую неделю'}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleRemove}
                  className="rounded-xl p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}

            {/* Быстрые варианты */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              {quickOptions.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setDatetime(nearestFuture(opt.minutes))}
                  className="rounded-xl border border-ink-200 dark:border-ink-700 px-3 py-2 text-xs font-semibold text-ink-600 dark:text-ink-300 hover:border-accent-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors text-left"
                >
                  <Clock className="size-3 mb-1" />
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Дата и время */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-ink-500">
                Дата и время
              </label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={e => setDatetime(e.target.value)}
                className="w-full rounded-2xl border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800 px-4 py-2.5 text-sm text-ink-800 dark:text-ink-100 outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
              />
            </div>

            {/* Повтор */}
            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-semibold text-ink-500">
                Повтор
              </label>
              <div className="flex gap-2">
                {(['none', 'daily', 'weekly'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setRepeat(r)}
                    className={cn(
                      'flex-1 rounded-xl py-2 text-xs font-semibold transition-all border',
                      repeat === r
                        ? 'bg-accent-500 text-white border-accent-500'
                        : 'border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400 hover:border-accent-400'
                    )}
                  >
                    {r === 'none' && <><BellOff className="size-3 inline mr-1" />Нет</>}
                    {r === 'daily' && <><RefreshCw className="size-3 inline mr-1" />Ежедневно</>}
                    {r === 'weekly' && <><RefreshCw className="size-3 inline mr-1" />Еженедельно</>}
                  </button>
                ))}
              </div>
            </div>

            {/* Ошибка разрешений */}
            {permError && (
              <p className="mb-3 rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
                Разрешите уведомления в настройках браузера чтобы получать напоминания
              </p>
            )}

            {/* Кнопки */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-2xl border border-ink-200 dark:border-ink-700 py-3 text-sm font-semibold text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-700 py-3 text-sm font-semibold text-white shadow-md shadow-accent-600/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Check className="size-4" />
                {hasReminder ? 'Обновить' : 'Установить'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
