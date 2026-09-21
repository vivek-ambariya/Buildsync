import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.ai import document_ai
from app.core.config import settings
from app.core.deps import CurrentUser, Database, require_permission
from app.core.permissions import P
from app.db.mongodb import Collections as C
from app.models.common import DocumentStatus, serialize, to_object_id, utcnow
from app.services.activity_service import log_activity
from app.services.project_service import can_reach_project, scoped_project_query, visibility_filter

router = APIRouter(prefix="/documents", tags=["documents"])

can_upload = Depends(require_permission(P.documents_upload))
can_edit = Depends(require_permission(P.documents_edit))
can_delete = Depends(require_permission(P.documents_delete))

MAX_BYTES = 25 * 1024 * 1024


async def _require_document(db, user: dict, document_id: str) -> dict:
    """Fetch a document, or refuse it, without saying which of the two it was.

    A document the caller cannot reach and a document that does not exist get
    the same 404, so an id cannot be used to discover what other sites hold.
    """
    doc = await db[C.documents].find_one({"_id": to_object_id(document_id)})
    if not doc or not await can_reach_project(db, user, doc.get("project_id")):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That document does not exist.")
    return doc


@router.get("")
async def index(db: Database, user: CurrentUser, project_id: str | None = None,
                doc_type: str | None = None, q: str | None = None):
    visible = [p async for p in db[C.projects].find(visibility_filter(user), {"name": 1})]
    names = {str(p["_id"]): p["name"] for p in visible}

    query: dict = scoped_project_query([p["_id"] for p in visible], project_id)
    if doc_type:
        query["doc_type"] = doc_type
    if q:
        query["name"] = {"$regex": q, "$options": "i"}

    cursor = db[C.documents].find(query).sort("uploaded_at", -1)
    items = []
    async for doc in cursor:
        document = serialize(doc)
        document["project_name"] = names.get(str(document.get("project_id")), "")
        items.append(document)
    return items


@router.get("/{document_id}")
async def detail(document_id: str, db: Database, user: CurrentUser):
    return serialize(await _require_document(db, user, document_id))


@router.post("/upload", status_code=status.HTTP_201_CREATED, dependencies=[can_upload])
async def upload(
    db: Database,
    user: CurrentUser,
    file: UploadFile = File(...),
    project_id: str = Form(...),
    doc_type: str | None = Form(default=None),
    notes: str = Form(default=""),
):
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            "That file is over the 25 MB limit. Split it or upload a lighter export.")
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That file is empty.")

    project_oid = to_object_id(project_id)
    if not project_oid or not await can_reach_project(db, user, project_oid):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project does not exist.")

    suffix = Path(file.filename or "upload").suffix
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    (settings.storage_path / stored_name).write_bytes(raw)

    record = {
        "project_id": project_oid,
        "name": file.filename or stored_name,
        "stored_name": stored_name,
        "content_type": file.content_type,
        "size_bytes": len(raw),
        "doc_type": doc_type or "other",
        "notes": notes,
        "status": DocumentStatus.processing.value,
        "uploaded_by": to_object_id(user["id"]),
        "uploaded_by_name": user.get("name"),
        "uploaded_at": utcnow(),
    }
    result = await db[C.documents].insert_one(record)

    try:
        analysis = await document_ai.process(raw, record["name"], doc_type)
        await db[C.documents].update_one(
            {"_id": result.inserted_id},
            {"$set": {**analysis, "status": DocumentStatus.processed.value}},
        )
    except Exception as exc:  # the file is safely stored either way
        await db[C.documents].update_one(
            {"_id": result.inserted_id},
            {"$set": {"status": DocumentStatus.failed.value, "error": str(exc)[:200]}},
        )

    await log_activity(db, actor=user, action="uploaded document", entity_type="document",
                       entity_id=str(result.inserted_id), project_id=project_id, detail=record["name"])
    return serialize(await db[C.documents].find_one({"_id": result.inserted_id}))


@router.post("/{document_id}/reprocess", dependencies=[can_edit])
async def reprocess(document_id: str, db: Database, user: CurrentUser):
    doc = await _require_document(db, user, document_id)
    path = settings.storage_path / doc["stored_name"]
    if not path.exists():
        raise HTTPException(status.HTTP_410_GONE, "The stored file is no longer on disk. Upload it again.")

    analysis = await document_ai.process(path.read_bytes(), doc["name"], doc.get("doc_type"))
    await db[C.documents].update_one(
        {"_id": doc["_id"]}, {"$set": {**analysis, "status": DocumentStatus.processed.value}}
    )
    return serialize(await db[C.documents].find_one({"_id": doc["_id"]}))


@router.get("/{document_id}/file")
async def download(document_id: str, db: Database, user: CurrentUser):
    doc = await _require_document(db, user, document_id)
    path = settings.storage_path / doc["stored_name"]
    if not path.exists():
        raise HTTPException(status.HTTP_410_GONE, "The stored file is no longer on disk.")
    return FileResponse(path, filename=doc["name"], media_type=doc.get("content_type") or "application/octet-stream")


@router.delete("/{document_id}", dependencies=[can_delete])
async def remove(document_id: str, db: Database, user: CurrentUser):
    doc = await _require_document(db, user, document_id)
    (settings.storage_path / doc["stored_name"]).unlink(missing_ok=True)
    await db[C.documents].delete_one({"_id": doc["_id"]})
    await log_activity(db, actor=user, action="deleted document", entity_type="document",
                       project_id=str(doc.get("project_id")), detail=doc.get("name", ""))
    return {"ok": True}
