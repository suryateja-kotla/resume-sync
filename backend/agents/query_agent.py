from google.adk import Agent
from instructions.query_agent_instruction import QUERY_AGENT_INSTRUCTION
from tools.excel_tools import create_talent_excel
import os
import sys
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

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

query_agent = Agent(
    name="query_agent",
    model="gemini-2.5-pro",
    instruction=QUERY_AGENT_INSTRUCTION,
    tools=[mongo_toolset, create_talent_excel],
)
