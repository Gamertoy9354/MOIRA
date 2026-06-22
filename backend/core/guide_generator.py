"""Developer Guide Generator — produces Markdown + JSON onboarding guides.

For every synthesized connector, Kimi K2.5 writes a beautiful step-by-step
credential setup guide that the developer sees in the UI.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from openai import AsyncOpenAI

from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class CredentialStep:
    step_number: int
    title: str
    description: str
    screenshot_hint: str
    url: str | None
    expected_result: str

    def to_dict(self) -> dict:
        return {
            "step_number": self.step_number,
            "title": self.title,
            "description": self.description,
            "screenshot_hint": self.screenshot_hint,
            "url": self.url,
            "expected_result": self.expected_result,
        }


@dataclass
class DeveloperGuide:
    tool_name: str
    service_name: str
    summary: str
    estimated_setup_time: str
    credential_steps: list[CredentialStep]
    env_file_snippet: str
    test_command: str
    common_errors: list[dict]
    pricing_note: str

    def to_dict(self) -> dict:
        return {
            "tool_name": self.tool_name,
            "service_name": self.service_name,
            "summary": self.summary,
            "estimated_setup_time": self.estimated_setup_time,
            "steps": [s.to_dict() for s in self.credential_steps],
            "env_file_snippet": self.env_file_snippet,
            "test_command": self.test_command,
            "common_errors": self.common_errors,
            "pricing_info": self.pricing_note,
        }


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_GUIDE_SYSTEM = """You are a developer experience engineer writing onboarding guides for API credentials.

Given a service name and its required credentials, produce a step-by-step setup guide.
Return ONLY valid JSON — no markdown fences, no explanation outside the JSON.

