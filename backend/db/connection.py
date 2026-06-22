"""asyncpg connection pool management."""

from __future__ import annotations

import asyncpg
from asyncpg.pool import Pool

from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)

_pool: Pool | None = None


async def get_pool() -> Pool | None:
    """Return the asyncpg connection pool or None if connection fails."""
    global _pool
    if _pool is None:
        try:
            settings = get_settings()
            _pool = await asyncpg.create_pool(
                dsn=settings.database_url,
                min_size=2,
                max_size=10,
                command_timeout=5, # Short timeout for dev detection
            )
            logger.info("Database connection pool created", dsn=settings.database_url)
        except Exception as exc:
            logger.warning("Database unavailable — continuing in ephemeral mode", error=str(exc))
            return None
    return _pool


async def close_pool() -> None:
    """Gracefully close the connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Database connection pool closed")


async def run_migrations() -> None:
    """Apply all SQL migration files in order (if pool available)."""
    import pathlib
    pool = await get_pool()
    if not pool:
        logger.warning("Skipping migrations: No database pool available")
        return
        
    migrations_dir = pathlib.Path(__file__).parent / "migrations"
    sql_files = sorted(migrations_dir.glob("*.sql"))
    async with pool.acquire() as conn:
        for sql_file in sql_files:
            logger.info("Running migration", file=str(sql_file))
            sql = sql_file.read_text(encoding="utf-8")
            # Wrap in transaction
            async with conn.transaction():
                await conn.execute(sql)
    logger.info("All migrations applied", count=len(sql_files))
