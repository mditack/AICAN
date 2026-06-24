# Multi-Scenario Roleplay + AI Builder + Analytics Dashboard

**Date:** 2026-06-24
**Status:** Approved
**Stack:** Next.js 15, Upstash Redis, LiveKit Agents (Python), Vercel

---

## Overview

Evolve AICAN from a single hardcoded roleplay scenario to a multi-scenario platform with:

1. **Multi-scenario management** — Multiple admins/trainers create and manage roleplay scenarios
2. **AI-assisted scenario builder** — Gemini generates agent prompt, session prompt, and rubric from context
3. **Analytics dashboard** — Track session scores, filtered by scenario and date

Authentication is anonymous for now (no user login). LearnDash integration planned for later.

---

## Data Model (Upstash Redis)

```
aican:scenarios                → Set of scenario IDs
aican:scenario:{id}            → Hash {
                                    name,           # "Coaching Karyawan Senior"
                                    description,    # short description for card
                                    category,       # "coaching" | "negotiation" | etc.
                                    agentPrompt,    # character & personality
                                    sessionPrompt,  # flow & constraints
                                    rubricPrompt,   # scoring criteria (separated from session)
                                    voice,          # voice ID (Gemini name or ElevenLabs ID)
                                    ttsProvider,    # "gemini" | "elevenlabs"
                                    isActive,       # "true" | "false"
                                    createdBy,      # admin name
                                    createdAt,      # ISO timestamp
                                    updatedAt       # ISO timestamp
                                  }
aican:scenario:default         → String (scenario ID shown when only one is active)

aican:sessions:{scenarioId}    → Sorted Set (score as rank → sessionId)
aican:session:{sessionId}      → Hash {
                                    scenarioId,
                                    participantName,
                                    score,          # 50-100
                                    feedback,       # full AI feedback text
                                    startedAt,      # ISO timestamp
                                    endedAt         # ISO timestamp
                                  }
aican:sessions:recent          → List (most recent sessionIds, capped at 500)
```

### Migration from Current Data

Current `aican:prompts` key stores a single scenario. On first deploy:
- Create a default scenario from existing `aican:prompts` data
- Add it to `aican:scenarios` set
- Set it as `aican:scenario:default`
- Keep `aican:prompts` as-is for backwards compat until migration confirmed

---

## Pages & Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Welcome — scenario picker (cards) → start roleplay | Public |
| `/session` | Active roleplay (existing session-view + scenarioId context) | Public |
| `/admin/scenarios` | List all scenarios, toggle active/inactive, delete | Admin (no auth for now) |
| `/admin/scenarios/new` | AI-assisted scenario builder | Admin |
| `/admin/scenarios/[id]` | Edit existing scenario (3 prompt textareas + voice) | Admin |
| `/admin/analytics` | Scores dashboard with filters | Admin |

When only 1 active scenario exists, welcome page behaves like today (direct to roleplay).

---

## Feature 1: Multi-Scenario Management

### Welcome Page Changes

Current: Animated bars → "Mulai bicara" button → connect.
New: Animated bars → **scenario cards grid** → select → "Mulai bicara" → connect.

Each card shows:
- Scenario name
- Category badge
- Short description
- Difficulty indicator (if set)

The selected scenario ID is passed to `connection-details` API → embedded in participant token metadata → agent reads it to load the correct prompts.

### Admin Scenarios Page (`/admin/scenarios`)

- Table/grid of all scenarios
- Each row: name, category, status (active/inactive), created by, date, actions
- Actions: Edit, Duplicate, Toggle active, Delete
- "Buat Skenario Baru" button → `/admin/scenarios/new`

### Agent Changes

Agent `_fetch_prompts_from_api()` currently fetches from `/api/prompts`. New flow:
- Agent reads `scenarioId` from participant metadata (set at connection time)
- Fetches `GET /api/scenarios/{id}` to get the specific scenario's prompts
- Falls back to default scenario if no scenarioId in metadata
- Uses `rubricPrompt` as part of the final assessment (not during conversation)

---

## Feature 2: AI-Assisted Scenario Builder

### Flow (5 steps on single page)

**Step 1 — Start from template or blank**
- Template categories: Coaching, Negotiation, Conflict Resolution, Customer Service, Interview, Custom
- Each template pre-fills context fields with sensible defaults

**Step 2 — Context form**
- Scenario name (required)
- Description (required)
- AI character name & role (required)
- Situation context (required)
- Participant objective — what they need to achieve (required)
- Difficulty level: Mudah / Sedang / Sulit (optional)
- Category select (optional, auto-detected from template)

**Step 3 — AI generation**
- Button: "Generate dengan AI"
- Calls `POST /api/scenarios/generate` which sends context to Gemini 2.5 Flash
- Gemini generates 3 separate outputs:
  - **Agent Prompt**: Character personality, background, behavior rules
  - **Session Prompt**: Conversation flow, constraints, end conditions
  - **Rubric Prompt**: Scoring criteria 50-100 with specific benchmarks
