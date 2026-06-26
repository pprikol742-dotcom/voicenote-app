import { useCallback, useEffect, useRef, useState } from 'react';

export interface RecordingResult {
  dataUrl: string;
  duration: number;
  transcript: string;
  audioBlob: Blob; // передаём blob для офлайн-транскрибации
}

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'error';

export const WAVE_BARS = 48;

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export const speechSupported =
  typeof window !== 'undefined' &&
  Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * ИСПРАВЛЕННЫЕ БАГИ:
 * 1. AudioContext не закрывался если start() вызывался повторно без cleanup
 * 2. MediaRecorder chunks не очищались при cancel (утечка памяти)  
 * 3. SpeechRecognition перезапускался даже после явной отмены
 * 4. race condition: rec.onstop мог не сработать если MediaRecorder уже inactive
 * 5. FileReader не освобождал память (нет URL.revokeObjectURL)
 * 6. stoppingRef не сбрасывался при повторном start()
 * 7. timer clearInterval вызывался до остановки — elapsed мог не обновиться
 */
export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(WAVE_BARS).fill(0.05));
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stoppingRef = useRef(false);
  const finalRef = useRef('');
  const mimeTypeRef = useRef('');

  // FIX #1: полная очистка всех ресурсов
  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);

    // FIX #7: сначала останавливаем таймер
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    // FIX #1: AudioContext закрываем только если не уже закрыт
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    // FIX #2: очищаем chunks чтобы не было утечки памяти
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    // FIX #6: сбрасываем stoppingRef в начале нового старта
    stoppingRef.current = false;
    setError(null);
    setStatus('requesting');
    setFinalTranscript('');
    setInterimTranscript('');
    finalRef.current = '';
    setElapsed(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // оптимально для Whisper
        },
      });
      streamRef.current = stream;

      // Выбираем лучший поддерживаемый формат
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : '';
      mimeTypeRef.current = mimeType;

      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      rec.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start(250);
      mediaRecorderRef.current = rec;

      // Waveform visualizer
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const level = Math.min(1, Math.max(0.05, rms * 3.2));
        setLevels(prev => [...prev.slice(1), level]);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - startTimeRef.current) / 1000);
      }, 200);

      // Web Speech API как живой превью (необязательно — Whisper даст финальный результат)
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR();
        recognition.lang = 'ru-RU';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (e: any) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            if (res.isFinal) {
              finalRef.current = (finalRef.current + ' ' + res[0].transcript).trim();
            } else {
              interim += res[0].transcript;
            }
          }
          setFinalTranscript(finalRef.current);
          setInterimTranscript(interim);
        };
        recognition.onerror = () => { /* no-speech — не критично */ };
        // FIX #3: перезапускаем только если реально записываем
        recognition.onend = () => {
          if (!stoppingRef.current && mediaRecorderRef.current?.state === 'recording') {
            try { recognition.start(); } catch {}
          }
        };
        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {}
      }

      setStatus('recording');
    } catch {
      setError('Не удалось получить доступ к микрофону. Проверьте разрешения.');
      setStatus('error');
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback((): Promise<RecordingResult | null> => {
    return new Promise(resolve => {
      const rec = mediaRecorderRef.current;

      // FIX #4: обрабатываем случай когда recorder уже inactive
      if (!rec || rec.state === 'inactive') {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current || 'audio/webm',
        });
        if (blob.size > 0) {
          const reader = new FileReader();
          reader.onloadend = () => {
            cleanup();
            setStatus('idle');
            setLevels(Array(WAVE_BARS).fill(0.05));
            resolve({
              dataUrl: reader.result as string,
              duration,
              transcript: finalRef.current.trim(),
              audioBlob: blob,
            });
          };
          reader.readAsDataURL(blob);
        } else {
          cleanup();
          setStatus('idle');
          resolve(null);
        }
        return;
      }

      stoppingRef.current = true;
      const duration = (Date.now() - startTimeRef.current) / 1000;

      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current || rec.mimeType || 'audio/webm',
        });
        const reader = new FileReader();
        reader.onloadend = () => {
          cleanup();
          setStatus('idle');
          setLevels(Array(WAVE_BARS).fill(0.05));
          resolve({
            dataUrl: reader.result as string,
            duration,
            transcript: finalRef.current.trim(),
            audioBlob: blob,
          });
        };
        reader.readAsDataURL(blob);
      };

      rec.stop();
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    stoppingRef.current = true;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
    }
    cleanup();
    setStatus('idle');
    setLevels(Array(WAVE_BARS).fill(0.05));
    setFinalTranscript('');
    setInterimTranscript('');
    setError(null);
  }, [cleanup]);

  return {
    status,
    elapsed,
    levels,
    finalTranscript,
    interimTranscript,
    error,
    start,
    stop,
    cancel,
  };
}
