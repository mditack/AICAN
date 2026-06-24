import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import {
  DEFAULT_AGENT_PROMPT,
  DEFAULT_SESSION_PROMPT,
  DEFAULT_TTS_PROVIDER,
  ELEVENLABS_VOICE_OPTIONS,
  GEMINI_VOICE_OPTIONS,
  type StoredPrompts,
  type TtsProvider,
  getDefaultVoice,
} from '@/lib/prompt-defaults';

const REDIS_KEY = 'aican:prompts';
const VALID_TTS_PROVIDERS = new Set<TtsProvider>(['gemini', 'elevenlabs']);

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function validProvider(v: unknown): TtsProvider {
  if (typeof v === 'string' && VALID_TTS_PROVIDERS.has(v as TtsProvider)) return v as TtsProvider;
  return DEFAULT_TTS_PROVIDER;
}

export const revalidate = 0;

/** GET: return current prompts (from Upstash or defaults). Used by the prompts page and by the LiveKit agent. */
export async function GET() {
  try {
    const redis = getRedis();
    const defaultProvider = DEFAULT_TTS_PROVIDER;
    const defaults: StoredPrompts & { source: string } = {
      agentPrompt: DEFAULT_AGENT_PROMPT,
      sessionPrompt: DEFAULT_SESSION_PROMPT,
      voice: getDefaultVoice(defaultProvider),
      ttsProvider: defaultProvider,
      source: 'defaults',
    };

    if (!redis) {
      return NextResponse.json(defaults);
    }

    const stored = await redis.get<StoredPrompts>(REDIS_KEY);
    if (
      !stored ||
      typeof stored?.agentPrompt !== 'string' ||
      typeof stored?.sessionPrompt !== 'string'
    ) {
      return NextResponse.json(defaults);
    }

    const ttsProvider = validProvider(stored.ttsProvider);
    const voice =
      typeof stored.voice === 'string' && stored.voice.length > 0
        ? stored.voice
        : getDefaultVoice(ttsProvider);

    return NextResponse.json({
      ...stored,
      voice,
      ttsProvider,
      source: 'upstash',
    } satisfies StoredPrompts & { source: string });
  } catch (error) {
    console.error('GET /api/prompts:', error);
    return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 });
  }
}

const VALID_GEMINI_IDS = new Set(GEMINI_VOICE_OPTIONS.map((v) => v.id));
const VALID_ELEVENLABS_IDS = new Set(ELEVENLABS_VOICE_OPTIONS.map((v) => v.id));

function isValidVoice(voiceId: string, provider: TtsProvider): boolean {
  if (provider === 'elevenlabs') return VALID_ELEVENLABS_IDS.has(voiceId);
  return VALID_GEMINI_IDS.has(voiceId);
}

/** POST: save prompts, voice, and TTS provider to Upstash. */
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
    const ttsProviderRaw = typeof body?.ttsProvider === 'string' ? body.ttsProvider : undefined;
    const ttsProvider =
      ttsProviderRaw && VALID_TTS_PROVIDERS.has(ttsProviderRaw as TtsProvider)
        ? (ttsProviderRaw as TtsProvider)
        : undefined;
    const voiceRaw = typeof body?.voice === 'string' ? body.voice.trim() : undefined;
    const resolvedProvider = ttsProvider ?? DEFAULT_TTS_PROVIDER;
    const voice = voiceRaw && isValidVoice(voiceRaw, resolvedProvider) ? voiceRaw : undefined;

    if (
      agentPrompt === undefined &&
      sessionPrompt === undefined &&
      voice === undefined &&
      ttsProvider === undefined
    ) {
      return NextResponse.json(
        { error: 'Provide at least one of agentPrompt, sessionPrompt, voice, or ttsProvider' },
        { status: 400 }
      );
    }

    const existing = (await redis.get<StoredPrompts>(REDIS_KEY)) ?? {
      agentPrompt: DEFAULT_AGENT_PROMPT,
      sessionPrompt: DEFAULT_SESSION_PROMPT,
      voice: getDefaultVoice(DEFAULT_TTS_PROVIDER),
      ttsProvider: DEFAULT_TTS_PROVIDER,
    };

    const existingProvider = validProvider(existing.ttsProvider);
    const nextProvider = ttsProvider ?? existingProvider;
    const existingVoice =
      typeof existing.voice === 'string' && existing.voice.length > 0
        ? existing.voice
        : getDefaultVoice(nextProvider);

    const next: StoredPrompts = {
      agentPrompt: agentPrompt ?? existing.agentPrompt,
      sessionPrompt: sessionPrompt ?? existing.sessionPrompt,
      voice: voice ?? existingVoice,
      ttsProvider: nextProvider,
    };

    await redis.set(REDIS_KEY, next);
    return NextResponse.json(next);
  } catch (error) {
    console.error('POST /api/prompts:', error);
    return NextResponse.json({ error: 'Failed to save prompts' }, { status: 500 });
  }
}
