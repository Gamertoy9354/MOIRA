# MCP Gateway — Agentic Workflow Orchestration

An AI-powered middleware that converts plain-English requests into parallel, self-healing DAG executions across GitHub, Slack, Jira, Google Sheets, and internal databases — all streamed live to a React frontend via WebSocket.

---

## What It Does

Type something like:

> *"Create a Jira bug for the login timeout issue, open a GitHub branch called hotfix/login, and notify the team on Slack"*

The system will:
1. Use an LLM (Llama 3.3 70B / Kimi K2.5 / Qwen3) to decompose the request into a DAG
2. Execute all steps in parallel where possible
3. Self-heal on failures using Kimi-powered recovery
4. Stream every event live to the UI via WebSocket
5. Auto-log the full audit to Google Sheets

---

## Architecture

```
User Input → LLM Planner → DAG Builder → DAG Executor
                                              ↓
                                    ┌─────────────────┐
                                    │   SafeGuard      │  3-layer firewall
                                    │   (perimeter +   │  (perimeter, policies,
                                    │   policies +     │   anomaly detection)
                                    │   anomaly)       │
                                    └─────────────────┘
                                              ↓
                              ┌───────────────────────────┐
                              │      MCP Connectors        │
                              │  GitHub · Slack · Jira     │
                              │  Google Sheets · Database  │
                              └───────────────────────────┘
                                              ↓
                              WebSocket → React Frontend
                              (DAG Visualizer + Terminal + Audit)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, asyncpg, Pydantic v2, structlog |
| LLM | NVIDIA NIM API (Llama 3.3 70B, Kimi K2.5, Qwen3 Coder) |
| Frontend | React 18, Vite, ReactFlow, Tailwind CSS, Motion |
| Database | PostgreSQL 16 (optional — falls back to in-memory) |
| Cache | Redis (optional) |
| Connectors | GitHub REST API, Slack Web API, Jira REST API v3, Google Sheets API v4 |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker Desktop (for PostgreSQL + Redis) — **optional**, system works without it in ephemeral mode

---

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd mcp-gateway
```

### 2. Configure environment

Copy the template and fill in your API keys:

```bash
cp env.md .env
# Edit .env with your actual keys
```

See [`env.md`](./env.md) for all required fields.

### 3. Start infrastructure (optional but recommended)

```bash
docker compose up postgres redis -d
```

If you skip this, the system runs in ephemeral mode (no persistence between restarts).

### 4. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 5. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## Running

### Option A — One command (Windows)

```bat
run.bat
```

### Option B — Manual

**Backend** (from project root):
```bash
cd backend
python main.py
# API:  http://localhost:8001
# Docs: http://localhost:8001/docs
```

**Frontend** (from project root):
```bash
cd frontend
npm run dev
# UI: http://localhost:5173
```

---

## Features

### Model Selector
Switch between 3 LLMs from the header dropdown:
- **Llama 3.3 70B** — fastest (~8s planning)
- **Kimi K2.5** — best reasoning
- **Qwen3 Coder 480B** — best for code tasks

### DAG Visualizer
Live graph showing every step, its status, connector, tool, and latency. Includes START (LLM planning) and END nodes. Updates in real time as steps execute.

### Terminal Panel
Click **Terminal** in the header to see every backend event as it happens — step starts, completions, failures, recovery decisions, and timing.

### Self-Healing Recovery
When a step fails, the LLM diagnoses the error and either:
- **Patches** the step params and retries
- **Inserts** prerequisite steps before the failing one
- **Escalates** to the user with a clear explanation

### SafeGuard Firewall
3-layer protection on every tool call:
1. **Perimeter** — connector registry validation
2. **Policies** — rule-based (e.g. no direct push to main without approval)
3. **Anomaly** — rate limiting, payload size, injection detection

### Audit Export
- **Export Audit Data** (sidebar) — generates a full PDF of all workflows with date/time, steps, status, latency, and errors
- **Live Sheets Audit** — opens your Google Sheet with auto-logged workflow data
- **Export PDF** (below DAG) — exports the current workflow as a formatted PDF

---

## Connectors

| Connector | Tools |
|---|---|
| **GitHub** | get_repo_info, create_branch, create_issue, list_issues, close_issue, push_file |
| **Slack** | send_message, list_channels, get_channel_history, set_channel_topic |
| **Jira** | create_issue, get_issue, list_issues, update_issue_status, add_comment, assign_issue |
| **Google Sheets** | append_row, read_range, update_cell, find_spreadsheet_by_name |
| **Database** | log_incident, get_incident, update_incident_status, list_incidents |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/workflows` | Create and start a workflow |
| GET | `/api/v1/workflows` | List all workflows |
| GET | `/api/v1/workflows/{id}` | Get workflow state + DAG |
| POST | `/api/v1/workflows/{id}/retry` | Retry a failed workflow |
| POST | `/api/v1/workflows/{id}/approve` | Approve a pending step |
| GET | `/api/v1/workflows/{id}/audit` | Get audit log |
| GET | `/api/v1/tools` | List all available MCP tools |
| GET | `/health` | Health check |
| WS | `/ws/{workflow_id}` | Real-time event stream |

---

## Example Prompts

```
Create a GitHub issue titled 'Login timeout bug' and notify Slack
```
```
Create a Jira bug, open a GitHub branch called hotfix/login, and update Slack
```
```
List all open GitHub issues and append a summary to Google Sheets
```
```
Log a CRITICAL incident in the database and send a Slack alert
```