- Each output displayed in its own editable textarea

**Step 4 — Chat refinement (optional)**
- Sidebar chat interface
- Admin types natural language instructions: "buat karakternya lebih keras kepala"
- Calls `POST /api/scenarios/refine` with current prompts + instruction
- AI returns updated version of the relevant prompt section(s)
- Changes highlighted in textarea

**Step 5 — Voice & save**
- TTS provider toggle (Gemini/ElevenLabs) + voice picker (reused component)
- Voice preview button (ElevenLabs only, reuses `/api/voice-preview`)
- "Simpan Skenario" button → `POST /api/scenarios`

### AI Generation API

`POST /api/scenarios/generate`
- Uses `GOOGLE_API_KEY` (same key as agent, Gemini 2.5 Flash text)
- System prompt instructs Gemini to output structured JSON with 3 fields
- Temperature: 0.8 for creativity
- Response parsed and returned to client

`POST /api/scenarios/refine`
- Input: current agentPrompt + sessionPrompt + rubricPrompt + user instruction
- Gemini returns updated prompts with changes applied
- Only modified sections returned

---

## Feature 3: Analytics Dashboard

### Score Capture Flow

```
User clicks End Call
→ LiveKit fires participant_disconnected event
→ Agent generates final assessment via LLM:
   "Based on this conversation, provide scoring per rubric in format [SKOR:XX]"
→ Agent parses [SKOR:XX] and feedback text from response
→ Agent POSTs to /api/sessions:
   { scenarioId, participantName, score, feedback }
→ Stored in Redis (session hash + sorted set + recent list)
```

If user disconnects before assessment completes, agent still generates and stores it server-side.

The agent extracts `participantName` from the conversation (user states their name in step 1 of the roleplay flow).

### Dashboard UI (`/admin/analytics`)

**Overview cards (top row):**
- Total sessions (all time)
- Average score
- Sessions today
- Most popular scenario

**Filters:**
- Scenario dropdown (all / specific)
- Date range picker

**Table: Recent sessions**
| Peserta | Skenario | Skor | Tanggal | Durasi |
|---------|----------|------|---------|--------|
| Budi    | Coaching Riko | 75 | 2026-06-24 | 12 min |

Click row → expand/modal showing full AI feedback text.

**Simple chart:**
- Score distribution bar chart (50-60, 60-70, 70-80, 80-90, 90-100)
- Computed client-side from Redis data

### Redis Analytics Limitations

- No server-side aggregation — all computed in API route or client
- Sorted sets enable "top scores" and "by scenario" queries efficiently
- Recent list capped at 500 entries; for scale beyond that, migrate to Supabase
- Sufficient for the early phase (< 1000 sessions)

---

## API Routes (New)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/scenarios` | List all scenarios (with optional `?active=true` filter) |
| GET | `/api/scenarios/[id]` | Get single scenario (used by agent) |
| POST | `/api/scenarios` | Create new scenario |
| PUT | `/api/scenarios/[id]` | Update scenario |
| DELETE | `/api/scenarios/[id]` | Delete scenario |
| POST | `/api/scenarios/generate` | AI generate prompts from context |
| POST | `/api/scenarios/refine` | AI refine prompts with instruction |
| POST | `/api/sessions` | Save session result (called by agent) |
| GET | `/api/sessions` | List sessions (with filters: scenarioId, limit, offset) |
| GET | `/api/sessions/[id]` | Get session detail with feedback |
| GET | `/api/sessions/stats` | Aggregated stats for dashboard cards |

---

## Implementation Phases

**Phase 1: Multi-Scenario Backend + Admin CRUD**
- Redis data model
- API routes for scenarios CRUD
- Migrate existing single scenario → multi-scenario format
- `/admin/scenarios` list page
- `/admin/scenarios/[id]` edit page (manual prompt editing)

**Phase 2: Welcome Page Scenario Picker**
- Update welcome page with scenario cards
- Pass scenarioId through connection flow
- Agent reads scenarioId and loads correct prompts

**Phase 3: AI Scenario Builder**
- `/admin/scenarios/new` with form + AI generation
- `/api/scenarios/generate` and `/api/scenarios/refine`
- Chat refinement sidebar
- Template system

**Phase 4: Score Capture + Analytics**
- Agent: listen disconnect event, generate assessment, POST score
- `/api/sessions` endpoints
- `/admin/analytics` dashboard page

---

## Out of Scope (Future)

- User authentication / login
- LearnDash integration (embed + SSO)
- Session transcript recording (full conversation text)
- Multi-language scenarios (currently Indonesian only)
- Audio recording / playback
- Supabase migration for scale
