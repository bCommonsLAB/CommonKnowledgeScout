export interface Session {
  id?: string; // Automatisch generierte ID
  // Pflichtfelder
  session: string;
  filename: string;
  track: string;
  event: string;
  // Optionale Felder
  subtitle?: string;
  description?: string;
  image_url?: string; // Optional: Bild-URL von der Session-Seite
  video_url?: string;
  attachments_url?: string;
  url?: string;
  day?: string;
  starttime?: string;
  endtime?: string;
  speakers?: string[];
  speakers_url?: string[]; // Optional: URLs der Sprecher (comma-separated string wird zu Array geparst)
  speakers_image_url?: string[]; // Optional: Bild-URLs der Sprecher (comma-separated string wird zu Array geparst)
  source_language?: string;
  target_language?: string;
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