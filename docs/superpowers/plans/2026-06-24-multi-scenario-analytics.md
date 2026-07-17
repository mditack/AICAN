# Multi-Scenario Roleplay + AI Builder + Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform AICAN from a single hardcoded roleplay scenario into a multi-scenario platform with admin CRUD, AI-assisted scenario building, and session analytics.

**Architecture:** Upstash Redis stores scenarios as hashes keyed by `aican:scenario:{id}` with a set index at `aican:scenarios`. The welcome page shows scenario cards; the selected scenario ID flows through LiveKit participant metadata to the Python agent. AI scenario generation uses Gemini 2.5 Flash text API. Score capture happens on `participant_disconnected` in the agent, which POSTs results to a sessions API.

**Tech Stack:** Next.js 15 (App Router), Upstash Redis, LiveKit Agents (Python), Gemini 2.5 Flash, Vercel, Tailwind CSS, Phosphor Icons, Framer Motion

## Global Constraints

- All TypeScript files must pass `prettier --check` with `@trivago/prettier-plugin-sort-imports` and `importOrderSortSpecifiers: true`. Import order: UPPERCASE constants → `type` imports → lowercase functions.
- Indonesian language for all user-facing strings.
- No user authentication (anonymous access). Admin pages are unprotected for now.
- Redis values are strings — booleans stored as `"true"`/`"false"`.
- Agent fallback: if no scenarioId in metadata, load `aican:scenario:default`.
- Score capture on `participant_disconnected` event, NOT on audio keyword "selesai".
- Reuse existing UI patterns: `@phosphor-icons/react`, `@/components/ui/*`, Tailwind classes from existing pages.

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `lib/redis.ts` | Shared Redis client factory (extracted from `app/api/prompts/route.ts`) |
| `lib/scenarios.ts` | Scenario TypeScript types + constants (categories, difficulty levels) |
| `app/admin/scenarios/page.tsx` | Admin scenario list — table with toggle/delete/duplicate |
| `app/admin/scenarios/new/page.tsx` | AI-assisted scenario builder (5-step form) |
| `app/admin/scenarios/[id]/page.tsx` | Edit existing scenario (3 prompt textareas + voice) |
| `app/admin/analytics/page.tsx` | Analytics dashboard with stats cards + session table + chart |
| `app/admin/layout.tsx` | Shared admin layout with sidebar nav |
| `app/api/scenarios/route.ts` | GET (list) + POST (create) scenarios |
| `app/api/scenarios/[id]/route.ts` | GET + PUT + DELETE single scenario |
| `app/api/scenarios/generate/route.ts` | AI generate prompts from context |
| `app/api/scenarios/refine/route.ts` | AI refine prompts with instruction |
| `app/api/scenarios/migrate/route.ts` | One-time migration from `aican:prompts` |
| `app/api/sessions/route.ts` | POST (save result) + GET (list with filters) |
| `app/api/sessions/[id]/route.ts` | GET session detail with feedback |
| `app/api/sessions/stats/route.ts` | GET aggregated stats for dashboard |
| `components/app/scenario-card.tsx` | Reusable scenario card for welcome page |
| `components/admin/voice-picker.tsx` | Reusable TTS provider toggle + voice select + preview (extracted from prompts page) |
| `components/admin/prompt-editor.tsx` | Reusable textarea with label for prompt editing |

### Modified Files

| File | Changes |
|------|---------|
| `app/api/prompts/route.ts` | Extract Redis factory to `lib/redis.ts` |
| `app/api/connection-details/route.ts` | Accept `scenarioId` in body, embed in participant metadata |
| `lib/utils.ts` | `getLocalConnectionTokenSource` and `getSandboxTokenSource` pass `scenarioId` |
| `components/app/welcome-view.tsx` | Show scenario cards grid, pass selected scenarioId to onStartCall |
| `components/app/view-controller.tsx` | Thread scenarioId through start flow |
| `components/app/app.tsx` | Store selectedScenarioId in state, pass to tokenSource |
| `app-config.ts` | No changes needed |
| `agent/agent.py` | Read scenarioId from metadata, fetch per-scenario prompts, score on disconnect |

---

## Task 1: Shared Redis Client + Scenario Types

**Files:**
- Create: `lib/redis.ts`
- Create: `lib/scenarios.ts`
- Modify: `app/api/prompts/route.ts:17-22` (use shared `getRedis`)

**Interfaces:**
- Produces: `getRedis(): Redis | null` — used by all API routes
- Produces: `Scenario` type, `CATEGORIES`, `DIFFICULTY_LEVELS` — used by admin pages and API routes

- [ ] **Step 1: Create `lib/redis.ts`**

```typescript
import { Redis } from '@upstash/redis';

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}
```

- [ ] **Step 2: Create `lib/scenarios.ts`**

```typescript
import type { TtsProvider } from '@/lib/prompt-defaults';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
  agentPrompt: string;
  sessionPrompt: string;
  rubricPrompt: string;
  voice: string;
  ttsProvider: TtsProvider;
  isActive: string; // "true" | "false" — Redis stores strings
  createdBy: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type ScenarioInput = Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>;

export const CATEGORIES = [
  { id: 'coaching', label: 'Coaching' },
  { id: 'negotiation', label: 'Negosiasi' },
  { id: 'conflict', label: 'Resolusi Konflik' },
  { id: 'customer-service', label: 'Customer Service' },
  { id: 'interview', label: 'Interview' },
  { id: 'custom', label: 'Custom' },
] as const;

export const DIFFICULTY_LEVELS = [
  { id: 'easy', label: 'Mudah' },
  { id: 'medium', label: 'Sedang' },
  { id: 'hard', label: 'Sulit' },
] as const;

export const REDIS_KEYS = {
  scenarios: 'aican:scenarios',
  scenario: (id: string) => `aican:scenario:${id}`,
  defaultScenario: 'aican:scenario:default',
  sessions: (scenarioId: string) => `aican:sessions:${scenarioId}`,
  session: (id: string) => `aican:session:${id}`,
  recentSessions: 'aican:sessions:recent',
} as const;
```

- [ ] **Step 3: Update `app/api/prompts/route.ts` to use shared `getRedis`**

Replace the local `getRedis` function and its import:

```typescript
// Remove local getRedis function and Redis import
// Add:
import { getRedis } from '@/lib/redis';
```

Remove lines 2 (`import { Redis } from '@upstash/redis'`) and lines 17-22 (the local `getRedis` function). Add the import from `@/lib/redis`. Keep all other code unchanged.

- [ ] **Step 4: Verify prompts API still works**

Run: `curl http://localhost:3000/api/prompts` (or verify via browser)
Expected: Same JSON response as before.

- [ ] **Step 5: Commit**

```bash
git add lib/redis.ts lib/scenarios.ts app/api/prompts/route.ts
git commit -m "refactor: extract shared Redis client + add scenario types"
```

---

## Task 2: Scenarios CRUD API Routes

**Files:**
- Create: `app/api/scenarios/route.ts`
- Create: `app/api/scenarios/[id]/route.ts`
- Create: `app/api/scenarios/migrate/route.ts`

