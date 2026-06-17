import { NextResponse } from 'next/server';

/**
 * Deprecated. The Span flow is now two-phase so a human authorizes the
 * purchase by clicking "Buy" in the Claude checkout widget:
 *   POST /api/broker/prepare  → open UCP checkout + request scope
 *   POST /api/broker/confirm  → (Buy clicked) approve scope + complete
 */
export async function POST() {
  return NextResponse.json(
    {
      status: 'error',
      error:
        'Deprecated: use POST /api/broker/prepare then POST /api/broker/confirm.',
    },
    { status: 410 },
  );
}
