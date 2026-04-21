import os
from google.adk.agents import Agent
from tools.resume_tool import (
    extract_resume,
    generate_resume_docx,
)
from instructions.ingestion_agent_instruction import INGESTION_AGENT_INSTRUCTION
from mongo_mcp.mcp_toolsets import get_ingestion_agent_toolset

ingestion_agent = Agent(
    name="ingestion_agent",
    model=os.getenv("MODEL", "gemini-2.5-flash"),
    description="Ingests employee resumes, extracts data, generates DOCX, persists to MongoDB.",
    instruction=INGESTION_AGENT_INSTRUCTION,
    tools=[
        extract_resume,
        generate_resume_docx,
        get_ingestion_agent_toolset(),
    ],
)
