/**
 * @fileoverview Secretary Service Types - Type Definitions for Secretary Service
 * 
 * @description
 * Type definitions for Secretary Service API requests and responses. Includes
 * interfaces for audio, video, image, PDF, and session processing. Defines
 * transformation request/response structures and error types.
 * 
 * @module secretary
 * 
 * @exports
 * - AudioTransformationRequest: Request interface for audio processing
 * - AudioTransformationResponse: Response interface for audio processing
 * - TransformationError: Error interface for transformation failures
 * - StructuredSessionData: Interface for structured session data
 * - TemplateExtractionResponse: Response interface for template extraction
 * 
 * @usedIn
 * - src/lib/secretary/client.ts: Client uses type definitions
 * - src/app/api/secretary: API routes use type definitions
 * - src/lib/external-jobs: External jobs use type definitions
 * 
 * @dependencies
 * - None (pure type definitions)
 */

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

/**
 * RAG Embedding Chunk aus Secretary Service Response
 */
export interface SecretaryRagChunk {
  text: string;
  chunk_index: number;
  document_id: string;
  embedding: number[];
  heading_context: string | null;
  start_char: number | null;
  end_char: number | null;
  metadata: Record<string, unknown>;
}

/**
 * RAG Embedding Response vom Secretary Service
 */
export interface SecretaryRagResponse {
  status: 'success' | 'error';
  request?: {
    endpoint: string;
    document_id: string;
    chunk_size: number;
    chunk_overlap: number;
    input_length: number;
    embedding_model: string;
    client_metadata_present: boolean;
  };
  process?: {
    process_id: string;
    processor_name: string;
    status: string;
    duration_ms: number;
    llm_info: {
      total_tokens: number;
      total_cost_usd: number;
      requests: unknown[];
    };
  };
  data?: {
    document_id: string;
    chunks: SecretaryRagChunk[];
    total_chunks: number;
    embedding_dimensions: number;
    embedding_model: string;
    created_at: string;
    metadata: Record<string, unknown>;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
} 