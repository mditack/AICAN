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
from livekit.agents.voice.room_io.types import TextInputEvent
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

INITIAL_TRIGGER_TEXT = "[SYSTEM] Mulai sesi sekarang. Sapa lawan bicara sesuai instruksi."


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


# shutdown_process_timeout gives the shutdown callback (assessment generation)
# enough time to finish before the worker process is killed. Default is 10s
# which is too short for LLM-based assessments — bump to 120s.
server = AgentServer(shutdown_process_timeout=120.0)


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

    # Custom text-input callback: works around gemini-3.1-flash-live-preview
    # having mutable_chat_context=False (which makes the default cb's
    # generate_reply(user_input=...) a no-op). We inject the message
    # directly into the realtime session as a completed user turn.
    async def _text_input_cb(sess: AgentSession, ev: TextInputEvent) -> None:
        try:
            rt = sess._activity.realtime_llm_session if sess._activity else None
        except AttributeError:
            rt = None

        if rt is None:
            async with sess._claim_user_turn():
                await sess.interrupt()
                sess.generate_reply(user_input=ev.text)
            return

        try:
            from google.genai import types as gtypes

            async with sess._claim_user_turn():
                await sess.interrupt()
                turn = gtypes.Content(
                    parts=[gtypes.Part(text=ev.text)],
                    role="user",
                )
                rt._send_client_event(
                    gtypes.LiveClientContent(turns=[turn], turn_complete=True)
                )
        except Exception as e:
            logger.warning("Custom text_input_cb failed, falling back: %s", e)
            async with sess._claim_user_turn():
                await sess.interrupt()
                sess.generate_reply(user_input=ev.text)

    combined_instructions = agent_prompt + "\n\n" + session_prompt
    await session.start(
        room=ctx.room,
        agent=Assistant(instructions=combined_instructions),
        room_options=room_io.RoomOptions(
            text_input=room_io.TextInputOptions(text_input_cb=_text_input_cb),
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony()
                if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                else noise_cancellation.BVC(),
            ),
        ),
    )

    # Kick off the agent so it speaks first instead of waiting for user audio.
    # gemini-3.1-flash-live-preview ignores generate_reply, so send a hidden
    # trigger message directly on the realtime channel. The trigger phrase is
    # filtered out of the transcript before assessment.
    async def _kick_off_agent():
        try:
            await asyncio.sleep(0.8)
            rt = session._activity.realtime_llm_session if session._activity else None
            if rt is None:
                logger.warning("Realtime session not available for initial trigger")
                return
            from google.genai import types as gtypes
            trigger = gtypes.Content(
                parts=[gtypes.Part(text=INITIAL_TRIGGER_TEXT)],
                role="user",
            )
            rt._send_client_event(
                gtypes.LiveClientContent(turns=[trigger], turn_complete=True)
            )
            logger.info("Initial trigger sent to agent")
        except Exception as e:
            logger.warning("Failed to send initial trigger: %s", e)

    asyncio.create_task(_kick_off_agent())

    # Generate assessment and store directly in Redis on participant disconnect
    async def _generate_and_post_assessment():
        logger.info("Generating text assessment via Gemini LLM...")

        # Build transcript from session chat history
        transcript_lines: list[str] = []
        try:
            history = session.history
            for item in history.items:
                role = getattr(item, "role", None)
                text_content = getattr(item, "text_content", None)
                if not role or not text_content:
                    continue
                clean_text = text_content.strip()
                # Skip the hidden session-start trigger — it isn't real user speech
                if clean_text == INITIAL_TRIGGER_TEXT:
                    continue
                if role == "user":
                    speaker = "Peserta"
                elif role in ("assistant", "model"):
                    speaker = "Agen"
                else:
                    continue
                transcript_lines.append(f"{speaker}: {clean_text}")
        except Exception as e:
            logger.warning("Failed to read chat history: %s", e)

        transcript = "\n".join(transcript_lines).strip()
        logger.info("Transcript length: %d chars, %d lines", len(transcript), len(transcript_lines))

        assessment_prompt = "Anda adalah evaluator roleplay. Berikut transkrip percakapan roleplay yang baru selesai:\n\n"
        if transcript:
            assessment_prompt += f"---\n{transcript}\n---\n\n"
        else:
            assessment_prompt += "(Transkrip percakapan tidak tersedia — kemungkinan sesi berakhir sebelum ada percakapan berarti.)\n\n"

        if rubric_prompt:
            assessment_prompt += (
                f"Rubrik penilaian:\n{rubric_prompt}\n\n"
                "Identifikasi 3-6 kriteria evaluasi dari rubrik di atas. "
            )
        else:
            assessment_prompt += (
                "Gunakan 4 kriteria evaluasi default: "
                '"Membangun rapport", "Menggali kebutuhan", "Menyampaikan solusi", "Menangani keberatan". '
            )
        assessment_prompt += (
            "Berikan penilaian akhir untuk peserta (peran 'Peserta' di transkrip) dalam bahasa Indonesia "
            "berdasarkan apa yang benar-benar mereka katakan di transkrip. "
            "JANGAN membuat asumsi atau contoh hipotetis — nilai HANYA berdasarkan perilaku aktual di transkrip. "
            "Jika transkrip terlalu pendek untuk evaluasi menyeluruh, tetap berikan penilaian jujur dengan skor rendah dan sebutkan kekurangannya. "
            "Format respons HANYA sebagai JSON (tanpa markdown, tanpa teks lain) dengan field: "
            '"score" (angka 0-100, skor keseluruhan), '
            '"feedback" (string berisi feedback keseluruhan 2-3 kalimat merujuk hal spesifik dari transkrip), '
            '"criteria" (array objek dengan field: '
            '"name" string nama kriteria, '
            '"score" angka 0 hingga maxScore, '
            '"maxScore" angka 5, '
            '"feedback" string 2-4 kalimat menjelaskan penilaian dengan mengutip atau merujuk perilaku spesifik peserta di transkrip), '
            '"strengths" (array string, 2-4 kekuatan spesifik yang muncul di transkrip), '
            '"improvements" (array string, 2-4 area yang perlu diperbaiki dengan saran konkret).'
        )

        async def _call_llm_once() -> str:
            # Call Gemini directly. gemini-2.5-flash was returning 504
            # DEADLINE_EXCEEDED consistently on this prompt shape; the -lite
            # variant is faster and thinking_budget=0 disables the slow
            # reasoning path we don't need for structured assessment output.
            from google import genai
            from google.genai import types as gtypes

            client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY", ""))
            config = gtypes.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
                thinking_config=gtypes.ThinkingConfig(thinking_budget=0),
            )

            def _sync_call() -> str:
                resp = client.models.generate_content(
                    model="gemini-2.5-flash-lite",
                    contents=assessment_prompt,
                    config=config,
                )
                return resp.text or ""

            return await asyncio.to_thread(_sync_call)

        response_text = ""
        last_err: Exception | None = None
        for attempt in range(3):
            try:
                response_text = await asyncio.wait_for(_call_llm_once(), timeout=30)
                if response_text.strip():
                    break
            except Exception as e:
                last_err = e
                logger.warning("LLM assessment attempt %s failed: %s", attempt + 1, e)
                if attempt < 2:
                    await asyncio.sleep(1.0)

        # Default fallback assessment if all LLM attempts failed
        score = 0
        feedback_text = json.dumps(
            {
                "score": 0,
                "feedback": (
                    "Penilaian otomatis sedang tidak tersedia. Silakan coba sesi lagi "
                    "atau hubungi administrator jika masalah berlanjut."
                ),
                "criteria": [],
                "strengths": [],
                "improvements": [],
            },
            ensure_ascii=False,
        )

        if response_text:
            logger.info("Assessment raw: %s", response_text[:300])
            try:
                clean = response_text.strip()
                if clean.startswith("```"):
                    clean = re.sub(r"^```(?:json)?\s*", "", clean)
                    clean = re.sub(r"\s*```$", "", clean)
                parsed = json.loads(clean)
                score = max(0, min(100, int(parsed.get("score", 0))))
                feedback_text = json.dumps(parsed, ensure_ascii=False)
            except (json.JSONDecodeError, ValueError, TypeError) as e:
                logger.warning("Failed to parse assessment JSON: %s", e)
                m = re.search(r"\b(\d{2,3})\b", response_text)
                if m:
                    val = int(m.group(1))
                    if 0 <= val <= 100:
                        score = val
        elif last_err:
            logger.warning("All LLM attempts failed, saving fallback assessment: %s", last_err)

        # Write assessment to Upstash Redis — always runs so frontend never hangs
        if not (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN):
            logger.warning("Redis credentials not configured, skipping assessment storage")
            return

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

    # Run assessment as a shutdown callback so the job lifecycle waits for it
    # instead of being cancelled by the room closing.
    async def _on_shutdown():
        # Worst case inside _generate_and_post_assessment: 3 LLM attempts *
        # 30s + 2 retry sleeps = 92s, then a 10s Redis write = ~102s. This
        # must stay above that (previously 90s raced the LLM retries and
        # could cancel the coroutine before the Redis write ever ran, losing
        # the assessment entirely) and below shutdown_process_timeout (120s).
        try:
            await asyncio.wait_for(_generate_and_post_assessment(), timeout=110)
        except asyncio.TimeoutError:
            logger.warning("Assessment shutdown callback timed out after 110s")
        except Exception as e:
            logger.warning("Assessment shutdown callback failed: %s", e)

    ctx.add_shutdown_callback(_on_shutdown)


if __name__ == "__main__":
    agents.cli.run_app(server)
