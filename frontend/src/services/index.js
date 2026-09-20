/**
 * The service layer.
 *
 * Screens import a named service rather than reaching for a shared `api`
 * object, so what a screen talks to is visible from its imports alone. Every
 * service is a view onto the one configured axios client in `lib/api.js`:
 * auth headers, error normalisation and the 401 handler are defined once
 * there, and nothing here re-implements them.
 */
import { api, client, tokenStore } from '@/lib/api'

export const authService = api.auth
export const userService = api.users
export const projectService = api.projects
export const taskService = api.tasks
export const materialService = api.materials
export const expenseService = api.expenses
export const documentService = api.documents
export const siteUpdateService = api.siteUpdates
export const reportService = api.reports
export const aiService = api.ai
export const notificationService = api.notifications
export const dashboardService = api.dashboard

/** Everything behind /admin, plus the user administration on /users. */
export const adminService = {
  ...api.admin,
  users: {
    list: api.users.adminList,
    get: api.users.get,
    create: api.users.create,
    update: api.users.update,
    changeRole: api.users.changeRole,
    setStatus: api.users.setStatus,
    resetPassword: api.users.resetPassword,
    assignProjects: api.users.assignProjects,
    remove: api.users.remove,
  },
  projects: api.projects,
  tasks: api.tasks,
  materials: api.materials,
  expenses: api.expenses,
  documents: api.documents,
  siteUpdates: api.siteUpdates,
  reports: api.reports,
}

export { api, client, tokenStore }
