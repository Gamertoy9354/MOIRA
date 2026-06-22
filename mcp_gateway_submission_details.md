# MOIRA: Multi-Tenant Agentic MCP Gateway & Fate Engine
## Comprehensive Architecture & Technical Design Specification

This document provides a comprehensive, deep-dive architectural and technical design specification for **MOIRA (Model Orchestrated Integration & Recovery Agent)**, also known as the **MCP Gateway & Fate Engine**. It covers every core component, data schema, safety layer, self-healing orchestration loop, and file path in the system.

---

## 1. Directory Structure and Module Layout

The codebase is split into a modern React frontend (Vite + TypeScript) and a FastAPI backend (Python 3.11). Below is the complete structural layout of the repository:

```
mcp-gateway-2-main/
├── backend/
│   ├── api/
│   │   ├── auth.py              # User profiles, verification, and onboarding routes
│   │   ├── chat.py              # Conversational chat processing loop
│   │   ├── settings.py          # Environment settings read/write operations
│   │   ├── synthesized_tools.py # Management and creation of synthesized tools
│   │   ├── websocket.py         # Real-time orchestration event streams
│   │   └── workflows.py         # Plan creation, execution, and audit log endpoints
│   ├── core/
│   │   ├── auth_middleware.py   # JWT decoding (HS256 secret or asymmetric ES256 JWKS)
│   │   ├── circuit_breaker.py   # Failure tracking per step and rate-limit controls
│   │   ├── connector_registry.py# Registry of built-in and synthesized MCP tools
│   │   ├── context_resolver.py  # Resolves template variables (e.g. {{step_0.output}})
│   │   ├── dag_builder.py       # Helper functions to build, patch, and insert DAG steps
│   │   ├── dag_executor.py      # ThreadPoolExecutor executing tasks in parallel
│   │   ├── guide_generator.py   # Generates human markdown walkthroughs of workflows
│   │   ├── llm_router.py        # Configures context and model routing overrides
│   │   ├── planner.py           # Kimi K2.5 system prompts and DAG plans
│   │   ├── recovery.py          # Diagnoses failed steps and executes patches
│   │   ├── safeguard.py         # Three-layer firewall for inspecting tool calls
│   │   ├── tool_gap_detector.py # Extracts service intents and suggests gaps
│   │   └── tool_synthesizer.py  # AI code generator, safety scanner, and hot-loader
│   ├── db/
│   │   ├── migrations/
│   │   │   ├── 001_initial.sql           # Initial tables for logs and registry
│   │   │   ├── 002_synthesized_tools.sql # Dynamic tools table
│   │   │   └── 003_multi_tenant.sql      # Multi-tenant scoping update
│   │   ├── connection.py        # Database connection pool manager
│   │   └── audit.py             # Log writers for audit and recovery entries
│   ├── models/
│   │   ├── dag.py               # Pydantic models representing DAGs and Steps
│   │   ├── events.py            # Pydantic models for WebSocket event payloads
│   │   └── recovery.py          # Recovery decisions and action enums
│   ├── utils/
│   │   ├── config.py            # Singleton configuration settings loader
│   │   └── logger.py            # Structured JSON logger setup
│   ├── Dockerfile
│   ├── main.py                  # Server startup script
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/      # UI components (DAG Visualizer, Terminal, Settings)
│   │   │   ├── pages/           # LandingPage, OnboardingFlow, Dashboard, AppShell
│   │   │   └── App.tsx          # Router and application setup
│   │   ├── lib/
│   │   │   └── supabase.ts      # Supabase client and authFetch helper
│   │   ├── services/
│   │   │   ├── types.ts         # TypeScript interface definitions
│   │   │   └── ws-provider.ts   # WebSocket connection provider and API wrappers
│   │   ├── config.ts            # Production/Development API URL resolver
│   │   └── index.css            # Vanilla CSS design system
│   ├── package.json
│   └── vite.config.ts
├── render.yaml                  # Unified Render deploy configuration file
└── docker-compose.yml           # Local database & Redis setup
```

