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


