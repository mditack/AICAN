import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import {
  DEFAULT_AGENT_PROMPT,
  DEFAULT_SESSION_PROMPT,
  DEFAULT_VOICE,
  type StoredPrompts,
  VOICE_OPTIONS,
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
        voice: DEFAULT_VOICE,
        source: 'defaults',
      } satisfies StoredPrompts & { source: string });
    }
    const stored = await redis.get<StoredPrompts>(REDIS_KEY);
    if (
      !stored ||
      typeof stored?.agentPrompt !== 'string' ||
      typeof stored?.sessionPrompt !== 'string'
    ) {
      return NextResponse.json({
        agentPrompt: DEFAULT_AGENT_PROMPT,
        sessionPrompt: DEFAULT_SESSION_PROMPT,
        voice: DEFAULT_VOICE,
        source: 'defaults',
      } satisfies StoredPrompts & { source: string });
    }
    const voice =
      typeof stored.voice === 'string' && stored.voice.length > 0 ? stored.voice : DEFAULT_VOICE;
    return NextResponse.json({
      ...stored,
      voice,
      source: 'upstash',
    } satisfies StoredPrompts & { source: string });
  } catch (error) {
    console.error('GET /api/prompts:', error);
    return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 });
  }
}

const VALID_VOICE_IDS = new Set(VOICE_OPTIONS.map((v) => v.id));

/** POST: save prompts and voice to Upstash. Body: { agentPrompt?, sessionPrompt?, voice? }. */
export async function POST(req: Request) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json(
        {
          error:
            'Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
        },
        { status: 503 }
      );
    }
    const body = await req.json();
    const agentPrompt = typeof body?.agentPrompt === 'string' ? body.agentPrompt : undefined;
    const sessionPrompt = typeof body?.sessionPrompt === 'string' ? body.sessionPrompt : undefined;
    const voiceRaw = typeof body?.voice === 'string' ? body.voice.trim() : undefined;
    const voice = voiceRaw && VALID_VOICE_IDS.has(voiceRaw) ? voiceRaw : undefined;
    if (agentPrompt === undefined && sessionPrompt === undefined && voice === undefined) {
      return NextResponse.json(
        { error: 'Provide at least one of agentPrompt, sessionPrompt, or voice' },
        { status: 400 }
      );
    }
    const existing = (await redis.get<StoredPrompts>(REDIS_KEY)) ?? {
      agentPrompt: DEFAULT_AGENT_PROMPT,
      sessionPrompt: DEFAULT_SESSION_PROMPT,
      voice: DEFAULT_VOICE,
    };
    const existingVoice =
      typeof existing.voice === 'string' && existing.voice.length > 0
        ? existing.voice
        : DEFAULT_VOICE;
    const next: StoredPrompts = {
      agentPrompt: agentPrompt ?? existing.agentPrompt,
      sessionPrompt: sessionPrompt ?? existing.sessionPrompt,
      voice: voice ?? existingVoice,
    };
    await redis.set(REDIS_KEY, next);
    return NextResponse.json(next);
  } catch (error) {
    console.error('POST /api/prompts:', error);
    return NextResponse.json({ error: 'Failed to save prompts' }, { status: 500 });
  }
}
