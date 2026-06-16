import { DeviceFrame } from '@/components/device-frame';
import { MayaFlow, SavingsCard } from '@/components/maya-flow';
import { CreditCheckoutCard } from '@/components/credit-checkout';
import { MAYA } from '@/lib/demo';

export default function Savings() {
  return (
    <DeviceFrame active="savings">
      {/* header */}
      <header className="flex items-center justify-between px-5 pt-2">
        <div>
          <p className="text-[13px] text-mute">Savings &amp; Credit</p>
          <h1 className="text-[22px] font-semibold tracking-tight text-cloud">
            {MAYA.holder}
          </h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-elevate text-[14px] font-semibold text-cloud ring-1 ring-hairline">
          {MAYA.holder
            .split(' ')
            .map((n) => n[0])
            .join('')}
        </div>
      </header>

      {/* live Aave position */}
      <SavingsCard />

      {/* Maya's Compass DeFi agent */}
      <section className="mt-6 px-5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-mute">
          Your DeFi agent
        </h2>
        <div className="mt-3 rounded-[1.6rem] bg-gradient-to-b from-surface to-surface/60 p-4 ring-1 ring-hairline transition-shadow hover:ring-coral/20">
          <div className="flex items-start gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-coral/15 text-[18px] ring-1 ring-coral/30">
              🏦
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-mint ring-2 ring-surface"
                aria-hidden
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-semibold text-cloud">
                  {MAYA.agentName}
                </p>
                <span className="flex items-center gap-1 rounded-md bg-mint/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-mint ring-1 ring-mint/30">
                  <ShieldGlyph />
                  KYA T{MAYA.kyaTier}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-mute">{MAYA.agentBlurb}</p>
              <div className="mt-2.5 flex items-center gap-2 text-[12px]">
                <span className="flex items-center gap-1 rounded-full bg-gold/12 px-2 py-0.5 font-semibold text-gold">
                  ★ {MAYA.reputation.toFixed(1)}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-mute">
                  Compass Labs · Aave
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* spend without breaking savings (borrow + withdraw + pay merchant) */}
      <CreditCheckoutCard />

      {/* borrow against savings */}
      <section className="mt-6 px-5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-mute">
          Borrow against savings
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-mute/90">
          Borrowing raises your risk, so Sly asks for a one-shot{' '}
          <span className="font-mono text-cloud/80">{MAYA.scope}</span> grant
          before the agent touches your collateral.
        </p>
      </section>
      <div className="mt-3">
        <MayaFlow />
      </div>

      {/* footer */}
      <p className="mt-7 px-5 text-center text-[11px] uppercase tracking-[0.18em] text-mute/70">
        sandbox · Base mainnet · real sub-dollar amounts
      </p>
    </DeviceFrame>
  );
}

function ShieldGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
