// No-Op Implementierungen, um alte APM-Helfer stillzulegen
export interface ApmJobLabels { jobId?: string; libraryId?: string; [k: string]: string | number | boolean | null | undefined }
export interface ApmJobContext { tx: null }

export function startJobTx(name: string, type: string, labels?: ApmJobLabels): ApmJobContext { return { tx: null } }
export function endJobTx(ctx: ApmJobContext): void { /* no-op */ }
export async function withStep<T>(name: string, fn: () => Promise<T> | T): Promise<T> { return await fn() }
export async function logPhase(phase: string, fields?: Record<string, unknown>): Promise<void> { /* no-op */ }
export function captureError(error: unknown, labels?: Record<string, unknown>): void { /* no-op */ }
export function flush(): void { /* no-op */ }



