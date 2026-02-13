# AICAN Agent (Gemini 2.5 Flash Native Audio)

Voice agent using **Gemini 2.5 Flash Native Audio** with:

- **Model:** `gemini-2.5-flash-native-audio-preview-12-2025`
- **Voice:** Enceladus
- **Language:** Indonesian (`id-ID`)
- **Temperature:** 1.0

## Prerequisites

- Python >= 3.10, < 3.14
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (recommended) or pip
- [LiveKit CLI](https://docs.livekit.io/intro/basics/cli/) (`lk`)
- LiveKit Cloud project and Google API key

## Setup

1. **From repo root**, copy env (or create `agent/.env.local` with):

   ```bash
   cd agent
   cp .env.example .env.local
   ```

   Then set in `agent/.env.local`:
   - `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` — from [LiveKit Cloud](https://cloud.livekit.io) or run `lk appenv -w` from project root and copy into `agent/.env.local`.
   - `GOOGLE_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey).

2. **Install dependencies** (from `agent/`):

   ```bash
   uv sync
   # or: pip install -e ".[google]"
   ```

## Run locally

From `agent/`:

```bash
# Dev: connect to LiveKit and use with playground or your React app
uv run agent.py dev

# Console: talk in terminal only
uv run agent.py console
```

Ensure the React app (from repo root) uses the same LiveKit project and that `AGENT_NAME` matches the name you give when deploying (see below).

## Deploy to LiveKit Cloud

1. **Install and auth LiveKit CLI** (if not done):
   - Install: `winget install LiveKit.LiveKitCLI` (Windows) or see [docs](https://docs.livekit.io/intro/basics/cli/).
   - Link project: `lk cloud auth`.

2. **From the `agent` directory**, deploy:

   ```bash
   cd agent
   lk agent create
   ```

   The CLI will:
   - Create `Dockerfile` and `livekit.toml` if missing
   - Build the image and deploy to your LiveKit Cloud project
   - Assign an **agent name** (e.g. `aican-agent-xxxx`)

3. **Set the agent name in the frontend** so the app uses this agent:
   - In the project root `.env.local`, set:
     ```env
     AGENT_NAME=<agent-name-from-deploy>
     ```
   - Or in `app-config.ts`, set `agentName` to that value.

4. **Secrets on LiveKit Cloud**  
   Add `GOOGLE_API_KEY` in the Cloud dashboard (Project → Settings → Secrets) so the deployed agent can call Gemini.

## Useful commands

- **Status:** `lk agent status`
- **Logs:** `lk agent logs`
- **Redeploy after changes:** `lk agent create` (or use the deploy workflow from the docs)

## Model config (in code)

The agent uses this LLM config in `agent/agent.py`:

```python
llm=google.realtime.RealtimeModel(
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    voice="Enceladus",
    language="id-ID",
    temperature=1.0,
)
```

Edit `agent/agent.py` to change instructions, voice, or language, then redeploy.