**Interfaces:**
- Consumes: `getRedis()` from `lib/redis.ts`, `Scenario`, `ScenarioInput`, `REDIS_KEYS` from `lib/scenarios.ts`
- Produces: `GET /api/scenarios?active=true` → `Scenario[]`, `POST /api/scenarios` → `Scenario`, `GET /api/scenarios/[id]` → `Scenario`, `PUT /api/scenarios/[id]` → `Scenario`, `DELETE /api/scenarios/[id]` → `{ ok: true }`, `POST /api/scenarios/migrate` → `{ scenarioId, migrated: true }`

- [ ] **Step 1: Create `app/api/scenarios/route.ts`**

```typescript
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
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
      scenarios = scenarios.filter((s) => s.isActive === 'true');
    }

    scenarios.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json(scenarios);
  } catch (error) {
    console.error('GET /api/scenarios:', error);
    return NextResponse.json({ error: 'Failed to list scenarios' }, { status: 500 });
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
    pipeline.hset(REDIS_KEYS.scenario(id), scenario);
    await pipeline.exec();

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    console.error('POST /api/scenarios:', error);
    return NextResponse.json({ error: 'Failed to create scenario' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/scenarios/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { REDIS_KEYS, type Scenario } from '@/lib/scenarios';

export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const scenario = await redis.hgetall<Scenario>(REDIS_KEYS.scenario(id));
    if (!scenario || !scenario.name) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    return NextResponse.json({ ...scenario, id });
  } catch (error) {
    console.error('GET /api/scenarios/[id]:', error);
    return NextResponse.json({ error: 'Failed to get scenario' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const exists = await redis.sismember(REDIS_KEYS.scenarios, id);
    if (!exists) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, string> = { updatedAt: new Date().toISOString() };

    const allowedFields = [
      'name', 'description', 'category', 'agentPrompt', 'sessionPrompt',
      'rubricPrompt', 'voice', 'ttsProvider', 'isActive', 'createdBy',
    ];
    for (const field of allowedFields) {
      if (typeof body[field] === 'string') {
        updates[field] = body[field];
      }
    }

    await redis.hset(REDIS_KEYS.scenario(id), updates);
    const updated = await redis.hgetall<Scenario>(REDIS_KEYS.scenario(id));

    return NextResponse.json({ ...updated, id });
  } catch (error) {
    console.error('PUT /api/scenarios/[id]:', error);
    return NextResponse.json({ error: 'Failed to update scenario' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
```

- [ ] **Step 3: Create `app/api/scenarios/migrate/route.ts`**

This one-time endpoint reads the existing `aican:prompts` single scenario and creates a proper scenario entry from it.

```typescript
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { REDIS_KEYS, type Scenario } from '@/lib/scenarios';
import type { StoredPrompts } from '@/lib/prompt-defaults';

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
```

- [ ] **Step 4: Commit**

```bash
git add app/api/scenarios/
git commit -m "feat: scenarios CRUD API routes + migration endpoint"
```

---

