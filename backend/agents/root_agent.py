from google.adk.agents import Agent
from agents.ingestion_agent import ingestion_agent
from agents.query_agent import query_agent
from instructions.root_agent_instruction import ROOT_AGENT_INSTRUCTION
import os
from dotenv import load_dotenv

load_dotenv()

root_agent = Agent(
    name="root_orchestrator",
    model=os.getenv("MODEL", "gemini-2.5-flash"),
    description="Orchestrates all resume system operations by routing to specialist agents.",
    instruction=ROOT_AGENT_INSTRUCTION,
    sub_agents=[ingestion_agent, query_agent],
)
