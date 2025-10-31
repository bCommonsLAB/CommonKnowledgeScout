export interface AudioTransformationRequest {
  file: File;
  target_language: string;
}

export interface AudioTransformationResponse {
  duration: number;
  detected_language: string;
  output_text: string;
  original_text: string;
  translated_text: string;
  llm_model: string;
  translation_model: string;
  token_count: number;
  segments: unknown[];
  process_id: string;
  process_dir: string;
  args: Record<string, unknown>;
}

export interface TransformationError {
  error: string;
}

// Neue Typen für Template-Extraktion
export interface StructuredSessionData {
  event: string;
  session: string;
  subtitle: string;
  description: string;
  filename: string;
  track: string;
  image_url?: string; // Optional: Bild-URL von der Session-Seite
  video_url: string;
  attachments_url?: string;
  url: string;
  day: string;
  starttime: string;
  endtime: string;
  speakers: string[];
  speakers_url?: string[]; // Optional: URLs der Sprecher (comma-separated string wird zu Array geparst)
  speakers_image_url?: string[]; // Optional: Bild-URLs der Sprecher (comma-separated string wird zu Array geparst)
  language: string;
}

export interface TemplateExtractionResponse {
  status: string;
  request: {
    processor: string;
    timestamp: string;
    parameters: {
      text: string | null;
      url: string;
      template: string;
      source_language: string;
      target_language: string;
      context: Record<string, unknown>;
      additional_field_descriptions: Record<string, unknown>;
      use_cache: boolean;
      duration_ms: number;
    };
  };
  process: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: unknown[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: string | null;
  data: {
    text: string;
    language: string;
    format: string;
    summarized: boolean;
    structured_data: StructuredSessionData;
  };
  translation: unknown | null;
} 