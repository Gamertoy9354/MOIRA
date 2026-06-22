"""
MOIRA Chat API — Direct conversational LLM endpoint.
Classifies user intent as CHAT or EXECUTE and responds accordingly.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from core.auth_middleware import require_auth

from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1", tags=["chat"])

# ── Intent classification prompt ──────────────────────────────────────────────

_INTENT_SYSTEM = """You are MOIRA, an ancient oracle intelligence and MCP workflow orchestration system.
Your first task is to classify the user's message intent:

- CHAT: The user is asking a question, seeking information, having a conversation, asking for explanations, or asking about MOIRA itself.
  Examples: "What is MCP?", "How does orchestration work?", "What connectors do you support?", "Hello", "What can you do?"

- EXECUTE: The user wants to perform actions, run automations, execute workflows, interact with external tools/services.
  Examples: "Post to Slack", "Create a Jira ticket", "Check GitHub PRs", "Onboard a new employee", "Run a security audit"

Respond with EXACTLY one word: CHAT or EXECUTE"""

_CHAT_SYSTEM = """You are MOIRA — the ancient Greek goddess of fate, reborn as an intelligent MCP orchestration system.
You are the decisive, omniscient guardian of enterprise workflows.

Your personality:
- Ancient, authoritative, wise but accessible
- You speak with quiet certainty
- You don't use filler phrases ("Sure!", "Of course!", "Great question!")
- You are concise but thorough
- You use markdown naturally for code blocks, lists, and headers when helpful

You help users understand:
- MCP (Model Context Protocol) and how it works
- The MOIRA system architecture
- Available connectors: GitHub, Jira, Slack, Google Sheets, Database
- How to construct workflow requests
- General programming and DevOps questions

When the user wants to execute a workflow, tell them to describe what they want done and you'll weave the DAG."""


class ChatRequest(BaseModel):
    message: str
    model_id: Optional[str] = None
    provider: Optional[str] = None


class ChatResponse(BaseModel):
    mode: str  # 'chat' or 'execution'
    response: str
    tokens: Optional[int] = None


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, user_id: str = Depends(require_auth)) -> ChatResponse:
    """
    Intent-aware chat endpoint.
    Returns mode='chat' for conversational queries (direct LLM reply).
    Returns mode='execution' if request requires workflow execution.
    """
    try:
        from core.llm_router import get_llm_client, load_user_ai_config
        await load_user_ai_config(user_id)
        client, model = get_llm_client(
            provider=req.provider,
            model_id=req.model_id,
        )

        # ── Step 1: Classify intent ──
        intent_resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _INTENT_SYSTEM},
                {"role": "user", "content": req.message},
            ],
            max_tokens=10,
            temperature=0.1,
        )
        intent = intent_resp.choices[0].message.content.strip().upper()
        logger.info("Chat intent classified", intent=intent, message=req.message[:60])

        if intent == "EXECUTE":
            # Signal frontend to run this as a full workflow
            return ChatResponse(mode="execution", response="", tokens=0)

        # ── Step 2: Generate conversational response ──
        chat_resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _CHAT_SYSTEM},
                {"role": "user", "content": req.message},
            ],
            max_tokens=1200,
            temperature=0.7,
        )
        reply = chat_resp.choices[0].message.content.strip()
        tokens = chat_resp.usage.total_tokens if chat_resp.usage else None
        logger.info("Chat response generated", tokens=tokens)

        return ChatResponse(mode="chat", response=reply, tokens=tokens)

    except Exception as exc:
        logger.warning("Chat endpoint error, falling back to execution", error=str(exc))
        # On any LLM error, fall back to workflow execution mode
        return ChatResponse(mode="execution", response="", tokens=0)
