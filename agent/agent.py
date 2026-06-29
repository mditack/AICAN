"""
AICAN voice agent — dual-mode (Indonesian).
Mode 'gemini':     Gemini 3.1 Flash Live (free, all-in-one)
Mode 'elevenlabs': Groq Whisper STT + Gemini Flash text LLM + ElevenLabs Flash TTS (pipeline)
Deploy to LiveKit Cloud with: lk agent create
"""
import asyncio
import json
import logging
import os
import re
import time

import requests
from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, TurnHandlingOptions
from livekit.plugins import google, noise_cancellation
from prompts import AGENT_PROMPT, SESSION_PROMPT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info("AICAN agent module loading...")
load_dotenv(".env.local")

AGENT_NAME = os.getenv("AGENT_NAME", "")
PROMPTS_API_URL = os.getenv("PROMPTS_API_URL", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "pFZP5JQG7iQjIQuC4Bku")
DEFAULT_TTS_PROVIDER = os.getenv("DEFAULT_TTS_PROVIDER", "gemini")
UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")


def _extract_scenario_from_metadata(metadata: dict) -> dict | None:
    """Extract scenario prompts embedded directly in participant metadata."""
    scenario = metadata.get("scenario")
    if not scenario or not isinstance(scenario, dict):
        return None
    agent_prompt = scenario.get("agentPrompt")
    session_prompt = scenario.get("sessionPrompt")
    if isinstance(agent_prompt, str) and isinstance(session_prompt, str):
        return {
            "agent_prompt": agent_prompt,
            "session_prompt": session_prompt,
            "rubric_prompt": scenario.get("rubricPrompt", ""),
            "voice": scenario.get("voice", ""),
            "tts_provider": scenario.get("ttsProvider", DEFAULT_TTS_PROVIDER),
        }
    return None


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


