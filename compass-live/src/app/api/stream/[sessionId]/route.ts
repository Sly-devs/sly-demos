/**
 * GET /api/stream/[sessionId]
 *
 * Long-lived SSE that forwards events from the in-process session bus
 * to the browser. Replays buffered events on connect (so a slow page
 * load doesn't miss the early `meta` banner), then streams live.
 *
 * Local-only by design — the runner spawns child processes; no Vercel
 * runtime concerns apply.
 */

import type { NextRequest } from 'next/server';
import { subscribe, type DemoEvent } from '@/lib/bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (ev: DemoEvent) => {
        const payload = `event: ${ev.kind}\ndata: ${JSON.stringify(ev)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          /* controller already closed */
        }
      };

      const sub = subscribe(sessionId, send);
      if (!sub) {
        const err = `event: error\ndata: ${JSON.stringify({ error: 'unknown session' })}\n\n`;
        controller.enqueue(encoder.encode(err));
        controller.close();
        return;
      }
      // Replay anything already queued (banner + early lines).
      for (const ev of sub.replay) send(ev);
      // If the session already finished before this subscriber arrived,
      // close after replay.
      if (sub.done) {
        sub.unsubscribe();
        controller.close();
        return;
      }
      // Heartbeat every 15s so proxies don't time us out.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      // Cleanup hook on cancel.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (controller as any).__cleanup = () => {
        clearInterval(heartbeat);
        sub.unsubscribe();
      };
    },
    cancel() {
      // The controller's __cleanup is set in start; nothing else needed here
      // because the EventEmitter is per-session and gc'd 60s post-done.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
