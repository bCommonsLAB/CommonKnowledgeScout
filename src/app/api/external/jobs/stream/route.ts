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

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      // Initial event: connected
      controller.enqueue(encoder.encode(`event: connected\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`));

      const unsubscribe = getJobEventBus().subscribe(userEmail, (evt: JobUpdateEvent) => {
        controller.enqueue(encoder.encode(`event: job_update\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      });

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\n`));
        controller.enqueue(encoder.encode(`data: ${Date.now()}\n\n`));
      }, 25000);

      // Cleanup
      const close = () => {
        clearInterval(keepAlive);
        unsubscribe();
      };

      // Cleanup über AbortSignal wenn vorhanden
      const signal = (request as unknown as { signal?: AbortSignal }).signal;
      if (signal && typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', close);
      }
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