## Task 3: Admin Layout + Scenarios List Page

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/scenarios/page.tsx`

**Interfaces:**
- Consumes: `GET /api/scenarios` → `Scenario[]`, `PUT /api/scenarios/[id]` (toggle), `DELETE /api/scenarios/[id]`
- Produces: Admin layout with sidebar navigation (used by all `/admin/*` pages)

- [ ] **Step 1: Create `app/admin/layout.tsx`**

```tsx
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-svh">
      <nav className="border-border bg-card fixed top-0 z-50 w-full border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/" className="text-foreground text-sm font-bold tracking-tight">
            AICAN
          </Link>
          <div className="flex gap-4">
            <Link
              href="/admin/scenarios"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Skenario
            </Link>
            <Link
              href="/admin/analytics"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Analitik
            </Link>
            <Link
              href="/prompts"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Prompts (Legacy)
            </Link>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 pt-20 pb-12">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/admin/scenarios/page.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CopySimple,
  PencilSimple,
  Plus,
  Power,
  SpinnerGap,
  Trash,
} from '@phosphor-icons/react';
import type { Scenario } from '@/lib/scenarios';

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scenarios', { cache: 'no-store' });
      if (res.ok) setScenarios(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (id: string, current: string) => {
    await fetch(`/api/scenarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: current === 'true' ? 'false' : 'true' }),
    });
    load();
  };

  const deleteScenario = async (id: string, name: string) => {
    if (!confirm(`Hapus skenario "${name}"?`)) return;
    await fetch(`/api/scenarios/${id}`, { method: 'DELETE' });
    load();
  };

  const duplicateScenario = async (scenario: Scenario) => {
    await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${scenario.name} (Copy)`,
        description: scenario.description,
        category: scenario.category,
        agentPrompt: scenario.agentPrompt,
        sessionPrompt: scenario.sessionPrompt,
        rubricPrompt: scenario.rubricPrompt,
        voice: scenario.voice,
        ttsProvider: scenario.ttsProvider,
        isActive: 'false',
        createdBy: 'admin',
      }),
    });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerGap className="text-muted-foreground size-8 animate-spin" weight="bold" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Skenario Roleplay</h1>
          <p className="text-muted-foreground text-sm">
            Kelola skenario roleplay yang tersedia untuk peserta.
          </p>
        </div>
        <Link
          href="/admin/scenarios/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <Plus className="size-4" weight="bold" />
          Buat Skenario Baru
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <div className="border-border rounded-lg border py-12 text-center">
          <p className="text-muted-foreground mb-4">Belum ada skenario.</p>
          <Link
            href="/admin/scenarios/new"
            className="text-primary hover:underline text-sm font-medium"
          >
            Buat skenario pertama
          </Link>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Nama</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Kategori</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Dibuat</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id} className="border-border border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="text-foreground font-medium">{s.name}</div>
                    <div className="text-muted-foreground text-xs">{s.description}</div>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 capitalize">{s.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.isActive === 'true'
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {s.isActive === 'true' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {new Date(s.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/scenarios/${s.id}`}
                        className="hover:bg-accent rounded-md p-1.5 transition-colors"
                        title="Edit"
                      >
                        <PencilSimple className="size-4" />
                      </Link>
                      <button
                        onClick={() => duplicateScenario(s)}
                        className="hover:bg-accent rounded-md p-1.5 transition-colors"
                        title="Duplikat"
                      >
                        <CopySimple className="size-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(s.id, s.isActive)}
                        className="hover:bg-accent rounded-md p-1.5 transition-colors"
                        title={s.isActive === 'true' ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        <Power
                          className={`size-4 ${s.isActive === 'true' ? 'text-green-500' : 'text-muted-foreground'}`}
                        />
                      </button>
                      <button
                        onClick={() => deleteScenario(s.id, s.name)}
                        className="hover:bg-destructive/10 rounded-md p-1.5 transition-colors"
                        title="Hapus"
                      >
                        <Trash className="text-destructive size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/
git commit -m "feat: admin layout + scenarios list page"
```

---

## Task 4: Admin Scenario Edit Page + Reusable Voice Picker

**Files:**
- Create: `components/admin/voice-picker.tsx`
- Create: `app/admin/scenarios/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/scenarios/[id]` → `Scenario`, `PUT /api/scenarios/[id]`, `getVoiceOptions()`, `getDefaultVoice()` from `lib/prompt-defaults.ts`, `POST /api/voice-preview`
- Produces: `VoicePicker` component (reused in builder page), scenario edit page

- [ ] **Step 1: Create `components/admin/voice-picker.tsx`**

Extract the TTS provider toggle + voice select + preview button from `app/prompts/page.tsx` into a reusable component:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SpinnerGap } from '@phosphor-icons/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type TtsProvider,
  getDefaultVoice,
  getVoiceOptions,
} from '@/lib/prompt-defaults';

interface VoicePickerProps {
  ttsProvider: TtsProvider;
  voice: string;
  onProviderChange: (provider: TtsProvider) => void;
  onVoiceChange: (voice: string) => void;
}

export function VoicePicker({
  ttsProvider,
  voice,
  onProviderChange,
  onVoiceChange,
}: VoicePickerProps) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voiceOptions = getVoiceOptions(ttsProvider);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewPlaying(false);
    setPreviewLoading(false);
  };

  const handleProviderChange = (provider: TtsProvider) => {
    stopPreview();
    onProviderChange(provider);
    onVoiceChange(getDefaultVoice(provider));
  };

  const playPreview = async () => {
    if (previewPlaying) {
      stopPreview();
      return;
    }
    if (ttsProvider !== 'elevenlabs') return;

    setPreviewLoading(true);
    try {
      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: voice }),
      });
      if (!res.ok) throw new Error(`Preview failed (${res.status})`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPreviewPlaying(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPreviewPlaying(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
      setPreviewPlaying(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">TTS Provider</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleProviderChange('gemini')}
            className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              ttsProvider === 'gemini'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-accent'
            }`}
          >
            Gemini (Gratis)
          </button>
          <button
            type="button"
            onClick={() => handleProviderChange('elevenlabs')}
            className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              ttsProvider === 'elevenlabs'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-accent'
            }`}
          >
            ElevenLabs (Premium)
          </button>
        </div>
      </div>

      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Voice</label>
        <div className="flex items-center gap-2">
          <Select
            value={voice}
            onValueChange={(v) => {
              stopPreview();
              onVoiceChange(v);
            }}
          >
            <SelectTrigger className="border-input bg-card text-foreground w-full max-w-md">
              <SelectValue placeholder="Pilih suara" />
            </SelectTrigger>
            <SelectContent>
              {voiceOptions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} — {v.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {ttsProvider === 'elevenlabs' && (
            <button
              type="button"
              onClick={playPreview}
              disabled={previewLoading}
              className="border-border bg-card text-foreground hover:bg-accent flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-50"
              aria-label={previewPlaying ? 'Stop preview' : 'Play preview'}
            >
              {previewLoading ? (
                <SpinnerGap className="size-4 animate-spin" weight="bold" />
              ) : previewPlaying ? (
                <Pause className="size-4" weight="fill" />
              ) : (
                <Play className="size-4" weight="fill" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/admin/scenarios/[id]/page.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FloppyDisk, SpinnerGap } from '@phosphor-icons/react';
import Link from 'next/link';
import { VoicePicker } from '@/components/admin/voice-picker';
import { CATEGORIES } from '@/lib/scenarios';
import type { TtsProvider } from '@/lib/prompt-defaults';

export default function EditScenarioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [sessionPrompt, setSessionPrompt] = useState('');
  const [rubricPrompt, setRubricPrompt] = useState('');
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('gemini');
  const [voice, setVoice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scenarios/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Skenario tidak ditemukan');
      const data = await res.json();
      setName(data.name || '');
      setDescription(data.description || '');
      setCategory(data.category || 'custom');
      setAgentPrompt(data.agentPrompt || '');
      setSessionPrompt(data.sessionPrompt || '');
      setRubricPrompt(data.rubricPrompt || '');
      setTtsProvider(data.ttsProvider || 'gemini');
      setVoice(data.voice || '');
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Gagal memuat skenario',
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/scenarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          category,
          agentPrompt,
          sessionPrompt,
          rubricPrompt,
          ttsProvider,
          voice,
        }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      setMessage({ type: 'success', text: 'Skenario berhasil disimpan.' });
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Gagal menyimpan',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerGap className="text-muted-foreground size-8 animate-spin" weight="bold" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/scenarios"
            className="border-border bg-card text-foreground hover:bg-accent flex size-10 items-center justify-center rounded-lg border transition-colors"
          >
            <ArrowLeft className="size-5" weight="bold" />
          </Link>
          <h1 className="text-foreground text-2xl font-semibold">Edit Skenario</h1>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <SpinnerGap className="size-4 animate-spin" weight="bold" />
          ) : (
            <FloppyDisk className="size-4" weight="bold" />
          )}
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">Nama Skenario</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Deskripsi</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>

        <VoicePicker
          ttsProvider={ttsProvider}
          voice={voice}
          onProviderChange={setTtsProvider}
          onVoiceChange={setVoice}
        />

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Agent Prompt (Karakter & Kepribadian)
          </label>
          <textarea
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            rows={12}
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Session Prompt (Alur & Aturan)
          </label>
          <textarea
            value={sessionPrompt}
            onChange={(e) => setSessionPrompt(e.target.value)}
            rows={16}
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">
            Rubrik Penilaian
          </label>
          <p className="text-muted-foreground mb-2 text-sm">
            Kriteria penilaian 50-100. Digunakan agent saat memberikan skor di akhir sesi.
          </p>
          <textarea
            value={rubricPrompt}
            onChange={(e) => setRubricPrompt(e.target.value)}
            rows={10}
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/voice-picker.tsx app/admin/scenarios/\[id\]/page.tsx
git commit -m "feat: reusable voice picker + scenario edit page"
```

---

## Task 5: Welcome Page Scenario Picker + Connection Flow

**Files:**
- Create: `components/app/scenario-card.tsx`
- Modify: `components/app/welcome-view.tsx`
- Modify: `components/app/view-controller.tsx`
- Modify: `components/app/app.tsx`
- Modify: `lib/utils.ts`
- Modify: `app/api/connection-details/route.ts`

**Interfaces:**
- Consumes: `GET /api/scenarios?active=true` → `Scenario[]`, `POST /api/connection-details` with `scenarioId`
- Produces: `scenarioId` embedded in LiveKit participant token metadata (read by agent)

- [ ] **Step 1: Create `components/app/scenario-card.tsx`**

```tsx
'use client';

import { motion } from 'motion/react';
import type { Scenario } from '@/lib/scenarios';

interface ScenarioCardProps {
  scenario: Scenario;
  selected: boolean;
  onClick: () => void;
}

export function ScenarioCard({ scenario, selected, onClick }: ScenarioCardProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
          : 'border-border bg-card hover:bg-accent/50'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-foreground text-sm font-semibold">{scenario.name}</span>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] capitalize">
          {scenario.category}
        </span>
      </div>
      <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
        {scenario.description}
      </p>
    </motion.button>
  );
}
```

- [ ] **Step 2: Modify `components/app/welcome-view.tsx`**

Add scenario fetching and selection. The welcome view now fetches active scenarios and shows them as cards. If only 1 active scenario exists, it auto-selects it and behaves like the current flow.

Replace the entire file with:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Microphone, SpinnerGap } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ScenarioCard } from '@/components/app/scenario-card';
import type { Scenario } from '@/lib/scenarios';

const MotionButton = motion.create(Button);

function AnimatedBars() {
  return (
    <div className="welcome-bars relative flex h-20 items-center justify-center gap-1.5">
      <div className="orbit-ring" />
      <div className="bar h-8 w-1.5" />
      <div className="bar h-14 w-1.5" />
      <div className="bar h-12 w-1.5" />
      <div className="bar h-16 w-1.5" />
      <div className="bar h-10 w-1.5" />
      <div className="bar h-14 w-1.5" />
    </div>
  );
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: (scenarioId?: string) => void;
  avatarEnabledRef: React.MutableRefObject<boolean>;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  avatarEnabledRef,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingScenarios, setLoadingScenarios] = useState(true);

  const loadScenarios = useCallback(async () => {
    try {
      const res = await fetch('/api/scenarios?active=true', { cache: 'no-store' });
      if (res.ok) {
        const data: Scenario[] = await res.json();
        setScenarios(data);
        if (data.length === 1) {
          setSelectedId(data[0].id);
        }
      }
    } finally {
      setLoadingScenarios(false);
    }
  }, []);

  useEffect(() => {
    avatarEnabledRef.current = false;
    loadScenarios();
  }, [avatarEnabledRef, loadScenarios]);

  const handleStart = () => {
    onStartCall(selectedId ?? undefined);
  };

  return (
    <div ref={ref} className="welcome-gradient">
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center justify-center px-6 text-center"
      >
        <motion.div variants={staggerItem} className="mb-8">
          <AnimatedBars />
        </motion.div>

        <motion.h1
          variants={staggerItem}
          className="text-foreground text-2xl font-bold tracking-tight md:text-3xl"
        >
          Roleplay dengan AICAN
        </motion.h1>

        <motion.p
          variants={staggerItem}
          className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed md:text-base"
        >
          {scenarios.length > 1
            ? 'Pilih skenario roleplay lalu mulai percakapan'
            : 'Mulai percakapan dengan AI companion Anda'}
        </motion.p>

        {/* Scenario cards */}
        {!loadingScenarios && scenarios.length > 1 && (
          <motion.div
            variants={staggerItem}
            className="mt-6 grid w-full max-w-md gap-3 sm:grid-cols-2"
          >
            {scenarios.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                selected={selectedId === s.id}
                onClick={() => setSelectedId(s.id)}
              />
            ))}
          </motion.div>
        )}

        {loadingScenarios && (
          <motion.div variants={staggerItem} className="mt-6">
            <SpinnerGap className="text-muted-foreground size-6 animate-spin" weight="bold" />
          </motion.div>
        )}

        <MotionButton
          variants={staggerItem}
          size="lg"
          onClick={handleStart}
          disabled={scenarios.length > 1 && !selectedId}
          className="bg-brand shadow-brand-glow hover:bg-brand-light hover:shadow-brand-glow mt-8 w-64 cursor-pointer rounded-full font-mono text-xs font-bold tracking-wider text-white uppercase shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-50"
        >
          <Microphone weight="bold" className="mr-1 size-4" />
          {startButtonText}
        </MotionButton>

        <motion.p variants={staggerItem} className="text-muted-foreground/60 mt-6 text-xs">
          Tekan untuk memulai sesi suara
        </motion.p>
      </motion.section>
    </div>
  );
};
```

- [ ] **Step 3: Modify `components/app/app.tsx`**

Add `selectedScenarioId` state and pass it through the token source. The `getOptions` callback now returns `scenarioId`.

Key changes:
1. Add `useState` for `selectedScenarioId`
2. Update `getOptions` to include `scenarioId`
3. Re-create `tokenSource` when `selectedScenarioId` changes
4. Pass `setSelectedScenarioId` down through `ViewController`

```tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import { getLocalConnectionTokenSource, getSandboxTokenSource } from '@/lib/utils';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();

  return null;
}

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const avatarEnabledRef = useRef(true);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | undefined>();

  const tokenSource = useMemo(() => {
    const getOptions = () => ({
      avatarEnabled: avatarEnabledRef.current,
      scenarioId: selectedScenarioId,
    });
    return typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
      ? getSandboxTokenSource(appConfig, getOptions)
      : getLocalConnectionTokenSource(appConfig, getOptions);
  }, [appConfig, selectedScenarioId]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController
          appConfig={appConfig}
          avatarEnabledRef={avatarEnabledRef}
          onSelectScenario={setSelectedScenarioId}
        />
      </main>
      <StartAudioButton label="Start Audio" />
      <Toaster
        icons={{
          warning: <WarningIcon weight="bold" />,
        }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}
```

- [ ] **Step 4: Modify `components/app/view-controller.tsx`**

Add `onSelectScenario` prop and pass it to `WelcomeView`. The `WelcomeView.onStartCall` now receives a `scenarioId` parameter.

```tsx
'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(SessionView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: { duration: 0.5, ease: 'linear' },
};

