import { fetchHelixState } from '@/lib/sly';

export const dynamic = 'force-dynamic';

const RAILS = [
  { k: 'x402', c: 'text-x402', b: 'border-x402/40', g: 'bg-x402/[0.07]' },
  { k: 'ucp', c: 'text-ucp', b: 'border-ucp/40', g: 'bg-ucp/[0.07]' },
  { k: 'acp', c: 'text-acp', b: 'border-acp/40', g: 'bg-acp/[0.07]' },
  { k: 'a2a', c: 'text-a2a', b: 'border-a2a/40', g: 'bg-a2a/[0.07]' },
] as const;

export default async function LaunchPage() {
  const s = await fetchHelixState();
  const eps = s.rails.x402.endpoints;

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-12">
      <header className="border-b border-line pb-7">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black tracking-tight text-ink">
            Helix
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-mega text-x402">
            marketplace launch
          </span>
        </div>
        <h1 className="mt-5 max-w-2xl text-[34px] font-black leading-[1.15] tracking-tight text-ink">
          One marketplace. Four agentic-commerce rails. Stood up on Sly.
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] text-mute">
          x402 per-call endpoints, a UCP-discoverable catalog, ACP checkout,
          and an A2A-discoverable agent — created against the real Sly API.
          Then the agents arrive.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-x402 px-5 py-3 text-[14px] font-bold text-void transition hover:opacity-90"
        >
          Watch it fill, live →
        </a>
      </header>

      <div className="mt-9 grid grid-cols-1 gap-4 md:grid-cols-2">
        {RAILS.map((r) => {
          const live =
            r.k === 'x402'
              ? s.rails.x402.live
              : r.k === 'ucp'
                ? s.rails.ucp.live
                : r.k === 'acp'
                  ? s.rails.acp.live
                  : s.rails.a2a.live;
          return (
            <section
              key={r.k}
              className={`rounded-2xl border ${r.b} ${r.g} bg-panel/60 p-6 shadow-panel`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-[12px] font-bold uppercase tracking-mega ${r.c}`}
                >
                  {r.k}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-mute">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-pulse' : 'bg-mute'}`}
                  />
                  {live ? 'live' : 'pending'}
                </span>
              </div>

              {r.k === 'x402' ? (
                <div className="mt-4 space-y-2.5">
                  {eps.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg bg-panel2/70 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-ink">
                          {e.name}
                        </div>
                        <div className="truncate font-mono text-[11px] text-dim">
                          {e.path}
                        </div>
                      </div>
                      <div className="ml-3 text-right">
                        <div className="text-[14px] font-semibold text-ink tnum">
                          ${e.basePrice}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-mute">
                          per call
                        </div>
                      </div>
                    </div>
                  ))}
                  {!eps.length ? (
                    <p className="text-[13px] text-dim">
                      Run the driver to create the endpoints.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4">
                  <div className="text-[16px] font-semibold text-ink">
                    {r.k === 'ucp'
                      ? s.rails.ucp.catalogName
                      : r.k === 'acp'
                        ? s.rails.acp.merchant
                        : s.rails.a2a.agentName}
                  </div>
                  <div className="mt-1 text-[13px] text-mute">
                    {r.k === 'ucp'
                      ? 'Discoverable merchant catalog (UCP)'
                      : r.k === 'acp'
                        ? `${s.rails.acp.checkoutCount} agentic checkouts`
                        : 'Discoverable agent card (A2A)'}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="mt-9 text-center font-mono text-[11px] text-dim">
        Created against the real Sly API on the Helix tenant. Sandbox · Base
        Sepolia.
      </footer>
    </main>
  );
}
