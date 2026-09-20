"""Single Motor client shared across the application lifespan."""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

_client: AsyncIOMotorClient | None = None


def connect() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri, uuidRepresentation="standard")
    return _client


async def close() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_database() -> AsyncIOMotorDatabase:
    return connect()[settings.mongodb_db]


class Collections:
    users = "users"
    projects = "projects"
    tasks = "tasks"
    milestones = "milestones"
    materials = "materials"
    expenses = "expenses"
    documents = "documents"
    site_updates = "site_updates"
    notifications = "notifications"
    reports = "reports"
    ai_insights = "ai_insights"
    activities = "activities"
    conversations = "conversations"
    # Site operations: what the people on the ground record during the day.
    site_photos = "site_photos"
    site_issues = "site_issues"
    material_requests = "material_requests"
    workforce_logs = "workforce_logs"
    progress_updates = "progress_updates"
