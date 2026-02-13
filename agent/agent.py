"""
AICAN voice agent using Gemini 2.5 Flash Native Audio (Indonesian).
Deploy to LiveKit Cloud with: lk agent create
"""
import argparse
import os
import sys

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import google, noise_cancellation, bey
from livekit.plugins.google.realtime import RealtimeModel
from prompts import AGENT_PROMPT, SESSION_PROMPT

load_dotenv(".env.local")

# Must match NEXT_PUBLIC_AGENT_NAME / AGENT_NAME in the frontend .env.local (e.g. AICAN)
AGENT_NAME = os.getenv("AGENT_NAME", "")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=AGENT_PROMPT,
        )


server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        llm=google.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-preview-12-2025",
            voice="Enceladus",
            language="id-ID",
            temperature=1.0,
        ),
    )
    await session.start(
        room=ctx.room,
        agent=Assistant(),
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

    avatar = bey.AvatarSession(
        avatar_id=os.getenv("BEY_AVATAR_ID"),
    )
    # Start the avatar and wait for it to join
    await avatar.start(session, room=ctx.room)

    # Ignore all user audio/text input while the agent delivers its introduction
    session.input.set_audio_enabled(False)

    intro_handle = session.generate_reply(
        instructions=SESSION_PROMPT,
        allow_interruptions=False,
    )
    await intro_handle  # wait for the introduction to fully play out

    # Introduction done – re-enable user input
    session.input.set_audio_enabled(True)


if __name__ == "__main__":
    agents.cli.run_app(server)