class Assistant(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(instructions=instructions)


def _build_gemini_session(voice: str) -> AgentSession:
    """Gemini Native Audio — free all-in-one RealtimeModel."""
    gemini_voice = voice if voice and len(voice) < 30 else "Enceladus"
    return AgentSession(
        llm=google.realtime.RealtimeModel(
            model="gemini-3.1-flash-live-preview",
            voice=gemini_voice,
            language="id-ID",
            temperature=1.0,
        ),
    )


def _build_elevenlabs_session(voice_id: str) -> AgentSession:
    """Pipeline: Groq Whisper + Gemini Flash text + ElevenLabs Flash TTS."""
    from livekit.plugins import groq, elevenlabs, silero
    from livekit.plugins.turn_detector.multilingual import MultilingualModel

    el_voice = voice_id if voice_id and len(voice_id) >= 15 else ELEVENLABS_VOICE_ID
    return AgentSession(
        stt=groq.STT(
            model="whisper-large-v3-turbo",
            language="id",
        ),
        llm=google.LLM(
            model="gemini-2.5-flash",
            temperature=1.0,
        ),
        tts=elevenlabs.TTS(
            voice_id=el_voice,
            model="eleven_flash_v2_5",
            language="id",
        ),
        vad=silero.VAD.load(),
        turn_handling=TurnHandlingOptions(
            turn_detection=MultilingualModel(),
        ),
    )


server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def my_agent(ctx: agents.JobContext):
    # Wait for user participant to join so we can read their metadata
    participant = await ctx.wait_for_participant()
    logger.info("Participant joined: %s, metadata: %s", participant.identity, participant.metadata)

    # Read scenarioId and scenario prompts from participant metadata
    scenario_id = None
    fetched = None

    try:
        meta = json.loads(participant.metadata or "{}")
        scenario_id = meta.get("scenarioId")
        fetched = _extract_scenario_from_metadata(meta)
        if fetched:
            logger.info("Got scenario prompts from metadata (id=%s)", scenario_id)
    except (json.JSONDecodeError, AttributeError):
        pass

    # Fallback: fetch from API if not embedded in metadata
    if not fetched:
        logger.info("Scenario ID from metadata: %s, fetching from API...", scenario_id)
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

    combined_instructions = agent_prompt + "\n\n" + session_prompt
    await session.start(
        room=ctx.room,
        agent=Assistant(instructions=combined_instructions),
        room_options=room_io.RoomOptions(
            text_input=True,
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony()
                if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                else noise_cancellation.BVC(),
            ),
        ),
    )

    # Generate assessment and store directly in Redis on participant disconnect
    async def _generate_and_post_assessment():
        logger.info("Generating text assessment via Gemini LLM...")

        assessment_prompt = "Percakapan roleplay telah selesai. "
        if rubric_prompt:
            assessment_prompt += f"Berdasarkan rubrik berikut:\n{rubric_prompt}\n\n"
        assessment_prompt += (
            "Berikan penilaian akhir untuk peserta dalam bahasa Indonesia. "
            "Format respons HANYA sebagai JSON (tanpa markdown, tanpa teks lain) dengan field: "
            '"score" (angka 50-100), '
            '"feedback" (string berisi feedback keseluruhan 2-3 kalimat), '
            '"strengths" (array string, maks 3 kekuatan peserta), '
            '"improvements" (array string, maks 3 area yang perlu diperbaiki).'
        )

        try:
            llm = google.LLM(model="gemini-2.5-flash", temperature=0.7)
            from livekit.agents.llm import ChatContext

            chat_ctx = ChatContext()
            chat_ctx.add_message(role="user", content=assessment_prompt)
            stream = llm.chat(chat_ctx=chat_ctx)

            response_text = ""
            async for text in stream.to_str_iterable():
                response_text += text

            logger.info("Assessment raw: %s", response_text[:300])

            score = 70
            feedback_text = response_text
            try:
                clean = response_text.strip()
                if clean.startswith("```"):
                    clean = re.sub(r"^```(?:json)?\s*", "", clean)
                    clean = re.sub(r"\s*```$", "", clean)
                parsed = json.loads(clean)
                score = max(50, min(100, int(parsed.get("score", 70))))
                feedback_text = json.dumps(parsed, ensure_ascii=False)
            except (json.JSONDecodeError, ValueError, TypeError):
                m = re.search(r"\b(\d{2,3})\b", response_text)
                if m:
                    val = int(m.group(1))
                    if 50 <= val <= 100:
                        score = val

            # Write assessment directly to Upstash Redis
            if UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN:
                import random
                import string
                now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
                rand_suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
                session_id = f"sess_{int(time.time() * 1000)}_{rand_suffix}"
                sid = scenario_id or "default"
                room_name = ctx.room.name
                name = participant.name or "Peserta"

                pipeline_cmds = [
                    ["HSET", f"aican:session:{session_id}",
                     "scenarioId", sid,
                     "participantName", name,
                     "score", str(score),
                     "feedback", feedback_text,
                     "roomName", room_name,
                     "startedAt", now,
                     "endedAt", now],
                    ["ZADD", f"aican:sessions:{sid}", str(score), session_id],
                    ["LPUSH", "aican:sessions:recent", session_id],
                    ["LTRIM", "aican:sessions:recent", "0", "499"],
                    ["SET", f"session:room:{room_name}", session_id],
                ]
                try:
                    resp = await asyncio.to_thread(
                        lambda: requests.post(
                            f"{UPSTASH_REDIS_REST_URL}/pipeline",
                            headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"},
                            json=pipeline_cmds,
                            timeout=10,
                        )
                    )
                    logger.info("Assessment saved to Redis, score=%s, status=%s, session=%s",
                                score, resp.status_code, session_id)
                except Exception as e:
                    logger.warning("Failed to save assessment to Redis: %s", e)
            else:
                logger.warning("Redis credentials not configured, skipping assessment storage")
        except Exception as e:
            logger.warning("Failed to generate assessment: %s", e)

    def on_participant_disconnected(p: rtc.RemoteParticipant):
        if p.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
            asyncio.create_task(_generate_and_post_assessment())

    ctx.room.on("participant_disconnected", on_participant_disconnected)


if __name__ == "__main__":
    agents.cli.run_app(server)
