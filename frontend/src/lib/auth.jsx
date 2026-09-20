import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { api, setUnauthorisedHandler, tokenStore } from './api'

const AuthContext = createContext(null)

/** What each role may do. The UI reads this rather than checking role strings. */
const PERMISSIONS = {
  admin: {
    manageProjects: true, manageTasks: true, manageMaterials: true,
    manageExpenses: true, uploadDocuments: true, fileSiteUpdates: true,
    generateReports: true, manageUsers: true,
  },
  project_manager: {
    manageProjects: true, manageTasks: true, manageMaterials: true,
    manageExpenses: true, uploadDocuments: true, fileSiteUpdates: true,
    generateReports: true, manageUsers: false,
  },
  site_engineer: {
    manageProjects: false, manageTasks: true, manageMaterials: true,
    manageExpenses: false, uploadDocuments: true, fileSiteUpdates: true,
    generateReports: false, manageUsers: false,
  },
  contractor: {
    manageProjects: false, manageTasks: true, manageMaterials: false,
    manageExpenses: false, uploadDocuments: false, fileSiteUpdates: false,
    generateReports: false, manageUsers: false,
  },
}

export const ROLE_LABELS = {
  admin: 'Administrator',
  project_manager: 'Project manager',
  site_engineer: 'Site engineer',
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
      roleLabel: ROLE_LABELS[user?.role] || '',
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
