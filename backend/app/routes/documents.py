import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.ai import document_ai
from app.core.config import settings
from app.core.deps import CurrentUser, Database
from app.db.mongodb import Collections as C
from app.models.common import DocumentStatus, serialize, to_object_id, utcnow
from app.services.activity_service import log_activity
from app.services.project_service import visibility_filter

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_BYTES = 25 * 1024 * 1024


@router.get("")
async def index(db: Database, user: CurrentUser, project_id: str | None = None,
                doc_type: str | None = None, q: str | None = None):
    visible = [p async for p in db[C.projects].find(visibility_filter(user), {"name": 1})]
    names = {str(p["_id"]): p["name"] for p in visible}

    query: dict = {"project_id": {"$in": [p["_id"] for p in visible]}}
    if project_id and (oid := to_object_id(project_id)):
        query["project_id"] = oid
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
    doc = await db[C.documents].find_one({"_id": to_object_id(document_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That document does not exist.")
    return serialize(doc)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
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
    if not project_oid or not await db[C.projects].find_one({"_id": project_oid}):
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


@router.post("/{document_id}/reprocess")
async def reprocess(document_id: str, db: Database, user: CurrentUser):
    doc = await db[C.documents].find_one({"_id": to_object_id(document_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That document does not exist.")
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
    doc = await db[C.documents].find_one({"_id": to_object_id(document_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That document does not exist.")
    path = settings.storage_path / doc["stored_name"]
    if not path.exists():
        raise HTTPException(status.HTTP_410_GONE, "The stored file is no longer on disk.")
    return FileResponse(path, filename=doc["name"], media_type=doc.get("content_type") or "application/octet-stream")


@router.delete("/{document_id}")
async def remove(document_id: str, db: Database, user: CurrentUser):
    doc = await db[C.documents].find_one({"_id": to_object_id(document_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That document does not exist.")
    (settings.storage_path / doc["stored_name"]).unlink(missing_ok=True)
    await db[C.documents].delete_one({"_id": doc["_id"]})
    await log_activity(db, actor=user, action="deleted document", entity_type="document",
                       project_id=str(doc.get("project_id")), detail=doc.get("name", ""))
    return {"ok": True}
