from google.adk.agents import Agent
from agents.ingestion_agent import ingestion_agent
from instructions.root_agent_instruction import ROOT_AGENT_INSTRUCTION

root_agent = Agent(
    name="root_orchestrator",
    model="gemini-2.5-pro",
    description="Orchestrates all resume system operations by routing to specialist agents.",
    instruction=ROOT_AGENT_INSTRUCTION,
    sub_agents=[ingestion_agent],
)
