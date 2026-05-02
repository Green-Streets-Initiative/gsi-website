/** Types shared between the field recorder page and API route */

export interface FieldRecorderCampaign {
  id: string
  name: string
  campaign_slug: string
  funder_name: string | null
  consent_copy: Record<string, ConsentCopy>
  confirmation_copy: Record<string, ConfirmationCopy>
  field_recorder_enabled: boolean
  field_recorder_collect_email: boolean
  upload_enabled: boolean
  supported_languages: string[]
}

export type RecorderMode = 'record' | 'upload'

/** MIME types accepted for pre-recorded video uploads (matches wmu-clips bucket allowlist) */
export const UPLOAD_ACCEPT_MIME = ['video/mp4', 'video/quicktime', 'video/webm'] as const

/** Hard cap on uploaded file size (matches wmu-clips bucket file_size_limit) */
export const UPLOAD_MAX_BYTES = 100 * 1024 * 1024

export interface ConsentCopy {
  what_this_is?: string
  public_use_bullet?: string
  trip_data_bullet?: string
  deletion_rights_bullet?: string
  checkbox_text?: string
}

export interface ConfirmationCopy {
  title?: string
  body?: string
  teaser?: string
}

export interface FieldRecorderPrompt {
  id: string
  campaign_id: string
  sort_order: number
  prompt_text: string
  hint_text: string | null
  max_duration_seconds: number
  is_optional: boolean
}

export interface RecordedClip {
  promptId: string
  blob: Blob
  mimeType: string
  duration: number
  skipped: false
}

export interface SkippedClip {
  promptId: string
  skipped: true
}

export type ClipEntry = RecordedClip | SkippedClip

export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Espanol',
  pt: 'Portugues',
  zh: '中文',
  ht: 'Kreyol Ayisyen',
  vi: 'Tieng Viet',
  ar: 'العربية',
  fr: 'Francais',
}
