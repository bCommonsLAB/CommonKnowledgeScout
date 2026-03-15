import { NextRequest } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { getJobEventBus, JobUpdateEvent } from '@/lib/events/job-event-bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { userId } = getAuth(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
  if (!userEmail) return new Response('Forbidden', { status: 403 });

  let teardown: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const signal = (request as unknown as { signal?: AbortSignal }).signal;

      let isClosed = false;
      let keepAlive: ReturnType<typeof setInterval> | undefined;
      let unsubscribe: (() => void) | undefined;

      // Guard gegen doppelte/verspätete Teardowns.
      const close = () => {
        if (isClosed) return;
        isClosed = true;
        if (keepAlive) {
          clearInterval(keepAlive);
          keepAlive = undefined;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = undefined;
        }
        if (signal && typeof signal.removeEventListener === 'function') {
          signal.removeEventListener('abort', close);
        }
      };

      // enqueue kann nach Stream-Close werfen; dann sofort aufräumen.
      const safeEnqueue = (payload: string): boolean => {
        if (isClosed) return false;
        try {
          controller.enqueue(encoder.encode(payload));
          return true;
        } catch {
          close();
          return false;
        }
      };

      const sendEvent = (event: string, data: string): void => {
        const hasEvent = safeEnqueue(`event: ${event}\n`);
        if (!hasEvent) return;
        safeEnqueue(`data: ${data}\n\n`);
      };

      // Initial event: connected
      sendEvent('connected', JSON.stringify({ ok: true, ts: Date.now() }));

      unsubscribe = getJobEventBus().subscribe(userEmail, (evt: JobUpdateEvent) => {
        sendEvent('job_update', JSON.stringify(evt));
      });

      keepAlive = setInterval(() => {
        sendEvent('ping', String(Date.now()));
      }, 25000);

      // Cleanup über AbortSignal wenn vorhanden
      if (signal && typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', close);
      }

      teardown = close;
    },
    cancel() {
      if (teardown) teardown();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}


