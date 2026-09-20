import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import {
  ArrowRight, FileSearch, Hammer, MessageSquareText, Moon, Package,
  Radar, Sun, Wallet,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { useLenis } from '@/lib/useLenis'
import { useTheme } from '@/lib/theme'
import { useScrollReveal } from '@/animations/useMotion'
import { prefersReducedMotion } from '@/animations'
import { Logo } from '@/components/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { BuildSequence } from '@/features/landing/BuildSequence'
import { LoginModal } from '@/features/landing/LoginModal'

const SCATTERED = [
  { source: 'Excel trackers', detail: 'Three versions, none of them current' },
  { source: 'WhatsApp groups', detail: 'Today’s pour confirmed in a voice note' },
  { source: 'Printed BOQs', detail: 'Revision 3 in a drawer at the site office' },
  { source: 'Vendor invoices', detail: 'Emailed to whoever raised the order' },
  { source: 'Site diaries', detail: 'Handwritten, collected at month end' },
  { source: 'Drawing folders', detail: 'Latest revision unclear until someone asks' },
]

const FEATURES = [
  {
    icon: Radar,
    title: 'Risk detection',
    body: 'Every project is scored on schedule variance, cost performance and stock cover. Findings are ranked by what they will actually cost you, not by when they were raised.',
  },
  {
    icon: FileSearch,
    title: 'Document intelligence',
    body: 'Upload a BOQ or an invoice and the quantities, rates, vendors and totals come out as structured rows you can query.',
  },
  {
    icon: Hammer,
    title: 'Progress tracking',
    body: 'Daily site reports build the actual curve. Compare it against the contract programme and the rate of build becomes a forecast.',
  },
  {
    icon: Package,
    title: 'Material management',
    body: 'Consumption is measured against supplier lead time, so a reorder date arrives before the site runs dry, not after.',
  },
  {
    icon: Wallet,
    title: 'Budget analytics',
    body: 'Earned value against committed spend, by category and by vendor, with a forecast at completion for every project.',
  },
  {
    icon: MessageSquareText,
    title: 'Ask it anything',
    body: 'A copilot grounded in your own records. Ask why a tower is behind and it answers with the numbers, not a guess.',
  },
]

export default function Landing() {
  const { status } = useAuth()
  const { theme, toggle } = useTheme()
  const [loginOpen, setLoginOpen] = useState(false)
  const hero = useRef(null)
  const reveal = useScrollReveal([])

  useLenis(true)

  // One orchestrated entrance, then the page hands motion over to scroll.
  useLayoutEffect(() => {
    if (!hero.current || prefersReducedMotion()) return undefined
    const context = gsap.context(() => {
      gsap.from('[data-hero]', {
        opacity: 0,
        y: 18,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.075,
        delay: 0.1,
      })
      gsap.from('[data-hero-panel]', {
        opacity: 0,
        y: 26,
        duration: 0.85,
        ease: 'power3.out',
        delay: 0.35,
      })
    }, hero)
    return () => context.revert()
  }, [])

  useEffect(() => {
    document.title = 'BuildSync AI — Construction data, intelligent decisions'
  }, [])

  const openLogin = () => setLoginOpen(true)

  return (
    <div ref={reveal} className="bg-paper">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-6 lg:px-10">
          <Logo size={26} />
          <nav className="ml-6 hidden items-center gap-6 lg:flex">
            {[
              ['The problem', '#problem'],
              ['How it works', '#sequence'],
              ['What it does', '#features'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-base text-muted transition-colors hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="rounded-control p-2 text-muted transition-colors hover:bg-raised hover:text-ink"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {status === 'authenticated' ? (
              <ButtonLink to="/app" variant="primary">
                Open dashboard
                <ArrowRight size={15} />
              </ButtonLink>
            ) : (
              <Button variant="primary" onClick={openLogin}>
                Go visit
                <ArrowRight size={15} />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section ref={hero} className="relative overflow-hidden">
        <div className="survey-grid absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-[1400px] items-center gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:px-10 lg:py-24">
          <div>
            <p data-hero className="text-tiny font-medium text-amber-deep">
              Construction data management
            </p>
            <h1 data-hero className="mt-4 font-display text-display text-ink">
              Construction data.
              <br />
              Intelligent decisions.
            </h1>
            <p data-hero className="mt-6 max-w-xl text-lead text-muted">
              Projects, documents, progress, materials, budgets and risk in one command
              centre. Scroll down and watch a building become the data that describes it.
            </p>
            <div data-hero className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" size="lg" onClick={openLogin}>
                Go visit
                <ArrowRight size={16} />
              </Button>
              <a
                href="#sequence"
                className="inline-flex h-11 items-center gap-2 rounded-control border border-line bg-surface px-5 text-body font-medium text-ink transition-colors hover:border-line-strong hover:bg-raised"
              >
                See how it works
              </a>
            </div>
            <dl data-hero className="mt-12 grid max-w-lg grid-cols-3 gap-px overflow-hidden rounded-panel border border-line bg-line">
              {[
                ['8', 'live projects'],
                ['₹114 Cr', 'under management'],
                ['37', 'risk findings open'],
              ].map(([value, label]) => (
                <div key={label} className="bg-surface px-4 py-4">
                  <dt className="font-display text-h3 tabular text-ink">{value}</dt>
                  <dd className="mt-0.5 text-micro text-subtle">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* A real reading from the product, not a decorative graphic. */}
          <div data-hero-panel className="rounded-panel border border-line bg-surface shadow-overlay">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <p className="panel-title">Portfolio, this morning</p>
              <span className="flex items-center gap-1.5 text-micro text-muted">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-healthy" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-healthy" />
                </span>
                live
              </span>
            </div>
            <ul className="divide-y divide-line">
              {[
                { name: 'Riverfront Residency C', actual: 91, planned: 86.7, tone: 'healthy' },
                { name: 'Green Valley Residences', actual: 71, planned: 59.4, tone: 'healthy' },
                { name: 'LJ Business Center', actual: 58, planned: 48.1, tone: 'healthy' },
                { name: 'Metro Commercial Hub', actual: 44, planned: 42.8, tone: 'healthy' },
                { name: 'Skyline Tower', actual: 40, planned: 56.6, tone: 'critical' },
                { name: 'Sardar Industrial Park II', actual: 33, planned: 41.3, tone: 'warning' },
              ].map((row) => {
                const variance = row.actual - row.planned
                return (
                  <li key={row.name} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-base text-ink">{row.name}</span>
                      <span className="shrink-0 text-base tabular text-ink">{row.actual}%</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-pill bg-line">
                        <div
                          className={cn(
                            'h-full rounded-pill',
                            row.tone === 'critical' ? 'bg-critical' : row.tone === 'warning' ? 'bg-amber' : 'bg-healthy',
                          )}
                          style={{ width: `${row.actual}%` }}
                        />
                        <span
                          className="absolute top-0 h-full w-px bg-ink/45"
                          style={{ left: `${row.planned}%` }}
                          aria-hidden
                        />
                      </div>
                      <span
                        className={cn(
                          'w-14 shrink-0 text-right text-micro tabular',
                          variance <= -12 ? 'text-critical' : variance < -4 ? 'text-amber-deep' : 'text-healthy',
                        )}
                      >
                        {variance > 0 ? '+' : ''}{variance.toFixed(1)} pts
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="flex items-start gap-2.5 border-t border-line bg-critical-wash px-5 py-3">
              <Radar size={14} className="mt-0.5 shrink-0 text-critical" />
              <p className="text-tiny leading-relaxed text-critical">
                <span className="font-medium">Skyline Tower is 16.6 points behind plan.</span> At the
                current rate of build, completion lands 308 days past the contract date.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="border-t border-line bg-surface py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div data-reveal className="max-w-2xl">
            <p className="text-tiny font-medium text-muted">The problem</p>
            <h2 className="mt-3 font-display text-h1 leading-[1.08] text-ink">
              A project generates thousands of numbers a week. Almost none of them end up
              anywhere you can use.
            </h2>
            <p className="mt-5 max-w-xl text-lead text-muted">
              Construction data is not missing. It is scattered, and by the time anyone
              collects it into one view, the decision it would have informed has already
              been made.
            </p>
          </div>

          <ul data-reveal className="mt-12 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {SCATTERED.map((item) => (
              <li key={item.source} data-reveal-child className="bg-surface px-5 py-6">
                <p className="font-display text-h4 text-ink">{item.source}</p>
                <p className="mt-1.5 text-base leading-relaxed text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>

          <div data-reveal className="mt-12 flex flex-col gap-4 rounded-panel border border-line bg-raised p-6 sm:flex-row sm:items-center sm:gap-8">
            <p className="font-display text-h3 text-ink sm:shrink-0">One platform instead</p>
            <p className="text-lead text-muted">
              Every record lands in the same place, keyed to the project it belongs to, and
              the intelligence is computed from that single source.
            </p>
          </div>
        </div>
      </section>

      {/* The scroll-scrubbed build */}
      <div id="sequence">
        <BuildSequence />
      </div>

      {/* Features */}
      <section id="features" className="border-t border-line py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div data-reveal className="max-w-2xl">
            <p className="text-tiny font-medium text-muted">What it does</p>
            <h2 className="mt-3 font-display text-h1 leading-[1.08] text-ink">
              Six things, each of which earns its place on the sidebar.
            </h2>
          </div>

          <div data-reveal className="mt-12 grid gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} data-reveal-child className="bg-surface p-6">
                <feature.icon size={18} className="text-amber-deep" strokeWidth={1.9} />
                <h3 className="mt-4 font-display text-h4 text-ink">{feature.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-line bg-surface">
        <div className="relative overflow-hidden">
          <div className="survey-grid absolute inset-0" aria-hidden />
          <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20 text-center lg:px-10 lg:py-28">
            <div data-reveal>
              <h2 className="mx-auto max-w-2xl font-display text-display leading-[0.98] text-ink">
                Build smarter.
                <br />
                Decide faster.
              </h2>
              <p className="mx-auto mt-6 max-w-lg text-lead text-muted">
                Eight live projects are already loaded. Sign in and see the whole portfolio
                the way a project director would.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Button variant="primary" size="lg" onClick={openLogin}>
                  Enter BuildSync
                  <ArrowRight size={16} />
                </Button>
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center rounded-control border border-line bg-surface px-5 text-body font-medium text-ink transition-colors hover:border-line-strong hover:bg-raised"
                >
                  Open the full sign-in page
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <Logo size={22} />
          <p className="text-tiny text-subtle">
            Built for the B.Tech Hackathon 2026 — Smart Construction Data Management.
          </p>
        </div>
      </footer>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  )
}
