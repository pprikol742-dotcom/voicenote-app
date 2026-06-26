/**
 * Хук для офлайн-транскрибации через Whisper tiny
 * Использует Web Worker чтобы не блокировать UI
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type WhisperStatus =
  | 'idle'
  | 'loading'      // скачивается/инициализируется модель
  | 'ready'        // модель готова
  | 'transcribing' // идёт транскрибация
  | 'error';

export interface WhisperState {
  status: WhisperStatus;
  /** Прогресс загрузки модели 0-100 */
  loadProgress: number;
  /** Какой файл модели грузится сейчас */
  loadFile: string;
  /** Результат транскрибации */
  transcript: string;
  error: string | null;
}

/**
 * Конвертирует аудио blob (webm/ogg) в Float32Array для Whisper
 */
async function blobToFloat32(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();
  // Whisper ожидает моно 16кГц
  return decoded.getChannelData(0);
}

export function useWhisper() {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<WhisperState>({
    status: 'idle',
    loadProgress: 0,
    loadFile: '',
    transcript: '',
    error: null,
  });

  // Инициализируем воркер один раз
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/whisper.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case 'loading':
          setState(s => ({
            ...s,
            status: 'loading',
            loadProgress: msg.progress ?? s.loadProgress,
            loadFile: msg.file ?? s.loadFile,
          }));
          break;
        case 'ready':
          setState(s => ({ ...s, status: 'ready', loadProgress: 100, error: null }));
          break;
        case 'result':
          setState(s => ({ ...s, status: 'ready', transcript: msg.text, error: null }));
          break;
        case 'error':
          setState(s => ({ ...s, status: 'error', error: msg.message }));
          break;
      }
    };

    worker.onerror = (e) => {
      setState(s => ({ ...s, status: 'error', error: e.message }));
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  /** Предзагрузить модель заранее (необязательно) */
  const preload = useCallback(() => {
    if (state.status === 'idle') {
      setState(s => ({ ...s, status: 'loading' }));
      workerRef.current?.postMessage({ type: 'preload' });
    }
  }, [state.status]);

  /**
   * Транскрибировать аудио blob офлайн через Whisper
   * Возвращает текст или null при ошибке
   */
  const transcribe = useCallback(async (
    audioBlob: Blob,
    language = 'russian'
  ): Promise<string | null> => {
    const worker = workerRef.current;
    if (!worker) return null;

    setState(s => ({ ...s, transcript: '', error: null }));

    // Если модель ещё не загружена — начинаем загрузку
    if (state.status === 'idle' || state.status === 'error') {
      setState(s => ({ ...s, status: 'loading' }));
    }

    try {
      const audio = await blobToFloat32(audioBlob);

      return await new Promise<string | null>((resolve) => {
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'result') {
            worker.removeEventListener('message', handler);
            setState(s => ({ ...s, status: 'ready', transcript: e.data.text }));
            resolve(e.data.text || null);
          } else if (e.data.type === 'error') {
            worker.removeEventListener('message', handler);
            setState(s => ({ ...s, status: 'error', error: e.data.message }));
            resolve(null);
          }
        };
        worker.addEventListener('message', handler);

        setState(s => ({ ...s, status: 'transcribing' }));
        worker.postMessage({ type: 'transcribe', audio, language }, [audio.buffer]);
      });
    } catch (err: any) {
      setState(s => ({ ...s, status: 'error', error: err.message }));
      return null;
    }
  }, [state.status]);

  const reset = useCallback(() => {
    setState(s => ({ ...s, transcript: '', error: null }));
  }, []);

  return { ...state, preload, transcribe, reset };
}
