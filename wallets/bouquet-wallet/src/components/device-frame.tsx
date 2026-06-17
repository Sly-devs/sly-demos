import Link from 'next/link';

/**
 * Centered ~390px iPhone-class device frame on a neutral backdrop.
 * Status bar + bottom tab bar are rendered here so every page is a
 * full-bleed wallet screen.
 */
export function DeviceFrame({
  children,
  active,
}: {
  children: React.ReactNode;
  active: 'home' | 'savings' | 'activity';
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 px-4 py-10">
      <div className="relative">
        {/* ambient coral glow behind the device */}
        <div
          className="pointer-events-none absolute -inset-16 -z-10 rounded-full bg-coral/10 blur-[90px]"
          aria-hidden
        />

        {/* titanium frame band */}
        <div className="relative rounded-[3.7rem] bg-gradient-to-b from-[#3a4156] via-[#23293a] to-[#181c29] p-[3px] shadow-device">
          {/* device body */}
          <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[3.5rem] bg-canvas ring-1 ring-black/40">
            {/* outer bezel highlight */}
            <div className="pointer-events-none absolute inset-0 rounded-[3.5rem] ring-1 ring-inset ring-white/[0.06]" />

          {/* status bar */}
          <div className="absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-between px-8 pt-2 text-[13px] font-semibold text-cloud">
            <span className="tabnums">9:41</span>
            {/* dynamic island */}
            <div className="absolute left-1/2 top-3 h-7 w-[116px] -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-1.5">
              <Signal />
              <Wifi />
              <Battery />
            </span>
          </div>

          {/* scrollable content */}
          <div className="no-scrollbar h-full overflow-y-auto pb-24 pt-14">
            {children}
          </div>

          {/* tab bar */}
          <nav className="absolute inset-x-0 bottom-0 z-30 border-t border-hairline bg-canvas/85 backdrop-blur-xl">
            <div className="flex items-stretch justify-around px-6 pb-7 pt-3">
              <TabLink href="/" label="Wallet" active={active === 'home'}>
                <WalletIcon />
              </TabLink>
              <TabLink
                href="/savings"
                label="Savings"
                active={active === 'savings'}
              >
                <SavingsIcon />
              </TabLink>
              <TabLink
                href="/activity"
                label="Activity"
                active={active === 'activity'}
              >
                <ActivityIcon />
              </TabLink>
            </div>
            {/* home indicator */}
            <div className="mx-auto mb-2 h-1 w-32 rounded-full bg-white/25" />
          </nav>
          </div>
        </div>
      </div>

      <p className="text-[11px] uppercase tracking-[0.25em] text-mute/70">
        Coral · agentic consumer wallet · demo
      </p>
    </div>
  );
}

function TabLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
        active ? 'text-coral' : 'text-mute hover:text-cloud'
      }`}
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}

/* — minimal inline icons (no external deps) — */

function WalletIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3 10h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="14" r="1.4" fill="currentColor" />
    </svg>
  );
}

function SavingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 11a7 5 0 0 1 14 0v5a7 5 0 0 1-14 0v-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5 11a7 5 0 0 0 14 0"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="16" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 13h4l2.5-7 4 14 2.5-7H21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Signal() {
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden>
      <rect x="0" y="7" width="3" height="4" rx="1" />
      <rect x="4.5" y="5" width="3" height="6" rx="1" />
      <rect x="9" y="3" width="3" height="8" rx="1" />
      <rect x="13.5" y="0" width="3" height="11" rx="1" />
    </svg>
  );
}

function Wifi() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden>
      <path d="M8 11l2.5-3a3.3 3.3 0 0 0-5 0L8 11Z" />
      <path
        d="M3 5.5a7 7 0 0 1 10 0"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Battery() {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden>
      <rect
        x="1"
        y="1"
        width="21"
        height="10"
        rx="2.5"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.2"
      />
      <rect x="3" y="3" width="15" height="6" rx="1.2" fill="currentColor" />
      <rect x="23" y="4" width="2" height="4" rx="1" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}
