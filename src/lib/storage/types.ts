import 'server-only'

// Speicher-Adapter (ARCHITEKTUR §3.1/§3.3): eigene Typen, keine Anbieter-Typen nach außen.

export type StorageDriver = 'local' | 's3'

/** Ablage-Bereiche der Payload-Uploads (DATENMODELL §6.2–§6.4). */
export type UploadArea = 'media' | 'documents' | 'private'

/** Collection-Slug je Bereich. */
export const UPLOAD_AREA_COLLECTION = {
  media: 'media',
  documents: 'documents',
  private: 'private-uploads',
} as const satisfies Record<UploadArea, string>

/** Cache-Klasse einer Datei-Antwort (ARCHITEKTUR §3.3). */
export type CacheClass = 'immutable' | 'short' | 'private'

/** Systemdateien ohne Datenbank (Job-Wecker, Frische-Prüfung; ARCHITEKTUR §9.6, §11.3). */
export interface SystemFileStore {
  readonly driver: StorageDriver
  /** `null`, wenn die Datei nicht existiert. */
  readJson<T = unknown>(key: string): Promise<T | null>
  writeJson(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}
