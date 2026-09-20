import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp, Building2, Cpu, Eraser, Loader2, Sparkles,
} from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { useChartTheme } from '@/charts/useChartTheme'
import { prefersReducedMotion } from '@/animations'
import { Markdown } from '@/components/Markdown'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { LogoMark } from '@/components/Logo'

const TONE = {
  healthy: 'border-healthy/25 bg-healthy-wash text-healthy',
  warning: 'border-amber/35 bg-amber-wash text-amber-deep',
  critical: 'border-critical/25 bg-critical-wash text-critical',
  info: 'border-line bg-raised text-ink',
}

export default function Assistant() {
  const { user } = useAuth()
  const toast = useToast()
  const { data: config } = useAsync(() => api.ai.suggestions(), [])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  const ask = useCallback(
    async (question) => {
      const text = question.trim()
      if (!text || thinking) return

      setMessages((current) => [...current, { role: 'user', content: text, id: `u-${Date.now()}` }])
      setDraft('')
      setThinking(true)

      try {
        const reply = await api.ai.ask(text)
        setMessages((current) => [
          ...current,
          { role: 'assistant', id: `a-${Date.now()}`, ...reply },
        ])
      } catch (err) {
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            id: `e-${Date.now()}`,
            answer: `I could not answer that one. ${err.message}`,
            cards: [],
            chart: null,
            sources: [],
            failed: true,
          },
        ])
      } finally {
        setThinking(false)
        inputRef.current?.focus()
      }
    },
    [thinking],
  )

  const clear = async () => {
    setMessages([])
    try {
      await api.ai.clearHistory()
    } catch {
      /* the local thread is already cleared */
    }
    toast.info('Conversation cleared')
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <LogoMark size={34} />
          <div>
            <h1 className="font-display text-h3 text-ink">Ask BuildSync</h1>
            <p className="text-tiny text-muted">
              Your construction intelligence copilot
              {config?.hosted_model ? ` · answering through ${config.engine}` : ' · answering from your own records'}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <Eraser size={13} />
            Clear conversation
          </Button>
        )}
      </header>

      {/* Thread */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-panel border border-line bg-surface"
      >
        {messages.length === 0 ? (
          <Welcome prompts={config?.prompts} onPick={ask} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            {messages.map((message) =>
              message.role === 'user' ? (
                <UserMessage key={message.id} message={message} user={user} />
              ) : (
                <AssistantMessage key={message.id} message={message} />
              ),
            )}
            {thinking && <Thinking />}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          ask(draft)
        }}
        className="mt-3 shrink-0"
      >
        <div className="flex items-end gap-2 rounded-panel border border-line bg-surface p-2 transition-colors focus-within:border-line-strong">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                ask(draft)
              }
            }}
            rows={1}
            placeholder="Ask about a project, a budget, a material or a delay…"
            aria-label="Ask BuildSync a question"
            className="max-h-32 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-body text-ink placeholder:text-subtle focus:outline-none"
          />
          <Button
            type="submit"
            variant="primary"
            size="icon"
            disabled={!draft.trim() || thinking}
            aria-label="Send question"
          >
            {thinking ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={15} />}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-micro text-subtle">
          Every answer is computed from your projects, tasks, materials and expenses. Figures are never invented.
        </p>
      </form>
    </div>
  )
}

