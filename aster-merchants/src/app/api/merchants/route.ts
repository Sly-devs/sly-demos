import { NextResponse } from 'next/server';
import { fetchMerchants } from '@/lib/sly';

export const dynamic = 'force-dynamic';

/** Live merchant directory — real Aster-tenant accounts via the operator key. */
export async function GET() {
  const { merchants, live } = await fetchMerchants();
  return NextResponse.json({
    live,
    source: live ? 'sly-api' : 'fallback',
    merchants,
  });
}
