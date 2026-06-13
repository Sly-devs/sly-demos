/**
 * @sly/demo-kit — shared demo-flow helpers over @sly_ai/sdk.
 *
 * The SDK's `Sly` class is already a unified client. This kit adds:
 *  - a structured event stream every demo surface can render (broker viewer,
 *    Coral activity feed, Aster tx table) without re-implementing step tracking
 *  - one-call canonical flows (`agentBuy`) so each demo's glue code stays tiny
 *
 * Demo-only. Never import this from production apps.
 */

import { Sly } from '@sly_ai/sdk';
import type {
  CreateCheckoutRequest,
  CompleteCheckoutRequest,
  CompleteCheckoutResponse,
  CheckoutWithItems,
} from '@sly_ai/sdk/acp';

export type DemoEventKind =
  | 'mandate.checked'
  | 'agent.verified'
  | 'policy.evaluated'
  | 'checkout.created'
  | 'scope.requested'
  | 'scope.approved'
  | 'scope.denied'
  | 'checkout.completed'
  | 'settlement.pending'
  | 'settlement.completed'
  | 'error';

export interface DemoEvent {
  kind: DemoEventKind;
  /** Protocol badge for the broker viewer: ACP, AP2, UCP, x402, A2A, MPP. */
  protocol?: 'ACP' | 'AP2' | 'UCP' | 'x402' | 'A2A' | 'MPP';
  label: string;
  detail?: Record<string, unknown>;
  at: string;
}

export type DemoEventListener = (e: DemoEvent) => void;

export interface DemoClientOptions {
  apiKey: string;
  /** Override inferred base URL (e.g. local API at http://localhost:4000). */
  baseUrl?: string;
  environment?: 'sandbox' | 'production';
  onEvent?: DemoEventListener;
}

export interface AgentBuyInput {
  checkout: CreateCheckoutRequest;
  /** Completion payload (e.g. shared_payment_token). */
  complete?: CompleteCheckoutRequest;
}

export interface AgentBuyResult {
  created: CheckoutWithItems;
  completed: CompleteCheckoutResponse;
  events: DemoEvent[];
}

/** Epic-82 scope request (agent-side). */
export interface RequestScopeInput {
  scope?: 'tenant_read' | 'tenant_write' | 'treasury';
  lifecycle?: 'one_shot' | 'standing';
  /** Human-readable reason shown to the approver (min 8 chars). */
  purpose: string;
  intent?: { route?: string; args?: Record<string, unknown> };
}

export class SlyDemoClient {
  readonly sly: Sly;
  readonly baseUrl: string;
  private apiKey: string;
  private listeners: DemoEventListener[] = [];
  private log: DemoEvent[] = [];

  constructor(opts: DemoClientOptions) {
    this.baseUrl = (opts.baseUrl ?? 'https://api.getsly.ai').replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.sly = new Sly({
      apiKey: opts.apiKey,
      // SlyConfig's field is `apiUrl` (NOT `baseUrl`). Passing the wrong
      // key made the SDK fall back to the env-inferred default
      // (sandbox.getsly.ai) and silently ignore the local API — so SDK
      // calls (createCheckout/completeCheckout) bypassed the local
      // server while raw scope calls hit it. Always pin apiUrl.
      ...(opts.baseUrl ? { apiUrl: opts.baseUrl } : {}),
      ...(opts.environment ? { environment: opts.environment } : {}),
    } as ConstructorParameters<typeof Sly>[0]);
    if (opts.onEvent) this.listeners.push(opts.onEvent);
  }

