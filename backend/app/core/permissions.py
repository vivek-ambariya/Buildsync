"""Role → permission matrix: the single source of truth for what a role may do.

Two different questions decide whether a request is allowed, and they are kept
apart on purpose:

  * *which actions* a role may perform — this module, enforced by the guards in
    `app.core.deps`;
  * *which rows* a person may touch — `project_service.visibility_filter`,
    which narrows every query to the projects they are attached to.

An admin passes both: every permission, and no visibility filter. Nothing else
in the API decides authorisation for itself, so adding a role or moving a
capability is a change in this one file.
"""
from app.models.common import Role


class P:
    """Permission names, grouped by the area they govern."""

    # People and access
    users_view = "users.view"
    users_create = "users.create"
    users_edit = "users.edit"
    users_delete = "users.delete"
    users_assign = "users.assign"
    roles_manage = "roles.manage"

    # Projects
    projects_view_all = "projects.view_all"
    projects_create = "projects.create"
    projects_edit = "projects.edit"
    projects_delete = "projects.delete"
    projects_assign_manager = "projects.assign_manager"

    # Tasks
    tasks_create = "tasks.create"
    tasks_edit = "tasks.edit"           # any field on any visible task
    tasks_update_own = "tasks.update_own"   # progress/status on your own task
    tasks_delete = "tasks.delete"

    # Materials
    materials_view = "materials.view"
    materials_create = "materials.create"
    materials_edit = "materials.edit"
    materials_delete = "materials.delete"

    # Expenses
    expenses_view = "expenses.view"
    expenses_create = "expenses.create"
    expenses_edit = "expenses.edit"
    expenses_delete = "expenses.delete"

    # Documents
    documents_view = "documents.view"
    documents_upload = "documents.upload"
    documents_edit = "documents.edit"
    documents_delete = "documents.delete"

    # Site updates
    site_updates_view = "site_updates.view"
    site_updates_create = "site_updates.create"
    site_updates_edit = "site_updates.edit"
    site_updates_delete = "site_updates.delete"

    # Reports
    reports_view = "reports.view"
    reports_generate = "reports.generate"
    reports_delete = "reports.delete"

    # Site operations — what the people on the ground record during the day.
    site_photos_view = "site_photos.view"
    site_photos_upload = "site_photos.upload"
    site_photos_delete = "site_photos.delete"

    site_issues_view = "site_issues.view"
    site_issues_report = "site_issues.report"
    site_issues_resolve = "site_issues.resolve"

    material_requests_view = "material_requests.view"
    material_requests_create = "material_requests.create"
    material_requests_decide = "material_requests.decide"

    workforce_view = "workforce.view"
    workforce_record = "workforce.record"

    # Intelligence
    ai_view = "ai.view"
    ai_run_analysis = "ai.run_analysis"
    ai_assistant = "ai.assistant"

    # System
    system_stats = "system.stats"
    system_activity_logs = "system.activity_logs"
    system_settings = "system.settings"


def _all_permissions() -> frozenset[str]:
    return frozenset(
        value for key, value in vars(P).items()
        if not key.startswith("_") and isinstance(value, str)
    )


ALL_PERMISSIONS = _all_permissions()

# A project manager runs the sites they are given: everything operational,
# nothing that changes who has access or removes a project from the portfolio.
_PROJECT_MANAGER = frozenset({
    P.users_view, P.users_assign,
    P.projects_create, P.projects_edit,
    P.tasks_create, P.tasks_edit, P.tasks_update_own, P.tasks_delete,
    P.materials_view, P.materials_create, P.materials_edit, P.materials_delete,
    P.expenses_view, P.expenses_create, P.expenses_edit, P.expenses_delete,
    P.documents_view, P.documents_upload, P.documents_edit, P.documents_delete,
    P.site_updates_view, P.site_updates_create, P.site_updates_edit, P.site_updates_delete,
    P.reports_view, P.reports_generate,
    P.site_photos_view, P.site_photos_upload, P.site_photos_delete,
    P.site_issues_view, P.site_issues_report, P.site_issues_resolve,
    P.material_requests_view, P.material_requests_create, P.material_requests_decide,
    P.workforce_view, P.workforce_record,
    P.ai_view, P.ai_run_analysis, P.ai_assistant,
})

# A site engineer (site manager) runs the day on the ground: progress against
# their own tasks, what was built, who turned up, what was consumed, what went
# wrong, and the photographs that evidence all of it. Nothing they do changes
# who has access, what a project costs, or which projects exist.
_SITE_ENGINEER = frozenset({
    P.users_view,
    P.tasks_update_own,
    P.materials_view, P.materials_edit,
    P.expenses_view, P.expenses_create,
    P.documents_view, P.documents_upload,
    P.site_updates_view, P.site_updates_create, P.site_updates_edit,
    P.reports_view,
    P.site_photos_view, P.site_photos_upload, P.site_photos_delete,
    P.site_issues_view, P.site_issues_report,
    P.material_requests_view, P.material_requests_create,
    P.workforce_view, P.workforce_record,
    P.ai_view, P.ai_assistant,
})

# A contractor sees their own work and reports against it. No budgets.
_CONTRACTOR = frozenset({
    P.users_view,
    P.tasks_update_own,
    P.materials_view,
    P.documents_view,
    P.site_updates_view, P.site_updates_create,
    P.site_photos_view, P.site_photos_upload,
    P.site_issues_view, P.site_issues_report,
    P.workforce_view,
    P.ai_view,
})

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    Role.admin.value: ALL_PERMISSIONS,
    Role.project_manager.value: _PROJECT_MANAGER,
    Role.site_engineer.value: _SITE_ENGINEER,
    Role.contractor.value: _CONTRACTOR,
}


def permissions_for(role: str | None) -> frozenset[str]:
    """Everything `role` may do. An unknown role gets nothing, never everything."""
    return ROLE_PERMISSIONS.get(role or "", frozenset())


def has_permission(role: str | None, permission: str) -> bool:
    return permission in permissions_for(role)


def has_any(role: str | None, permissions) -> bool:
    granted = permissions_for(role)
    return any(p in granted for p in permissions)


def has_all(role: str | None, permissions) -> bool:
    granted = permissions_for(role)
    return all(p in granted for p in permissions)


def is_admin(user: dict | None) -> bool:
    return bool(user) and user.get("role") == Role.admin.value
