import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

from core.connector_registry import get_registry, SynthesizedToolRecord
from connectors.base import MCPConnector

class DummyConnector(MCPConnector):
    def get_connector_name(self) -> str:
        return "dummy_service"
    
    def get_connector_description(self) -> str:
        return "A dummy connector for registry testing"
        
    async def list_tools(self) -> list[dict]:
        return []

async def test_unregister():
    reg = get_registry()
    
    # 1. Register connector
    conn = DummyConnector()
    rec = SynthesizedToolRecord(
        service_name="dummy_service",
        connector_class_name="DummyConnector",
        file_path="dummy_path.py",
        tool_names=[]
    )
    reg.register_synthesized(conn, rec)
    
    # Verify in registry
    assert "dummy_service" in reg.as_dict(), "Connector not registered in connectors"
    assert "dummy_service" in reg._synthesized_meta, "Connector not registered in synthesized_meta"
    
    # Mock importing module so it gets in sys.modules
    sys.modules["connectors.synthesized.dummy_service"] = DummyConnector
    assert "connectors.synthesized.dummy_service" in sys.modules, "Mock module not in sys.modules"
    
    # 2. Unregister connector
    removed = reg.unregister("dummy_service")
    assert removed is True, "unregister returned False, expected True"
    
    # Verify removed
    assert "dummy_service" not in reg.as_dict(), "Connector still in connectors after unregister"
    assert "dummy_service" not in reg._synthesized_meta, "Connector still in synthesized_meta after unregister"
    assert "connectors.synthesized.dummy_service" not in sys.modules, "Module still in sys.modules after unregister"
    
    print("SUCCESS: unregister method test passed successfully!")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_unregister())
