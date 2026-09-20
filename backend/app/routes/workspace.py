"""One guarded entry point per workspace.

Each workspace answers "what am I signed in to, and what is waiting for me"
at its own address, behind its own role guard. That is what makes the
separation real rather than cosmetic: a contractor who edits the URL to
`/api/project-manager/overview` is refused by the server, not by the
interface that stopped offering the link.

These routers deliberately stay thin. The data still comes from the same
services the rest of the API uses — this is a different door onto the same
building, not a second building.
"""
from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, Database, require_roles
from app.core.workspaces import WORKSPACES, authorized_roles, home_for, slug_for_role
from app.db.mongodb import Collections as C
from app.models.common import Role, serialize, to_object_id, utcnow
from app.services.analytics_service import dashboard_snapshot
from app.services.project_service import list_projects, visibility_filter

# --------------------------------------------------------------------------
# Project manager
# --------------------------------------------------------------------------

pm_router = APIRouter(
    prefix="/project-manager",
    tags=["workspace:project-manager"],
    dependencies=[Depends(require_roles(Role.project_manager))],
)


@pm_router.get("/overview")
async def pm_overview(db: Database, user: CurrentUser):
    """The portfolio this manager is responsible for."""
    snapshot = await dashboard_snapshot(db, user)
    oid = to_object_id(user["id"])
    return {
        **snapshot,
        "workspace": _manifest(user),
        "managing": await db[C.projects].count_documents({"manager_id": oid}),
    }


@pm_router.get("/projects")
async def pm_projects(db: Database, user: CurrentUser):
    return await list_projects(db, user)


# --------------------------------------------------------------------------
# Site manager
# --------------------------------------------------------------------------

site_router = APIRouter(
    prefix="/site-manager",
    tags=["workspace:site-manager"],
    dependencies=[Depends(require_roles(Role.site_engineer))],
)


@site_router.get("/overview")
async def site_overview(db: Database, user: CurrentUser):
    """Today on the sites this person runs. No budget figures."""
    return {"workspace": _manifest(user), **await _field_summary(db, user)}


@site_router.get("/tasks")
async def site_tasks(db: Database, user: CurrentUser):
    return await _assigned_tasks(db, user, own_only=False)


# --------------------------------------------------------------------------
# Contractor
# --------------------------------------------------------------------------

contractor_router = APIRouter(
    prefix="/contractor",
    tags=["workspace:contractor"],
    dependencies=[Depends(require_roles(Role.contractor))],
)


@contractor_router.get("/overview")
async def contractor_overview(db: Database, user: CurrentUser):
    """The work assigned to this contractor, and nothing else."""
    return {"workspace": _manifest(user), **await _field_summary(db, user, own_only=True)}


@contractor_router.get("/tasks")
async def contractor_tasks(db: Database, user: CurrentUser):
    return await _assigned_tasks(db, user, own_only=True)


# --------------------------------------------------------------------------
# Shared
# --------------------------------------------------------------------------

def _manifest(user: dict) -> dict:
    """Which workspace this session is in, and where else it could go."""
    slug = slug_for_role(user.get("role"))
    workspace = WORKSPACES.get(slug or "", {})
    return {
        "slug": slug,
        "label": workspace.get("label"),
        "home": home_for(user.get("role")),
        "authorized_roles": authorized_roles(user),
    }


async def _assigned_tasks(db, user: dict, *, own_only: bool) -> list[dict]:
    visible = [p async for p in db[C.projects].find(visibility_filter(user), {"name": 1})]
    names = {str(p["_id"]): p["name"] for p in visible}

    query: dict = {"project_id": {"$in": [p["_id"] for p in visible]}}
    if own_only:
        query["assignee_id"] = to_object_id(user["id"])

    tasks = []
    async for doc in db[C.tasks].find(query).sort("deadline", 1):
        task = serialize(doc)
        task["project_name"] = names.get(str(task.get("project_id")), "")
        tasks.append(task)
    return tasks


async def _field_summary(db, user: dict, *, own_only: bool = False) -> dict:
    tasks = await _assigned_tasks(db, user, own_only=own_only)
    now = utcnow()
    open_tasks = [t for t in tasks if t.get("status") != "completed"]
    projects = await list_projects(db, user)
    return {
        "projects": [{"id": p["id"], "name": p["name"], "code": p.get("code"),
                      "status": p.get("status")} for p in projects],
        "summary": {
            "projects": len(projects),
            "tasks": len(tasks),
            "open": len(open_tasks),
            "completed": len(tasks) - len(open_tasks),
            "overdue": sum(
                1 for t in open_tasks
                if t.get("deadline") and str(t["deadline"]) < now.isoformat()
            ),
        },
    }
