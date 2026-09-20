import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'buildsync-theme'

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || document.documentElement.dataset.theme || 'light'
  } catch {
    return 'light'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(read)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext) || { theme: 'light', toggle: () => {} }
}
