import { AudioTransformationRequest, AudioTransformationResponse, TransformationError } from './types';

export class SecretaryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretaryServiceError';
  }
}

export async function transformAudio(
  request: AudioTransformationRequest
): Promise<AudioTransformationResponse> {
  const formData = new FormData();
  formData.append('file', request.file);
  formData.append('target_language', request.target_language);
  formData.append('template', request.template);

  try {
    const response = await fetch('/api/secretary/process-audio', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as TransformationError;
      throw new SecretaryServiceError(errorData.error || 'Unbekannter Fehler beim Transformieren der Audio-Datei');
    }

    return response.json() as Promise<AudioTransformationResponse>;
  } catch (error) {
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verbindung zum Secretary Service');
  }
} 