import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Mic, Pause, Play, Trash2 } from "lucide-react";
import type { AudioClip } from "../types";

export function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

interface Props {
  clip: AudioClip;
  onDelete?: () => void;
}

/** Плеер голосовой заметки: play/pause, перемотка, скорость, расшифровка */
export default function AudioPlayer({ clip, onDelete }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(clip.duration || 0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const audio = new Audio(clip.dataUrl);
    audioRef.current = audio;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => {
      if (isFinite(audio.duration) && audio.duration > 0)
        setDuration(audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [clip.dataUrl]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.playbackRate = SPEEDS[speedIdx];
      audio.play();
      setPlaying(true);
    }
  };

  const seek = (v: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = v;
    setCurrent(v);
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const total = duration || clip.duration || 1;
  const progress = Math.min(100, (current / total) * 100);

  return (
    <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-850 p-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={playing ? "Пауза" : "Воспроизвести"}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-md shadow-accent-600/30 transition-transform hover:scale-105 active:scale-95"
        >
          {playing ? (
            <Pause className="size-4" fill="currentColor" />
          ) : (
            <Play className="ml-0.5 size-4" fill="currentColor" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
            <Mic className="size-3 text-accent-500" />
            <span className="font-medium">Голосовая заметка</span>
            <span className="ml-auto tabular-nums">
              {fmtTime(current)} / {fmtTime(total)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={total}
            step={0.05}
            value={current}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Перемотка"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-accent-600"
            style={{
              background: `linear-gradient(to right, var(--color-accent-600) ${progress}%, var(--color-ink-300) ${progress}%)`,
            }}
          />
        </div>

        <button
          onClick={cycleSpeed}
          aria-label="Скорость воспроизведения"
          className="shrink-0 rounded-lg border border-ink-200 dark:border-ink-700 px-2 py-1 text-xs font-bold text-ink-600 dark:text-ink-300 hover:border-accent-400 hover:text-accent-600 transition-colors tabular-nums"
        >
          {SPEEDS[speedIdx]}×
        </button>

        {onDelete && (
          <button
            onClick={onDelete}
            aria-label="Удалить запись"
            className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      {clip.transcript && (
        <div className="mt-2">
          <button
            onClick={() => setShowTranscript((s) => !s)}
            className="flex items-center gap-1 text-xs font-semibold text-accent-600 dark:text-accent-400 hover:underline"
          >
            {showTranscript ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            Расшифровка
          </button>
          {showTranscript && (
            <p className="mt-1.5 rounded-xl bg-white dark:bg-ink-900 p-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300 border border-ink-100 dark:border-ink-800">
              {clip.transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
