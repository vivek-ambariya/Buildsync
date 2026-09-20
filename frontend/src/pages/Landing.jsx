import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowRight, FileSearch, Hammer, MessageSquareText, Moon,
  Package, Radar, Sun, Wallet,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { useLenis } from '@/lib/useLenis'
import { useTheme } from '@/lib/theme'
import { prefersReducedMotion } from '@/animations'
import { LogoLink } from '@/components/LogoLink'
import { Button, ButtonLink } from '@/components/ui/Button'
import { BuildSequence } from '@/features/landing/BuildSequence'
import { Pipeline } from '@/features/landing/Pipeline'
import { ProductPreview } from '@/features/landing/ProductPreview'
import { ScatteredData } from '@/features/landing/ScatteredData'
import { HeroScene } from '@/features/landing/HeroScene'
import { ScrollRail } from '@/features/landing/ScrollRail'
import { StatsBand } from '@/features/landing/StatsBand'
import { gsap, parallax, wipeIn } from '@/features/landing/scroll'

const FEATURES = [
  {
    icon: Radar,
    title: 'Risk detection',
    body: 'Every project scored on schedule variance, cost performance and stock cover. Findings ranked by what they will actually cost you, not by when they were raised.',
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
    body: 'Consumption measured against supplier lead time, so a reorder date arrives before the site runs dry rather than after.',
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

const CHAPTERS = [
  { selector: '#hero', label: 'BuildSync AI' },
  { selector: '#problem', label: 'The problem' },
  { selector: '#sequence', label: 'A project, built' },
  { selector: '#pipeline', label: 'How it works' },
  { selector: '#preview', label: 'The product' },
  { selector: '#features', label: 'What it does' },
  { selector: '#enter', label: 'Enter' },
]


export default function Landing() {
  const { status, home } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const root = useRef(null)

  useLenis(true)

  useEffect(() => {
    document.title = 'BuildSync AI — Construction data, intelligent decisions'
  }, [])

  useLayoutEffect(() => {
    const scope = root.current
    if (!scope) return undefined

    const context = gsap.context(() => {
      // One orchestrated entrance. After this the page hands motion to scroll.
      if (!prefersReducedMotion()) {
        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
        intro
          .from('[data-hero]', { opacity: 0, y: 18, duration: 0.7, stagger: 0.075 }, 0.1)
          .from('[data-hero-panel]', { opacity: 0, y: 28, duration: 0.85 }, 0.35)
          .from('[data-hero-row]', { opacity: 0, x: -12, duration: 0.5, stagger: 0.06 }, 0.6)
      }

      // Hero exit: three depths leaving at three speeds.
      parallax('[data-hero-copy]', { distance: -70, trigger: '#hero', start: 'top top', end: 'bottom top' })
      parallax('[data-hero-panel]', { distance: -150, trigger: '#hero', start: 'top top', end: 'bottom top' })
      parallax('[data-hero-grid]', { distance: 90, trigger: '#hero', start: 'top top', end: 'bottom top' })

      if (!prefersReducedMotion()) {
        // The scroll cue retires once the visitor has taken the hint.
        gsap.to('[data-scroll-cue]', {
          opacity: 0,
          y: 12,
          ease: 'none',
          scrollTrigger: { trigger: '#hero', start: 'top top', end: '18% top', scrub: 0.4 },
        })

        // Features: the cards rise as the grid is scrolled through, and the
        // rule draws across the heading.
        gsap.fromTo(
          '[data-feature]',
          { opacity: 0, y: 34 },
          {
            opacity: 1,
            y: 0,
            ease: 'power2.out',
            stagger: 0.12,
            duration: 1,
            scrollTrigger: { trigger: '#features', start: 'top 78%', end: 'center 60%', scrub: 0.6 },
          },
        )
        gsap.fromTo(
          '[data-feature-rule]',
          { scaleX: 0 },
          {
            scaleX: 1,
            transformOrigin: 'left center',
            ease: 'none',
            scrollTrigger: { trigger: '#features', start: 'top 85%', end: 'top 45%', scrub: 0.5 },
          },
        )

        // Closing statement: the two lines arrive from opposite sides.
        gsap.fromTo(
          '[data-cta-line="1"]',
          { x: -46, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: '#enter', start: 'top 85%', end: 'center 65%', scrub: 0.7 },
          },
        )
        gsap.fromTo(
          '[data-cta-line="2"]',
          { x: 46, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: '#enter', start: 'top 85%', end: 'center 65%', scrub: 0.7 },
          },
        )
        parallax('[data-cta-grid]', { distance: 70, trigger: '#enter' })
      }

      wipeIn(gsap.utils.toArray('[data-wipe]', scope), { trigger: '#features' })
    }, root)

    return () => context.revert()
  }, [])

  // Signing in starts with choosing a workspace, so every call to action
  // here leads to that screen rather than straight to a password field.
  const openLogin = () => navigate('/login')

  return (
    <div ref={root} className="bg-paper">
      <ScrollRail chapters={CHAPTERS} />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-6 lg:px-10">
          <LogoLink size={26} />
          <nav className="ml-6 hidden items-center gap-6 lg:flex">
            {[
              ['The problem', '#problem'],
              ['How it works', '#pipeline'],
              ['The product', '#preview'],
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
              <ButtonLink to={home} variant="primary">
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
      <section id="hero" className="relative overflow-hidden">
        <div data-hero-grid className="survey-grid absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-[1400px] items-center gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:px-10 lg:py-24">
          <div data-hero-copy>
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
                href="#problem"
                className="inline-flex h-11 items-center gap-2 rounded-control border border-line bg-surface px-5 text-body font-medium text-ink transition-colors hover:border-line-strong hover:bg-raised"
              >
                See how it works
              </a>
            </div>

            <div data-scroll-cue className="mt-12 flex items-center gap-2.5 text-tiny text-subtle">
              <ArrowDown size={13} className="animate-bounce" style={{ animationDuration: '2.2s' }} />
              Scroll — the page builds as you go
            </div>
          </div>

          {/* Two acts on a loop: the site, then the room where that day's
              work becomes a decision. */}
          <div data-hero-panel>
            <HeroScene />
          </div>
        </div>
      </section>

      <ScatteredData />

      <div id="sequence">
        <BuildSequence />
      </div>

      <Pipeline />

      <div id="preview">
        <ProductPreview />
      </div>

      {/* Features */}
      <section id="features" className="border-t border-line py-20 lg:py-28">
        <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-tiny font-medium text-muted" data-wipe>
              What it does
            </p>
            <h2 className="mt-3 font-display text-h1 leading-[1.08] text-ink">
              <span className="block" data-wipe>
                Six things, each of which
              </span>
              <span className="block" data-wipe>
                earns its place on the sidebar.
              </span>
            </h2>
          </div>

          <div className="mt-8 h-px w-full bg-line">
            <div data-feature-rule className="h-px origin-left bg-amber" style={{ transform: 'scaleX(0)' }} aria-hidden />
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} data-feature className="bg-surface p-6">
                <feature.icon size={18} className="text-amber-deep" strokeWidth={1.9} />
                <h3 className="mt-4 font-display text-h4 text-ink">{feature.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <StatsBand />

      {/* Final CTA */}
      <section id="enter" className="relative overflow-hidden border-t border-line bg-surface">
        <div data-cta-grid className="survey-grid absolute inset-0" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20 text-center lg:px-10 lg:py-28">
          <h2 className="mx-auto max-w-2xl font-display text-display leading-[0.98] text-ink">
            <span className="block" data-cta-line="1">
              Build smarter.
            </span>
            <span className="block" data-cta-line="2">
              Decide faster.
            </span>
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
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <LogoLink size={22} />
          <p className="text-tiny text-subtle">
            Built for the B.Tech Hackathon 2026 — Smart Construction Data Management.
          </p>
        </div>
      </footer>

    </div>
  )
}
