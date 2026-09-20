"""Schema catch-up applied on startup. Idempotent, and safe to run repeatedly.

Kept apart from the seed because these run against real data: an existing
database must arrive at the current shape without being reset.
"""
import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongodb import Collections as C

log = logging.getLogger(__name__)

# Accounts that are genuinely two jobs at once. A director of projects runs
# the platform and carries their own portfolio; a senior project manager
# covers a site directly when one needs it. Applied only where the account has
# not already been given an explicit set, so an admin's later edits stand.
MULTI_ROLE_SEED = {
    "vivek@buildsync.ai": ["admin", "project_manager"],
    "meera.shah@buildsync.ai": ["project_manager", "site_engineer"],
}


async def ensure_user_roles(db: AsyncIOMotorDatabase) -> int:
    """Give every account the `roles` list that workspace selection reads.

    Before multi-role support a user had one `role`. That field is still the
    account's primary workspace and still what the permission matrix is keyed
    on; `roles` is the set they may sign in as. Backfilling it from `role`
    means older records need no special case anywhere else.
    """
    updated = 0
    async for user in db[C.users].find({}, {"role": 1, "roles": 1, "email": 1}):
        existing = user.get("roles")
        if isinstance(existing, list) and existing:
            continue
        roles = MULTI_ROLE_SEED.get(user.get("email", ""), None) or [user.get("role")]
        roles = [r for r in roles if r]
        if not roles:
            continue
        await db[C.users].update_one({"_id": user["_id"]}, {"$set": {"roles": roles}})
        updated += 1

    if updated:
        log.info("Backfilled authorised roles on %d account(s).", updated)
    return updated


async def run_migrations(db: AsyncIOMotorDatabase) -> None:
    for migration in (ensure_user_roles,):
        try:
            await migration(db)
        except Exception as exc:  # a migration must never block boot
            log.warning("Migration %s failed: %s", migration.__name__, exc)
