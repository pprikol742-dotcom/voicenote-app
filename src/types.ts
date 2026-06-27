/** Доменные типы приложения «Блокнот» */

export interface AudioClip {
  id: string;
  dataUrl: string;
  duration: number;
  transcript: string;
  createdAt: number;
}

export interface Reminder {
  /** timestamp когда сработает */
  at: number;
  /** повтор: нет / каждый день / каждую неделю */
  repeat: 'none' | 'daily' | 'weekly';
  /** уже сработало (не повтор) */
  fired: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  deletedAt: number | null;
  audios: AudioClip[];
  reminder: Reminder | null;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  emoji: string;
}

export type ViewId =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'archive' }
  | { kind: 'trash' }
  | { kind: 'reminders' }
  | { kind: 'folder'; folderId: string }
  | { kind: 'tag'; tag: string };

export type SortMode = 'updated' | 'created' | 'title';
export type ThemeMode = 'light' | 'dark' | 'system';
