import { DeviceFrame } from '@/components/device-frame';
import { WALLET } from '@/lib/demo';

interface Txn {
  merchant: string;
  item: string;
  amount: number;
  when: string;
  protocol: string;
  agent: boolean;
}

const HISTORY: Txn[] = [
  {
    merchant: 'Crate',
    item: 'Hoka Clifton 10',
    amount: 145.0,
    when: 'Just now',
    protocol: 'ACP',
    agent: true,
  },
  {
    merchant: 'Aster Coffee',
    item: 'Subscription · 2 bags',
    amount: 38.0,
    when: 'Yesterday',
    protocol: 'AP2',
    agent: true,
  },
  {
    merchant: 'Lume',
    item: 'Desk lamp · warm',
    amount: 89.0,
    when: '3 days ago',
    protocol: 'ACP',
    agent: true,
  },
  {
    merchant: 'Coral',
    item: 'Added funds',
    amount: -250.0,
    when: 'Apr 28',
    protocol: 'MPP',
    agent: false,
  },
];

export default function Activity() {
  return (
    <DeviceFrame active="activity">
      <header className="px-5 pt-2">
        <h1 className="text-[22px] font-semibold tracking-tight text-cloud">
          Activity
        </h1>
        <p className="mt-0.5 text-[13px] text-mute">
          Agent purchases settled in {WALLET.currency}
        </p>
      </header>

      <ul className="mt-5 space-y-2.5 px-5">
        {HISTORY.map((t, i) => {
          const debit = t.amount >= 0;
          return (
            <li
              key={i}
              className="animate-fade-up flex items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-hairline transition-colors hover:ring-coral/15"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-elevate text-[15px]">
                {debit ? '🧾' : '＋'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[14.5px] font-semibold text-cloud">
                    {t.merchant}
                  </p>
                  {t.agent && (
                    <span className="rounded bg-coral/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-coral-soft ring-1 ring-coral/25">
                      agent
                    </span>
                  )}
                </div>
                <p className="truncate text-[12px] text-mute">{t.item}</p>
              </div>
              <div className="text-right">
                <p
                  className={`text-[14.5px] font-semibold tabnums ${
                    debit ? 'text-cloud' : 'text-mint'
                  }`}
                >
                  {debit ? '−' : '+'}$
                  {Math.abs(t.amount).toFixed(2)}
                </p>
                <p className="text-[11px] text-mute">{t.when}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 px-5 text-center text-[11px] leading-relaxed text-mute/70">
        Demo activity for the Sly platform. No real orders are fulfilled.
      </p>
    </DeviceFrame>
  );
}
