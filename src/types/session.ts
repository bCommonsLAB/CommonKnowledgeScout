export interface Session {
  id?: string; // Automatisch generierte ID
  session: string;
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