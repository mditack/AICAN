import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';
import { ensureString, getRedis } from '@/lib/redis';
import { REDIS_KEYS } from '@/lib/scenarios';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export const revalidate = 0;

async function fetchScenarioPrompts(scenarioId?: string) {
  if (!scenarioId) return null;
  const redis = getRedis();
  if (!redis) return null;

  try {
    const data = await redis.hgetall(REDIS_KEYS.scenario(scenarioId));
    if (!data || !data.agentPrompt) return null;
    return {
      agentPrompt: ensureString(data.agentPrompt),
      sessionPrompt: ensureString(data.sessionPrompt),
      rubricPrompt: ensureString(data.rubricPrompt),
      voice: typeof data.voice === 'string' ? data.voice : '',
      ttsProvider: typeof data.ttsProvider === 'string' ? data.ttsProvider : 'gemini',
    };
  } catch (e) {
    console.error('Failed to fetch scenario:', e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    const body = await req.json();
    const agentName: string | undefined =
      body?.room_config?.agents?.[0]?.agent_name ?? body?.agentName;
    const avatarEnabled =
      body?.avatar_enabled !== undefined ? body.avatar_enabled : body?.avatarEnabled !== false;
    const scenarioId: string | undefined = body?.scenarioId;

    const scenario = await fetchScenarioPrompts(scenarioId);

    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    const metadata: Record<string, unknown> = { avatarEnabled, scenarioId };
    if (scenario) {
      metadata.scenario = scenario;
    }

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      agentName,
      JSON.stringify(metadata)
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken: participantToken,
      participantName,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName?: string,
  metadata?: string
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  at.metadata = metadata || '{}';

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (agentName) {
    at.roomConfig = new RoomConfiguration({
      agents: [{ agentName }],
    });
  }

  return at.toJwt();
}
