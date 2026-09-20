/**
 * Permission names, mirrored from the API's matrix.
 *
 * These drive what the interface offers. They are not what makes an action
 * allowed: the server checks every request again against the role it reads
 * from the database, so hiding a button and refusing a request are separate
 * mechanisms and only the second one is security.
 */
export const PERM = {
  usersView: 'users.view',
  usersCreate: 'users.create',
  usersEdit: 'users.edit',
  usersDelete: 'users.delete',
  usersAssign: 'users.assign',
  rolesManage: 'roles.manage',

  projectsCreate: 'projects.create',
  projectsEdit: 'projects.edit',
  projectsDelete: 'projects.delete',
  projectsAssignManager: 'projects.assign_manager',

  tasksCreate: 'tasks.create',
  tasksEdit: 'tasks.edit',
  tasksDelete: 'tasks.delete',

  materialsCreate: 'materials.create',
  materialsEdit: 'materials.edit',
  materialsDelete: 'materials.delete',

  expensesView: 'expenses.view',
  expensesCreate: 'expenses.create',
  expensesEdit: 'expenses.edit',
  expensesDelete: 'expenses.delete',

  documentsUpload: 'documents.upload',
  documentsDelete: 'documents.delete',

  siteUpdatesEdit: 'site_updates.edit',
  siteUpdatesDelete: 'site_updates.delete',

  reportsView: 'reports.view',
  reportsGenerate: 'reports.generate',
  reportsDelete: 'reports.delete',

  aiRunAnalysis: 'ai.run_analysis',

  systemStats: 'system.stats',
  systemActivityLogs: 'system.activity_logs',
  systemSettings: 'system.settings',
}

export const ROLES = ['admin', 'project_manager', 'site_engineer', 'contractor']

/** How a role is written when it is shown to a person. */
export const ROLE_NAMES = {
  admin: 'Admin',
  project_manager: 'Project manager',
  site_engineer: 'Site engineer',
  contractor: 'Contractor',
}

/** One line on what the role is for, shown beside the role picker. */
export const ROLE_SUMMARY = {
  admin: 'Full access, including people, roles and system settings.',
  project_manager: 'Runs projects end to end: schedule, budget, documents, reports.',
  site_engineer: 'Records site work: reports, stock, task progress, uploads.',
  contractor: 'Their own assigned work, and progress against it.',
}

export const roleName = (role) => ROLE_NAMES[role] || role || '—'
