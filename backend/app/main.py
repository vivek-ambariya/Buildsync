"""BuildSync AI — FastAPI application entry point.

Wiring only: lifespan, middleware, error shape, router registration.
All behaviour lives in app/routes and app/services.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.db.indexes import ensure_indexes
from app.db.migrations import run_migrations
from app.db.mongodb import close, connect, get_database
from app.routes import (
    admin,
    ai,
    auth,
    dashboard,
    documents,
    expenses,
    materials,
    notifications,
    projects,
    reports,
    search,
    site,
    site_updates,
    tasks,
    users,
    workspace,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("buildsync")


@asynccontextmanager
async def lifespan(app: FastAPI):
    connect()
    db = get_database()
    try:
        await db.command("ping")
        await ensure_indexes(db)
        await run_migrations(db)
        log.info("Connected to MongoDB at %s/%s", settings.mongodb_uri, settings.mongodb_db)
    except Exception as exc:
        log.error("MongoDB is unreachable: %s", exc)
    yield
    await close()


app = FastAPI(
    title=settings.app_name,
    description="Construction data management and project intelligence API.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    """One error shape for the whole API so the client can always read it."""
    return JSONResponse(status_code=exc.status_code, content={"error": {"message": exc.detail}})


def _serialisable(errors: list[dict]) -> list[dict]:
    """Pydantic's error list, with the parts that cannot become JSON removed.

    A validator that raises `ValueError` has the exception object itself put
    into `ctx`, and an exception does not survive `json.dumps`. Without this
    the response handler would fail while reporting the failure, turning every
    such 422 into a 500 — the one status that tells the client nothing.
    """
    cleaned = []
    for err in errors:
        item = {k: v for k, v in err.items() if k != "ctx"}
        ctx = err.get("ctx")
        if isinstance(ctx, dict):
            item["ctx"] = {k: str(v) for k, v in ctx.items()}
        cleaned.append(item)
    return cleaned


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"message": f"Check the {field} field: {first.get('msg', 'invalid value')}.",
                           "fields": _serialisable(errors)}},
    )


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": {"message": "Something went wrong on our side. Try again in a moment."}},
    )


@app.get("/health", tags=["system"])
async def health():
    db = get_database()
    try:
        await db.command("ping")
        database = "connected"
    except Exception:
        database = "unreachable"
    return {"status": "ok", "app": settings.app_name, "database": database,
            "environment": settings.environment}


for module in (auth, users, admin, dashboard, projects, tasks, materials, expenses,
               documents, site_updates, site, reports, ai, notifications, search):
    app.include_router(module.router, prefix=settings.api_prefix)

# One guarded entry point per workspace, each behind its own role check.
for _router in (workspace.pm_router, workspace.site_router, workspace.contractor_router):
    app.include_router(_router, prefix=settings.api_prefix)