  /** Raw authed JSON call for endpoints the SDK doesn't wrap (scopes). */
  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new Error(json?.error ?? `${method} ${path} → ${res.status}`);
    }
    return (json?.data ?? json) as T;
  }

  /** Generic authed GET for endpoints the SDK doesn't wrap. */
  apiGet<T>(path: string): Promise<T> {
    return this.req<T>('GET', path);
  }

  /** Generic authed PATCH for endpoints the SDK doesn't wrap. */
  apiPatch<T>(path: string, body: unknown): Promise<T> {
    return this.req<T>('PATCH', path, body);
  }

  /**
   * Agent-side: request an elevated scope (Epic-82). The configured key
   * MUST be an agent token. Returns the pending request id; a tenant
   * owner must approve it via decideScope before the elevation applies.
   */
  async requestScope(
    input: RequestScopeInput,
  ): Promise<{ requestId: string; status: string }> {
    const r = await this.req<{ request_id: string; status: string }>(
      'POST',
      '/v1/auth/scopes/request',
      {
        scope: input.scope ?? 'treasury',
        lifecycle: input.lifecycle ?? 'one_shot',
        purpose: input.purpose,
        ...(input.intent ? { intent: input.intent } : {}),
      },
    );
    this.emit({
      kind: 'scope.requested',
      protocol: 'AP2',
      label: `Scope requested: ${input.scope ?? 'treasury'} — ${input.purpose}`,
      detail: { request_id: r.request_id, status: r.status },
    });
    return { requestId: r.request_id, status: r.status };
  }

  /**
   * Tenant-owner side: approve (or deny) a pending scope request. The
   * configured key MUST be a tenant API key (owner-equivalent) or owner JWT.
   */
  async decideScope(
    requestId: string,
    decision: 'approve' | 'deny' = 'approve',
  ): Promise<{ status: string }> {
    const r = await this.req<{ status: string }>(
      'POST',
      `/v1/organization/scopes/${requestId}/decide`,
      { decision },
    );
    this.emit({
      kind: decision === 'approve' ? 'scope.approved' : 'scope.denied',
      protocol: 'AP2',
      label:
        decision === 'approve'
          ? 'Treasury scope approved by account owner'
          : 'Scope request denied',
      detail: { request_id: requestId, status: r.status },
    });
    return r;
  }

  on(listener: DemoEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(e: Omit<DemoEvent, 'at'>): DemoEvent {
    const full: DemoEvent = { ...e, at: new Date().toISOString() };
    this.log.push(full);
    for (const l of this.listeners) l(full);
    return full;
  }

  get events(): DemoEvent[] {
    return [...this.log];
  }

  /**
   * Canonical agentic purchase: ACP checkout → complete. Emits a structured
   * event at every step for demo surfaces (broker viewer, activity feeds) to
   * render. Settlement is driven server-side off the resulting transfer; the
   * completion response carries the terminal status + transfer_id.
   */
  async agentBuy(input: AgentBuyInput): Promise<AgentBuyResult> {
    try {
      const created = await this.sly.acp.createCheckout(input.checkout);
      this.emit({
        kind: 'checkout.created',
        protocol: 'ACP',
        label: `Checkout created for ${input.checkout.merchant_name ?? input.checkout.merchant_id}`,
        detail: { checkout_id: created.id, status: created.status },
      });

      // ACP complete requires a non-empty shared_payment_token. In the
      // sandbox any opaque token settles (mirrors marketplace-sim). Demos
      // can override via input.complete.
      const completePayload: CompleteCheckoutRequest = {
        shared_payment_token: `demo-spt-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`,
        idempotency_key: `demo-idem-${created.id}`,
        ...input.complete,
      };
      const completed = await this.sly.acp.completeCheckout(
        created.id,
        completePayload
      );
      this.emit({
        kind: 'checkout.completed',
        protocol: 'ACP',
        label: 'Checkout completed',
        detail: {
          checkout_id: completed.checkout_id,
          transfer_id: completed.transfer_id,
          status: completed.status,
          total_amount: completed.total_amount,
          currency: completed.currency,
        },
      });

      this.emit({
        kind: 'settlement.completed',
        protocol: 'MPP',
        label: `Settlement ${completed.status}`,
        detail: { transfer_id: completed.transfer_id, status: completed.status },
      });

      return { created, completed, events: this.events };
    } catch (err) {
      this.emit({
        kind: 'error',
        label: err instanceof Error ? err.message : 'agentBuy failed',
        detail: { error: String(err) },
      });
      throw err;
    }
  }
}

export function createDemoClient(opts: DemoClientOptions): SlyDemoClient {
  return new SlyDemoClient(opts);
}

export type {
  CreateCheckoutRequest,
  CompleteCheckoutRequest,
  CompleteCheckoutResponse,
  CheckoutWithItems,
};
