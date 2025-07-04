import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(size?: number): string {
  if (!size) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDateTime(date: Date | string): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Gibt eine benutzerfreundliche Fehlermeldung für bekannte Fehlerfälle bei Audio-Transformationen zurück.
 * @param error - Das Fehlerobjekt (meist Error oder unknown)
 * @returns Eine für den Nutzer verständliche Fehlermeldung (deutsch)
 */
export function getUserFriendlyAudioErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("ECONNREFUSED"))
      return "Der Audio-Service ist nicht erreichbar. Bitte prüfen Sie die Verbindung oder starten Sie den Service neu.";
    if (error.message.includes("fetch failed"))
      return "Die Verbindung zum Audio-Service ist fehlgeschlagen. Bitte prüfen Sie Ihre Netzwerkverbindung.";
    if (error.message.includes("Failed to fetch"))
      return "Die Verbindung zum Server konnte nicht hergestellt werden. Bitte versuchen Sie es später erneut.";
    if (error.message.includes("Datei konnte nicht geladen werden"))
      return "Die Audiodatei konnte nicht geladen werden. Bitte prüfen Sie die Datei und versuchen Sie es erneut.";
    return error.message;
  }
  return "Unbekannter Fehler bei der Transkription. Bitte versuchen Sie es später erneut.";
}

/**
 * Gibt eine benutzerfreundliche Fehlermeldung für bekannte Fehlerfälle bei Video-Transformationen zurück.
 * @param error - Das Fehlerobjekt (meist Error oder unknown)
 * @returns Eine für den Nutzer verständliche Fehlermeldung (deutsch)
 */
export function getUserFriendlyVideoErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("ECONNREFUSED"))
      return "Der Video-Service ist nicht erreichbar. Bitte prüfen Sie die Verbindung oder starten Sie den Service neu.";
    if (error.message.includes("fetch failed"))
      return "Die Verbindung zum Video-Service ist fehlgeschlagen. Bitte prüfen Sie Ihre Netzwerkverbindung.";
    if (error.message.includes("Failed to fetch"))
      return "Die Verbindung zum Server konnte nicht hergestellt werden. Bitte versuchen Sie es später erneut.";
    if (error.message.includes("Datei konnte nicht geladen werden"))
      return "Die Videodatei konnte nicht geladen werden. Bitte prüfen Sie die Datei und versuchen Sie es erneut.";
    if (error.message.includes("Video-Format wird nicht unterstützt"))
      return "Das Video-Format wird nicht unterstützt. Bitte verwenden Sie ein anderes Format (MP4, AVI, MOV, etc.).";
    if (error.message.includes("Videodatei ist zu groß"))
      return "Die Videodatei ist zu groß für die Verarbeitung. Bitte verwenden Sie eine kleinere Datei.";
    if (error.message.includes("Kein Audio-Stream"))
      return "Die Videodatei enthält keine Audio-Spur. Transkription ist nicht möglich.";
    return error.message;
  }
  return "Unbekannter Fehler bei der Video-Verarbeitung. Bitte versuchen Sie es später erneut.";
}
