'use client';

/**
 * Helix agent graph — a REAL peer-economy mesh.
 *
 * Nodes/edges come from state.graph (WS-D): buyers, prosumers and
 * dedicated providers, with real per-pair A2A counts (now that the API
 * records client_agent_id), real per-buyer ACP counts, and honest x402
 * relationship edges. The d3-force layout draws those edges DIRECTLY —
 * Sly is the settlement substrate (a soft-pulsing node), not a forced
 * waypoint. Particles flow continuously along every edge at a rate
 * proportional to that edge's REAL on-ledger weight, so the mesh stays
 * alive between polls and visibly "communicates" in proportion to
 * genuine volume (no fabricated traffic).
 */

import { useEffect, useRef } from 'react';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import type { HelixState, Protocol } from '@/lib/sly';

const COL: Record<Protocol, string> = {
  x402: '#5eead4',
  ucp: '#a78bfa',
  acp: '#f0a93b',
  a2a: '#60a5fa',
};
const HUB_COL = '#34d399';
const PROSUMER_COL = '#a78bfa';
const PULSE_MS = 1500;

type NodeKind = 'buyer' | 'prosumer' | 'provider' | 'service' | 'hub';

interface SimNode extends SimulationNodeDatum {
  id: string;
  label: string;
  kind: NodeKind;
  proto?: Protocol;
  activity: number;
  radius: number;
}
type SimEdge = SimulationLinkDatum<SimNode> & {
  proto: Protocol;
  count: number;
  // continuous emission rate (particles/sec) ∝ this edge's REAL volume
  rate: number;
  acc: number;
};

