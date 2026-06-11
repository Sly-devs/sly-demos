/**
 * Compass demo: in-process session bus.
 *
 * Connects the POST /run handler (which spawns work and emits events)
 * to the GET /stream/:id SSE handler (which forwards them to the
 * browser). All in one Node process — no Redis, no DB pubsub, just a
 * Map<sessionId, EventEmitter>.
 *
 * Each session goes through: created → emitting → 'done' event → closed
 * (auto-removed 60s after 'done' to give late subscribers a chance to
 * see the final state).
 */

import { EventEmitter } from 'node:events';

export type DemoEventKind =
  | 'agent'    // line from the demo-agent-client.mjs stdout (left pane)
  | 'api'      // curated event from the API side (right pane)
  | 'meta'     // banner / status updates (either pane)
  | 'done';    // terminal — stream can close

export interface DemoEvent {
  kind: DemoEventKind;
  ts: number;           // epoch ms
  pane: 'left' | 'right' | 'either';
  // For 'agent' / 'api' / 'meta', `text` is one line.
  // For 'done', `text` is an empty string.
  text: string;
  // Optional structured payload for the right pane (renders alongside text).
  detail?: Record<string, unknown>;
  // 'info' | 'good' | 'warn' | 'deny' | 'dim' — drives the color in the UI.
  level?: 'info' | 'good' | 'warn' | 'deny' | 'dim';
}

interface Session {
  emitter: EventEmitter;
  events: DemoEvent[]; // replay buffer for late subscribers
  done: boolean;
  createdAt: number;
  reapTimer?: ReturnType<typeof setTimeout>;
}

// Survive Next.js dev hot-reloads by stashing on globalThis.
const g = globalThis as unknown as { __slyCompassDemoBus?: Map<string, Session> };
if (!g.__slyCompassDemoBus) g.__slyCompassDemoBus = new Map<string, Session>();
const sessions: Map<string, Session> = g.__slyCompassDemoBus;

export function createSession(): string {
  const id = crypto.randomUUID();
  sessions.set(id, { emitter: new EventEmitter(), events: [], done: false, createdAt: Date.now() });
  return id;
}

export function pushEvent(sessionId: string, ev: Omit<DemoEvent, 'ts'> & { ts?: number }): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  const event: DemoEvent = { ts: Date.now(), ...ev };
  s.events.push(event);
  s.emitter.emit('event', event);
  if (event.kind === 'done') {
    s.done = true;
    // Hold the session for 60s post-done so a late subscriber can still
    // catch up via the replay buffer, then garbage-collect.
    s.reapTimer = setTimeout(() => sessions.delete(sessionId), 60_000);
  }
}

export function subscribe(
  sessionId: string,
  onEvent: (ev: DemoEvent) => void,
): { unsubscribe: () => void; done: boolean; replay: DemoEvent[] } | null {
  const s = sessions.get(sessionId);
  if (!s) return null;
  s.emitter.on('event', onEvent);
  return {
    unsubscribe: () => s.emitter.off('event', onEvent),
    done: s.done,
    replay: [...s.events],
  };
}
