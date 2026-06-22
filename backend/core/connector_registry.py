"""Connector Registry — manages static and synthesized connectors centrally.

All connectors (built-in and Kimi-generated) are registered here.
The DAG executor, SafeGuard, and ToolGapDetector all read from this
single source of truth.
"""

from __future__ import annotations

import importlib
import importlib.util
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from connectors.base import MCPConnector
from utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Data shapes
# ---------------------------------------------------------------------------

@dataclass
class ToolDefinition:
    """Flat tool record used by ToolGapDetector."""
    name: str
    connector: str
    description: str
    parameters: dict = field(default_factory=dict)
    sensitive: bool = False


@dataclass
class SynthesizedToolRecord:
    """Lightweight in-memory reference to a synthesized connector."""
    service_name: str
    connector_class_name: str
    file_path: str
    tool_names: list[str]


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class ConnectorRegistry:
    """Thread-safe (single-process asyncio) registry for all MCP connectors."""

    def __init__(self) -> None:
        self._connectors: dict[str, MCPConnector] = {}
        self._synthesized_meta: dict[str, SynthesizedToolRecord] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, connector: MCPConnector) -> None:
        name = connector.get_connector_name()
        self._connectors[name] = connector
        logger.info("Connector registered", name=name)

    def register_synthesized(
        self,
        connector: MCPConnector,
        record: SynthesizedToolRecord,
    ) -> None:
        name = connector.get_connector_name()
        self._connectors[name] = connector
        self._synthesized_meta[name] = record
        logger.info("Synthesized connector registered", name=name)

    def unregister(self, service_name: str) -> bool:
        """Remove a connector from the registry and unload its module from sys.modules."""
        removed = False
        if service_name in self._connectors:
            del self._connectors[service_name]
            removed = True
        if service_name in self._synthesized_meta:
            del self._synthesized_meta[service_name]
            removed = True
        
        # Clean up from sys.modules
        module_name = f"connectors.synthesized.{service_name}"
        if module_name in sys.modules:
            del sys.modules[module_name]
            
        if removed:
            logger.info("Connector unregistered", name=service_name)
        return removed

    # ------------------------------------------------------------------

    # Lookups
    # ------------------------------------------------------------------

    def get(self, service_name: str) -> MCPConnector | None:
        return self._connectors.get(service_name)

    def is_registered(self, service_name: str) -> bool:
        return service_name in self._connectors

    def as_dict(self) -> dict[str, MCPConnector]:
        """Return raw dict — compatible with existing _registry usage pattern."""
        return dict(self._connectors)

    def get_synthesized_tools(self) -> list[SynthesizedToolRecord]:
        return list(self._synthesized_meta.values())

    # ------------------------------------------------------------------
    # Tool enumeration
    # ------------------------------------------------------------------

    async def list_all_tools(self) -> list[ToolDefinition]:
        """Return flat list of all tools across all registered connectors."""
        all_tools: list[ToolDefinition] = []
        for connector_name, connector in self._connectors.items():
            try:
                tools = await connector.list_tools()
                for t in tools:
                    all_tools.append(ToolDefinition(
                        name=t.get("name", ""),
                        connector=connector_name,
                        description=t.get("description", ""),
                        parameters=t.get("parameters", {}),
                        sensitive=t.get("sensitive", False),
                    ))
            except Exception as exc:
                logger.error(
                    "Failed to list tools from connector",
                    connector=connector_name,
                    error=str(exc),
                )
        return all_tools

    # ------------------------------------------------------------------
    # Hot loading
    # ------------------------------------------------------------------

    def hot_load(self, module_path: str, class_name: str) -> MCPConnector:
        """Dynamically import a Python file and instantiate the named class."""
        path = Path(module_path)
        if not path.exists():
            raise FileNotFoundError(f"Connector file not found: {module_path}")

        module_name = f"connectors.synthesized.{path.stem}"

        # Remove stale module if previously loaded (hot reload)
        if module_name in sys.modules:
            del sys.modules[module_name]

        spec = importlib.util.spec_from_file_location(module_name, str(path))
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot create module spec for {module_path}")

        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)  # type: ignore[attr-defined]

        cls = getattr(module, class_name, None)
        if cls is None:
            raise AttributeError(f"Class '{class_name}' not found in {module_path}")

        instance: MCPConnector = cls()
        logger.info("Hot-loaded connector", class_name=class_name, file=module_path)
        return instance


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_registry: ConnectorRegistry | None = None


