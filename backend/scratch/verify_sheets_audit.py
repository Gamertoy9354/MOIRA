import sys
import os
import asyncio

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

# Set env var load
from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from core.connector_registry import bootstrap_registry
from api.workflows import _write_workflow_to_sheets
from models.dag import DAG, DAGStep, DAGStepStatus, DAGStatus
from datetime import datetime, timedelta

async def main():
    print("Bootstrapping registry...")
    await bootstrap_registry()
    
    # Create a mock DAG
    step = DAGStep(
        id="step_test_1",
        description="Verify Google Sheets Audit Integration",
        connector="sheets",
        tool="append_row",
        params={},
        status=DAGStepStatus.SUCCESS,
        started_at=datetime.utcnow() - timedelta(seconds=5),
        completed_at=datetime.utcnow()
    )
    
    dag = DAG(
        id="test-wf-id-12345",
        workflow_id="test-wf-id-12345",
        name="Test Sheets Audit",
        steps={"step_test_1": step},
        original_user_request="Perform manual verification of google sheets audit writing",
        status=DAGStatus.COMPLETED
    )
    
    print("Attempting to write workflow to sheets...")
    try:
        await _write_workflow_to_sheets(
            workflow_id=dag.workflow_id,
            user_request=dag.original_user_request,
            dag=dag
        )
        print("Success! Row written without exceptions.")
    except Exception as e:
        import traceback
        print("Failed with exception:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
