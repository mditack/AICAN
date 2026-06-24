"""
AICAN voice agent — dual-mode (Indonesian).
Mode 'gemini':     Gemini 2.5 Flash Native Audio (free, all-in-one)
Mode 'elevenlabs': Groq Whisper STT + Gemini Flash text LLM + ElevenLabs Flash TTS (pipeline)
Deploy to LiveKit Cloud with: lk agent create
"""
import asyncio
import json
import logging
import os

import requests
from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, TurnHandlingOptions
from livekit.plugins import google, noise_cancellation
from prompts import AGENT_PROMPT, SESSION_PROMPT

logger = logging.getLogger(__name__)
load_dotenv(".env.local")

AGENT_NAME = os.getenv("AGENT_NAME", "")
PROMPTS_API_URL = os.getenv("PROMPTS_API_URL", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "pFZP5JQG7iQjIQuC4Bku")
DEFAULT_TTS_PROVIDER = os.getenv("DEFAULT_TTS_PROVIDER", "gemini")


def _fetch_prompts_from_api() -> dict | None:
    """Fetch agent prompt, session prompt, voice, and ttsProvider from the API."""
    if not PROMPTS_API_URL or not PROMPTS_API_URL.startswith("http"):
        return None
    try:
        r = requests.get(PROMPTS_API_URL, timeout=10)
        r.raise_for_status()
        data = r.json()
        agent = data.get("agentPrompt")
        session = data.get("sessionPrompt")
        if isinstance(agent, str) and isinstance(session, str):
            return {
                "agent_prompt": agent,
                "session_prompt": session,
                "voice": data.get("voice", ""),
                "tts_provider": data.get("ttsProvider", DEFAULT_TTS_PROVIDER),
            }
    except Exception as e:
        logger.warning("Failed to fetch prompts from API (%s), using defaults: %s", PROMPTS_API_URL, e)
    return None


class Assistant(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(instructions=instructions)


def _build_gemini_session(voice: str) -> AgentSession:
    """Gemini Native Audio — free all-in-one RealtimeModel."""
    gemini_voice = voice if voice and len(voice) < 30 else "Enceladus"
    return AgentSession(
        llm=google.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-preview-12-2025",
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
    fetched = await asyncio.to_thread(_fetch_prompts_from_api)

    agent_prompt = fetched["agent_prompt"] if fetched else AGENT_PROMPT
    session_prompt = fetched["session_prompt"] if fetched else SESSION_PROMPT
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


if __name__ == "__main__":
    agents.cli.run_app(server)
