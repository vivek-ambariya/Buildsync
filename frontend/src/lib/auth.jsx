import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { api, setUnauthorisedHandler, tokenStore } from './api'

const AuthContext = createContext(null)

/**
 * What each role may do, mirrored from the API's matrix in
 * `app/core/permissions.py`.
 *
 * Kept deliberately in step with the server: a flag that is true here while
 * the API refuses the call means the interface offers a button that fails,
 * which is worse than not offering it. Hence the split between *managing* a
 * record (creating and deleting it) and *updating* one that already exists —
 * a site engineer keeps stock levels current but does not add or remove
 * material lines, and a contractor moves their own task along without being
 * able to create, reassign or delete one.
 */
const PERMISSIONS = {
  admin: {
    manageProjects: true, manageTasks: true, updateTasks: true,
    manageMaterials: true, updateMaterials: true,
    manageExpenses: true, submitExpenses: true,
    uploadDocuments: true, fileSiteUpdates: true,
    generateReports: true, manageUsers: true,
    uploadSitePhotos: true, reportIssues: true, requestMaterials: true,
    recordWorkforce: true, resolveIssues: true,
  },
  project_manager: {
    manageProjects: true, manageTasks: true, updateTasks: true,
    manageMaterials: true, updateMaterials: true,
    manageExpenses: true, submitExpenses: true,
    uploadDocuments: true, fileSiteUpdates: true,
    generateReports: true, manageUsers: false,
    uploadSitePhotos: true, reportIssues: true, requestMaterials: true,
    recordWorkforce: true, resolveIssues: true,
  },
  site_engineer: {
    manageProjects: false, manageTasks: false, updateTasks: true,
    manageMaterials: false, updateMaterials: true,
    manageExpenses: false, submitExpenses: true,
    uploadDocuments: true, fileSiteUpdates: true,
    generateReports: false, manageUsers: false,
    // Site operations: recording the day, not running the business.
    uploadSitePhotos: true, reportIssues: true, requestMaterials: true,
    recordWorkforce: true, resolveIssues: false,
  },
  contractor: {
    manageProjects: false, manageTasks: false, updateTasks: true,
    manageMaterials: false, updateMaterials: false,
    manageExpenses: false, submitExpenses: false,
    uploadDocuments: false, fileSiteUpdates: true,
    generateReports: false, manageUsers: false,
    uploadSitePhotos: true, reportIssues: true, requestMaterials: false,
    recordWorkforce: false, resolveIssues: false,
  },
}

/**
 * Where a role's work actually lives.
 *
 * A site manager runs the day from a phone on site, so they land in the field
 * app rather than in the portfolio dashboard. Everyone else starts where the
 * portfolio does. Sign-in, the logo and every "back to the start" path read
 * this rather than hardcoding /app.
 */
const ROLE_HOME = {
  site_engineer: '/site',
  contractor: '/site',
}

export const homeFor = (role) => ROLE_HOME[role] || '/app'

/** True for the roles whose primary surface is the field app. */
export const isFieldRole = (role) => Boolean(ROLE_HOME[role])

export const ROLE_LABELS = {
  admin: 'Administrator',
  project_manager: 'Project manager',
  site_engineer: 'Site manager',
  contractor: 'Contractor',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading') // loading | authenticated | anonymous

  const signOut = useCallback(() => {
    tokenStore.set(null)
    setUser(null)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    setUnauthorisedHandler(signOut)
  }, [signOut])

  useEffect(() => {
    if (!tokenStore.get()) {
      setStatus('anonymous')
      return
    }
    api.auth
      .me()
      .then((me) => {
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        tokenStore.set(null)
        setStatus('anonymous')
      })
  }, [])

  const signIn = useCallback(async (email, password) => {
    const result = await api.auth.login(email, password)
    tokenStore.set(result.access_token)
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }, [])

  const value = useMemo(
    () => ({
      user,
      status,
      signIn,
      signOut,
      can: (permission) => Boolean(PERMISSIONS[user?.role]?.[permission]),
      /**
       * Whether the signed-in person holds an API permission.
       *
       * The list comes from the server with the session, so the interface and
       * the API agree on one matrix instead of drifting apart. It decides what
       * to *offer*; the server still decides what is *allowed*.
       */
      has: (permission) => Boolean(user?.permissions?.includes(permission)),
      permissions: user?.permissions || [],
      isAdmin: user?.role === 'admin',
      roleLabel: ROLE_LABELS[user?.role] || '',
      home: homeFor(user?.role),
      isField: isFieldRole(user?.role),
    }),
    [user, status, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
