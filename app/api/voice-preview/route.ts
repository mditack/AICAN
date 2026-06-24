import { NextResponse } from 'next/server';

const PREVIEW_TEXT = 'Halo, saya akan menjadi rekan roleplay Anda hari ini. Mari kita mulai.';

/** POST: generate a short ElevenLabs voice preview. Body: { voiceId: string } */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.ELEVEN_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVEN_API_KEY not configured on server.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const voiceId = typeof body?.voiceId === 'string' ? body.voiceId.trim() : '';
    if (!voiceId || voiceId.length < 10) {
      return NextResponse.json({ error: 'Invalid voiceId' }, { status: 400 });
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: PREVIEW_TEXT,
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('ElevenLabs preview error:', res.status, text);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${res.status}` },
        { status: 502 }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('POST /api/voice-preview:', error);
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 });
  }
}
