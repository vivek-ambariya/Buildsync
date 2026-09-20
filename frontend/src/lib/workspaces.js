import {
  AlertTriangle, Boxes, Briefcase, Building2, Camera, ClipboardList, FileBarChart,
  FileText, Gauge, HardHat, LayoutDashboard, LayoutGrid, ListChecks, MessageSquareText,
  Package, Radar, Receipt, Settings, ShieldCheck, Sun, Users,
} from 'lucide-react'

/**
 * The four ways into BuildSync.
 *
 * A workspace is a surface, not a privilege. Choosing one on the way in says
 * which product you want to open; whether you may open it is decided by the
 * API from the roles stored against your account. Everything here — slugs,
 * labels, navigation, landing paths — is presentation built on top of that
 * decision, and mirrors `backend/app/core/workspaces.py`.
 *
 * `site_engineer` is shown as "Site Manager" because that is the job title on
 * site; the stored role keeps its original name so no existing record has to
 * be migrated for a label.
 */

/** Navigation for the portfolio shell, shared by the project-manager workspace. */
const portfolioNav = (base) => [
  {
    label: 'Portfolio',
    items: [
      { to: base, label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: `${base}/projects`, label: 'My projects', icon: Building2 },
      { to: `${base}/site-updates`, label: 'Site reports', icon: HardHat },
      { to: `${base}/documents`, label: 'Documents', icon: FileText },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: `${base}/assistant`, label: 'Ask BuildSync', icon: MessageSquareText },
      { to: `${base}/insights`, label: 'AI insights', icon: Radar },
      { to: `${base}/reports`, label: 'Reports', icon: FileBarChart, permission: 'generateReports' },
    ],
  },
  {
    label: 'Organisation',
    items: [{ to: `${base}/team`, label: 'Team', icon: Users }],
  },
]

/**
 * Field navigation, in the order a day runs rather than by data model:
 * look at the day, check your work, do it, record it, report what happened.
 * `primary` items are the ones the bottom bar carries on a phone.
 */
const siteManagerNav = (base) => [
  { to: base, label: 'Dashboard', short: 'Today', icon: LayoutGrid, end: true, primary: true },
  { to: `${base}/tasks`, label: 'My tasks', short: 'Tasks', icon: ListChecks, primary: true },
  { to: `${base}/today`, label: "Today's work", short: 'Work', icon: Sun },
  { to: `${base}/progress`, label: 'Progress updates', short: 'Progress', icon: Gauge, primary: true },
  { to: `${base}/photos`, label: 'Site photos', short: 'Photos', icon: Camera, primary: true },
  { to: `${base}/materials`, label: 'Materials', short: 'Materials', icon: Package },
  { to: `${base}/issues`, label: 'Issues', short: 'Issues', icon: AlertTriangle },
  { to: `${base}/reports`, label: 'Daily reports', short: 'Reports', icon: ClipboardList },
  { to: `${base}/documents`, label: 'Documents', short: 'Docs', icon: FileText },
]

/**
 * A contractor's version of the same shell: their assigned work, what they
 * need to record against it, and nothing about running the site. No daily
 * report and no headcount — those belong to whoever runs the site.
 */
const contractorNav = (base) => [
  { to: base, label: 'Dashboard', short: 'Today', icon: LayoutGrid, end: true, primary: true },
  { to: `${base}/tasks`, label: 'My tasks', short: 'Tasks', icon: ListChecks, primary: true },
  { to: `${base}/progress`, label: 'Work progress', short: 'Progress', icon: Gauge, primary: true },
  { to: `${base}/photos`, label: 'Photos', short: 'Photos', icon: Camera, primary: true },
  { to: `${base}/materials`, label: 'Materials', short: 'Materials', icon: Package },
  { to: `${base}/issues`, label: 'Issues', short: 'Issues', icon: AlertTriangle },
  { to: `${base}/documents`, label: 'Site instructions', short: 'Docs', icon: FileText },
]

const adminNav = (base) => [
  {
    label: 'Control centre',
    items: [{ to: base, label: 'Overview', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Records',
    items: [
      { to: `${base}/projects`, label: 'Projects', icon: Building2 },
      { to: `${base}/users`, label: 'Users', icon: Users },
      { to: `${base}/tasks`, label: 'Tasks', icon: ListChecks },
      { to: `${base}/materials`, label: 'Materials', icon: Boxes },
      { to: `${base}/expenses`, label: 'Expenses', icon: Receipt },
      { to: `${base}/documents`, label: 'Documents', icon: FileText },
      { to: `${base}/site-updates`, label: 'Site updates', icon: HardHat },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: `${base}/ai`, label: 'AI intelligence', icon: Radar },
      { to: `${base}/reports`, label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'System',
    items: [
      { to: `${base}/activity`, label: 'Activity logs', icon: ClipboardList },
      { to: `${base}/settings`, label: 'Settings', icon: Settings },
    ],
  },
]

export const WORKSPACES = {
  admin: {
    slug: 'admin',
    role: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    shell: 'admin',
    base: '/admin',
    loginTitle: 'Admin Login',
    loginSubtitle: 'Access the BuildSync administration workspace.',
    description:
      'Manage the entire BuildSync platform, users, projects, system activity and organization-wide operations.',
    nav: adminNav,
  },
  'project-manager': {
    slug: 'project-manager',
    role: 'project_manager',
    label: 'Project Manager',
    icon: Briefcase,
    shell: 'portfolio',
    base: '/project-manager',
    loginTitle: 'Project Manager Login',
    loginSubtitle: 'Access your project management workspace.',
    description:
      'Manage projects, tasks, milestones, budgets, teams, materials, reports and project intelligence.',
    nav: portfolioNav,
  },
  'site-manager': {
    slug: 'site-manager',
    role: 'site_engineer',
    label: 'Site Manager',
    icon: HardHat,
    shell: 'field',
    base: '/site-manager',
    loginTitle: 'Site Manager Login',
    loginSubtitle: 'Access your site operations workspace.',
    description:
      'Manage daily site operations, progress updates, site reports, materials, workers and construction issues.',
    nav: siteManagerNav,
  },
  contractor: {
    slug: 'contractor',
    role: 'contractor',
    label: 'Contractor',
    icon: Package,
    shell: 'field',
    base: '/contractor',
    loginTitle: 'Contractor Login',
    loginSubtitle: 'Access your assigned work workspace.',
    description:
      'Manage assigned work, update progress, submit completed work, report issues and request materials.',
    nav: contractorNav,
  },
}

export const WORKSPACE_ORDER = ['admin', 'project-manager', 'site-manager', 'contractor']

export const WORKSPACE_LIST = WORKSPACE_ORDER.map((slug) => WORKSPACES[slug])

const BY_ROLE = Object.fromEntries(
  WORKSPACE_ORDER.map((slug) => [WORKSPACES[slug].role, WORKSPACES[slug]]),
)

/** The workspace a stored role name belongs to. */
export const workspaceForRole = (role) => BY_ROLE[role] || null

/** The workspace a URL slug names. */
export const workspaceForSlug = (slug) => WORKSPACES[slug] || null

/** Where a role lands after signing in. */
export const homeForRole = (role) => BY_ROLE[role]?.base || '/login'

/** The workspaces an account may open, in presentation order. */
export const workspacesFor = (roles = []) =>
  WORKSPACE_ORDER.map((slug) => WORKSPACES[slug]).filter((w) => roles.includes(w.role))

/** Build a path inside a workspace: `wsPath('/contractor', 'tasks')`. */
export const wsPath = (base, path = '') =>
  path ? `${base}/${String(path).replace(/^\//, '')}` : base
