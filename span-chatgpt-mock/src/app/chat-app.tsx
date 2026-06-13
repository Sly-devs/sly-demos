'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatPrice } from '@/lib/catalog';

/**
 * Outpost Outdoors' custom-GPT mock. A shopper chats with the GPT, it surfaces
 * an in-chat product card, and "Confirm purchase" drives the Sly ACP flow via
 * /api/acs/checkout. Sly is the neutral broker between this ChatGPT-side seller
 * and Maya's Claude-side shopping agent.
 *
 * Visual target: near-indistinguishable from a real ChatGPT custom-GPT
 * (chatgpt.com, 2024–2025). Only presentation changed — the confirm() fetch,
 * request/response JSON shapes and phase machine are untouched.
 */

interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  priceCents: number;
  currency: string;
}

type Phase = 'idle' | 'working' | 'done' | 'error';

interface CheckoutResult {
  status: string;
  transferId?: string;
  totalAmount?: number;
  currency?: string;
  events?: { kind: string; label: string; protocol?: string | null }[];
  error?: string;
}

const USER_PROMPT = 'Looking for the Hoka Clifton 10 — can you pull it up?';

/**
 * Autoplay stages. `?autoplay=1` drives a scripted, ChatGPT-like
 * conversation for screen recording; without it the surface stays
 * fully interactive (composer + Confirm button) as before.
 */
type Stage =
  | 'blank' // empty thread, suggestions + composer
  | 'typing' // prompt being typed into the composer
  | 'sent' // user bubble shown, assistant "thinking"
  | 'streaming' // assistant reply streaming in
  | 'product' // reply done, product card revealed
  | 'live'; // confirm() fired — hand off to the phase machine

