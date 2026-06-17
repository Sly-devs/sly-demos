import { NextResponse } from 'next/server';
import { mayaEnv, readPosition } from '@/lib/maya-flow';

/**
 * GET Maya's real on-chain Aave position via the Compass CLI
 * (`compass credit positions`). Powers the savings card on /savings.
 *
 * Read-only — runs no Sly policy flow and broadcasts nothing.
 */
export async function GET() {
  const env = await mayaEnv();
  if ('error' in env) {
    return NextResponse.json({ error: env.error }, { status: 500 });
  }
  try {
    const position = await readPosition(env);
    return NextResponse.json(position);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
