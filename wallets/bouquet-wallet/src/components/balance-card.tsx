'use client';

import { useEffect, useState } from 'react';
import { WALLET } from '@/lib/demo';

/**
 * Live wallet balance — reads the agent's real Coral Shopping Wallet on
 * Sly via /api/agent/wallet, so it decrements after the agent spends.
 * Falls back to the seed value while loading / if the API is down.
 */
export function BalanceCard() {
  const [balance, setBalance] = useState<number>(WALLET.balance);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const r = await fetch('/api/agent/wallet', { cache: 'no-store' });
      const d = await r.json();
      if (typeof d?.balance === 'number') setBalance(d.balance);
    } catch {
      /* keep fallback */
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    load();
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return (
    <section className="card-sheen relative mx-5 mt-4 overflow-hidden rounded-[1.8rem] bg-gradient-to-br from-coral via-coral-deep to-[#7a2417] p-5 shadow-card">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/70">
          Coral balance
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-bold tracking-wide text-white backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-mint" aria-hidden />
          USDC · Base
        </span>
      </div>
      <p
        className={`relative mt-4 text-[42px] font-semibold leading-none tracking-tight text-white tabnums transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-80'
        }`}
      >
        <span className="align-top text-[22px] text-white/70">$</span>
        {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
      <p className="relative mt-2 text-[13px] text-white/70">
        Your stablecoin balance · agents spend within the daily limit
      </p>
      <div className="relative mt-5 flex gap-2">
        {['Add funds', 'Send', 'Activity'].map((a) => (
          <span
            key={a}
            className="flex-1 rounded-xl bg-white/[0.14] py-2.5 text-center text-[12.5px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            {a}
          </span>
        ))}
      </div>
    </section>
  );
}
