"""Auth API router — user profile management, Supabase JWT verification."""
from __future__ import annotations

import os
from datetime import datetime

import httpx
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel

from core.auth_middleware import require_auth
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _supa_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


import json

MOCK_DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scratch_db.json")

def _is_mock_mode() -> bool:
    return not SUPABASE_URL or not SUPABASE_SERVICE_KEY or "YOUR_SUPABASE" in SUPABASE_SERVICE_KEY

def _read_mock_db() -> dict:
    if not os.path.exists(MOCK_DB_FILE):
        return {
            "profiles": {},
            "onboarding": {},
            "configs": {}
        }
    try:
        with open(MOCK_DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {
            "profiles": {},
            "onboarding": {},
            "configs": {}
        }

def _write_mock_db(data: dict):
    os.makedirs(os.path.dirname(MOCK_DB_FILE), exist_ok=True)
    with open(MOCK_DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ── Models ──────────────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    id: str
    supabase_uid: str
    email: str
    display_name: str | None = None
    avatar_url: str | None = None
    onboarding_completed: bool = False
    created_at: str


class OnboardingStatus(BaseModel):
    completed_steps: list[str]
    is_complete: bool


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/verify")
async def verify_and_upsert(request: Request):
    """
    Called after Google OAuth completes on frontend.
    Upserts user profile in Supabase and returns profile + onboarding status.
    """
    user_id = getattr(request.state, "user_id", None)
    user_email = getattr(request.state, "user_email", None)

    if not user_id:
        raise HTTPException(status_code=401, detail="No authenticated user in request")

    # Extract display name + avatar from token or request body
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    display_name = body.get("display_name", user_email.split("@")[0] if user_email else "Fate's Chosen")
    avatar_url = body.get("avatar_url")

    if _is_mock_mode():
        db = _read_mock_db()
        profile = {
            "id": "dev-user-id",
            "supabase_uid": user_id,
            "email": user_email or "developer@moira.sinaai.in",
            "display_name": display_name,
            "avatar_url": avatar_url,
            "onboarding_completed": db.get("profiles", {}).get("dev-user-id", {}).get("onboarding_completed", False),
            "created_at": datetime.utcnow().isoformat()
        }
        db["profiles"]["dev-user-id"] = profile
        if "dev-user-id" not in db["onboarding"]:
            db["onboarding"]["dev-user-id"] = {
                "completed_steps": [],
                "completed_at": None
            }
        _write_mock_db(db)
        logger.info("User verified locally in mock mode", user_id=user_id, email=user_email)
        return {
            "profile": profile,
            "onboarding": {
                "completed_steps": db["onboarding"]["dev-user-id"]["completed_steps"],
                "is_complete": bool(db["onboarding"]["dev-user-id"]["completed_at"])
            }
        }

    async with httpx.AsyncClient() as client:
        # Upsert user profile
        upsert_resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/user_profiles",
            headers={**_supa_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
            json={
                "supabase_uid": user_id,
                "email": user_email,
                "display_name": display_name,
                "avatar_url": avatar_url,
            },
        )

        if upsert_resp.status_code not in (200, 201):
            logger.error("Failed to upsert user profile", status=upsert_resp.status_code, body=upsert_resp.text)
            raise HTTPException(status_code=500, detail="Failed to create user profile")

        profiles = upsert_resp.json()
        profile = profiles[0] if profiles else None

        if not profile:
            raise HTTPException(status_code=500, detail="Profile not returned after upsert")

        profile_id = profile["id"]

        # Ensure onboarding record exists
        await client.post(
            f"{SUPABASE_URL}/rest/v1/user_onboarding",
            headers={**_supa_headers(), "Prefer": "resolution=ignore-duplicates"},
            json={"user_id": profile_id, "completed_steps": []},
        )

        # Fetch onboarding status
        onboarding_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_onboarding",
            headers=_supa_headers(),
            params={"user_id": f"eq.{profile_id}", "select": "completed_steps,completed_at"},
        )
        onboarding = onboarding_resp.json()
        onboarding_data = onboarding[0] if onboarding else {"completed_steps": [], "completed_at": None}
        completed_steps = onboarding_data.get("completed_steps") or []

    logger.info("User verified and profile upserted", user_id=user_id, email=user_email)

    return {
        "profile": profile,
        "onboarding": {
            "completed_steps": completed_steps,
            "is_complete": bool(onboarding_data.get("completed_at")),
        },
    }


@router.get("/me")
async def get_me(request: Request, user_id: str = Depends(require_auth)):
    """Get current user's profile and onboarding status."""
    if _is_mock_mode():
        db = _read_mock_db()
        profile = db["profiles"].get("dev-user-id")
        if not profile:
            # Auto-create profile if missing
            profile = {
                "id": "dev-user-id",
                "supabase_uid": user_id,
                "email": "developer@moira.sinaai.in",
                "display_name": "Developer",
                "avatar_url": None,
                "onboarding_completed": False,
                "created_at": datetime.utcnow().isoformat()
            }
            db["profiles"]["dev-user-id"] = profile
            db["onboarding"]["dev-user-id"] = {
                "completed_steps": [],
                "completed_at": None
            }
            _write_mock_db(db)
        
        onboarding_data = db["onboarding"].get("dev-user-id", {"completed_steps": [], "completed_at": None})
        return {
            "profile": profile,
            "onboarding": {
                "completed_steps": onboarding_data.get("completed_steps") or [],
                "is_complete": bool(onboarding_data.get("completed_at"))
            }
        }

    async with httpx.AsyncClient() as client:
        profile_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_profiles",
            headers=_supa_headers(),
            params={"supabase_uid": f"eq.{user_id}", "select": "*"},
        )
        profiles = profile_resp.json()
        if not profiles:
            raise HTTPException(status_code=404, detail="User profile not found")

        profile = profiles[0]
        profile_id = profile["id"]

        onboarding_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_onboarding",
            headers=_supa_headers(),
            params={"user_id": f"eq.{profile_id}", "select": "completed_steps,completed_at"},
        )
        onboarding = onboarding_resp.json()
        onboarding_data = onboarding[0] if onboarding else {"completed_steps": [], "completed_at": None}

    return {
        "profile": profile,
        "onboarding": {
            "completed_steps": onboarding_data.get("completed_steps") or [],
            "is_complete": bool(onboarding_data.get("completed_at")),
        },
    }


