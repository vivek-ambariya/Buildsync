import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { CommandPalette, useCommandPalette } from '@/components/CommandPalette'
import { Logo } from '@/components/Logo'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout() {
  const { status } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const palette = useCommandPalette()

  useEffect(() => {
    setMobileNavOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  if (status === 'loading') return <BootScreen />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />

  return (
    <div className="min-h-screen bg-paper">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-h-screen flex-col lg:pl-[244px]">
        <Topbar onMenu={() => setMobileNavOpen(true)} onSearch={() => palette.setOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette open={palette.open} onClose={palette.close} />
    </div>
  )
}

function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
      <Logo size={34} showWordmark={false} />
      <p className="text-tiny text-subtle">Loading your portfolio…</p>
    </div>
  )
}
