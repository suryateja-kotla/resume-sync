import uuid
import json
import logging
import re

from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from agents.root_agent import root_agent
from observability.tracer import init_tracing
from opentelemetry import trace

APP_NAME = "resume_management_system"
session_service = InMemorySessionService()
logger = logging.getLogger(__name__)

tracer = init_tracing()

runner = Runner(app_name=APP_NAME, agent=root_agent, session_service=session_service)


def strip_markdown_json(text: str) -> str:
    text = text.strip()
    match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text


async def run_agent(
    prompt: dict, user_id: str = "default_user", session_id: str | None = None
):
    session_id = session_id or str(uuid.uuid4())

    with tracer.start_as_current_span("agent.run") as span:
        span.set_attribute("session.id", session_id)
        span.set_attribute("user.id", user_id)
        span.set_attribute("action", prompt.get("action", "unknown"))
        span.set_attribute("employee_id", prompt.get("employee_id", "unknown"))

        logger.info(
            f"kavya Running agent | user_id={user_id} | session_id={session_id}"
        )

        await session_service.create_session(
            user_id=user_id, session_id=session_id, app_name=APP_NAME
        )

        user_message = types.Content(
            role="user", parts=[types.Part.from_text(text=json.dumps(prompt))]
        )

        reply = ""

        try:
            # Use async version
            async for event in runner.run_async(
                user_id=user_id, session_id=session_id, new_message=user_message
            ):
                logger.info(f"kavya Received event: {type(event).__name__} | {event}")
                event_type = type(event).__name__
                with tracer.start_as_current_span(f"event.{event_type}") as event_span:
                    event_span.set_attribute("session.id", session_id)

                    if hasattr(event, "text") and event.text:
                        reply += event.text
                        event_span.set_attribute("event.text", event.text[:500])

                    elif hasattr(event, "content") and event.content:
                        if hasattr(event.content, "parts"):
                            for part in event.content.parts:
                                if hasattr(part, "text") and part.text:
                                    reply += part.text
                                    event_span.set_attribute(
                                        "part.text", part.text[:500]
                                    )

                                if (
                                    hasattr(part, "function_call")
                                    and part.function_call
                                ):
                                    fc = part.function_call
                                    event_span.set_attribute("tool.name", fc.name)
                                    event_span.set_attribute(
                                        "tool.args", json.dumps(dict(fc.args))[:500]
                                    )
                                    logger.info(
                                        f"kavya Tool call: {fc.name} | args: {dict(fc.args)}"
                                    )

                                if (
                                    hasattr(part, "function_response")
                                    and part.function_response
                                ):
                                    fr = part.function_response
                                    event_span.set_attribute(
                                        "tool.response.name", fr.name
                                    )
                                    event_span.set_attribute(
                                        "tool.response.result", str(fr.response)[:500]
                                    )
                                    logger.info(
                                        f"kavya Tool response: {fr.name} | result: {fr.response}"
                                    )
            span.set_attribute("reply.raw", reply[:1000])

        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.StatusCode.ERROR, str(e))
            raise

        # Strip markdown fences
        reply = strip_markdown_json(reply)

        try:
            parsed_reply = json.loads(reply)
            span.set_attribute("reply.status", parsed_reply.get("status", "unknown"))
        except json.JSONDecodeError:
            parsed_reply = {"status": "error", "message": reply}
            span.set_status(trace.StatusCode.ERROR, "JSON decode failed")

        return {"session_id": session_id, "reply": parsed_reply}
