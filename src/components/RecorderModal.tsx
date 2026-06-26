import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, Mic, X, Zap } from 'lucide-react';
import {
  speechSupported,
  useVoiceRecorder,
  type RecordingResult,
} from '../hooks/useVoiceRecorder';
import { useWhisper } from '../hooks/useWhisper';
import { fmtTime } from './AudioPlayer';
import { cn } from '../utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (result: RecordingResult) => void;
}

type TranscribeMode = 'online' | 'offline';

export default function RecorderModal({ open, onClose, onSave }: Props) {
  const rec = useVoiceRecorder();
  const whisper = useWhisper();
  const [mode, setMode] = useState<TranscribeMode>('online');
  const [isProcessing, setIsProcessing] = useState(false);

  // Автостарт при открытии
  useEffect(() => {
    if (open) rec.start();
    else rec.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Предзагружаем модель при переключении на офлайн
  useEffect(() => {
    if (mode === 'offline' && whisper.status === 'idle') {
      whisper.preload();
    }
  }, [mode, whisper]);

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      const result = await rec.stop();
      if (!result) { onClose(); return; }

      // Если офлайн-режим и Whisper готов — транскрибируем через него
      if (mode === 'offline' && result.audioBlob.size > 0) {
        const offlineText = await whisper.transcribe(result.audioBlob);
        onSave({
          ...result,
          transcript: offlineText ?? result.transcript,
        });
      } else {
        onSave(result);
      }
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  const handleCancel = () => {
    rec.cancel();
    onClose();
  };

  const isLoading = whisper.status === 'loading';
  const isTranscribing = whisper.status === 'transcribing' || isProcessing;
  const canSave = rec.status === 'recording' && !isProcessing;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={handleCancel}
          role="dialog"
          aria-modal="true"
          aria-label="Запись голосовой заметки"
        >
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-ink-900 p-6 shadow-2xl border border-ink-100 dark:border-ink-800"
          >
            {/* Заголовок */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full bg-red-500" />
                </span>
                <h2 className="font-bold text-ink-900 dark:text-ink-50">
                  {isTranscribing
                    ? 'Расшифровка…'
                    : isLoading
                    ? 'Загрузка модели…'
                    : rec.status === 'recording'
                    ? 'Идёт запись…'
                    : rec.status === 'requesting'
                    ? 'Доступ к микрофону…'
                    : 'Запись'}
                </h2>
              </div>
              <span className="rounded-full bg-ink-100 dark:bg-ink-800 px-3 py-1 text-sm font-bold tabular-nums text-ink-700 dark:text-ink-200">
                {fmtTime(rec.elapsed)}
              </span>
            </div>

            {/* Переключатель режима транскрибации */}
            <div className="mb-4 flex rounded-2xl bg-ink-100 dark:bg-ink-800 p-1 gap-1">
              <button
                onClick={() => setMode('online')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all',
                  mode === 'online'
                    ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-ink-50 shadow-sm'
                    : 'text-ink-500 dark:text-ink-400'
                )}
              >
                <Zap className="size-3.5" />
                Онлайн (быстро)
              </button>
              <button
                onClick={() => setMode('offline')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all',
                  mode === 'offline'
                    ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-ink-50 shadow-sm'
                    : 'text-ink-500 dark:text-ink-400'
                )}
              >
                <Mic className="size-3.5" />
                Офлайн (Whisper)
              </button>
            </div>

            {/* Прогресс загрузки модели */}
            {mode === 'offline' && isLoading && (
              <div className="mb-3 rounded-2xl bg-accent-50 dark:bg-accent-600/10 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-accent-700 dark:text-accent-300">
                    Загрузка Whisper tiny (~40 МБ)
                  </span>
                  <span className="text-xs font-bold text-accent-600 dark:text-accent-400">
                    {whisper.loadProgress}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-accent-200 dark:bg-accent-700">
                  <motion.div
                    className="h-full rounded-full bg-accent-500"
                    animate={{ width: `${whisper.loadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                {whisper.loadFile && (
                  <p className="mt-1 text-[10px] text-accent-500 truncate">
                    {whisper.loadFile}
                  </p>
                )}
                <p className="mt-1.5 text-[10px] text-accent-600 dark:text-accent-400">
                  После загрузки модель кэшируется — следующий раз мгновенно
                </p>
              </div>
            )}

            {mode === 'offline' && whisper.status === 'ready' && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-500/10 px-3 py-2">
                <Check className="size-4 text-green-500 shrink-0" />
                <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                  Whisper готов — транскрибация без интернета
                </span>
              </div>
            )}

            {/* Waveform */}
            <div
              className="flex h-20 items-center justify-center gap-[3px] rounded-2xl bg-ink-50 dark:bg-ink-850 px-3"
              aria-hidden="true"
            >
              {rec.levels.map((lv, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-gradient-to-t from-accent-600 to-accent-400 transition-[height] duration-100"
                  style={{ height: `${Math.max(4, lv * 64)}px` }}
                />
              ))}
            </div>

            {/* Живая транскрибация */}
            <div className="mt-3 max-h-28 min-h-14 overflow-y-auto rounded-2xl border border-dashed border-ink-200 dark:border-ink-700 p-3 text-sm leading-relaxed">
              {isTranscribing ? (
                <div className="flex items-center gap-2 text-ink-400">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Whisper расшифровывает аудио…</span>
                </div>
              ) : mode === 'offline' ? (
                <p className="text-ink-400 text-xs">
                  Расшифровка начнётся после нажатия ✓ — Whisper обработает всю запись офлайн
                </p>
              ) : speechSupported ? (
                rec.finalTranscript || rec.interimTranscript ? (
                  <p className="text-ink-700 dark:text-ink-200">
                    {rec.finalTranscript}{' '}
                    <span className="text-ink-400 italic">{rec.interimTranscript}</span>
                  </p>
                ) : (
                  <p className="text-ink-400">Говорите — текст появится здесь…</p>
                )
              ) : (
                <p className="text-ink-400 text-xs">
                  Браузер не поддерживает онлайн-распознавание. Переключитесь на Whisper.
                </p>
              )}
            </div>

            {/* Ошибки */}
            {rec.error && (
              <p className="mt-2 rounded-xl bg-red-50 dark:bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
                {rec.error}
              </p>
            )}
            {whisper.error && mode === 'offline' && (
              <p className="mt-2 rounded-xl bg-red-50 dark:bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
                Whisper: {whisper.error}
              </p>
            )}

            {/* Кнопки управления */}
            <div className="mt-5 flex items-center justify-center gap-6">
              <button
                onClick={handleCancel}
                disabled={isProcessing}
                aria-label="Отменить запись"
                className="grid size-12 place-items-center rounded-full bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-300 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                <X className="size-5" />
              </button>

              <div className="rec-pulse grid size-16 place-items-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/40">
                <Mic className="size-7" />
              </div>

              <button
                onClick={handleSave}
                disabled={!canSave}
                aria-label="Сохранить запись"
                className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-md shadow-accent-600/30 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                {isProcessing ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Check className="size-5" />
                )}
              </button>
            </div>

            <p className="mt-3 text-center text-xs text-ink-400">
              ✕ — отменить · ✓ — сохранить
              {mode === 'offline' && ' + расшифровать офлайн'}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