@router.post("/onboarding/save-step")
async def save_onboarding_step(request: Request, user_id: str = Depends(require_auth)):
    """Save a completed onboarding step and optionally mark onboarding done."""
    body = await request.json()
    step = body.get("step")  # e.g. "github", "jira", "slack", "sheets"
    mark_complete = body.get("mark_complete", False)

    if not step:
        raise HTTPException(status_code=400, detail="step is required")

    if _is_mock_mode():
        db = _read_mock_db()
        ob = db["onboarding"].get("dev-user-id", {"completed_steps": [], "completed_at": None})
        current_steps = ob.get("completed_steps") or []
        if step not in current_steps:
            current_steps.append(step)
        ob["completed_steps"] = current_steps
        if mark_complete:
            ob["completed_at"] = datetime.utcnow().isoformat()
            if "dev-user-id" in db["profiles"]:
                db["profiles"]["dev-user-id"]["onboarding_completed"] = True
        db["onboarding"]["dev-user-id"] = ob
        _write_mock_db(db)
        return {"saved_step": step, "completed_steps": current_steps, "is_complete": mark_complete}

    async with httpx.AsyncClient() as client:
        # Get profile id
        profile_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_profiles",
            headers=_supa_headers(),
            params={"supabase_uid": f"eq.{user_id}", "select": "id"},
        )
        profiles = profile_resp.json()
        if not profiles:
            raise HTTPException(status_code=404, detail="Profile not found")
        profile_id = profiles[0]["id"]

        # Get current steps
        ob_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_onboarding",
            headers=_supa_headers(),
            params={"user_id": f"eq.{profile_id}", "select": "completed_steps"},
        )
        ob = ob_resp.json()
        current_steps = ob[0]["completed_steps"] if ob else []
        if step not in current_steps:
            current_steps.append(step)

        # Update
        patch_data: dict = {"completed_steps": current_steps}
        if mark_complete:
            patch_data["completed_at"] = datetime.utcnow().isoformat()

        await client.patch(
            f"{SUPABASE_URL}/rest/v1/user_onboarding",
            headers=_supa_headers(),
            params={"user_id": f"eq.{profile_id}"},
            json=patch_data,
        )

        if mark_complete:
            await client.patch(
                f"{SUPABASE_URL}/rest/v1/user_profiles",
                headers=_supa_headers(),
                params={"id": f"eq.{profile_id}"},
                json={"onboarding_completed": True},
            )

    return {"saved_step": step, "completed_steps": current_steps, "is_complete": mark_complete}