def get_registry() -> ConnectorRegistry:
    global _registry
    if _registry is None:
        _registry = ConnectorRegistry()
    return _registry


async def bootstrap_registry(force: bool = False) -> ConnectorRegistry:
    """
    Build the singleton registry by loading all static connectors,
    then scanning backend/connectors/synthesized/ for previously
    generated connectors that survived a server restart.

    Args:
        force: If True, re-register all static connectors even if the registry
               already has them (used for hot-reload after credential change).
    """
    from connectors.github import GitHubConnector
    from connectors.slack import SlackConnector
    from connectors.sheets import GoogleSheetsConnector
    from connectors.database import DatabaseConnector
    from connectors.jira import JiraConnector

    reg = get_registry()

    # Register static connectors (force clears existing before re-registering)
    for conn in [
        GitHubConnector(),
        SlackConnector(),
        GoogleSheetsConnector(),
        DatabaseConnector(),
        JiraConnector(),
    ]:
        # If forcing, remove old registration first so fresh credentials are used
        if force:
            try:
                reg._connectors.pop(conn.name, None)
                reg._tools = {k: v for k, v in reg._tools.items() if v[0] != conn.name}
            except Exception:
                pass
        reg.register(conn)

    # Scan synthesized directory
    synth_dir = Path(__file__).parent.parent / "connectors" / "synthesized"
    synth_dir.mkdir(parents=True, exist_ok=True)

    if not force:
        for py_file in synth_dir.glob("*.py"):
            if py_file.name == "__init__.py":
                continue
            await _try_load_synthesized(reg, py_file)

    logger.info(
        "Registry bootstrapped",
        static_count=5,
        total=len(reg.as_dict()),
        forced=force,
    )
    return reg



async def _try_load_synthesized(reg: ConnectorRegistry, py_file: Path) -> None:
    """Attempt to load one synthesized connector file into the registry."""
    try:
        # Peek for class name pattern: class XyzConnector(MCPConnector):
        source = py_file.read_text(encoding="utf-8")
        import re
        m = re.search(r"class\s+(\w+Connector)\s*\(", source)
        if not m:
            logger.warning("No connector class found in synthesized file", file=str(py_file))
            return

        class_name = m.group(1)
        service_name = py_file.stem  # filename == service_name

        # Cross-reference DB (best-effort — skip if DB unavailable)
        db_valid = await _check_db_validity(service_name)
        if db_valid is False:
            logger.warning(
                "Synthesized connector skipped — DB marks it invalid",
                service=service_name,
            )
            return

        instance = reg.hot_load(str(py_file), class_name)
        tools = await instance.list_tools()
        tool_names = [t["name"] for t in tools]

        record = SynthesizedToolRecord(
            service_name=service_name,
            connector_class_name=class_name,
            file_path=str(py_file),
            tool_names=tool_names,
        )
        reg.register_synthesized(instance, record)
        logger.info("Loaded synthesized connector from disk", service=service_name)

    except Exception as exc:
        logger.error(
            "Failed to load synthesized connector",
            file=str(py_file),
            error=str(exc),
        )


async def _check_db_validity(service_name: str) -> bool | None:
    """Return True if DB says valid, False if invalid, None if DB unavailable."""
    try:
        from db.connection import get_pool
        pool = await get_pool()
        if not pool:
            from db.redis_db import is_redis_available, redis_get_synthesized_tool
            if await is_redis_available():
                tool_data = await redis_get_synthesized_tool(service_name)
                if tool_data is None:
                    return None
                return tool_data.get("validation_passed")
            return None
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT validation_passed FROM synthesized_tools WHERE service_name = $1",
                service_name,
            )
        if row is None:
            return None  # not in DB yet — allow load
        return row["validation_passed"]
    except Exception:
        return None
