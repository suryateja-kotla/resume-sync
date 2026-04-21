from google.adk import Agent
from instructions.query_agent_instruction import QUERY_AGENT_INSTRUCTION
from tools.excel_tools import create_talent_excel
import os
from mongo_mcp.mcp_toolsets import get_query_agent_toolset

query_agent = Agent(
    name="query_agent",
    model=os.getenv("MODEL", "gemini-2.5-flash"),
    instruction=QUERY_AGENT_INSTRUCTION,
    tools=[get_query_agent_toolset(), create_talent_excel],
)
