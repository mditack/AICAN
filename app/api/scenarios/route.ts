import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getRedis } from '@/lib/redis';
import { REDIS_KEYS, type Scenario, type ScenarioInput } from '@/lib/scenarios';

export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') === 'true';

    const ids = await redis.smembers(REDIS_KEYS.scenarios);
    if (!ids.length) {
      return NextResponse.json([]);
    }

    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.hgetall(REDIS_KEYS.scenario(id));
    }
    const results = await pipeline.exec<(Scenario | null)[]>();

    let scenarios = results
      .filter((s): s is Scenario => s !== null && typeof s.name === 'string')
      .map((s, i) => ({ ...s, id: ids[i] }));

    if (activeOnly) {
      scenarios = scenarios.filter((s) => String(s.isActive) === 'true');
    }

    scenarios.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json(scenarios);
  } catch (error) {
    console.error('GET /api/scenarios (returning empty):', error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const body: ScenarioInput = await req.json();
    if (!body.name || !body.agentPrompt || !body.sessionPrompt) {
      return NextResponse.json(
        { error: 'name, agentPrompt, and sessionPrompt are required' },
        { status: 400 }
      );
    }

    const id = randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const scenario: Scenario = {
      id,
      name: body.name,
      description: body.description || '',
      category: body.category || 'custom',
      agentPrompt: body.agentPrompt,
      sessionPrompt: body.sessionPrompt,
      rubricPrompt: body.rubricPrompt || '',
      voice: body.voice || '',
      ttsProvider: body.ttsProvider || 'gemini',
      isActive: body.isActive ?? 'true',
      createdBy: body.createdBy || 'admin',
      createdAt: now,
      updatedAt: now,
    };

    const pipeline = redis.pipeline();
    pipeline.sadd(REDIS_KEYS.scenarios, id);
    pipeline.hset(REDIS_KEYS.scenario(id), scenario as unknown as Record<string, string>);
    await pipeline.exec();

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    console.error('POST /api/scenarios:', error);
    return NextResponse.json({ error: 'Failed to create scenario' }, { status: 500 });
  }
}
