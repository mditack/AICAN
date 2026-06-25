import { NextResponse } from 'next/server';
import { ensureString, getRedis } from '@/lib/redis';
import type { Scenario } from '@/lib/scenarios';
import { REDIS_KEYS } from '@/lib/scenarios';

export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const scenario = (await redis.hgetall(REDIS_KEYS.scenario(id))) as Scenario | null;
    if (!scenario || !scenario.name) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...scenario,
      id,
      agentPrompt: ensureString(scenario.agentPrompt),
      sessionPrompt: ensureString(scenario.sessionPrompt),
      rubricPrompt: ensureString(scenario.rubricPrompt),
    });
  } catch (error) {
    console.error('GET /api/scenarios/[id]:', error);
    return NextResponse.json({ error: 'Failed to get scenario' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const exists = await redis.sismember(REDIS_KEYS.scenarios, id);
    if (!exists) {
      return NextResponse.json({ error: `Scenario not found (id=${id})` }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, string> = { updatedAt: new Date().toISOString() };

    const allowedFields = [
      'name',
      'description',
      'category',
      'agentPrompt',
      'sessionPrompt',
      'rubricPrompt',
      'voice',
      'ttsProvider',
      'isActive',
      'createdBy',
    ];
    for (const field of allowedFields) {
      if (typeof body[field] === 'string') {
        updates[field] = body[field];
      }
    }

    await redis.hset(REDIS_KEYS.scenario(id), updates);
    const updated = (await redis.hgetall(REDIS_KEYS.scenario(id))) as Scenario | null;

    return NextResponse.json({
      ...updated,
      id,
      agentPrompt: ensureString(updated?.agentPrompt),
      sessionPrompt: ensureString(updated?.sessionPrompt),
      rubricPrompt: ensureString(updated?.rubricPrompt),
    });
  } catch (error) {
    console.error('PUT /api/scenarios/[id]:', error);
    return NextResponse.json({ error: 'Failed to update scenario' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const pipeline = redis.pipeline();
    pipeline.srem(REDIS_KEYS.scenarios, id);
    pipeline.del(REDIS_KEYS.scenario(id));

    const defaultId = await redis.get<string>(REDIS_KEYS.defaultScenario);
    if (defaultId === id) {
      pipeline.del(REDIS_KEYS.defaultScenario);
    }

    await pipeline.exec();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/scenarios/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete scenario' }, { status: 500 });
  }
}
