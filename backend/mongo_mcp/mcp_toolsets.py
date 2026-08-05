import os
import sys
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters
from mcp.client.stdio import DEFAULT_INHERITED_ENV_VARS

_MCP_SERVER_SCRIPT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "mongo_mcp", "mongo_mcp_server.py")
)

# mongo_mcp_server.py only needs these two — everything else the backend
# holds (Entra secret, GCS creds, Graph mail creds, the job trigger token)
# has no business being visible to this subprocess.
_MCP_SERVER_ENV_VARS = ("MONGO_URI", "MONGO_DB_NAME")


def get_ingestion_agent_toolset():
    return McpToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(
                command=sys.executable,
                args=[_MCP_SERVER_SCRIPT],
                # Without an explicit `env`, the mcp package only passes a
                # fixed OS safe-list (PATH, HOME, ...) to the subprocess —
                # not MONGO_URI. On Cloud Run (no .env file to fall back to)
                # that left mongo_mcp_server.py connecting to its own
                # default, mongodb://localhost:27017, which doesn't exist
                # there. Extending the safe-list with just what this one
                # tool needs, rather than forwarding the whole environment,
                # keeps every other secret out of reach of this subprocess.
                env={
                    **{k: v for k in DEFAULT_INHERITED_ENV_VARS if (v := os.environ.get(k)) is not None},
                    **{k: v for k in _MCP_SERVER_ENV_VARS if (v := os.environ.get(k)) is not None},
                },
            ),
            timeout=120,
        ),
        tool_filter=["save_resume_path"],
    )