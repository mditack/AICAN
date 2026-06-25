import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function POST(req: Request) {
  try {
    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { agentPrompt, sessionPrompt, rubricPrompt, instruction } = body;

    if (!instruction) {
      return NextResponse.json({ error: 'instruction is required' }, { status: 400 });
    }

    const prompt = `Kamu adalah AI yang membantu merevisi skenario roleplay untuk pelatihan karyawan.

Berikut prompt skenario saat ini:

### Agent Prompt (Karakter)
${agentPrompt || '(kosong)'}

### Session Prompt (Alur)
${sessionPrompt || '(kosong)'}

### Rubrik Penilaian
${rubricPrompt || '(kosong)'}

---

Instruksi revisi dari admin: "${instruction}"

Terapkan revisi sesuai instruksi. Kembalikan HANYA bagian yang berubah. Format output JSON:
{"agentPrompt": "...", "sessionPrompt": "...", "rubricPrompt": "..."}

Jika suatu bagian TIDAK berubah, tetap sertakan versi aslinya. Semua output dalam bahasa Indonesia.`;

    const res = await fetch(`${GEMINI_URL}?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Gemini API error:', res.status, err);
      const detail = err.length < 200 ? err : `Gemini ${res.status}`;
      return NextResponse.json({ error: `AI refinement failed: ${detail}` }, { status: 502 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 502 });
    }

    const parsed = JSON.parse(text);
    return NextResponse.json({
      agentPrompt: parsed.agentPrompt || agentPrompt,
      sessionPrompt: parsed.sessionPrompt || sessionPrompt,
      rubricPrompt: parsed.rubricPrompt || rubricPrompt,
    });
  } catch (error) {
    console.error('POST /api/scenarios/refine:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Refinement failed: ${msg}` }, { status: 500 });
  }
}