@router.get("/config/{connector}")
async def get_connector_config(connector: str, request: Request, user_id: str = Depends(require_auth)):
    """Get current user's config for a specific connector (without secrets)."""
    if _is_mock_mode():
        db = _read_mock_db()
        configs = db.get("configs", {}).get("dev-user-id", {})
        connector_cfg = configs.get(connector)
        if connector_cfg:
            return {
                "connector_name": connector,
                "is_configured": connector_cfg.get("is_configured", False),
                "last_tested_at": connector_cfg.get("last_tested_at")
            }
        return {"connector_name": connector, "is_configured": False}

    async with httpx.AsyncClient() as client:
        profile_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_profiles",
            headers=_supa_headers(),
            params={"supabase_uid": f"eq.{user_id}", "select": "id"},
        )
        profiles = profile_resp.json()
        if not profiles:
            raise HTTPException(status_code=404, detail="Profile not found")
        profile_id = profiles[0]["id"]

        config_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_env_configs",
            headers=_supa_headers(),
            params={"user_id": f"eq.{profile_id}", "connector_name": f"eq.{connector}", "select": "connector_name,is_configured,last_tested_at"},
        )
        configs = config_resp.json()

    return configs[0] if configs else {"connector_name": connector, "is_configured": False}


@router.post("/config/{connector}")
async def save_connector_config(connector: str, request: Request, user_id: str = Depends(require_auth)):
    """Save user's connector credentials. Config data is stored encrypted."""
    body = await request.json()
    config_data = body.get("config", {})

    if not config_data:
        raise HTTPException(status_code=400, detail="config object is required")

    if _is_mock_mode():
        db = _read_mock_db()
        if "dev-user-id" not in db["configs"]:
            db["configs"]["dev-user-id"] = {}
        
        # Inject into os.environ and write/update .env file
        from utils.config import reload_settings
        for key, val in config_data.items():
            os.environ[key.upper()] = str(val)
        try:
            from api.settings import _ENV_PATH
            lines = []
            if _ENV_PATH.exists():
                lines = _ENV_PATH.read_text(encoding="utf-8").splitlines()
            for key, val in config_data.items():
                env_key = key.upper()
                found = False
                for idx, line in enumerate(lines):
                    if line.strip().startswith(f"{env_key}=") or line.strip().startswith(f"{env_key} ="):
                        lines[idx] = f'{env_key}="{val}"'
                        found = True
                        break
                if not found:
                    lines.append(f'{env_key}="{val}"')
            _ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
            reload_settings()
            
            # Re-bootstrap connectors
            from core.connector_registry import bootstrap_registry
            await bootstrap_registry(force=True)
            logger.info("ConnectorRegistry re-bootstrapped locally after mock credential save")
        except Exception as exc:
            logger.warning(f"Could not save mock config to local .env: {exc}")

        db["configs"]["dev-user-id"][connector] = {
            "is_configured": True,
            "last_tested_at": db["configs"]["dev-user-id"].get(connector, {}).get("last_tested_at")
        }
        _write_mock_db(db)
        return {"connector": connector, "saved": True}

    async with httpx.AsyncClient() as client:
        # Get profile id
        profile_resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_profiles",
            headers=_supa_headers(),
            params={"supabase_uid": f"eq.{user_id}", "select": "id"},
        )
        profiles = profile_resp.json()
        if not profiles:
            raise HTTPException(status_code=404, detail="Profile not found")
        profile_id = profiles[0]["id"]

        # Upsert config
        resp = await client.post(
            f"{SUPABASE_URL}/rest/v1/user_env_configs",
            headers={**_supa_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
            json={
                "user_id": profile_id,
                "connector_name": connector,
                "config_data": config_data,
                "is_configured": True,
            },
        )

        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=500, detail="Failed to save config")

    logger.info("Connector config saved", user_id=user_id, connector=connector)
    return {"connector": connector, "saved": True}


