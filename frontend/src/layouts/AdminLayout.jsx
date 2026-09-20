import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { CommandPalette, useCommandPalette } from '@/components/CommandPalette'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopbar } from './AdminTopbar'

/**
 * The admin shell. Access is settled by `RequireWorkspace` above this in the
 * route tree, so this component is only ever mounted for an admin and does
 * not check again.
 */
export function AdminLayout() {
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const palette = useCommandPalette()

  useEffect(() => {
    setMobileNavOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-paper">
      <AdminSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-h-screen flex-col lg:pl-[244px]">
        <AdminTopbar onMenu={() => setMobileNavOpen(true)} onSearch={() => palette.setOpen(true)} />
        {/* min-w-0 is what stops a wide table pushing the page sideways. */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto w-full min-w-0 max-w-[1500px]">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette open={palette.open} onClose={palette.close} />
    </div>
  )
}
