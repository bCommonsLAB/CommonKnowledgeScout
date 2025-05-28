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