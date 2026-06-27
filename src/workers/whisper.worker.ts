import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

// Используем класс Pipeline напрямую через AutomaticSpeechRecognitionPipeline
let transcriber: any = null;

async function getTranscriber() {
  if (!transcriber) {
    self.postMessage({ type: 'loading', progress: 0 });

    transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en', // .en версия стабильнее в transformers v2
      {
        revision: 'main',
        progress_callback: (info: any) => {
          if (info.status === 'progress') {
            self.postMessage({
              type: 'loading',
              progress: Math.round(info.progress ?? 0),
              file: info.file ?? '',
            });
          } else if (info.status === 'done') {
            self.postMessage({ type: 'loading', progress: 100, file: info.file ?? '' });
          }
        },
      }
    );

    self.postMessage({ type: 'ready' });
  }
  return transcriber;
}

self.addEventListener('message', async (e: MessageEvent) => {
  const { type, audio } = e.data;

  if (type === 'preload') {
    try {
      await getTranscriber();
    } catch (err: any) {
      self.postMessage({ type: 'error', message: String(err?.message ?? err) });
    }
    return;
  }

  if (type === 'transcribe') {
    try {
      const asr = await getTranscriber();

      // Float32Array моно 16кГц
      const result = await asr(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });

      const text = Array.isArray(result)
        ? result.map((r: any) => r.text ?? '').join(' ').trim()
        : (result as any)?.text?.trim() ?? '';

      self.postMessage({ type: 'result', text });
    } catch (err: any) {
      self.postMessage({ type: 'error', message: String(err?.message ?? err) });
    }
  }
});
