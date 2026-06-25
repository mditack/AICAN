import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { REDIS_KEYS } from '@/lib/scenarios';

export const revalidate = 0;

export async function GET() {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const recentIds = await redis.lrange(REDIS_KEYS.recentSessions, 0, 499);
    const totalSessions = recentIds.length;

    if (totalSessions === 0) {
      return NextResponse.json({
        totalSessions: 0,
        averageScore: 0,
        sessionsToday: 0,
        topScenario: null,
      });
    }

    const pipeline = redis.pipeline();
    for (const id of recentIds) {
      pipeline.hgetall(REDIS_KEYS.session(id));
    }
    const results = await pipeline.exec<(Record<string, string> | null)[]>();

    const today = new Date().toISOString().slice(0, 10);
    let totalScore = 0;
    let scoreCount = 0;
    let sessionsToday = 0;
    const scenarioCounts: Record<string, number> = {};

    for (const s of results) {
      if (!s) continue;
      const score = Number(s.score);
      if (!isNaN(score)) {
        totalScore += score;
        scoreCount++;
      }
      if (s.endedAt?.startsWith(today)) {
        sessionsToday++;
      }
      if (s.scenarioId) {
        scenarioCounts[s.scenarioId] = (scenarioCounts[s.scenarioId] || 0) + 1;
      }
    }

    let topScenarioId: string | null = null;
    let topCount = 0;
    for (const [id, count] of Object.entries(scenarioCounts)) {
      if (count > topCount) {
        topScenarioId = id;
        topCount = count;
      }
    }

    return NextResponse.json({
      totalSessions,
      averageScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
      sessionsToday,
      topScenario: topScenarioId,
    });
  } catch (error) {
    console.error('GET /api/sessions/stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
