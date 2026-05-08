"""
AICAN voice agent using Gemini 2.5 Flash Native Audio (Indonesian).
Deploy to LiveKit Cloud with: lk agent create
"""
import asyncio
import json
import logging
import os

import requests
from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import google, noise_cancellation  # , bey
# from livekit.plugins import simli
from livekit.plugins.google.realtime import RealtimeModel
from prompts import AGENT_PROMPT, SESSION_PROMPT

logger = logging.getLogger(__name__)
load_dotenv(".env.local")

# Must match NEXT_PUBLIC_AGENT_NAME / AGENT_NAME in the frontend .env.local (e.g. AICAN)
AGENT_NAME = os.getenv("AGENT_NAME", "")

# Optional: URL of the Next.js app's prompts API (e.g. https://your-app.vercel.app/api/prompts).
# If set, the agent loads prompts from this URL at session start; otherwise uses prompts.py.
PROMPTS_API_URL = os.getenv("PROMPTS_API_URL", "")


def _fetch_prompts_from_api() -> tuple[str, str, str] | None:
    """Fetch agent and session prompts and voice from the API. Returns (agent_prompt, session_prompt, voice) or None on failure."""
    if not PROMPTS_API_URL or not PROMPTS_API_URL.startswith("http"):
        return None
    try:
        r = requests.get(PROMPTS_API_URL, timeout=10)
        r.raise_for_status()
        data = r.json()
        agent = data.get("agentPrompt")
        session = data.get("sessionPrompt")
        voice = data.get("voice")
        if isinstance(agent, str) and isinstance(session, str):
            return (agent, session, voice if isinstance(voice, str) and voice.strip() else "Enceladus")
    except Exception as e:
        logger.warning("Failed to fetch prompts from API (%s), using defaults: %s", PROMPTS_API_URL, e)
    return None


def _avatar_enabled_for_room(ctx: agents.JobContext) -> bool:
    """Read avatarEnabled from first participant's token metadata (default True)."""
    for p in ctx.room.remote_participants.values():
        if not p.metadata:
            return True
        try:
            data = json.loads(p.metadata)
            return data.get("avatarEnabled", True)
        except (json.JSONDecodeError, TypeError):
            return True
    return True


class Assistant(Agent):
    def __init__(self, instructions: str) -> None:
        super().__init__(instructions=instructions)


server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def my_agent(ctx: agents.JobContext):
    # Load prompts and voice from API if PROMPTS_API_URL is set, otherwise use prompts.py and default voice
    fetched = await asyncio.to_thread(_fetch_prompts_from_api)
    agent_prompt = fetched[0] if fetched else AGENT_PROMPT
    session_prompt = fetched[1] if fetched else SESSION_PROMPT
    voice = fetched[2] if fetched else "Enceladus"

    session = AgentSession(
        llm=google.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-preview-12-2025",
            voice=voice,
            language="id-ID",
            temperature=1.0,
        ),
    )

    # Optional Bey avatar: only if enabled by user and BEY_AVATAR_ID is set (commented out – using Simli)
    # avatar_enabled = _avatar_enabled_for_room(ctx)
    # bey_avatar_id = os.getenv("BEY_AVATAR_ID")
    # if avatar_enabled and bey_avatar_id:
    #     livekit_url = os.getenv("LIVEKIT_URL", "")
    #     if livekit_url.startswith("https://"):
    #         os.environ["LIVEKIT_URL"] = livekit_url.replace("https://", "wss://", 1)
    #     try:
    #         avatar = bey.AvatarSession(avatar_id=bey_avatar_id)
    #         await asyncio.wait_for(
    #             avatar.start(session, room=ctx.room),
    #             timeout=20.0,
    #         )
    #     except asyncio.TimeoutError:
    #         logger.warning("Bey avatar start timed out; continuing without avatar")
    #     except Exception as e:
    #         logger.warning("Bey avatar failed; continuing without avatar: %s", e)

    # Optional Simli avatar disabled (commented out).
    # If you re-enable this, note that we intentionally start the avatar BEFORE
    # `session.start()` so audio is routed to the avatar from the beginning.
    #
    # avatar_enabled = _avatar_enabled_for_room(ctx)
    # simli_api_key = os.getenv("SIMLI_API_KEY")
    # simli_face_id = os.getenv("SIMLI_FACE_ID")
    # if not avatar_enabled:
    #     logger.debug("Avatar disabled by user; skipping Simli avatar")
    # elif not simli_api_key or not simli_face_id:
    #     logger.info(
    #         "Simli avatar skipped: set SIMLI_API_KEY and SIMLI_FACE_ID in agent secrets (or .env.local for local run)"
    #     )
    # else:
    #     # Simli API expects wss:// for LiveKit URL
    #     livekit_url = os.getenv("LIVEKIT_URL", "")
    #     if livekit_url.startswith("https://"):
    #         os.environ["LIVEKIT_URL"] = livekit_url.replace("https://", "wss://", 1)
    #     try:
    #         avatar = simli.AvatarSession(
    #             simli_config=simli.SimliConfig(
    #                 api_key=simli_api_key,
    #                 face_id=simli_face_id,
    #             ),
    #         )
    #         await asyncio.wait_for(
    #             avatar.start(session, room=ctx.room),
    #             timeout=30.0,
    #         )
    #         logger.info("Simli avatar started successfully")
    #     except asyncio.TimeoutError:
    #         logger.warning("Simli avatar start timed out; continuing without avatar")
    #     except Exception as e:
    #         logger.warning("Simli avatar failed; continuing without avatar: %s", e)

    await session.start(
        room=ctx.room,
        agent=Assistant(instructions=agent_prompt),
        room_options=room_io.RoomOptions(
            #video_input=video_enabled,  # Enable only when image deps are available
            text_input=True,  # Explicitly enable text input to handle 'lk.chat' streams
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony()
                if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                else noise_cancellation.BVC(),
            ),
        ),
    )

    # Ignore all user audio/text input while the agent delivers its introduction
    session.input.set_audio_enabled(False)

    intro_handle = session.generate_reply(
        instructions=session_prompt,
        allow_interruptions=False,
    )
    await intro_handle  # wait for the introduction to fully play out

    # Introduction done – re-enable user input
    session.input.set_audio_enabled(True)


if __name__ == "__main__":
    agents.cli.run_app(server)
