import type { ExternalJobLogEntry } from '@/types/external-job';

// Einfacher In-Memory-Puffer pro JobId. Nicht persistent; Prozesslebensdauer.
const jobIdToLogs = new Map<string, ExternalJobLogEntry[]>();

export function bufferLog(jobId: string, entry: Omit<ExternalJobLogEntry, 'timestamp'>): void {
  const arr = jobIdToLogs.get(jobId) ?? [];
  arr.push({ timestamp: new Date(), ...entry });
  jobIdToLogs.set(jobId, arr);
}

export function getBufferedLogs(jobId: string): ExternalJobLogEntry[] {
  return jobIdToLogs.get(jobId) ?? [];
}

export function clearBufferedLogs(jobId: string): void {
  jobIdToLogs.delete(jobId);
}

export function drainBufferedLogs(jobId: string): ExternalJobLogEntry[] {
  const arr = jobIdToLogs.get(jobId) ?? [];
  jobIdToLogs.delete(jobId);
  return arr;
}


