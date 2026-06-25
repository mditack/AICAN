import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { StoredPrompts } from '@/lib/prompt-defaults';
import { getRedis } from '@/lib/redis';
import { REDIS_KEYS, type Scenario } from '@/lib/scenarios';

export async function POST() {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const defaultId = await redis.get<string>(REDIS_KEYS.defaultScenario);
    if (defaultId) {
      return NextResponse.json({
        message: 'Already migrated',
        scenarioId: defaultId,
        migrated: false,
      });
    }

    const stored = await redis.get<StoredPrompts>('aican:prompts');
    const id = randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const scenario: Scenario = {
      id,
      name: 'Coaching Karyawan Senior',
      description:
        'Roleplay coaching karyawan senior yang kehilangan motivasi karena perubahan cara kerja digital.',
      category: 'coaching',
      agentPrompt: stored?.agentPrompt || '',
      sessionPrompt: stored?.sessionPrompt || '',
      rubricPrompt: '',
      voice: stored?.voice || '',
      ttsProvider: (stored?.ttsProvider as 'gemini' | 'elevenlabs') || 'gemini',
      isActive: 'true',
      createdBy: 'system (migration)',
      createdAt: now,
      updatedAt: now,
    };

    const pipeline = redis.pipeline();
    pipeline.sadd(REDIS_KEYS.scenarios, id);
    pipeline.hset(REDIS_KEYS.scenario(id), scenario);
    pipeline.set(REDIS_KEYS.defaultScenario, id);
    await pipeline.exec();

    return NextResponse.json({ scenarioId: id, migrated: true });
  } catch (error) {
    console.error('POST /api/scenarios/migrate:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
