import { EventEmitter } from 'events';

export interface JobUpdateEvent {
  type: 'job_update';
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'pending-storage' | string;
  phase?: string;
  progress?: number;
  message?: string;
  updatedAt: string;
  jobType?: string;
  fileName?: string;
  sourceItemId?: string;
  libraryId?: string;
  /**
   * Optional: Ergebnis-Referenz (z.B. transformiertes Markdown im Shadow‑Twin).
   * Wird genutzt, um in der UI gezielt die erzeugte Datei zu öffnen/selektieren.
   */
  result?: { savedItemId?: string };
  /**
   * Optional: Ordner-Refresh-Hinweise für die UI (Parent + Shadow‑Twin).
   * `refreshFolderId` bleibt aus Kompatibilitätsgründen bestehen; bevorzugt `refreshFolderIds`.
   */
  refreshFolderId?: string;
  refreshFolderIds?: string[];
  /**
   * Optional: Shadow‑Twin Verzeichnis-ID. Wird für Navigation/Analyse im Client genutzt.
   */
  shadowTwinFolderId?: string | null;
}

type UserEmail = string;

class JobEventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(1000);
  }

  subscribe(userEmail: UserEmail, handler: (evt: JobUpdateEvent) => void): () => void {
    const channel = this.getChannel(userEmail);
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }

  emitUpdate(userEmail: UserEmail, event: JobUpdateEvent): void {
    const channel = this.getChannel(userEmail);
    this.emitter.emit(channel, event);
  }

  private getChannel(userEmail: string): string {
    return `job_update:${userEmail}`;
  }
}

// Stabiler Singleton über HMR/Request-Grenzen hinweg
// Verhindert, dass POST und SSE unterschiedliche Instanzen verwenden
declare const global: typeof globalThis & { __jobEventBus?: JobEventBus };

export function getJobEventBus(): JobEventBus {
  if (!global.__jobEventBus) {
    global.__jobEventBus = new JobEventBus();
  }
  return global.__jobEventBus;
}


