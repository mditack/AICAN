import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import {
  DEFAULT_AGENT_PROMPT,
  DEFAULT_SESSION_PROMPT,
  type StoredPrompts,
} from '@/lib/prompt-defaults';

const REDIS_KEY = 'aican:prompts';

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export const revalidate = 0;

/** GET: return current prompts (from Upstash or defaults). Used by the prompts page and by the LiveKit agent. */
export async function GET() {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({
        agentPrompt: DEFAULT_AGENT_PROMPT,
        sessionPrompt: DEFAULT_SESSION_PROMPT,
        source: 'defaults',
      } satisfies StoredPrompts & { source: string });
    }
    const stored = await redis.get<StoredPrompts>(REDIS_KEY);
    if (!stored || typeof stored?.agentPrompt !== 'string' || typeof stored?.sessionPrompt !== 'string') {
      return NextResponse.json({
        agentPrompt: DEFAULT_AGENT_PROMPT,
        sessionPrompt: DEFAULT_SESSION_PROMPT,
        source: 'defaults',
      } satisfies StoredPrompts & { source: string });
    }
    return NextResponse.json({
      ...stored,
      source: 'upstash',
    } satisfies StoredPrompts & { source: string });
  } catch (error) {
    console.error('GET /api/prompts:', error);
    return NextResponse.json(
      { error: 'Failed to load prompts' },
      { status: 500 }
    );
  }
}

/** POST: save prompts to Upstash. Body: { agentPrompt?: string, sessionPrompt?: string }. */
export async function POST(req: Request) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json(
        { error: 'Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.' },
        { status: 503 }
      );
    }
    const body = await req.json();
    const agentPrompt =
      typeof body?.agentPrompt === 'string' ? body.agentPrompt : undefined;
    const sessionPrompt =
      typeof body?.sessionPrompt === 'string' ? body.sessionPrompt : undefined;
    if (agentPrompt === undefined && sessionPrompt === undefined) {
      return NextResponse.json(
        { error: 'Provide at least one of agentPrompt or sessionPrompt' },
        { status: 400 }
      );
    }
    const existing = (await redis.get<StoredPrompts>(REDIS_KEY)) ?? {
      agentPrompt: DEFAULT_AGENT_PROMPT,
      sessionPrompt: DEFAULT_SESSION_PROMPT,
    };
    const next: StoredPrompts = {
      agentPrompt: agentPrompt ?? existing.agentPrompt,
      sessionPrompt: sessionPrompt ?? existing.sessionPrompt,
    };
    await redis.set(REDIS_KEY, next);
    return NextResponse.json(next);
  } catch (error) {
    console.error('POST /api/prompts:', error);
    return NextResponse.json(
      { error: 'Failed to save prompts' },
      { status: 500 }
    );
  }
}
