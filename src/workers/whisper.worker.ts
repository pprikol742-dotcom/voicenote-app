import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;

async function getTranscriber() {
  if (!transcriber) {
    self.postMessage({ type: 'loading', progress: 0 });
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      {
        revision: 'main',
        progress_callback: (info) => {
          if (info.status === 'progress') {
            self.postMessage({ type: 'loading', progress: Math.round(info.progress ?? 0), file: info.file ?? '' });
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

self.addEventListener('message', async (e) => {
  const { type, audio } = e.data;
  if (type === 'preload') {
    try { await getTranscriber(); }
    catch (err) { self.postMessage({ type: 'error', message: String(err?.message ?? err) }); }
    return;
  }
  if (type === 'transcribe') {
    try {
      const asr = await getTranscriber();
      const result = await asr(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: false });
      const text = Array.isArray(result) ? result.map(r => r.text ?? '').join(' ').trim() : result?.text?.trim() ?? '';
      self.postMessage({ type: 'result', text });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err?.message ?? err) });
    }
  }
});