---

## 2. Working MVP & Demo Evidence

*   **Production Application Link**: [https://moira.sinaai.in](https://moira.sinaai.in)
*   **Production Backend API Link**: [https://moira-backend-ly1o.onrender.com](https://moira-backend-ly1o.onrender.com)
*   **Production Setup & Hosting**:
    *   **Frontend**: React (Vite + TypeScript) is compiled during the build step and served statically by the FastAPI backend (`main.py` using `StaticFiles`). This guarantees that both the client code and APIs resolve to the exact same origin, eliminating CORS issues entirely.
    *   **Backend**: Hosted on Render using a Python 3.11 environment. 
    *   **Databases**: A hosted Supabase Postgres Instance serves as the relational state store, and Render Redis handles real-time task queuing and distributed locks.

---

## 3. Storage Design: Supabase Table Schemas

Below are the exact SQL schemas deployed on Supabase to isolate and manage user workspaces, configurations, audit trails, and synthesized connectors.

### 3.1. `user_profiles` Table
Stores primary user identity records linked directly to the Supabase Auth (`auth.users`) table.
```sql
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_uid UUID UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_user_profiles_supabase_uid ON public.user_profiles(supabase_uid);
```

### 3.2. `user_env_configs` Table
Stores custom connector configurations and API credentials. In production, this table is queried on demand, and keys are loaded dynamically using ContextVars only for the duration of a request.
```sql
CREATE TABLE public.user_env_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    connector_name VARCHAR(100) NOT NULL,
    config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_configured BOOLEAN DEFAULT false,
    last_tested_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_connector UNIQUE (user_id, connector_name)
);
CREATE INDEX idx_user_env_configs_user_id ON public.user_env_configs(user_id);
```

### 3.3. `user_onboarding` Table
Tracks progress through the onboarding wizard.
```sql
CREATE TABLE public.user_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    completed_steps TEXT[] DEFAULT '{}'::text[],
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

### 3.4. `audit_log` Table
Stores the execution history of every tool call passing through the SafeGuard firewall.
```sql
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR(255) NOT NULL,
    step_id VARCHAR(255) NOT NULL,
    connector VARCHAR(100) NOT NULL,
    tool VARCHAR(100) NOT NULL,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    safeguard_result VARCHAR(50) NOT NULL,
    safeguard_layer INT,
    safeguard_reason TEXT,
    executed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_audit_log_workflow_id ON public.audit_log(workflow_id);
```

### 3.5. `synthesized_tools` Table
Tracks dynamically generated connectors written by Kimi K2.5.
```sql
CREATE TABLE public.synthesized_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    connector_class_name VARCHAR(100) NOT NULL,
    code_content TEXT NOT NULL,
    tools_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_synth_tools_user ON public.synthesized_tools(user_id);
```

---

## 4. Under-the-Hood Explanation

MOIRA's request lifecycle consists of five stages: Intent analysis, Gap Detection, Code Generation, Security Verification, Execution, and Auto-Recovery.

```
[User Input]
     |
     v
+--------------------------+
|  1. Tool Gap Detector    | <--- Asks Kimi K2.5 to scan available tool definitions
+--------------------------+
     |
     +--> Gap Found?
            |
            +--[Yes]--> +------------------------+
            |           |  2. Tool Synthesizer   | ---> Writes class, scans code,
            |           +------------------------+      hot-loads it, prompts user.
            |                |
            +--[No]----------+
     |
     v
+--------------------------+
|  3. Kimi DAG Planner     | <--- Compiles sequential & parallel execution steps
+--------------------------+
     |
     v
+--------------------------+
|  4. SafeGuard Firewall   | <--- Layer 1 (Perimeter), Layer 2 (Policy), Layer 3 (Anomaly)
+--------------------------+
     |
     +--> Allowed? --[No]--> [Block / Escalate to Human]
     |
     v [Yes]
+--------------------------+
|  5. DAG Parallel Executor| <--- Multi-threaded processing using ThreadPoolExecutor
+--------------------------+
     |
     +--> Step Failed? --[Yes]--> +------------------------+
                                  |  6. Recovery Handler   | ---> Patches params or
                                  +------------------------+      injects missing steps.
```

---

### Step 4.1: Authentication and Tenant Key Scoping

To ensure multi-tenant data isolation, the backend uses **ContextVars** to store user configurations dynamically. This prevents user credentials from leaking between parallel execution threads.

When a client sends a request to the backend, the `AuthMiddleware` in `backend/core/auth_middleware.py` intercepts it:

```python
# From backend/core/auth_middleware.py

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        # ...
        token = auth_header.split(" ", 1)[1]

        try:
            # 1. Parse token header to identify algorithm
            header = jwt.get_unverified_header(token)
            alg = header.get("alg")

            if alg == "ES256":
                # Asymmetric verification via JWKS public keys
                kid = header.get("kid")
                jwk = await get_supabase_jwk(kid)
                payload = jwt.decode(
                    token,
                    jwk,
                    algorithms=["ES256"],
                    options={"verify_aud": False},
                )
            else:
                # Fallback to HS256 symmetric verification using local secret
                payload = jwt.decode(
                    token,
                    self.jwt_secret,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                )

            request.state.user_id = payload.get("sub")
            request.state.user_email = payload.get("email")
        except JWTError as e:
            return JSONResponse(
                status_code=401,
                content={"detail": f"Token verification failed: {e}"}
            )

        return await call_next(request)
```

If the user is authenticated, the `Depends(require_auth)` dependency is executed on API endpoints:

```python
# From backend/core/auth_middleware.py

async def require_auth(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    # Load user settings overrides into ContextVar for the current request context
    from core.llm_router import load_user_ai_config
    await load_user_ai_config(user_id)
    return user_id
```

The `load_user_ai_config` method in `backend/core/llm_router.py` fetches the user's encrypted configuration records from the `user_env_configs` Supabase table and stores them in a `ContextVar` named `user_credentials`:

```python
# From backend/core/llm_router.py

user_credentials: contextvars.ContextVar[dict[str, any] | None] = contextvars.ContextVar("user_credentials", default=None)

async def load_user_ai_config(user_id: str) -> None:
    # Query Supabase for this user's custom connector credentials
    async with httpx.AsyncClient() as client:
        config_resp = await client.get(
            f"{supabase_url}/rest/v1/user_env_configs",
            headers=headers,
            params={"user_id": f"eq.{profile_id}", "select": "connector_name,config_data"}
        )
        if config_resp.status_code == 200:
            configs = config_resp.json()
            credentials_overrides = {}
            for cfg in configs:
                conn_data = cfg.get("config_data", {})
                for k, v in conn_data.items():
                    credentials_overrides[k.lower()] = v
                    
            # Set overrides for the current execution thread context
            user_credentials.set(credentials_overrides)
```

---

### Step 4.2: Intent Extraction & Gap Detection

Before generating a plan, the **Tool Gap Detector** (`backend/core/tool_gap_detector.py`) checks if the user's prompt contains any actions that require tools that are not currently registered.

It sends the natural language request and the list of available tools to Kimi K2.5 using a structured system prompt:

```python
# From backend/core/tool_gap_detector.py

class ToolGapDetector:
    def __init__(self, client: AsyncOpenAI, model: str) -> None:
        self._client = client
        self._model = model

    async def detect_gaps(
        self,
        user_request: str,
        registry: ConnectorRegistry,
    ) -> ToolGapReport:
        # Format registry tools
        tools_list = registry.get_all_tools_metadata()
        
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _GAP_SYSTEM},
                {"role": "user", "content": f"Request: {user_request}\nAvailable Tools:\n{json.dumps(tools_list)}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.0
        )
        
        data = json.loads(response.choices[0].message.content)
        gaps = []
        for g in data.get("gaps", []):
            gaps.append(
                ToolGap(
                    intent=g["intent"],
                    suggested_service=g["suggested_service"],
                    suggested_tool_name=g["suggested_tool_name"],
                    confidence=g["confidence"],
                    reasoning=g["reasoning"]
                )
            )
            
        return ToolGapReport(
            gaps=gaps,
            covered_intents=data.get("covered_intents", []),
            synthesis_required=len(gaps) > 0
        )
```

---

### Step 4.3: Tool Synthesis & Safety scanning

If a tool gap is identified, the **Tool Synthesizer** (`backend/core/tool_synthesizer.py`) generates a new connector class. 

It requests Kimi K2.5 to return two markdown blocks:
1.  A complete Python class subclassing `MCPConnector`.
2.  A JSON metadata block defining the tools, descriptions, and input schemas.

Once the code is returned, the synthesizer runs a **SafeGuard safety scan** to inspect the code content before compiling it:

```python
# From backend/core/tool_synthesizer.py

_FORBIDDEN_PATTERNS = [
    r"\bsubprocess\b",
    r"\beval\s*\(",
    r"\bexec\s*\(",
    r"\bos\.system\s*\(",
    r"\b__import__\s*\(",
    r"\bos\.popen\s*\(",
    r"\bshutil\.rmtree\b",
    r"\bopen\s*\([^)]{0,120}['\"]w['\"]",
]

_HARDCODED_CRED_RE = re.compile(
    r"(AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xoxb-\d+-\S+|ghp_[A-Za-z0-9]{36})",
    re.IGNORECASE
)

def _safety_scan(code: str) -> tuple[bool, list[str]]:
    blocked: list[str] = []
    for pattern in _FORBIDDEN_PATTERNS:
        if re.search(pattern, code):
            blocked.append(pattern)
    if _HARDCODED_CRED_RE.search(code):
        blocked.append("hardcoded_credential_string")
    return len(blocked) == 0, blocked
```

If the code passes the scan:
1.  It is checked with Python's built-in `ast.parse(code)` to verify syntax correctness.
2.  It is saved to disk under `backend/connectors/synthesized/{service}.py`.
3.  It is imported into the running environment using `importlib`:

```python
# From backend/core/connector_registry.py

import importlib.util
import sys

def register_connector_class_dynamically(self, file_path: Path, class_name: str, service_name: str):
    module_name = f"connectors.synthesized.{service_name}"
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    
    # Instantiate class and register
    connector_class = getattr(module, class_name)
    connector_instance = connector_class()
    self.register(service_name, connector_instance)
```

---

### Step 4.4: The SafeGuard Firewall

The **MCPSafeGuard** (`backend/core/safeguard.py`) serves as a three-layer firewall that inspects every tool invocation:

```python
# From backend/core/safeguard.py

class MCPSafeGuard:
    async def check(
        self,
        connector: str,
        tool: str,
        params: dict,
        step_id: str,
        workflow_id: str,
        connector_instance: "MCPConnector",
    ) -> SafeGuardResult:
        # Layer 1 — Perimeter Checks
        if connector not in self._registry:
            return SafeGuardResult(allowed=False, action="block", reason="Connector not registered")

        # Layer 2 — Condition Policies
        # Example condition: Check if pushing directly to main/master branches in github
        if connector == "github" and tool == "push_file" and params.get("branch") in ("main", "master"):
            return SafeGuardResult(allowed=False, action="require_approval", reason="Protected branch push requires human approval")

        # Layer 3 — Anomaly Checks
        flat_params = json.dumps(params, default=str)
        # SQL Injection Check
        if self._SQL_INJECTION_RE.search(flat_params):
            return SafeGuardResult(allowed=False, action="block", reason="SQL injection detected")
        # Shell Injection Check
        if self._SHELL_INJECTION_RE.search(flat_params):
            return SafeGuardResult(allowed=False, action="block", reason="Shell injection detected")

        # Pass all layers -> allow execution
        return SafeGuardResult(allowed=True, action="allow", reason="Passed all layers")
```

---

### Step 4.5: ThreadPoolExecutor Execution & Parameter Resolution

The **DAG Executor** (`backend/core/dag_executor.py`) coordinates execution using a multi-threaded dependency graph resolver.
Before a step runs, the **Context Resolver** (`backend/core/context_resolver.py`) replaces any template parameters (`{{step_0.output.url}}`) with the actual output of completed steps:

```python
# From backend/core/context_resolver.py

def resolve_params(params: dict, completed_results: dict[str, dict]) -> dict:
    """Replace template variables like {{step_0.output.url}} with real values."""
    raw = json.dumps(params)
    
    # Regex to find all matching patterns: {{step_N.output.field}}
    pattern = r"\{\{\s*(step_\d+)\.output\.([a-zA-Z0-9_\-\.]+)\s*\}\}"
    
    def replacer(match):
        step_id = match.group(1)
        field_path = match.group(2).split(".")
        
        if step_id not in completed_results:
            raise ValueError(f"Required dependency output '{step_id}' is not yet available")
            
        # Traverse dictionary path
        val = completed_results[step_id].get("result", {})
        for key in field_path:
            if isinstance(val, dict) and key in val:
                val = val[key]
            else:
                raise KeyError(f"Field path '{match.group(2)}' not found in {step_id} output")
        return str(val)
        
    resolved_str = re.sub(pattern, replacer, raw)
    return json.loads(resolved_str)
```

The executor then checks dependencies and executes eligible steps in parallel:

```python
# From backend/core/dag_executor.py

class DAGExecutor:
    async def execute(self, dag: DAG):
        completed_results = {}
        
        # Loop until all steps are complete or aborted
        while not dag.is_finished():
            # Find steps that are ready (all depends_on steps succeeded)
            runnable_steps = [
                s for s in dag.steps.values()
                if s.status == DAGStepStatus.PENDING
                and all(dag.steps[dep].status == DAGStepStatus.SUCCESS for dep in s.depends_on)
            ]
            
            if not runnable_steps:
                break
                
            # Submit runnable tasks to ThreadPoolExecutor
            futures = []
            for step in runnable_steps:
                step.status = DAGStepStatus.RUNNING
                futures.append(
                    self._loop.run_in_executor(
                        self._executor,
                        self._execute_step,
                        step,
                        completed_results
                    )
                )
                
            # Wait for the current batch of parallel steps to finish
            await asyncio.gather(*futures)
```

---

### Step 4.6: Self-Healing & Recovery Loop

If a tool call returns an exception, the **Recovery Handler** (`backend/core/recovery.py`) intercepts the failure:

```python
# From backend/core/recovery.py

class RecoveryHandler:
    async def handle_failure(
        self,
        dag: DAG,
        failed_step: DAGStep,
        error: Exception,
        completed_results: dict[str, dict],
        available_tools: list[dict],
        circuit_breaker: CircuitBreaker,
    ) -> tuple[DAG, RecoveryAction]:
        
        step_id = failed_step.id
        
        # 1. Increment failure counter
        circuit_breaker.record_attempt(step_id)
        if circuit_breaker.is_open(step_id):
            # Too many failures on this step -> escalate to human
            return dag, RecoveryAction.ESCALATE

        # 2. Query Kimi K2.5 for recovery options
        decision: RecoveryDecision = await self._planner.plan_recovery(
            original_request=dag.original_user_request,
            original_dag=dag,
            failed_step=failed_step,
            error_message=str(error),
            completed_steps=[s.id for s in dag.steps.values() if s.status == DAGStepStatus.SUCCESS],
            available_tools=available_tools
        )
        
        # 3. Apply recovery decision
        if decision.action == RecoveryAction.PATCH_DAG:
            # Update params of the failed step and retry
            patch = decision.patch or {}
            dag = self._dag_builder.patch_step_params(dag, patch["step_id"], patch["update_params"])
            return dag, RecoveryAction.PATCH_DAG
            
        elif decision.action == RecoveryAction.INSERT_STEPS:
            # Inject new steps before the failed step and resume
            dag = self._dag_builder.insert_steps_before(dag, decision.new_steps, decision.insert_before)
            return dag, RecoveryAction.INSERT_STEPS
            
        return dag, RecoveryAction.ESCALATE
```

---

## 5. Value Beyond a Generic LLM

Generic LLMs (like ChatGPT or Claude) cannot replicate this functionality because:

1.  **Orchestrated Parallel Execution**: Chat interfaces process queries sequentially. MOIRA compiles plans into multi-threaded dependency graphs, executing independent tasks simultaneously (e.g. searching GitHub and reading spreadsheets in parallel).
2.  **Autonomous Code Synthesis**: When an integration is missing, MOIRA writes the required integration class, compiles it, scans it for security concerns, and hot-loads it into the running server environment dynamically. A normal LLM can only output snippet instructions.
3.  **Active Safety Guardrails**: Standard API agents rely on raw model outputs. MOIRA implements a three-layer sandbox firewall (`SafeGuard`) that checks every parameters payload for SQL/shell injections, verifies rate limits, and intercepts high-risk operations (like protected branch updates or resource deletions) to request manual confirmation.
4.  **Mid-Execution Recovery (Self-Healing)**: If an API call fails due to a missing resource or incorrect parameters, MOIRA detects the error, rewrites the graph, inserts missing setup steps, and resumes execution seamlessly without resetting the workflow.

---

## 6. Data Sources and References

MOIRA utilizes the following APIs and libraries to complete its task orchestrations:
*   **GitHub REST API**: Handles repository file pushes, branches creation, and pull requests management.
*   **Google Sheets REST API**: Handles workbook reads, cell writes, row appends, and table styling.
*   **Jira Cloud API**: Manages incident creation, transitions, and field updates.
*   **Slack Web API**: Dispatches rich message payloads and alerts.
*   **Supabase Client**: Provides multi-tenant schema isolation, profiles creation, and auth token checks.
*   **OpenAI SDK / NVIDIA NIM**: Connects to the host's `moonshotai/kimi-k2.5` model to generate plans and code.

---

## 7. Demo Scenario & System Limits

### 7.1. Live Execution Demo Scenario
*   **Scenario Intent**: *"Log a database failure ticket on Jira, record it in our Google Sheet ledger, and ping the developers channel on Slack."*
*   **Pipeline Execution**:
    1.  **Gap Check**: Passes (Jira, Sheets, and Slack are registered).
    2.  **Planner**: Resolves two parallel actions: `jira.create_issue` (`step_0`) and `sheets.append_row` (`step_1`). It creates a third step `slack.send_message` (`step_2`) that depends on `step_0` and `step_1`.
    3.  **Context Resolution**: `step_2` references output variables: `Jira issue {{step_0.output.key}} has been filed and logged to sheet {{step_1.output.title}}`.
    4.  **Firewall Check**: Inspects parameters; passes.
    5.  **Execution**: Runs steps 0 and 1 in parallel threads. Once both succeed, step 2 is resolved and executed.
*   **Result**: The Slack notification is posted containing direct links to the new Jira issue and Google Sheet.

### 7.2. System Limitations & Project Status
*   **Working & Verified**:
    *   Dynamic JWKS asymmetric signature verification for ES256 tokens.
    *   Defensive API parsing (zeroing `KeyError: 0` occurrences).
    *   Standardised key mode configurations.
    *   Parallel DAG execution threads and safety firewall scanning.
*   **Mocked / In-Progress**:
    *   Synthesized tools currently support stateless REST requests. Dynamic connectors requiring complex state (such as OAuth handshakes or persistent WebSockets) are planned for future updates.