OUTPUT FORMAT:
{
  "summary": "one sentence describing what this service does",
  "estimated_setup_time": "5 minutes",
  "credential_steps": [
    {
      "step_number": 1,
      "title": "Create a SendGrid Account",
      "description": "Go to sendgrid.com and sign up for a free account using your work email.",
      "screenshot_hint": "You should see the SendGrid dashboard with a blue navigation bar at the top.",
      "url": "https://sendgrid.com/free/",
      "expected_result": "You are logged into the SendGrid dashboard."
    }
  ],
  "env_file_snippet": "SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxx",
  "test_command": "curl -X POST https://api.sendgrid.com/v3/mail/send -H 'Authorization: Bearer $SENDGRID_API_KEY' -H 'Content-Type: application/json' -d '{\"personalizations\":[{\"to\":[{\"email\":\"test@example.com\"}]}],\"from\":{\"email\":\"from@example.com\"},\"subject\":\"Test\",\"content\":[{\"type\":\"text/plain\",\"value\":\"Hello\"}]}'",
  "common_errors": [
    {"error": "401 Unauthorized", "fix": "Your API key is invalid or has been revoked. Generate a new one from the API Keys settings page."},
    {"error": "403 Forbidden", "fix": "Your API key does not have the required permissions. Set it to Full Access when creating it."}
  ],
  "pricing_note": "SendGrid free tier: 100 emails/day. Paid plans start at $19.95/month for 50,000 emails."
}"""


def _extract_json(text: str) -> str:
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```", "", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------

class GuideGenerator:
    """Generates and persists developer credential setup guides."""

    def __init__(self, model_id: str | None = None) -> None:
        from core.llm_router import get_llm_client
        self._client, self._model = get_llm_client(model_id=model_id)
        self._guides_dir = Path(__file__).parent.parent / "guides"
        self._guides_dir.mkdir(parents=True, exist_ok=True)

    async def generate(
        self,
        service_name: str,
        tool_names: list[str],
        required_credentials: list[dict],
        workflow_id: str | None = None,
        broadcast: object = None,
    ) -> DeveloperGuide | None:
        """Generate guide, save to disk, update DB, emit event."""
        if not required_credentials:
            logger.info("No credentials needed — skipping guide generation", service=service_name)
            return None

        cred_desc = json.dumps(required_credentials, indent=2)
        user_msg = (
            f"Service: {service_name}\n"
            f"Tools: {', '.join(tool_names)}\n\n"
            f"Required credentials:\n{cred_desc}"
        )

        logger.info("Generating developer guide", service=service_name)

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": _GUIDE_SYSTEM},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.2,
                max_tokens=2048,
            )
            raw = response.choices[0].message.content or "{}"
            data = json.loads(_extract_json(raw))
        except Exception as exc:
            logger.error("Guide generation failed", error=str(exc))
            return None

        # Build CredentialStep objects
        steps: list[CredentialStep] = []
        for s in data.get("credential_steps", []):
            steps.append(CredentialStep(
                step_number=s.get("step_number", len(steps) + 1),
                title=s.get("title", ""),
                description=s.get("description", ""),
                screenshot_hint=s.get("screenshot_hint", ""),
                url=s.get("url"),
                expected_result=s.get("expected_result", ""),
            ))

        guide = DeveloperGuide(
            tool_name=tool_names[0] if tool_names else service_name,
            service_name=service_name,
            summary=data.get("summary", f"{service_name} API connector"),
            estimated_setup_time=data.get("estimated_setup_time", "5–10 minutes"),
            credential_steps=steps,
            env_file_snippet=data.get("env_file_snippet", ""),
            test_command=data.get("test_command", ""),
            common_errors=data.get("common_errors", []),
            pricing_note=data.get("pricing_note", ""),
        )

        # Save to disk
        md_path = self._guides_dir / f"{service_name}_setup_guide.md"
        json_path = self._guides_dir / f"{service_name}_setup_guide.json"
        md_path.write_text(self._to_markdown(guide), encoding="utf-8")
        json_path.write_text(json.dumps(guide.to_dict(), indent=2), encoding="utf-8")

        # Update DB
        await self._update_db(service_name, str(md_path), str(json_path))

        # Emit event
        if workflow_id and broadcast:
            try:
                from api.websocket import broadcast_raw
                step_preview = "; ".join(s.title for s in steps[:3])
                await broadcast_raw({
                    "event_type": "guide_generated",
                    "workflow_id": workflow_id,
                    "service": service_name,
                    "guide": guide.to_dict(),
                    "guide_preview": step_preview,
                })
            except Exception as exc:
                logger.warning("Failed to emit guide_generated event", error=str(exc))

        logger.info("Developer guide saved", service=service_name, md=str(md_path))
        return guide

    # ------------------------------------------------------------------
    # Markdown renderer
    # ------------------------------------------------------------------

    def _to_markdown(self, guide: DeveloperGuide) -> str:
        lines: list[str] = [
            f"# {guide.service_name.title()} — Setup Guide",
            "",
            f"> {guide.summary}",
            "",
            f"**Estimated setup time:** {guide.estimated_setup_time}",
            "",
            "---",
            "",
            "## Credential Steps",
            "",
        ]
        for step in guide.credential_steps:
            lines += [
                f"### Step {step.step_number}: {step.title}",
                "",
                step.description,
                "",
            ]
            if step.url:
                lines += [f"🔗 **URL:** [{step.url}]({step.url})", ""]
            lines += [
                f"*What you'll see: {step.screenshot_hint}*",
                "",
                f"✅ **Expected result:** {step.expected_result}",
                "",
            ]

        lines += [
            "---",
            "",
            "## Add to Your `.env` File",
            "",
            "```env",
            guide.env_file_snippet,
            "```",
            "",
            "---",
            "",
            "## Test Your Setup",
            "",
            "```bash",
            guide.test_command,
            "```",
            "",
            "---",
            "",
            "## Common Errors",
            "",
        ]
        for err in guide.common_errors:
            lines += [
                f"**Error:** `{err.get('error', '')}`",
                f"**Fix:** {err.get('fix', '')}",
                "",
            ]

        if guide.pricing_note:
            lines += [
                "---",
                "",
                f"> 💡 **Pricing:** {guide.pricing_note}",
                "",
            ]

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # DB update
    # ------------------------------------------------------------------

    async def _update_db(
        self,
        service_name: str,
        md_path: str,
        json_path: str,
    ) -> None:
        try:
            from db.connection import get_pool
            pool = await get_pool()
            if not pool:
                from db.redis_db import is_redis_available, redis_update_synthesized_tool_guide
                if await is_redis_available():
                    await redis_update_synthesized_tool_guide(service_name, md_path, json_path)
                return
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE synthesized_tools
                    SET guide_md_path = $1, guide_json_path = $2
                    WHERE service_name = $3
                    """,
                    md_path,
                    json_path,
                    service_name,
                )
        except Exception as exc:
            logger.error("Guide DB update failed", error=str(exc))
