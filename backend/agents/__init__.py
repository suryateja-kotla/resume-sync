# agents/__init__.py
from agents.ingestion_agent import ingestion_agent
from agents.root_agent import root_agent

__all__ = ["root_agent", "ingestion_agent"]
