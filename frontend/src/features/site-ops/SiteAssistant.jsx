import { useEffect, useRef, useState } from 'react'
import { Loader2, MessageSquareText, Send, Sparkles } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Markdown } from '@/components/Markdown'
import { Sheet } from './Sheet'
import { useSite } from './SiteContext'

/**
 * The assistant, kept deliberately small.
 *
 * On site the useful questions are lookups, not analysis — what is due, what
 * is running out, what is still open — so the four prompts that answer them
 * are one tap each and the typing field sits underneath as the exception
 * rather than the entry point. It is scoped to the current site, so "what
 * materials are low" never needs the person to say which job they mean.
 *
 * It does not offer to change anything. Advice a site manager acts on becomes
 * a progress update or an issue, and both of those have their own workflow
 * with a record at the end of it.
 */
const PROMPTS = [
  'What tasks are due today?',
  'Which materials are low?',
  "Summarise today's work.",
  'What issues are currently open?',
]

export function SiteAssistant({ open, onClose }) {
  const { projectId, project } = useSite()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    if (open) setMessages([])
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, pending])

  const ask = async (question) => {
    const text = (question || input).trim()
    if (!text || pending) return
    setInput('')
    setMessages((current) => [...current, { role: 'user', text }])
    setPending(true)
    try {
      const reply = await api.ai.ask(text, projectId || undefined)
      setMessages((current) => [...current, { role: 'assistant', text: reply.answer || reply.message || '' }])
    } catch (err) {
      setMessages((current) => [...current, { role: 'error', text: err.message }])
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Ask BuildSync"
      description={project ? `Answering about ${project.name}` : undefined}
      footer={
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            ask()
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this site…"
            className="input h-12 flex-1 text-base"
            aria-label="Ask a question"
          />
          <button
            type="submit"
            disabled={!input.trim() || pending}
            aria-label="Send"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-ink text-paper transition-opacity active:opacity-85 disabled:opacity-35"
          >
            {pending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      }
    >
      {messages.length === 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2 text-muted">
            <Sparkles size={15} className="text-amber-deep" />
            <p className="text-base">Ask about what is happening on this site today.</p>
          </div>
          <ul className="space-y-2">
            {PROMPTS.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  onClick={() => ask(prompt)}
                  className="tap flex w-full items-center gap-2.5 rounded-control border border-line px-3.5 text-left text-base text-ink active:bg-raised"
                >
                  <MessageSquareText size={16} className="shrink-0 text-subtle" />
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {messages.length > 0 && (
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                'rounded-panel px-3.5 py-3 text-base leading-relaxed',
                message.role === 'user'
                  ? 'ml-6 bg-ink text-paper'
                  : message.role === 'error'
                    ? 'border border-critical/25 bg-critical-wash text-critical'
                    : 'mr-2 border border-line bg-raised text-ink',
              )}
            >
              {message.role === 'assistant' ? <Markdown source={message.text} /> : message.text}
            </div>
          ))}
          {pending && (
            <div className="mr-2 flex items-center gap-2 rounded-panel border border-line bg-raised px-3.5 py-3 text-base text-muted">
              <Loader2 size={15} className="animate-spin" />
              Reading the site record…
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}
    </Sheet>
  )
}

/** The entry point: a quiet strip, not a floating button competing with the nav. */
export function AssistantLauncher({ className }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'tap flex w-full items-center gap-2.5 rounded-panel border border-line bg-surface px-4 text-left',
          'text-base text-muted transition-colors active:bg-raised',
          className,
        )}
      >
        <Sparkles size={17} className="shrink-0 text-amber-deep" />
        <span className="flex-1">Ask about this site</span>
        <span className="text-micro text-subtle">AI</span>
      </button>
      <SiteAssistant open={open} onClose={() => setOpen(false)} />
    </>
  )
}