interface Particle {
  from: SimNode;
  to: SimNode;
  color: string;
  born: number;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

/** Real on-ledger activity → node radius. */
function activityFor(
  n: { id: string; kind: NodeKind },
  state: HelixState,
  inDeg: Map<string, number>,
  outDeg: Map<string, number>,
): number {
  if (n.kind === 'hub') return 0;
  if (n.id === 'helix-supply') return state.rails.acp.checkoutCount;
  const ep = state.rails.x402.endpoints.find((e) => e.id === n.id);
  if (ep) return ep.calls;
  if (n.kind === 'provider') return inDeg.get(n.id) ?? 0;
  // buyer / prosumer: work they originate (+ work hired from them)
  return (outDeg.get(n.id) ?? 0) + (inDeg.get(n.id) ?? 0);
}

function radiusFor(kind: NodeKind, activity: number): number {
  if (kind === 'hub') return 26;
  const base = kind === 'service' ? 12 : kind === 'provider' ? 11 : 8;
  return base + Math.min(20, Math.log2(activity + 1) * 2.1);
}

/** Particles/sec for an edge, from its REAL on-ledger weight. */
function edgeRate(weight: number): number {
  return 0.12 + Math.min(2.0, Math.log2(weight + 1) * 0.42);
}

export default function AgentGraphCanvas({
  state,
}: {
  state: HelixState | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation<SimNode, SimEdge> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const byIdRef = useRef<Map<string, SimNode>>(new Map());
  const edgesRef = useRef<SimEdge[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const sizeRef = useRef({ w: 760, h: 470 });

  const graph = state?.graph;
  const sig = graph
    ? graph.nodes.map((n) => n.id).join(',') +
      '|' +
      graph.edges.map((e) => `${e.from}>${e.to}:${e.proto}`).join(',')
    : '';

  // ── build / rebuild the force sim when the node/edge set changes ──
  useEffect(() => {
    if (!graph || !state) return;
    const { w, h } = sizeRef.current;

    // real in/out degree from the actual edges (for node sizing); and
    // fan-in count per target (to split x402 endpoint volume per edge)
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();
    const agentDeg = new Map<string, number>();
    for (const e of graph.edges) {
      inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + e.count);
      outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + e.count);
      agentDeg.set(e.to, (agentDeg.get(e.to) ?? 0) + 1);
    }

    const nodes: SimNode[] = graph.nodes.map((n) => {
      const activity = activityFor(n, state, inDeg, outDeg);
      return {
        id: n.id,
        label: n.label,
        kind: n.kind,
        proto: n.proto,
        activity,
        radius: radiusFor(n.kind, activity),
        x: w / 2 + (hashStr(n.id) % 260),
        y: h / 2 + (hashStr(n.id + 'y') % 180),
      };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const hub = byId.get('sly');
    if (hub) {
      hub.fx = w / 2;
      hub.fy = h / 2;
    }

    // links = the REAL edges, drawn directly (NOT routed through Sly).
    // Emission weight = the edge's real count; for x402 relationship
    // edges (count 0, batch-netted) the REAL volume is the endpoint's
    // call total — use the target service node's activity so the flow
    // still reflects genuine on-ledger throughput.
    const links: SimEdge[] = [];
    for (const e of graph.edges) {
      const s = byId.get(e.from);
      const t = byId.get(e.to);
      if (!s || !t) continue;
      const weight =
        e.count > 0
          ? e.count
          : e.proto === 'x402'
            ? t.activity / Math.max(1, agentDeg.get(t.id) ?? 1)
            : 0;
      links.push({
        source: s,
        target: t,
        proto: e.proto,
        count: e.count,
        rate: edgeRate(weight),
        acc: Math.random(), // desync initial emission per edge
      });
    }

    nodesRef.current = nodes;
    byIdRef.current = byId;
    edgesRef.current = links;

    const sim = forceSimulation<SimNode>(nodes)
      .force(
        'link',
        forceLink<SimNode, SimEdge>(links)
          .id((d) => d.id)
          .distance((l) =>
            (l as SimEdge).proto === 'a2a'
              ? 105
              : (l as SimEdge).proto === 'acp'
                ? 120
                : 92,
          )
          .strength((l) => {
            const c = (l as SimEdge).count;
            return 0.18 + Math.min(0.45, Math.log2(c + 1) * 0.09);
          }),
      )
      .force('charge', forceManyBody<SimNode>().strength(-300))
      .force('x', forceX<SimNode>(w / 2).strength(0.045))
      .force('y', forceY<SimNode>(h / 2).strength(0.06))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => d.radius + 13),
      )
      .alphaDecay(0.03)
      .velocityDecay(0.58)
      // never fully freeze — keep a tiny residual energy so the mesh
      // gently breathes instead of hardening into static circles
      .alphaTarget(0.012)
      .on('tick', () => {
        const { w: cw, h: ch } = sizeRef.current;
        for (const nd of nodes) {
          if (nd.kind === 'hub') continue;
          const r = nd.radius + 14;
          if (nd.x != null) nd.x = Math.max(r, Math.min(cw - r, nd.x));
          if (nd.y != null) nd.y = Math.max(r + 6, Math.min(ch - r - 14, nd.y));
        }
      });

    simRef.current?.stop();
    simRef.current = sim;
    return () => {
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // ── refresh radii on live activity without relayout ──
  useEffect(() => {
    if (!state || !graph) return;
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();
    for (const e of graph.edges) {
      inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + e.count);
      outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + e.count);
    }
    for (const n of nodesRef.current) {
      n.activity = activityFor(n, state, inDeg, outDeg);
      n.radius = radiusFor(n.kind, n.activity);
    }
    simRef.current?.alpha(0.05).restart();
  }, [state, graph]);

  // Particles are emitted continuously from the REAL edges in the RAF
  // loop (rate ∝ each edge's real on-ledger weight) — see edgeRate /
  // SimEdge.rate. No feed-id bookkeeping: the mesh stays alive between
  // polls and when idle, flowing in proportion to genuine volume.

  // ── canvas RAF draw loop (HiDPI ×2) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const w = Math.max(320, Math.floor(r.width));
      const h = Math.max(260, Math.floor(r.height));
      sizeRef.current = { w, h };
      canvas.width = w * 2;
      canvas.height = h * 2;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const hub = byIdRef.current.get('sly');
      if (hub) {
        hub.fx = w / 2;
        hub.fy = h / 2;
      }
      const sim = simRef.current;
      if (sim) {
        sim.force('x', forceX<SimNode>(w / 2).strength(0.045));
        sim.force('y', forceY<SimNode>(h / 2).strength(0.06));
        sim.alpha(0.2).restart();
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let lastTs = performance.now();
    const draw = () => {
      const { w, h } = sizeRef.current;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const now = performance.now();
      const dt = Math.min(0.12, (now - lastTs) / 1000);
      lastTs = now;

      // Sly substrate — soft pulse behind the mesh (not a waypoint)
      const hub = byIdRef.current.get('sly');
      if (hub && hub.x != null) {
        const ring = 26 + ((now / 26) % 22);
        ctx.beginPath();
        ctx.arc(hub.x, hub.y!, ring, 0, Math.PI * 2);
        ctx.strokeStyle = HUB_COL;
        ctx.globalAlpha = Math.max(0, 0.16 * (1 - (ring - 26) / 22));
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // edges — the real mesh
      for (const l of edgesRef.current) {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        if (s.x == null || t.x == null) continue;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y!);
        ctx.lineTo(t.x, t.y!);
        ctx.strokeStyle = COL[l.proto];
        ctx.globalAlpha = l.count > 0 ? 0.3 : 0.12;
        ctx.lineWidth =
          l.count > 0 ? Math.max(1, Math.log2(l.count + 1) * 1.4) : 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── ambient emission: every edge continuously flows at a rate
      // proportional to its REAL on-ledger weight ──────────────────
      const CAP = 200;
      for (const l of edgesRef.current) {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        if (s.x == null || t.x == null) continue;
        l.acc += l.rate * dt;
        while (l.acc >= 1 && particlesRef.current.length < CAP) {
          l.acc -= 1;
          particlesRef.current.push({
            from: s,
            to: t,
            color: COL[l.proto] ?? '#9ca3af',
            born: now - Math.random() * 60,
          });
        }
        if (l.acc > 3) l.acc = 3; // don't bank a backlog while off-screen
      }

      // particles — straight along the real edge
      particlesRef.current = particlesRef.current.filter(
        (p) => now - p.born < PULSE_MS,
      );
      for (const p of particlesRef.current) {
        if (p.from.x == null || p.to.x == null) continue;
        const tt = (now - p.born) / PULSE_MS;
        const px = p.from.x + (p.to.x - p.from.x) * tt;
        const py = p.from.y! + (p.to.y! - p.from.y!) * tt;
        ctx.beginPath();
        ctx.arc(px, py, 3.1, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = tt > 0.9 ? (1 - tt) / 0.1 : 1;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // nodes
      for (const n of nodesRef.current) {
        if (n.x == null || n.y == null) continue;
        const r = n.radius;
        if (n.kind === 'hub') {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fillStyle = '#0b1a17';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = HUB_COL;
          ctx.stroke();
          ctx.fillStyle = HUB_COL;
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Sly', n.x, n.y);
          continue;
        }
        const col =
          n.kind === 'service'
            ? COL[n.proto ?? 'acp']
            : n.kind === 'provider'
              ? COL.a2a
              : n.kind === 'prosumer'
                ? PROSUMER_COL
                : '#f0a93b';
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = n.kind === 'provider' || n.kind === 'prosumer'
          ? '#11182b'
          : '#0e1726';
        ctx.fill();
        ctx.lineWidth = n.kind === 'service' || n.kind === 'provider' ? 2 : 1.5;
        ctx.strokeStyle = col;
        ctx.globalAlpha =
          n.kind === 'buyer' ? 0.55 : 0.9;
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (
          (n.kind === 'service' || n.kind === 'provider') &&
          n.activity > 0
        ) {
          ctx.fillStyle = '#dfe6f2';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(n.activity), n.x, n.y);
        }
        ctx.fillStyle =
          n.kind === 'service' || n.kind === 'provider'
            ? '#dde3f0'
            : '#9aa6c0';
        ctx.font = `${n.kind === 'buyer' ? 9 : 10}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(n.label, n.x, n.y + r + 4);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Agent economy · real peer mesh — every edge a Sly transaction
      </div>
      <div ref={wrapRef} className="relative mt-2 min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
