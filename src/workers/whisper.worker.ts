/**
 * Web Worker для офлайн-транскрибации через Whisper (tiny multilingual)
 * Запускается в отдельном потоке — не блокирует UI
 */
import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getTranscriber() {
  if (!transcriber) {
    self.postMessage({ type: 'loading', progress: 0 });
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny',
      {
        progress_callback: (info: any) => {
          if (info.status === 'progress') {
            self.postMessage({
              type: 'loading',
              progress: Math.round(info.progress ?? 0),
              file: info.file,
            });
          }
        },
      }
    );
    self.postMessage({ type: 'ready' });
  }
  return transcriber;
}

self.addEventListener('message', async (e: MessageEvent) => {
  const { type, audio, language } = e.data;

  if (type === 'preload') {
    try { await getTranscriber(); }
    catch (err: any) { self.postMessage({ type: 'error', message: err.message }); }
    return;
  }

  if (type === 'transcribe') {
    try {
      const asr = await getTranscriber();
      const result = await asr(audio, {
        language: language ?? 'russian',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });
      const text = Array.isArray(result)
        ? result.map((r: any) => r.text).join(' ').trim()
        : (result as any).text?.trim() ?? '';
      self.postMessage({ type: 'result', text });
    } catch (err: any) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
});