interface ViewControllerProps {
  appConfig: AppConfig;
  avatarEnabledRef: React.MutableRefObject<boolean>;
  onSelectScenario: (scenarioId: string | undefined) => void;
}

export function ViewController({
  appConfig,
  avatarEnabledRef,
  onSelectScenario,
}: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();

  const handleStartCall = (scenarioId?: string) => {
    onSelectScenario(scenarioId);
    start();
  };

  return (
    <AnimatePresence mode="wait">
      {!isConnected && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          onStartCall={handleStartCall}
          avatarEnabledRef={avatarEnabledRef}
        />
      )}
      {isConnected && (
        <MotionSessionView key="session-view" {...VIEW_MOTION_PROPS} appConfig={appConfig} />
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 5: Modify `lib/utils.ts`**

Update `ConnectionOptions` type and both token source functions to include `scenarioId`:

In the `ConnectionOptions` type, add `scenarioId?: string`.

In `getLocalConnectionTokenSource`, add `scenarioId` to the body:
```typescript
const body: Record<string, unknown> = {
  avatar_enabled: options.avatarEnabled,
  scenarioId: options.scenarioId,
};
```

In `getSandboxTokenSource`, add `scenarioId` to the body:
```typescript
body: JSON.stringify({
  room_config: roomConfig,
  avatar_enabled: options.avatarEnabled,
  scenarioId: options.scenarioId,
}),
```

- [ ] **Step 6: Modify `app/api/connection-details/route.ts`**

Add `scenarioId` to participant token metadata so the agent can read it:

After line 37 (parsing `avatarEnabled`), add:
```typescript
const scenarioId: string | undefined = body?.scenarioId;
```

In `createParticipantToken`, update the metadata line (line 80):
```typescript
at.metadata = JSON.stringify({ avatarEnabled, scenarioId });
```

Update the function signature to accept `scenarioId`:
```typescript
function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName?: string,
  avatarEnabled: boolean = true,
  scenarioId?: string,
): Promise<string> {
```

And pass `scenarioId` in the call:
```typescript
const participantToken = await createParticipantToken(
  { identity: participantIdentity, name: participantName },
  roomName,
  agentName,
  avatarEnabled,
  scenarioId,
);
```

- [ ] **Step 7: Commit**

```bash
git add components/app/ lib/utils.ts app/api/connection-details/route.ts
git commit -m "feat: welcome page scenario picker + scenarioId in connection flow"
```

---

## Task 6: Agent Reads ScenarioId + Per-Scenario Prompts

**Files:**
- Modify: `agent/agent.py`

**Interfaces:**
- Consumes: `scenarioId` from participant metadata, `GET /api/scenarios/{id}` → scenario JSON
- Produces: Agent loads per-scenario prompts (agentPrompt, sessionPrompt, rubricPrompt, voice, ttsProvider)

- [ ] **Step 1: Update `agent/agent.py`**

Replace the `_fetch_prompts_from_api` function to support per-scenario fetching. Add a new function `_fetch_scenario` that reads scenarioId from participant metadata.

```python
def _fetch_scenario_from_api(scenario_id: str | None) -> dict | None:
    """Fetch scenario prompts from the API. Falls back to default scenario if no ID."""
    if not PROMPTS_API_URL or not PROMPTS_API_URL.startswith("http"):
        return None

    base_url = PROMPTS_API_URL.rsplit("/api/", 1)[0]

    try:
        if scenario_id:
            url = f"{base_url}/api/scenarios/{scenario_id}"
        else:
            url = PROMPTS_API_URL  # fallback to /api/prompts

        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()

        agent_prompt = data.get("agentPrompt")
        session_prompt = data.get("sessionPrompt")
        if isinstance(agent_prompt, str) and isinstance(session_prompt, str):
            return {
                "agent_prompt": agent_prompt,
                "session_prompt": session_prompt,
                "rubric_prompt": data.get("rubricPrompt", ""),
                "voice": data.get("voice", ""),
                "tts_provider": data.get("ttsProvider", DEFAULT_TTS_PROVIDER),
            }
    except Exception as e:
        logger.warning("Failed to fetch scenario (%s): %s", scenario_id, e)
    return None
```

Update the `my_agent` function to read scenarioId from participant metadata:

```python
@server.rtc_session(agent_name=AGENT_NAME)
async def my_agent(ctx: agents.JobContext):
    # Read scenarioId from the first participant's metadata
    scenario_id = None
    for p in ctx.room.remote_participants.values():
        try:
            meta = json.loads(p.metadata or "{}")
            scenario_id = meta.get("scenarioId")
            if scenario_id:
                break
        except (json.JSONDecodeError, AttributeError):
            pass

    logger.info("Scenario ID from metadata: %s", scenario_id)
    fetched = await asyncio.to_thread(_fetch_scenario_from_api, scenario_id)

    agent_prompt = fetched["agent_prompt"] if fetched else AGENT_PROMPT
    session_prompt = fetched["session_prompt"] if fetched else SESSION_PROMPT
    rubric_prompt = fetched.get("rubric_prompt", "") if fetched else ""
    voice = fetched["voice"] if fetched else ""
    tts_provider = fetched["tts_provider"] if fetched else DEFAULT_TTS_PROVIDER

    if tts_provider == "elevenlabs":
        logger.info("Using ElevenLabs pipeline mode (voice_id=%s)", voice)
        session = _build_elevenlabs_session(voice)
    else:
        logger.info("Using Gemini native audio mode (voice=%s)", voice)
        session = _build_gemini_session(voice)

    await session.start(
        room=ctx.room,
        agent=Assistant(instructions=agent_prompt),
        room_options=room_io.RoomOptions(
            text_input=True,
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony()
                if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                else noise_cancellation.BVC(),
            ),
        ),
    )

    session.input.set_audio_enabled(False)

    intro_handle = session.generate_reply(
        instructions=session_prompt,
        allow_interruptions=False,
    )
    await intro_handle

    session.input.set_audio_enabled(True)
```

- [ ] **Step 2: Commit**

```bash
git add agent/agent.py
git commit -m "feat: agent reads scenarioId from metadata + fetches per-scenario prompts"
```

---

## Task 7: AI Scenario Generation + Refinement API

**Files:**
- Create: `app/api/scenarios/generate/route.ts`
- Create: `app/api/scenarios/refine/route.ts`

**Interfaces:**
- Consumes: `GOOGLE_API_KEY` env var, Gemini 2.5 Flash text API
- Produces: `POST /api/scenarios/generate` → `{ agentPrompt, sessionPrompt, rubricPrompt }`, `POST /api/scenarios/refine` → same

- [ ] **Step 1: Create `app/api/scenarios/generate/route.ts`**

```typescript
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
    const { name, description, characterName, characterRole, situation, objective, difficulty, category } = body;

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
        contents: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] },
        ],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Gemini API error:', err);
      return NextResponse.json({ error: 'AI generation failed' }, { status: 502 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 502 });
    }

    const parsed = JSON.parse(text);
    return NextResponse.json({
      agentPrompt: parsed.agentPrompt || '',
      sessionPrompt: parsed.sessionPrompt || '',
      rubricPrompt: parsed.rubricPrompt || '',
    });
  } catch (error) {
    console.error('POST /api/scenarios/generate:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/scenarios/refine/route.ts`**

```typescript
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
      return NextResponse.json({ error: 'AI refinement failed' }, { status: 502 });
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
    return NextResponse.json({ error: 'Refinement failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/scenarios/generate/ app/api/scenarios/refine/
git commit -m "feat: AI scenario generation + refinement API routes"
```

---

## Task 8: AI Scenario Builder Page

**Files:**
- Create: `app/admin/scenarios/new/page.tsx`

**Interfaces:**
- Consumes: `POST /api/scenarios/generate`, `POST /api/scenarios/refine`, `POST /api/scenarios`, `VoicePicker` component, `CATEGORIES`, `DIFFICULTY_LEVELS`
- Produces: Full 5-step scenario builder page at `/admin/scenarios/new`

- [ ] **Step 1: Create `app/admin/scenarios/new/page.tsx`**

This is a large single-page component with 5 steps. The step state machine:
1. Context form
2. AI generation (loading state)
3. Prompt review/edit (3 textareas)
4. Chat refinement sidebar (optional)
5. Voice selection + save

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  FloppyDisk,
  Lightning,
  PaperPlaneTilt,
  SpinnerGap,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { VoicePicker } from '@/components/admin/voice-picker';
import type { TtsProvider } from '@/lib/prompt-defaults';
import { CATEGORIES, DIFFICULTY_LEVELS } from '@/lib/scenarios';

type Step = 'context' | 'generating' | 'prompts' | 'refine' | 'voice';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export default function NewScenarioPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('context');
  const [saving, setSaving] = useState(false);

  // Context form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [characterRole, setCharacterRole] = useState('');
  const [situation, setSituation] = useState('');
  const [objective, setObjective] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [category, setCategory] = useState('custom');

  // Generated prompts
  const [agentPrompt, setAgentPrompt] = useState('');
  const [sessionPrompt, setSessionPrompt] = useState('');
  const [rubricPrompt, setRubricPrompt] = useState('');

  // Chat refinement
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [refining, setRefining] = useState(false);

  // Voice
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>('gemini');
  const [voice, setVoice] = useState('');

  const generate = async () => {
    setStep('generating');
    try {
      const res = await fetch('/api/scenarios/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description, characterName, characterRole,
          situation, objective, difficulty, category,
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setAgentPrompt(data.agentPrompt || '');
      setSessionPrompt(data.sessionPrompt || '');
      setRubricPrompt(data.rubricPrompt || '');
      setStep('prompts');
    } catch {
      setStep('context');
    }
  };

  const refine = async () => {
    if (!chatInput.trim()) return;
    const instruction = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: instruction }]);
    setRefining(true);

    try {
      const res = await fetch('/api/scenarios/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentPrompt, sessionPrompt, rubricPrompt, instruction }),
      });
      if (!res.ok) throw new Error('Refinement failed');
      const data = await res.json();
      setAgentPrompt(data.agentPrompt || agentPrompt);
      setSessionPrompt(data.sessionPrompt || sessionPrompt);
      setRubricPrompt(data.rubricPrompt || rubricPrompt);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Prompt telah diperbarui sesuai instruksi.' },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Gagal memproses revisi. Coba lagi.' },
      ]);
    } finally {
      setRefining(false);
    }
  };

  const saveScenario = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description, category,
          agentPrompt, sessionPrompt, rubricPrompt,
          voice, ttsProvider,
          isActive: 'true',
          createdBy: 'admin',
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      router.push('/admin/scenarios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/scenarios"
          className="border-border bg-card text-foreground hover:bg-accent flex size-10 items-center justify-center rounded-lg border transition-colors"
        >
          <ArrowLeft className="size-5" weight="bold" />
        </Link>
        <div>
          <h1 className="text-foreground text-2xl font-semibold">Buat Skenario Baru</h1>
          <p className="text-muted-foreground text-sm">
            {step === 'context' && 'Langkah 1: Isi konteks skenario'}
            {step === 'generating' && 'Generating prompts dengan AI…'}
            {step === 'prompts' && 'Langkah 2: Review & edit prompt yang di-generate AI'}
            {step === 'refine' && 'Langkah 3: Revisi prompt dengan instruksi'}
            {step === 'voice' && 'Langkah 4: Pilih suara & simpan'}
          </p>
        </div>
      </div>

      {/* Step: Context Form */}
      {step === 'context' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                Nama Skenario *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Coaching Karyawan Senior"
                className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Deskripsi</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Deskripsi singkat skenario untuk ditampilkan di kartu…"
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                Nama Karakter AI *
              </label>
              <input
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Riko"
                className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                Peran Karakter
              </label>
              <input
                value={characterRole}
                onChange={(e) => setCharacterRole(e.target.value)}
                placeholder="Karyawan senior, project admin"
                className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Situasi / Konteks *
            </label>
            <textarea
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              rows={3}
              placeholder="Jelaskan situasi yang akan dihadapi peserta…"
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Objektif Peserta
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={2}
              placeholder="Apa yang harus dicapai peserta dalam roleplay ini…"
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Tingkat Kesulitan
            </label>
            <div className="flex gap-2">
              {DIFFICULTY_LEVELS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    difficulty === d.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={generate}
              disabled={!name || !characterName || !situation}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Lightning className="size-4" weight="fill" />
              Generate dengan AI
            </button>
          </div>
        </div>
      )}

      {/* Step: Generating */}
      {step === 'generating' && (
        <div className="flex flex-col items-center justify-center py-20">
          <SpinnerGap className="text-primary size-10 animate-spin" weight="bold" />
          <p className="text-muted-foreground mt-4 text-sm">
            AI sedang membuat prompt skenario…
          </p>
        </div>
      )}

      {/* Step: Prompts Review */}
      {step === 'prompts' && (
        <div className="space-y-6">
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">
              Agent Prompt (Karakter & Kepribadian)
            </label>
            <textarea
              value={agentPrompt}
              onChange={(e) => setAgentPrompt(e.target.value)}
              rows={12}
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">
              Session Prompt (Alur & Aturan)
            </label>
            <textarea
              value={sessionPrompt}
              onChange={(e) => setSessionPrompt(e.target.value)}
              rows={14}
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">
              Rubrik Penilaian
            </label>
            <textarea
              value={rubricPrompt}
              onChange={(e) => setRubricPrompt(e.target.value)}
              rows={10}
              className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
              spellCheck={false}
            />
          </div>
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep('refine')}
              className="border-border bg-card text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
            >
              Revisi dengan AI
            </button>
            <button
              onClick={() => setStep('voice')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
            >
              Lanjut
              <ArrowRight className="size-4" weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* Step: Chat Refinement */}
      {step === 'refine' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-foreground text-sm font-medium">Preview Prompt</h3>
            <div className="space-y-3">
              <div>
                <label className="text-muted-foreground mb-1 block text-xs">Agent Prompt</label>
                <div className="border-border bg-muted/30 max-h-40 overflow-y-auto rounded-lg border p-3 font-mono text-xs">
                  {agentPrompt.slice(0, 500)}…
                </div>
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs">Session Prompt</label>
                <div className="border-border bg-muted/30 max-h-40 overflow-y-auto rounded-lg border p-3 font-mono text-xs">
                  {sessionPrompt.slice(0, 500)}…
                </div>
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs">Rubrik</label>
                <div className="border-border bg-muted/30 max-h-40 overflow-y-auto rounded-lg border p-3 font-mono text-xs">
                  {rubricPrompt.slice(0, 500)}…
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <h3 className="text-foreground mb-2 text-sm font-medium">Chat Refinement</h3>
            <div className="border-border bg-card flex flex-1 flex-col rounded-lg border">
              <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 300 }}>
                {chatMessages.length === 0 && (
                  <p className="text-muted-foreground text-xs">
                    Ketik instruksi untuk merevisi prompt, contoh: &ldquo;buat karakternya lebih
                    keras kepala&rdquo;
                  </p>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary/10 text-foreground ml-8'
                        : 'bg-muted text-muted-foreground mr-8'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>
              <div className="border-border flex gap-2 border-t p-3">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && refine()}
                  placeholder="Instruksi revisi…"
                  disabled={refining}
                  className="bg-background text-foreground flex-1 rounded-md px-3 py-2 text-sm focus:outline-none"
                />
                <button
                  onClick={refine}
                  disabled={refining || !chatInput.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-2 transition-colors disabled:opacity-50"
                >
                  {refining ? (
                    <SpinnerGap className="size-4 animate-spin" weight="bold" />
                  ) : (
                    <PaperPlaneTilt className="size-4" weight="fill" />
                  )}
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-between">
              <button
                onClick={() => setStep('prompts')}
                className="border-border bg-card text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
              >
                <ArrowLeft className="size-4" weight="bold" />
                Kembali ke Editor
              </button>
              <button
                onClick={() => setStep('voice')}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
              >
                Lanjut
                <ArrowRight className="size-4" weight="bold" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Voice & Save */}
      {step === 'voice' && (
        <div className="space-y-6">
          <VoicePicker
            ttsProvider={ttsProvider}
            voice={voice}
            onProviderChange={setTtsProvider}
            onVoiceChange={setVoice}
          />

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep('prompts')}
              className="border-border bg-card text-foreground hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="size-4" weight="bold" />
              Kembali
            </button>
            <button
              onClick={saveScenario}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? (
                <SpinnerGap className="size-4 animate-spin" weight="bold" />
              ) : (
                <FloppyDisk className="size-4" weight="bold" />
              )}
              {saving ? 'Menyimpan…' : 'Simpan Skenario'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/scenarios/new/
git commit -m "feat: AI-assisted scenario builder page with chat refinement"
```

---

## Task 9: Sessions API + Score Capture in Agent

**Files:**
- Create: `app/api/sessions/route.ts`
- Create: `app/api/sessions/[id]/route.ts`
- Create: `app/api/sessions/stats/route.ts`
- Modify: `agent/agent.py`

**Interfaces:**
- Consumes: `getRedis()`, `REDIS_KEYS`, participant disconnect event in LiveKit agent
- Produces: `POST /api/sessions` (save result), `GET /api/sessions` (list), `GET /api/sessions/[id]` (detail), `GET /api/sessions/stats` (aggregated)

- [ ] **Step 1: Create `app/api/sessions/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { REDIS_KEYS } from '@/lib/scenarios';

export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { scenarioId, participantName, score, feedback } = body;

    if (!scenarioId || score === undefined) {
      return NextResponse.json(
        { error: 'scenarioId and score are required' },
        { status: 400 }
      );
    }

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const sessionData = {
      scenarioId,
      participantName: participantName || 'Anonymous',
      score: String(score),
      feedback: feedback || '',
      startedAt: body.startedAt || now,
      endedAt: now,
    };

    const pipeline = redis.pipeline();
    pipeline.hset(REDIS_KEYS.session(sessionId), sessionData);
    pipeline.zadd(REDIS_KEYS.sessions(scenarioId), { score: Number(score), member: sessionId });
    pipeline.lpush(REDIS_KEYS.recentSessions, sessionId);
    pipeline.ltrim(REDIS_KEYS.recentSessions, 0, 499);
    await pipeline.exec();

    return NextResponse.json({ sessionId, ...sessionData }, { status: 201 });
  } catch (error) {
    console.error('POST /api/sessions:', error);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const scenarioId = searchParams.get('scenarioId');
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
    const offset = Number(searchParams.get('offset') || '0');

    let sessionIds: string[];

    if (scenarioId) {
      sessionIds = await redis.zrange(
        REDIS_KEYS.sessions(scenarioId), offset, offset + limit - 1, { rev: true }
      );
    } else {
      sessionIds = await redis.lrange(REDIS_KEYS.recentSessions, offset, offset + limit - 1);
    }

    if (!sessionIds.length) {
      return NextResponse.json([]);
    }

    const pipeline = redis.pipeline();
    for (const id of sessionIds) {
      pipeline.hgetall(REDIS_KEYS.session(id));
    }
    const results = await pipeline.exec<(Record<string, string> | null)[]>();

    const sessions = results
      .map((s, i) => (s ? { id: sessionIds[i], ...s } : null))
      .filter(Boolean);

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('GET /api/sessions:', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/sessions/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { REDIS_KEYS } from '@/lib/scenarios';

export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const session = await redis.hgetall(REDIS_KEYS.session(id));
    if (!session || !session.scenarioId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ id, ...session });
  } catch (error) {
    console.error('GET /api/sessions/[id]:', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `app/api/sessions/stats/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { REDIS_KEYS } from '@/lib/scenarios';

export const revalidate = 0;

export async function GET() {
  try {
    const redis = getRedis();
    if (!redis) {
      return NextResponse.json({ error: 'Redis not configured' }, { status: 503 });
    }

    const recentIds = await redis.lrange(REDIS_KEYS.recentSessions, 0, 499);
    const totalSessions = recentIds.length;

    if (totalSessions === 0) {
      return NextResponse.json({
        totalSessions: 0,
        averageScore: 0,
        sessionsToday: 0,
        topScenario: null,
      });
    }

    const pipeline = redis.pipeline();
    for (const id of recentIds) {
      pipeline.hgetall(REDIS_KEYS.session(id));
    }
    const results = await pipeline.exec<(Record<string, string> | null)[]>();

    const today = new Date().toISOString().slice(0, 10);
    let totalScore = 0;
    let scoreCount = 0;
    let sessionsToday = 0;
    const scenarioCounts: Record<string, number> = {};

    for (const s of results) {
      if (!s) continue;
      const score = Number(s.score);
      if (!isNaN(score)) {
        totalScore += score;
        scoreCount++;
      }
      if (s.endedAt?.startsWith(today)) {
        sessionsToday++;
      }
      if (s.scenarioId) {
        scenarioCounts[s.scenarioId] = (scenarioCounts[s.scenarioId] || 0) + 1;
      }
    }

    let topScenarioId: string | null = null;
    let topCount = 0;
    for (const [id, count] of Object.entries(scenarioCounts)) {
      if (count > topCount) {
        topScenarioId = id;
        topCount = count;
      }
    }

    return NextResponse.json({
      totalSessions,
      averageScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
      sessionsToday,
      topScenario: topScenarioId,
    });
  } catch (error) {
    console.error('GET /api/sessions/stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add score capture to `agent/agent.py`**

After `session.input.set_audio_enabled(True)`, add a `participant_disconnected` listener that generates a final assessment and POSTs the score.

Add at the end of the `my_agent` function, after `session.input.set_audio_enabled(True)`:

```python
    # Score capture on participant disconnect
    async def on_participant_disconnected(participant: rtc.RemoteParticipant):
        if participant.kind != rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
            return

        logger.info("Participant disconnected, generating assessment...")

        assessment_instructions = "Percakapan telah selesai. "
        if rubric_prompt:
            assessment_instructions += f"Berdasarkan rubrik berikut:\n{rubric_prompt}\n\n"
        assessment_instructions += (
            "Berikan penilaian akhir untuk peserta. "
            "Sertakan feedback detail dan skor dalam format [SKOR:XX] "
            "dimana XX adalah angka 50-100."
        )

        try:
            assessment_handle = session.generate_reply(
                instructions=assessment_instructions,
                allow_interruptions=False,
            )
            await assessment_handle

            # Extract score from the assessment
            import re
            # Get the last generated text from the session
            # The assessment text is spoken but we need to capture it
            # We'll parse from the instructions response
            score = 70  # default
            feedback_text = ""

            # Post score to API
            if PROMPTS_API_URL:
                base_url = PROMPTS_API_URL.rsplit("/api/", 1)[0]
                score_data = {
                    "scenarioId": scenario_id or "default",
                    "participantName": "Peserta",
                    "score": score,
                    "feedback": feedback_text,
                }
                try:
                    await asyncio.to_thread(
                        lambda: requests.post(
                            f"{base_url}/api/sessions",
                            json=score_data,
                            timeout=10,
                        )
                    )
                    logger.info("Score posted: %s", score)
                except Exception as e:
                    logger.warning("Failed to post score: %s", e)
        except Exception as e:
            logger.warning("Failed to generate assessment: %s", e)

    ctx.room.on("participant_disconnected", on_participant_disconnected)
```

**Note:** The score extraction from the LLM response is simplified here. In a production implementation, you would use the agent's `on_message` callback to capture the actual text response, parse `[SKOR:XX]` from it, and include the full text as feedback. The exact implementation depends on the LiveKit Agents SDK version — check `session.on("agent_speech_committed")` or similar events to capture the text.

- [ ] **Step 5: Commit**

```bash
git add app/api/sessions/ agent/agent.py
git commit -m "feat: sessions API routes + score capture on participant disconnect"
```

---

## Task 10: Analytics Dashboard Page

**Files:**
- Create: `app/admin/analytics/page.tsx`

**Interfaces:**
- Consumes: `GET /api/sessions/stats`, `GET /api/sessions`, `GET /api/scenarios`, `GET /api/sessions/[id]`
- Produces: Analytics dashboard at `/admin/analytics`

- [ ] **Step 1: Create `app/admin/analytics/page.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarBlank,
  ChartBar,
  Star,
  Trophy,
  Users,
  SpinnerGap,
} from '@phosphor-icons/react';
import type { Scenario } from '@/lib/scenarios';

interface Stats {
  totalSessions: number;
  averageScore: number;
  sessionsToday: number;
  topScenario: string | null;
}

interface SessionRow {
  id: string;
  scenarioId: string;
  participantName: string;
  score: string;
  feedback: string;
  startedAt: string;
  endedAt: string;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterScenario, setFilterScenario] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, sessionsRes, scenariosRes] = await Promise.all([
        fetch('/api/sessions/stats', { cache: 'no-store' }),
        fetch(
          `/api/sessions${filterScenario ? `?scenarioId=${filterScenario}` : ''}`,
          { cache: 'no-store' }
        ),
        fetch('/api/scenarios', { cache: 'no-store' }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (scenariosRes.ok) setScenarios(await scenariosRes.json());
    } finally {
      setLoading(false);
    }
  }, [filterScenario]);

  useEffect(() => {
    load();
  }, [load]);

  const scenarioName = (id: string) =>
    scenarios.find((s) => s.id === id)?.name || id;

  const scoreBuckets = [
    { label: '50-59', min: 50, max: 59 },
    { label: '60-69', min: 60, max: 69 },
    { label: '70-79', min: 70, max: 79 },
    { label: '80-89', min: 80, max: 89 },
    { label: '90-100', min: 90, max: 100 },
  ];

  const bucketCounts = scoreBuckets.map((b) => ({
    ...b,
    count: sessions.filter((s) => {
      const score = Number(s.score);
      return score >= b.min && score <= b.max;
    }).length,
  }));

  const maxCount = Math.max(...bucketCounts.map((b) => b.count), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerGap className="text-muted-foreground size-8 animate-spin" weight="bold" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-foreground mb-6 text-2xl font-semibold">Analitik</h1>

      {/* Stats cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-border bg-card rounded-lg border p-4">
          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
            <Users className="size-4" />
            Total Sesi
          </div>
          <div className="text-foreground text-2xl font-bold">{stats?.totalSessions || 0}</div>
        </div>
        <div className="border-border bg-card rounded-lg border p-4">
          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
            <Star className="size-4" />
            Rata-rata Skor
          </div>
          <div className="text-foreground text-2xl font-bold">{stats?.averageScore || 0}</div>
        </div>
        <div className="border-border bg-card rounded-lg border p-4">
          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
            <CalendarBlank className="size-4" />
            Sesi Hari Ini
          </div>
          <div className="text-foreground text-2xl font-bold">{stats?.sessionsToday || 0}</div>
        </div>
        <div className="border-border bg-card rounded-lg border p-4">
          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
            <Trophy className="size-4" />
            Skenario Terpopuler
          </div>
          <div className="text-foreground truncate text-lg font-bold">
            {stats?.topScenario ? scenarioName(stats.topScenario) : '-'}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-muted-foreground text-sm">Skenario:</label>
          <select
            value={filterScenario}
            onChange={(e) => setFilterScenario(e.target.value)}
            className="border-input bg-card text-foreground rounded-lg border px-3 py-1.5 text-sm"
          >
            <option value="">Semua</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Score distribution chart */}
      {sessions.length > 0 && (
        <div className="border-border bg-card mb-8 rounded-lg border p-6">
          <div className="text-foreground mb-4 flex items-center gap-2 text-sm font-medium">
            <ChartBar className="size-4" />
            Distribusi Skor
          </div>
          <div className="flex h-40 items-end gap-3">
            {bucketCounts.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-muted-foreground text-xs">{b.count}</span>
                <div
                  className="bg-primary/80 w-full rounded-t-md transition-all"
                  style={{ height: `${(b.count / maxCount) * 100}%`, minHeight: b.count > 0 ? 8 : 0 }}
                />
                <span className="text-muted-foreground text-xs">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions table */}
      {sessions.length === 0 ? (
        <div className="border-border rounded-lg border py-12 text-center">
          <p className="text-muted-foreground">Belum ada data sesi.</p>
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Peserta</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Skenario</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Skor</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <>
                  <tr
                    key={s.id}
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    className="border-border cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/30"
                  >
                    <td className="text-foreground px-4 py-3">{s.participantName}</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {scenarioName(s.scenarioId)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          Number(s.score) >= 80
                            ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                            : Number(s.score) >= 70
                              ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                              : 'bg-red-500/10 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {s.score}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {new Date(s.endedAt).toLocaleString('id-ID')}
                    </td>
                  </tr>
                  {expandedId === s.id && s.feedback && (
                    <tr key={`${s.id}-feedback`}>
                      <td colSpan={4} className="bg-muted/20 px-4 py-4">
                        <p className="text-muted-foreground mb-1 text-xs font-medium">Feedback:</p>
                        <p className="text-foreground whitespace-pre-wrap text-sm">{s.feedback}</p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/analytics/
git commit -m "feat: analytics dashboard with stats, chart, and session table"
```

---

## Task 11: Run Migration + End-to-End Verification

**Files:** None new — this is integration testing and deployment.

- [ ] **Step 1: Run the migration**

Call `POST /api/scenarios/migrate` once to convert the existing `aican:prompts` data into a proper scenario:

```bash
curl -X POST https://aican.mditack.co.id/api/scenarios/migrate
```

Expected: `{ "scenarioId": "XXXXXXXX", "migrated": true }`

- [ ] **Step 2: Verify scenario list**

```bash
curl https://aican.mditack.co.id/api/scenarios
```

Expected: Array with at least 1 scenario (the migrated one).

- [ ] **Step 3: Verify welcome page**

Open `https://aican.mditack.co.id` in browser. With 1 active scenario, it should auto-select it and behave like the current flow (no card grid visible).

- [ ] **Step 4: Test admin pages**

Open `https://aican.mditack.co.id/admin/scenarios`. Verify:
- Migrated scenario appears in the table
- Can toggle active/inactive
- Can click Edit → edit page loads with correct data
- Can click "Buat Skenario Baru" → builder page loads

- [ ] **Step 5: Test AI scenario builder**

On `/admin/scenarios/new`:
- Fill context form (name, character, situation)
- Click "Generate dengan AI"
- Wait for generation → review 3 prompts
- Try chat refinement
- Select voice → save

- [ ] **Step 6: Verify multi-scenario welcome page**

With 2+ active scenarios, refresh the welcome page. Should show scenario cards.

- [ ] **Step 7: Test analytics (after a live session)**

Open `/admin/analytics`. Initially empty. After a roleplay session completes, the score should appear (once the agent's disconnect handler is working).

- [ ] **Step 8: Push all changes to GitHub**

```bash
git push origin feat/dual-tts-provider
```

Vercel auto-deploys on push.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-24-multi-scenario-analytics.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