function Welcome({ prompts, onPick }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 py-10 text-center">
      <LogoMark size={40} />
      <h2 className="mt-5 font-display text-h2 text-ink">What do you want to know?</h2>
      <p className="mt-2.5 max-w-md text-lead text-muted">
        Ask in plain language. The answer comes back with the numbers behind it and the
        projects it was read from.
      </p>

      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {(prompts || []).map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className={cn(
              'group flex items-center gap-2.5 rounded-control border border-line bg-surface px-3.5 py-3 text-left',
              'transition-colors duration-150 hover:border-line-strong hover:bg-raised',
            )}
          >
            <Sparkles size={13} className="shrink-0 text-subtle transition-colors group-hover:text-amber-deep" />
            <span className="text-base text-ink">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function UserMessage({ message, user }) {
  return (
    <div className="flex justify-end gap-3">
      <div className="max-w-[80%] rounded-panel rounded-br-sm border border-line bg-raised px-4 py-2.5">
        <p className="text-body leading-relaxed text-ink">{message.content}</p>
      </div>
      <Avatar name={user?.name} initials={user?.avatar_initials} size="md" />
    </div>
  )
}

/**
 * Replies arrive whole from the API, so the reveal is the interface telling
 * the truth about pace rather than faking a token stream: the text is written
 * out quickly, then the cards and chart settle in underneath it.
 */
function AssistantMessage({ message }) {
  const [revealed, setRevealed] = useState(() =>
    prefersReducedMotion() ? message.answer.length : 0,
  )
  const done = revealed >= message.answer.length

  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    let frame
    let last = performance.now()
    let count = 0
    const CHARS_PER_SECOND = 900

    const step = (now) => {
      count += ((now - last) / 1000) * CHARS_PER_SECOND
      last = now
      setRevealed(Math.min(message.answer.length, Math.floor(count)))
      if (count < message.answer.length) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [message.answer])

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0">
        <LogoMark size={30} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn(message.failed && 'rounded-control border border-critical/25 bg-critical-wash px-3.5 py-3')}>
          <Markdown source={message.answer.slice(0, revealed)} className={message.failed ? '[&_p]:text-critical' : undefined} />
          {!done && <span className="ml-0.5 inline-block h-4 w-[2px] animate-caret-blink bg-ink align-middle" />}
        </div>

        {done && message.cards?.length > 0 && (
          <div className="mt-3.5 grid gap-2 sm:grid-cols-3">
            {message.cards.map((card) => (
              <div
                key={card.label}
                className={cn('rounded-control border px-3.5 py-2.5', TONE[card.tone] || TONE.info)}
              >
                <p className="text-micro opacity-80">{card.label}</p>
                <p className="mt-0.5 font-display text-[1.0625rem] font-semibold tabular">{card.value}</p>
                <p className="mt-0.5 text-micro opacity-75">{card.caption}</p>
              </div>
            ))}
          </div>
        )}

        {done && message.chart?.data?.length > 0 && <ReplyChart chart={message.chart} />}

        {done && message.sources?.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-micro text-subtle">
              <Building2 size={11} />
              Read from
            </span>
            {message.sources.slice(0, 6).map((source) => (
              <span
                key={source}
                className="rounded-pill border border-line bg-raised px-2 py-0.5 text-micro text-muted"
              >
                {source}
              </span>
            ))}
            {message.sources.length > 6 && (
              <span className="text-micro text-subtle">+{message.sources.length - 6} more</span>
            )}
            {message.engine && message.engine !== 'local' && (
              <span className="ml-1 flex items-center gap-1 text-micro text-subtle">
                <Cpu size={11} />
                {message.engine}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * In a planned-against-actual chart the plan is the benchmark and the actual
 * carries the verdict, so colour follows that role. Colouring both by their
 * absolute value would say nothing — 59% is neither good nor bad on its own.
 */
function barColour(row, data, theme) {
  if (row.name === 'Planned') return theme.amber
  if (row.name === 'Actual') {
    const planned = data.find((entry) => entry.name === 'Planned')?.value
    if (planned === undefined) return theme.ink
    const variance = row.value - planned
    return variance <= -12 ? theme.critical : variance < -4 ? theme.amber : theme.healthy
  }
  // A cross-project comparison: colour by how complete each one is.
  return row.value < 30 ? theme.critical : row.value < 60 ? theme.amber : theme.healthy
}

function ReplyChart({ chart }) {
  const theme = useChartTheme()
  const height = Math.max(140, chart.data.length * 30 + 30)

  return (
    <div className="mt-3.5 rounded-panel border border-line bg-raised/40 p-3">
      <p className="mb-2 px-1 text-tiny font-medium text-muted">{chart.title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chart.data} layout="vertical" margin={{ top: 0, right: 34, left: 0, bottom: 0 }}>
          <XAxis type="number" hide domain={[0, 100]} />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tickLine={false}
            axisLine={false}
            tick={{ fill: theme.muted, fontSize: 11 }}
          />
          <Tooltip {...theme.tooltip} formatter={(value) => [`${value}%`, 'Value']} cursor={{ fill: theme.alpha('ink', 0.04) }} />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={13} animationDuration={500} label={{ position: 'right', fill: theme.muted, fontSize: 11, formatter: (value) => `${value}%` }}>
            {chart.data.map((row) => (
              <Cell key={row.name} fill={barColour(row, chart.data, theme)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Thinking() {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0">
        <LogoMark size={30} />
      </span>
      <div className="flex items-center gap-2 pt-2">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-line-strong"
            style={{ animation: `thinking 1.1s ${index * 0.16}s infinite ease-in-out` }}
          />
        ))}
        <span className="ml-1 text-tiny text-subtle">Reading your projects…</span>
        <style>{`@keyframes thinking { 0%,100% { opacity:.3; transform:translateY(0) } 50% { opacity:1; transform:translateY(-3px) } }`}</style>
      </div>
    </div>
  )
}
