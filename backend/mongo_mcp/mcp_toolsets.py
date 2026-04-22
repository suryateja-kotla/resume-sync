import os
import sys
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

_MCP_SERVER_SCRIPT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "mongo_mcp", "mongo_mcp_server.py")
)


def get_query_agent_toolset():
    return McpToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(
                command=sys.executable,
                args=[_MCP_SERVER_SCRIPT],
            ),
            timeout=120,
        ),
        tool_filter=["search_employees_and_get_resume_paths"],
    )


def get_ingestion_agent_toolset():
    return McpToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(
                command=sys.executable,
                args=[_MCP_SERVER_SCRIPT],
            ),
            timeout=120,
        ),
        tool_filter=["save_employee_resume_profile", "log_audit_event"],
    )