export function ChatApp({ product }: { product: Product }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const [autoplay, setAutoplay] = useState(false);
  const [stage, setStage] = useState<Stage>('blank');
  const [typed, setTyped] = useState('');
  const [streamLen, setStreamLen] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const replyText =
    `Here's the ${product.name} — ${product.tagline.toLowerCase()}. ` +
    `${product.description} It's in stock and ready to ship today.`;

  const confirm = useCallback(async () => {
    setPhase('working');
    setResult(null);
    try {
      const res = await fetch('/api/acs/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          priceCents: product.priceCents,
          currency: product.currency,
        }),
      });
      const data = (await res.json()) as CheckoutResult;
      if (!res.ok || data.error || data.status === 'error') {
        setResult(data);
        setPhase('error');
        return;
      }
      setResult(data);
      setPhase('done');
    } catch (err) {
      setResult({ status: 'error', error: String(err) });
      setPhase('error');
    }
  }, [product]);

  // Autoplay confirm is ILLUSTRATIVE — it simulates the settled result
  // instead of hitting /api/acs/checkout, so the recording's single real
  // purchase remains the broker run (no double $135 spend / mandate
  // double-draw). Same visual end-state as a real confirm.
  const simulateConfirm = useCallback(() => {
    setPhase('working');
    setResult(null);
    after(2400, () => {
      setResult({
        status: 'completed',
        totalAmount: product.priceCents / 100,
        currency: product.currency,
        transferId: 'txn_span_outpost_settled',
        events: [
          { kind: 'identity.verified', protocol: 'A2A', label: 'Agent identity verified — Claude Shopping Agent (KYA Tier 2)' },
          { kind: 'policy.evaluated', protocol: 'AP2', label: 'Spend policy evaluated — within $150 mandate' },
          { kind: 'checkout.created', protocol: 'ACP', label: 'Checkout created at Outpost Outdoors' },
          { kind: 'checkout.completed', protocol: 'ACP', label: 'Checkout completed' },
          { kind: 'settlement.completed', protocol: 'MPP', label: 'Settlement confirmed — $135.00 USDC' },
        ],
      });
      setPhase('done');
    });
  }, [after, product]);

  // Autoplay driver — scripted ChatGPT-style conversation for recording.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoplay') !== '1') return;
    setAutoplay(true);
    setStage('blank');

    // 1) hold on the empty thread, then type the prompt
    after(1500, () => {
      setStage('typing');
      USER_PROMPT.split('').forEach((_, i) => {
        after(i * 34, () => setTyped(USER_PROMPT.slice(0, i + 1)));
      });
      const typeMs = USER_PROMPT.length * 34;
      // 2) send → user bubble + assistant "thinking"
      after(typeMs + 550, () => {
        setStage('sent');
        setTyped('');
        // 3) assistant streams the reply
        after(1500, () => {
          setStage('streaming');
          replyText.split('').forEach((_, i) => {
            after(i * 16, () => setStreamLen(i + 1));
          });
          const streamMs = replyText.length * 16;
          // 4) reply done → product card revealed
          after(streamMs + 500, () => {
            setStage('product');
            // 5) confirm the purchase (real ACS → Sly broker)
            after(2000, () => {
              setStage('live');
              simulateConfirm();
            });
          });
        });
      });
    });

    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
  }, [after, simulateConfirm, replyText]);

  // Follow the conversation as it grows (like real ChatGPT) so the
  // streaming reply, product card and broker trace stay in view.
  useEffect(() => {
    if (!autoplay) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [autoplay, stage, phase, streamLen, result]);

  const showUser =
    !autoplay || (stage !== 'blank' && stage !== 'typing');
  const showAssistant =
    !autoplay ||
    stage === 'sent' ||
    stage === 'streaming' ||
    stage === 'product' ||
    stage === 'live';
  const thinking = autoplay && stage === 'sent';
  const streaming = autoplay && stage === 'streaming';
  const replyComplete = !autoplay || stage === 'product' || stage === 'live';
  const showProduct = !autoplay || stage === 'product' || stage === 'live';
  const showSuggestions = autoplay ? stage === 'blank' : phase === 'idle';

  return (
    <div className="flex h-screen flex-col bg-cgpt-bg text-cgpt-text">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-5 py-7 sm:px-6">
          {showUser ? (
            <UserTurn>
              Looking for the Hoka Clifton 10 — can you pull it up?
            </UserTurn>
          ) : null}

          {showAssistant ? (
          <AssistantTurn>
            {thinking ? (
              <ThinkingDots />
            ) : (
              <div className="cgpt-prose text-[15px] text-cgpt-text">
                {streaming ? (
                  <p>
                    {replyText.slice(0, streamLen)}
                    <span className="cgpt-caret" />
                  </p>
                ) : (
                  <p>
                    Here&apos;s the <strong>{product.name}</strong> —{' '}
                    {product.tagline.toLowerCase()}. {product.description}{' '}
                    It&apos;s in stock and ready to ship today.
                  </p>
                )}
              </div>
            )}

            {showProduct && replyComplete ? (
              <ProductCard
                product={product}
                phase={phase}
                result={result}
                onConfirm={confirm}
              />
            ) : null}

            {phase === 'done' && result ? (
              <div className="cgpt-fade-in cgpt-prose mt-4 text-[15px] text-cgpt-text">
                <p>
                  All set — your order is placed and{' '}
                  <span className="text-cgpt-text">{result.status}</span>. Sly
                  brokered the checkout securely with your Claude shopping agent
                  {result.transferId ? (
                    <>
                      {' '}
                      under transfer{' '}
                      <span className="rounded bg-cgpt-bubble px-1.5 py-0.5 font-mono text-[13px]">
                        {result.transferId}
                      </span>
                    </>
                  ) : null}
                  . You&apos;ll get a shipping confirmation from Outpost Outdoors
                  shortly. Anything else I can help you find?
                </p>
              </div>
            ) : null}

            {phase === 'error' && result ? (
              <div className="cgpt-fade-in cgpt-prose mt-4 text-[15px] text-cgpt-text">
                <p>
                  I wasn&apos;t able to complete that checkout —{' '}
                  {result.error ?? 'the broker did not settle the order.'}{' '}
                  Nothing was charged. Want me to try again?
                </p>
              </div>
            ) : null}

            {replyComplete ? <MessageActions /> : null}
          </AssistantTurn>
          ) : null}

          {result?.events?.length ? (
            <AssistantTurn>
              <p className="mb-3 text-[13px] font-medium text-cgpt-muted">
                Sly broker trace
              </p>
              <ol className="space-y-2 text-[14px]">
                {result.events.map((e, i) => (
                  <li
                    key={i}
                    className="cgpt-fade-in flex items-center gap-2.5 text-cgpt-muted"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {e.protocol ? (
                      <span className="rounded-md border border-cgpt-border bg-cgpt-bubble px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cgpt-text">
                        {e.protocol}
                      </span>
                    ) : (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cgpt-faint" />
                    )}
                    <span>{e.label}</span>
                  </li>
                ))}
              </ol>
              <MessageActions />
            </AssistantTurn>
          ) : null}

          {showSuggestions ? <SuggestedPrompts /> : null}
          <div ref={bottomRef} className="h-px w-full" />
        </div>
      </main>

      <Composer typed={autoplay ? typed : ''} typing={stage === 'typing'} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar — model/GPT switcher chip + window controls                 */
/* ------------------------------------------------------------------ */

function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-3.5 py-2.5">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[16px] font-medium text-cgpt-text transition hover:bg-cgpt-bubble"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-[11px] font-bold text-white">
          O
        </span>
        Outpost Outdoors
        <ChevronDown className="h-4 w-4 text-cgpt-faint" />
      </button>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Share chat"
          className="flex h-9 items-center gap-2 rounded-full border border-cgpt-border px-3.5 text-[13px] font-medium text-cgpt-text transition hover:bg-cgpt-bubble"
        >
          <ShareIcon className="h-4 w-4" />
          Share
        </button>
        <button
          type="button"
          aria-label="More options"
          className="flex h-9 w-9 items-center justify-center rounded-full text-cgpt-muted transition hover:bg-cgpt-bubble"
        >
          <DotsIcon className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Turns                                                               */
/* ------------------------------------------------------------------ */

function UserTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="cgpt-fade-in flex justify-end">
      <div className="max-w-[75%] rounded-3xl bg-cgpt-bubble px-5 py-2.5 text-[15px] leading-relaxed text-cgpt-text">
        {children}
      </div>
    </div>
  );
}