@router.post("/config/{connector}/test")
async def test_connector_config(connector: str, request: Request, user_id: str = Depends(require_auth)):
    """Test a connector's credentials by making a real API call."""
    body = await request.json()
    config_data = body.get("config", {})

    # Basic validation per connector type
    result = {"connector": connector, "success": False, "message": ""}

    try:
        if connector == "github":
            token = config_data.get("GITHUB_TOKEN", "")
            async with httpx.AsyncClient() as c:
                r = await c.get("https://api.github.com/user", headers={"Authorization": f"Bearer {token}"}, timeout=8)
                if r.status_code == 200:
                    data = r.json()
                    result = {"connector": connector, "success": True, "message": f"Connected as @{data.get('login')}"}
                else:
                    result["message"] = "Invalid GitHub token"

        elif connector == "jira":
            domain = config_data.get("JIRA_DOMAIN", "")
            email = config_data.get("JIRA_EMAIL", "")
            token = config_data.get("JIRA_API_TOKEN", "")
            import base64
            creds = base64.b64encode(f"{email}:{token}".encode()).decode()
            async with httpx.AsyncClient() as c:
                r = await c.get(f"https://{domain}/rest/api/3/myself",
                                headers={"Authorization": f"Basic {creds}", "Accept": "application/json"}, timeout=8)
                if r.status_code == 200:
                    data = r.json()
                    result = {"connector": connector, "success": True, "message": f"Connected as {data.get('displayName')}"}
                else:
                    result["message"] = "Invalid Jira credentials"

        elif connector == "slack":
            webhook = config_data.get("SLACK_WEBHOOK_URL", "")
            async with httpx.AsyncClient() as c:
                r = await c.post(webhook, json={"text": "🔮 MOIRA connection test — fate is watching."}, timeout=8)
                if r.status_code == 200:
                    result = {"connector": connector, "success": True, "message": "Test message sent to Slack"}
                else:
                    result["message"] = "Invalid Slack webhook URL"

        else:
            result = {"connector": connector, "success": True, "message": "Config saved (no live test available)"}

    except Exception as e:
        result["message"] = f"Connection failed: {str(e)}"

    # Update last_tested_at
    if result["success"]:
        if _is_mock_mode():
            db = _read_mock_db()
            if "dev-user-id" not in db["configs"]:
                db["configs"]["dev-user-id"] = {}
            if connector not in db["configs"]["dev-user-id"]:
                db["configs"]["dev-user-id"][connector] = {}
            db["configs"]["dev-user-id"][connector]["last_tested_at"] = datetime.utcnow().isoformat()
            db["configs"]["dev-user-id"][connector]["is_configured"] = True
            _write_mock_db(db)
        else:
            async with httpx.AsyncClient() as client:
                profile_resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/user_profiles",
                    headers=_supa_headers(),
                    params={"supabase_uid": f"eq.{user_id}", "select": "id"},
                )
                profiles = profile_resp.json()
                if profiles:
                    profile_id = profiles[0]["id"]
                    await client.patch(
                        f"{SUPABASE_URL}/rest/v1/user_env_configs",
                        headers=_supa_headers(),
                        params={"user_id": f"eq.{profile_id}", "connector_name": f"eq.{connector}"},
                        json={"last_tested_at": datetime.utcnow().isoformat(), "is_configured": True},
                    )

    return result
