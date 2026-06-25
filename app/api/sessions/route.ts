import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { REDIS_KEYS } from '@/lib/scenarios';

export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { scenarioId, participantName, score, feedback } = body;

    if (!scenarioId || score === undefined) {
      return NextResponse.json(
        { error: 'scenarioId and score are required' },
        { status: 400 }
      );
    }

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const sessionData = {
      scenarioId,
      participantName: participantName || 'Anonymous',
      score: String(score),
      feedback: feedback || '',
      startedAt: body.startedAt || now,
      endedAt: now,
    };

    const pipeline = redis.pipeline();
    pipeline.hset(REDIS_KEYS.session(sessionId), sessionData);
    pipeline.zadd(REDIS_KEYS.sessions(scenarioId), { score: Number(score), member: sessionId });
    pipeline.lpush(REDIS_KEYS.recentSessions, sessionId);
    pipeline.ltrim(REDIS_KEYS.recentSessions, 0, 499);
    await pipeline.exec();

    return NextResponse.json({ sessionId, ...sessionData }, { status: 201 });
  } catch (error) {
    console.error('POST /api/sessions:', error);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const scenarioId = searchParams.get('scenarioId');
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
    const offset = Number(searchParams.get('offset') || '0');

    let sessionIds: string[];

    if (scenarioId) {
      sessionIds = await redis.zrange(REDIS_KEYS.sessions(scenarioId), offset, offset + limit - 1, {
        rev: true,
      });
    } else {
      sessionIds = await redis.lrange(REDIS_KEYS.recentSessions, offset, offset + limit - 1);
    }

    if (!sessionIds.length) {
      return NextResponse.json([]);
    }

    const pipeline = redis.pipeline();
    for (const id of sessionIds) {
      pipeline.hgetall(REDIS_KEYS.session(id));
    }
    const results = await pipeline.exec<(Record<string, string> | null)[]>();

    const sessions = results
      .map((s, i) => (s ? { id: sessionIds[i], ...s } : null))
      .filter(Boolean);

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('GET /api/sessions:', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}
