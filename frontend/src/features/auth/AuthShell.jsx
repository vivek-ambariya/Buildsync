import { Link } from 'react-router-dom'

import { Logo } from '@/components/Logo'

/**
 * The page around the sign-in card.
 *
 * Both doors share it so that moving between them is a change of one word in
 * the header and nothing else — the mark stays put, the card stays put, and
 * only the form underneath changes.
 */
export function AuthShell({ aside, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper survey-grid">
      <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-6 sm:px-10">
        <Link to="/" className="inline-flex">
          <Logo size={28} />
        </Link>
        {/* On a phone the mark and this line fight for the same row, and the
            card's own footer already offers the other door — so it goes. */}
        <span className="hidden sm:inline">{aside}</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 sm:px-10">
        {children}
      </main>
    </div>
  )
}
