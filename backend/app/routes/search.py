"""Portfolio-wide search behind the command palette."""
import re

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, Database
from app.core.workspaces import people_link_for
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id
from app.services.project_service import list_projects

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
async def search(db: Database, user: CurrentUser, q: str = Query(min_length=1, max_length=80)):
    pattern = re.compile(re.escape(q.strip()), re.IGNORECASE)
    projects = await list_projects(db, user)
    project_ids = [to_object_id(p["id"]) for p in projects]
    names = {p["id"]: p["name"] for p in projects}
    scope = {"project_id": {"$in": project_ids}}

    results: list[dict] = [
        {"type": "project", "id": p["id"], "title": p["name"],
         "subtitle": f"{p.get('category')} · {p.get('status', '').replace('_', ' ')}",
         "href": f"/app/projects/{p['id']}"}
        for p in projects if pattern.search(p["name"]) or pattern.search(p.get("code", ""))
    ][:6]

    async def collect(collection: str, field: str, kind: str, subtitle_key: str, href) -> None:
        cursor = db[collection].find({**scope, field: pattern}).limit(5)
        async for doc in cursor:
            item = serialize(doc)
            results.append({
                "type": kind,
                "id": item["id"],
                "title": item.get(field),
                "subtitle": f"{names.get(str(item.get('project_id')), 'Project')} · {item.get(subtitle_key, '')}",
                "href": href(item),
            })

    await collect(C.tasks, "title", "task", "status", lambda i: f"/app/projects/{i['project_id']}?tab=tasks")
    await collect(C.materials, "name", "material", "supplier", lambda i: f"/app/projects/{i['project_id']}?tab=materials")
    await collect(C.documents, "name", "document", "doc_type", lambda i: f"/app/documents?q={i['name']}")
    await collect(C.expenses, "title", "expense", "vendor", lambda i: f"/app/projects/{i['project_id']}?tab=expenses")

    # Only the shells that actually have a people directory get people back.
    people_href = people_link_for(user.get("role"))
    if people_href:
        cursor = db[C.users].find({"name": pattern, "active": True}, {"password_hash": 0}).limit(4)
        async for doc in cursor:
            person = serialize(doc)
            results.append({
                "type": "person", "id": person["id"], "title": person["name"],
                "subtitle": person.get("title") or person["role"].replace("_", " ").title(),
                "href": people_href,
            })

    return {"query": q, "results": results[:24]}
