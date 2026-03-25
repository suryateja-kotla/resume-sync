import os
import sys

from google.adk.agents import Agent
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters
from tools.resume_tool import (
    extract_resume,
    generate_resume_docx,
)
from instructions.ingestion_agent_instruction import INGESTION_AGENT_INSTRUCTION
from dotenv import load_dotenv

load_dotenv()

_MCP_SERVER_SCRIPT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "mcp_server", "mongo_mcp_server.py")
)

mongo_toolset = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command=sys.executable,
            args=[_MCP_SERVER_SCRIPT],
        ),
        timeout=120,
    ),
)

ingestion_agent = Agent(
    name="ingestion_agent",
    model=os.getenv("MODEL", "gemini-2.5-flash"),
    description="Ingests employee resumes, extracts data, generates DOCX, persists to MongoDB.",
    instruction=INGESTION_AGENT_INSTRUCTION,
    tools=[
        extract_resume,
        generate_resume_docx,
        mongo_toolset,
    ],
)
