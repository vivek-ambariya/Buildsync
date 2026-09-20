/**
 * The single place the app talks to the API.
 *
 * Every response error is normalised into an Error carrying a human message,
 * so screens never have to inspect an axios error shape.
 */
import axios from 'axios'

const TOKEN_KEY = 'buildsync-token'

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token) => {
    try {
      token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* private browsing: the session stays in memory only */
    }
  },
}

export const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  timeout: 45_000,
})

client.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let onUnauthorised = null
export const setUnauthorisedHandler = (handler) => {
  onUnauthorised = handler
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const message =
      error.response?.data?.error?.message ||
      (error.code === 'ECONNABORTED'
        ? 'That took too long. Check the API is running and try again.'
        : !error.response
          ? 'Cannot reach the BuildSync API. Start the backend and try again.'
          : 'Something went wrong. Try again in a moment.')

    if (status === 401 && onUnauthorised) onUnauthorised()

    // Keep the technical detail in the console, show the person the sentence.
    // A 401 while checking for an existing session is the normal answer for a
    // visitor who is not signed in, so it is not logged as a failure.
    const expiredSessionCheck = status === 401 && error.config?.url?.endsWith('/auth/me')
    if (!expiredSessionCheck) {
      console.error('[api]', error.config?.method?.toUpperCase(), error.config?.url, error)
    }

    const wrapped = new Error(message)
    wrapped.status = status
    wrapped.fields = error.response?.data?.error?.fields
    return Promise.reject(wrapped)
  },
)

const get = (url, params) => client.get(url, { params }).then((r) => r.data)
const post = (url, body, config) => client.post(url, body, config).then((r) => r.data)
const patch = (url, body) => client.patch(url, body).then((r) => r.data)
const remove = (url) => client.delete(url).then((r) => r.data)

export const api = {
  auth: {
    login: (email, password) => post('/auth/login', { email, password }),
    me: () => get('/auth/me'),
    demoAccounts: () => get('/auth/demo-accounts'),
  },
  users: {
    list: (role) => get('/users', role ? { role } : undefined),
    team: () => get('/users/team'),
  },
  dashboard: {
    get: () => get('/dashboard'),
  },
  projects: {
    list: (params) => get('/projects', params),
    get: (id) => get(`/projects/${id}`),
    create: (body) => post('/projects', body),
    update: (id, body) => patch(`/projects/${id}`, body),
    remove: (id) => remove(`/projects/${id}`),
    timeline: (id) => get(`/projects/${id}/timeline`),
  },
  tasks: {
    list: (params) => get('/tasks', params),
    create: (body) => post('/tasks', body),
    update: (id, body) => patch(`/tasks/${id}`, body),
    remove: (id) => remove(`/tasks/${id}`),
  },
  materials: {
    list: (params) => get('/materials', params),
    create: (body) => post('/materials', body),
    update: (id, body) => patch(`/materials/${id}`, body),
    remove: (id) => remove(`/materials/${id}`),
  },
  expenses: {
    list: (params) => get('/expenses', params),
    analytics: (projectId) => get('/expenses/analytics', projectId ? { project_id: projectId } : undefined),
    create: (body) => post('/expenses', body),
    update: (id, body) => patch(`/expenses/${id}`, body),
    remove: (id) => remove(`/expenses/${id}`),
  },
  documents: {
    list: (params) => get('/documents', params),
    get: (id) => get(`/documents/${id}`),
    upload: (formData, onProgress) =>
      post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100))
        },
      }),
    reprocess: (id) => post(`/documents/${id}/reprocess`),
    remove: (id) => remove(`/documents/${id}`),
    downloadUrl: (id) => `${import.meta.env.VITE_API_URL || ''}/api/documents/${id}/file`,
  },
  siteUpdates: {
    list: (params) => get('/site-updates', params),
    create: (body) => post('/site-updates', body),
    remove: (id) => remove(`/site-updates/${id}`),
  },
  reports: {
    types: () => get('/reports/types'),
    list: () => get('/reports'),
    get: (id) => get(`/reports/${id}`),
    generate: (body) => post('/reports/generate', body),
    remove: (id) => remove(`/reports/${id}`),
  },
  ai: {
    insights: (projectId) => get('/ai/insights', projectId ? { project_id: projectId } : undefined),
    refresh: (projectId) => post(`/ai/insights/refresh${projectId ? `?project_id=${projectId}` : ''}`),
    acknowledge: (id) => post(`/ai/insights/${id}/acknowledge`),
    suggestions: () => get('/ai/assistant/suggestions'),
    ask: (message, projectId) => post('/ai/assistant', { message, project_id: projectId }),
    history: () => get('/ai/assistant/history'),
    clearHistory: () => remove('/ai/assistant/history'),
  },
  /**
   * Site operations. A separate namespace because it is a separate surface:
   * one site, one day, shaped for a phone. `overview` is deliberately one
   * request — a field connection may not survive six sequential ones.
   */
  site: {
    overview: (projectId) => get('/site/overview', projectId ? { project_id: projectId } : undefined),
    tasks: (params) => get('/site/tasks', params),
    updateTask: (id, body) => patch(`/site/tasks/${id}`, body),

    progress: (projectId) => get('/site/progress', projectId ? { project_id: projectId } : undefined),
    recordProgress: (body) => post('/site/progress', body),

    photos: (params) => get('/site/photos', params),
    uploadPhotos: (formData, onProgress) =>
      post('/site/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100))
        },
      }),
    removePhoto: (id) => remove(`/site/photos/${id}`),
    // The gallery reads this straight into <img src>; the API guards it.
    photoUrl: (id) => `${import.meta.env.VITE_API_URL || ''}/api/site/photos/${id}/file`,

    materials: (projectId) => get('/site/materials', projectId ? { project_id: projectId } : undefined),
    recordUsage: (materialId, body) => post(`/site/materials/${materialId}/usage`, body),
    materialRequests: (projectId) =>
      get('/site/material-requests', projectId ? { project_id: projectId } : undefined),
    requestMaterial: (body) => post('/site/material-requests', body),

    workforce: (projectId) => get('/site/workforce', projectId ? { project_id: projectId } : undefined),
    recordWorkforce: (body) => post('/site/workforce', body),

    issues: (params) => get('/site/issues', params),
    reportIssue: (body) => post('/site/issues', body),
    updateIssue: (id, body) => patch(`/site/issues/${id}`, body),

    reports: (projectId) => get('/site/reports', projectId ? { project_id: projectId } : undefined),
    submitReport: (body) => post('/site/reports', body),

    documents: (params) => get('/site/documents', params),
  },
  notifications: {
    list: () => get('/notifications'),
    markRead: (ids, all = false) => post('/notifications/read', { ids, all }),
  },
  search: (q) => get('/search', { q }),
}
