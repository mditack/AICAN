import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `Kamu adalah AI yang membantu membuat skenario roleplay untuk pelatihan karyawan dalam bahasa Indonesia.

Berdasarkan konteks yang diberikan, buat 3 output terpisah:

1. **agentPrompt**: Prompt untuk karakter AI. Berisi kepribadian, latar belakang, cara bicara, motivasi tersembunyi, dan aturan perilaku karakter. JANGAN berisi alur percakapan atau rubrik penilaian.

2. **sessionPrompt**: Prompt untuk alur sesi. Berisi langkah-langkah percakapan (minta nama, mulai sesi, dll), constraints/batasan, dan instruksi akhir sesi. JANGAN berisi deskripsi karakter atau rubrik penilaian.

3. **rubricPrompt**: Rubrik penilaian 50-100. Berisi kriteria spesifik untuk setiap rentang nilai (50=kurang, 60=perlu pengembangan, 70=cukup, 80=baik, 90-100=sangat baik). Setiap level harus punya deskripsi detail dengan contoh perilaku yang diharapkan.

Format output HARUS JSON valid:
{"agentPrompt": "...", "sessionPrompt": "...", "rubricPrompt": "..."}

Semua output dalam bahasa Indonesia. Buat karakter yang realistis dan menantang. Rubrik harus spesifik dan measurable.`;

export async function POST(req: Request) {
  try {
    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 503 });
    }

    const body = await req.json();
    const {
      name,
      description,
      characterName,
      characterRole,
      situation,
      objective,
      difficulty,
      category,
    } = body;

    if (!name || !characterName || !situation) {
      return NextResponse.json(
        { error: 'name, characterName, and situation are required' },
        { status: 400 }
      );
    }

    const userPrompt = `Buat skenario roleplay dengan detail berikut:
- Nama skenario: ${name}
- Deskripsi: ${description || '-'}
- Nama karakter AI: ${characterName}
- Peran karakter: ${characterRole || '-'}
- Situasi/konteks: ${situation}
- Objektif peserta: ${objective || '-'}
- Tingkat kesulitan: ${difficulty || 'sedang'}
- Kategori: ${category || 'custom'}

Buat agentPrompt, sessionPrompt, dan rubricPrompt sesuai instruksi.`;

    const res = await fetch(`${GEMINI_URL}?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Gemini API error:', res.status, err);
      const detail = err.length < 200 ? err : `Gemini ${res.status}`;
      return NextResponse.json({ error: `AI generation failed: ${detail}` }, { status: 502 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 502 });
    }

    const parsed = JSON.parse(text);
    const str = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v, null, 2) || '');
    return NextResponse.json({
      agentPrompt: str(parsed.agentPrompt),
      sessionPrompt: str(parsed.sessionPrompt),
      rubricPrompt: str(parsed.rubricPrompt),
    });
  } catch (error) {
    console.error('POST /api/scenarios/generate:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Generation failed: ${msg}` }, { status: 500 });
  }
}
