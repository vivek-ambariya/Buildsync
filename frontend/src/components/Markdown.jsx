import { useMemo } from 'react'

import { cn } from '@/lib/cn'

/**
 * A small markdown renderer for assistant replies.
 *
 * The assistant emits a known, narrow subset — one heading, paragraphs, bullet
 * lists, bold and inline code — so parsing it here is a few lines and keeps the
 * output styled with the rest of the interface. A general markdown library
 * would be a larger dependency and would still need overriding everywhere.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g

function renderInline(text, keyPrefix) {
  return text.split(INLINE).map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-raised px-1 py-0.5 text-[0.9em] tabular text-ink">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

function parse(source) {
  const blocks = []
  let list = null

  source.split('\n').forEach((raw) => {
    const line = raw.trimEnd()

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/)

    if (bullet || numbered) {
      const ordered = Boolean(numbered)
      if (!list || list.ordered !== ordered) {
        list = { type: 'list', ordered, items: [] }
        blocks.push(list)
      }
      list.items.push(bullet ? bullet[1] : numbered[2])
      return
    }

    list = null
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
    } else if (line.trim()) {
      blocks.push({ type: 'paragraph', text: line })
    }
  })

  return blocks
}

export function Markdown({ source = '', className }) {
  const blocks = useMemo(() => parse(source), [source])

  return (
    <div className={cn('space-y-2.5', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <h4
              key={index}
              className={cn(
                'font-display text-ink',
                block.level <= 2 ? 'text-h4' : 'text-[0.9375rem] font-semibold',
                index > 0 && 'pt-1.5',
              )}
            >
              {renderInline(block.text, `h${index}`)}
            </h4>
          )
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return (
            <Tag key={index} className="space-y-1.5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2.5 text-body leading-relaxed text-muted">
                  <span
                    className={cn(
                      'shrink-0 select-none',
                      block.ordered ? 'tabular text-subtle' : 'pt-[0.45em] text-line-strong',
                    )}
                    aria-hidden
                  >
                    {block.ordered ? `${itemIndex + 1}.` : '—'}
                  </span>
                  <span className="min-w-0">{renderInline(item, `l${index}-${itemIndex}`)}</span>
                </li>
              ))}
            </Tag>
          )
        }
        return (
          <p key={index} className="text-body leading-relaxed text-muted">
            {renderInline(block.text, `p${index}`)}
          </p>
        )
      })}
    </div>
  )
}
