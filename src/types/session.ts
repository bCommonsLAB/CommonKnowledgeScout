export interface Session {
  id?: string; // Automatisch generierte ID
  session: string;
  subtitle?: string;  // ← Ergänzt: Untertitel der Session
  description?: string;  // ← Ergänzt: Beschreibung der Session
  filename: string;
  track: string;
  video_url: string;
  attachments_url?: string;
  event: string;
  url: string;
  day: string;
  starttime: string;
  endtime: string;
  speakers: string[];
  source_language: string;
  target_language?: string; // Optional für Job-Generierung
  // Optional: gespeichertes Plaintext-Transkript (zur Kontrolle)
  transcript_text?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface SessionCreateRequest {
  sessions: Omit<Session, 'id' | 'created_at' | 'updated_at'>[];
}

export interface SessionListResponse {
  status: 'success' | 'error';
  data?: {
    sessions: Session[];
    total: number;
  };
  message?: string;
}

export interface SessionResponse {
  status: 'success' | 'error';
  data?: {
    session: Session;
  };
  message?: string;
}

// Filter-Optionen für Sessions
export interface SessionFilterOptions {
  event?: string;
  track?: string;
  day?: string;
  source_language?: string;
  search?: string; // Suche in session-Namen
} 