import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { REDIS_KEYS } from '@/lib/scenarios';

export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const session = await redis.hgetall(REDIS_KEYS.session(id));
    if (!session || !session.scenarioId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ id, ...session });
  } catch (error) {
    console.error('GET /api/sessions/[id]:', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}