function AssistantTurn({ children }: { children: React.ReactNode }) {
  return (
    <div className="cgpt-fade-in flex gap-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cgpt-border bg-cgpt-bg">
        <SparkIcon className="h-4 w-4 text-cgpt-text" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}

function MessageActions() {
  return (
    <div className="mt-3 flex items-center gap-0.5 text-cgpt-faint">
      {[CopyIcon, ThumbUpIcon, ThumbDownIcon, SpeakerIcon, RetryIcon].map(
        (Icon, i) => (
          <button
            key={i}
            type="button"
            aria-label="Message action"
            className="flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-cgpt-bubble hover:text-cgpt-text"
          >
            <Icon className="h-[15px] w-[15px]" />
          </button>
        )
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div
      className="flex items-center gap-1.5 py-1"
      aria-label="Assistant is thinking"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="cgpt-dot h-2 w-2 rounded-full bg-cgpt-muted"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* In-chat product card + Stripe-ACS confirm-purchase card             */
/* ------------------------------------------------------------------ */

function ProductCard({
  product,
  phase,
  result,
  onConfirm,
}: {
  product: Product;
  phase: Phase;
  result: CheckoutResult | null;
  onConfirm: () => void;
}) {
  const working = phase === 'working';
  const done = phase === 'done';
  const price = formatPrice(product.priceCents, product.currency);

  return (
    <div className="mt-4 max-w-md overflow-hidden rounded-2xl border border-cgpt-border bg-cgpt-panel">
      {/* Product */}
      <div className="flex gap-4 p-4">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-cgpt-bubble text-3xl">
          👟
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-cgpt-bubble px-2 py-0.5 text-[11px] font-medium text-cgpt-muted">
              {product.category}
            </span>
            <span className="text-[11px] text-cgpt-faint">
              Outpost Outdoors
            </span>
          </div>
          <p className="mt-1.5 truncate text-[15px] font-semibold text-cgpt-text">
            {product.name}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-cgpt-muted">
            {product.description}
          </p>
        </div>
      </div>

      {/* Stripe ACS-style confirm bar */}
      <div className="border-t border-cgpt-border bg-cgpt-bg/40 p-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-cgpt-faint">
              Total
            </p>
            <p className="font-mono text-[19px] font-semibold text-cgpt-text">
              {price}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-cgpt-faint">
            <LockIcon className="h-3.5 w-3.5" />
            Secured by Sly
          </div>
        </div>

        <button
          onClick={onConfirm}
          disabled={working || done}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-cgpt-accent py-3 text-[15px] font-semibold text-white shadow-sm transition hover:bg-cgpt-accenthover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {working ? (
            <>
              <span className="cgpt-spin h-4 w-4 rounded-full border-2 border-white/35 border-t-white" />
              <span>Processing checkout</span>
              <span className="cgpt-dot">•</span>
              <span className="cgpt-dot">•</span>
              <span className="cgpt-dot">•</span>
            </>
          ) : done ? (
            <>
              <CheckIcon className="h-4 w-4" />
              Purchase confirmed
            </>
          ) : (
            <>
              <LockIcon className="h-4 w-4" />
              Confirm purchase · {price}
            </>
          )}
        </button>

        <p className="mt-2.5 text-center text-[11px] leading-relaxed text-cgpt-faint">
          {phase === 'error' && result
            ? 'Checkout was not completed — no charge was made.'
            : 'Agent checkout brokered by Sly · ACP / AP2 · no card details shared'}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Suggested prompts + composer                                        */
/* ------------------------------------------------------------------ */

const SUGGESTIONS = [
  'Compare it to the Clifton 9',
  'What sizes are in stock?',
  'Show me trail running options',
  'Track an existing order',
];

function SuggestedPrompts() {
  return (
    <div className="cgpt-fade-in flex flex-wrap gap-2 pl-11">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          type="button"
          className="rounded-full border border-cgpt-border bg-cgpt-chip px-3.5 py-1.5 text-[13px] text-cgpt-muted transition hover:bg-cgpt-chiphover hover:text-cgpt-text"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function Composer({ typed = '', typing = false }: { typed?: string; typing?: boolean }) {
  const hasText = typed.length > 0;
  return (
    <div className="px-4 pb-3">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-end gap-2 rounded-[28px] border border-cgpt-fieldborder bg-cgpt-field px-3 py-2.5 shadow-lg shadow-black/20">
          <button
            type="button"
            aria-label="Attach"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cgpt-muted transition hover:bg-white/10"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
          <div
            className={`flex-1 select-none py-2 text-[15px] ${
              hasText ? 'text-cgpt-text' : 'text-cgpt-faint'
            }`}
          >
            {hasText ? (
              <>
                {typed}
                {typing ? <span className="cgpt-caret" /> : null}
              </>
            ) : (
              'Message Outpost Outdoors'
            )}
          </div>
          <button
            type="button"
            aria-label="Voice"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cgpt-muted transition hover:bg-white/10"
          >
            <MicIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cgpt-send text-cgpt-bg transition hover:opacity-90"
          >
            <SendArrow className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-cgpt-faint">
          Outpost Outdoors GPT can make mistakes. Checkout is brokered by Sly —
          no real orders are fulfilled.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons (inline, ChatGPT-weight strokes — no extra deps)              */
/* ------------------------------------------------------------------ */

type IconProps = { className?: string };
const S = (p: IconProps & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
    aria-hidden="true"
  >
    {p.children}
  </svg>
);

const ChevronDown = (p: IconProps) => (
  <S {...p}>
    <path d="m6 9 6 6 6-6" />
  </S>
);
const ShareIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M12 15V3" />
    <path d="m8 7 4-4 4 4" />
  </S>
);
const DotsIcon = (p: IconProps) => (
  <S {...p}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </S>
);
const SparkIcon = (p: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={p.className}
    aria-hidden="true"
  >
    <path d="M12 2.5c.4 3.6 2.4 5.6 6 6-3.6.4-5.6 2.4-6 6-.4-3.6-2.4-5.6-6-6 3.6-.4 5.6-2.4 6-6Z" />
  </svg>
);
const CopyIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </S>
);
const ThumbUpIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Z" />
    <path d="M7 11l4-8a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7" />
  </S>
);
const ThumbDownIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Z" />
    <path d="M17 13l-4 8a2 2 0 0 1-2-2v-4H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 7.2 4H17" />
  </S>
);
const SpeakerIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="M16 9a4 4 0 0 1 0 6" />
  </S>
);
const RetryIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M3 12a9 9 0 1 1 3 6.7" />
    <path d="M3 21v-5h5" />
  </S>
);
const LockIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </S>
);
const CheckIcon = (p: IconProps) => (
  <S {...p}>
    <path d="m5 13 4 4L19 7" />
  </S>
);
const PlusIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
const MicIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </S>
);
const SendArrow = (p: IconProps) => (
  <S {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </S>
);
