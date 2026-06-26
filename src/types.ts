/** Доменные типы приложения «Блокнот» */

export interface AudioClip {
  id: string;
  /** base64 data-URL аудио (webm/ogg) */
  dataUrl: string;
  /** длительность в секундах */
  duration: number;
  /** расшифровка речи (Speech-to-Text) */
  transcript: string;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  /** HTML-содержимое редактора */
  content: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  /** timestamp удаления (в корзине) или null */
  deletedAt: number | null;
  audios: AudioClip[];
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  emoji: string;
}

export type ViewId =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "archive" }
  | { kind: "trash" }
  | { kind: "folder"; folderId: string }
  | { kind: "tag"; tag: string };

export type SortMode = "updated" | "created" | "title";

export type ThemeMode = "light" | "dark" | "system";
