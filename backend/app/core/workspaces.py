"""The four BuildSync workspaces, and which role each one requires.

A "workspace" is a way into the product, not a privilege. Choosing *Admin* on
the sign-in screen states which surface a person wants; whether they get it is
decided here and in `app.core.deps` from the roles stored against their
account. The two ideas are kept in separate vocabularies on purpose:

  * the URL and the client speak in slugs — `project-manager`, `site-manager`;
  * the database and the permission matrix speak in roles — `project_manager`,
    `site_engineer`.

`site_engineer` is presented as "Site manager" because that is what the job is
called on site. Renaming the stored role would mean migrating every existing
record for a label, so the mapping lives here instead.
"""
from app.models.common import Role

# slug -> everything the client needs to render the workspace chooser.
WORKSPACES: dict[str, dict] = {
    "admin": {
        "slug": "admin",
        "role": Role.admin.value,
        "label": "Admin",
        "login_title": "Admin Login",
        "login_subtitle": "Access the BuildSync administration workspace.",
        "description": (
            "Manage the entire BuildSync platform, users, projects, system activity "
            "and organization-wide operations."
        ),
        "home": "/admin",
    },
    "project-manager": {
        "slug": "project-manager",
        "role": Role.project_manager.value,
        "label": "Project Manager",
        "login_title": "Project Manager Login",
        "login_subtitle": "Access your project management workspace.",
        "description": (
            "Manage projects, tasks, milestones, budgets, teams, materials, reports "
            "and project intelligence."
        ),
        "home": "/project-manager",
    },
    "site-manager": {
        "slug": "site-manager",
        "role": Role.site_engineer.value,
        "label": "Site Manager",
        "login_title": "Site Manager Login",
        "login_subtitle": "Access your site operations workspace.",
        "description": (
            "Manage daily site operations, progress updates, site reports, materials, "
            "workers and construction issues."
        ),
        "home": "/site-manager",
    },
    "contractor": {
        "slug": "contractor",
        "role": Role.contractor.value,
        "label": "Contractor",
        "login_title": "Contractor Login",
        "login_subtitle": "Access your assigned work workspace.",
        "description": (
            "Manage assigned work, update progress, submit completed work, report "
            "issues and request materials."
        ),
        "home": "/contractor",
    },
}

# The order the chooser presents them in: most access first.
WORKSPACE_ORDER = ["admin", "project-manager", "site-manager", "contractor"]

_ROLE_TO_SLUG = {w["role"]: slug for slug, w in WORKSPACES.items()}


def slug_for_role(role: str | None) -> str | None:
    return _ROLE_TO_SLUG.get(role or "")


def role_for_slug(slug: str | None) -> str | None:
    workspace = WORKSPACES.get(slug or "")
    return workspace["role"] if workspace else None


def resolve(value: str | None) -> str | None:
    """Accept either a slug or a role name and return the role name.

    The client sends `selected_role`, and both spellings turn up in practice —
    a URL carries `site-manager`, a stored record carries `site_engineer`.
    Normalising here means nothing downstream has to care which arrived.
    """
    if not value:
        return None
    if value in WORKSPACES:
        return WORKSPACES[value]["role"]
    return value if value in _ROLE_TO_SLUG else None


def label_for(value: str | None) -> str:
    slug = value if value in WORKSPACES else slug_for_role(resolve(value))
    return WORKSPACES[slug]["label"] if slug else "that"


def home_for(role: str | None) -> str:
    slug = slug_for_role(role)
    return WORKSPACES[slug]["home"] if slug else "/login"


def authorized_roles(user: dict) -> list[str]:
    """Every role this account may sign in as — which is exactly one.

    An account is one person doing one job. Whoever administers the platform
    has an administrator's account; if they also run projects, that is a
    second account, not a second door on the first one. So the role stored on
    the record is the whole answer, and there is nothing to choose at sign-in
    and nothing to switch to afterwards.

    A list is still returned because that is the shape the client and the rest
    of the API already read, and because it gives the empty answer somewhere
    to live: a record whose `role` is missing or not a role BuildSync knows
    has no workspace at all, and is refused rather than guessed at.
    """
    primary = user.get("role")
    return [primary] if primary in _ROLE_TO_SLUG else []


def public_workspaces() -> list[dict]:
    """The chooser's contents. Public: it names no account and grants nothing."""
    return [
        {k: v for k, v in WORKSPACES[slug].items() if k != "role"}
        for slug in WORKSPACE_ORDER
    ]
