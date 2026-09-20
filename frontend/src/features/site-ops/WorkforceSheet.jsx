import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'

import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Form'
import { Sheet } from './Sheet'
import { SuccessBurst } from './SuccessBurst'
import { ChipGroup, FieldBlock, Stepper } from './controls'
import { useSite } from './SiteContext'

const SHIFTS = [
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
  { value: 'general', label: 'General' },
]

const blankCrew = () => ({ team: '', trade: '', present: 0, absent: 0, shift: 'day', work_assigned: '' })

/**
 * Headcount, by the unit a site actually counts in.
 *
 * Not "38 workers" but "Sharma Constructions, 12 present, 1 absent, on the
 * north footing" — because that is the row a site manager can answer from
 * memory at the gate, and it is also what makes the number auditable later.
 * The totals underneath are derived, never typed.
 */
export function WorkforceSheet({ open, onClose, existing, onSaved }) {
  const { projectId, project, reload } = useSite()
  const [crews, setCrews] = useState([blankCrew()])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    setCrews(existing?.crews?.length ? existing.crews.map((c) => ({ ...blankCrew(), ...c })) : [blankCrew()])
    setNotes(existing?.notes || '')
    setError(null)
  }, [open, existing])

  const present = crews.reduce((sum, crew) => sum + (Number(crew.present) || 0), 0)
  const absent = crews.reduce((sum, crew) => sum + (Number(crew.absent) || 0), 0)

  const setCrew = (index, patch) =>
    setCrews((current) => current.map((crew, i) => (i === index ? { ...crew, ...patch } : crew)))

  const submit = async (event) => {
    event?.preventDefault?.()
    setError(null)
    const filled = crews.filter((crew) => crew.team.trim())
    if (!filled.length) return setError('Name at least one team or contractor.')

    setSaving(true)
    try {
      await api.site.recordWorkforce({
        project_id: projectId,
        crews: filled.map((crew) => ({
          team: crew.team.trim(),
          trade: crew.trade.trim(),
          present: Number(crew.present) || 0,
          absent: Number(crew.absent) || 0,
          shift: crew.shift,
          work_assigned: crew.work_assigned.trim(),
        })),
        notes: notes.trim(),
      })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
    return undefined
  }

  const finish = () => {
    setDone(false)
    onClose?.()
    reload()
    onSaved?.()
  }

  return (
    <>
      <Sheet
        open={open && !done}
        onClose={onClose}
        title="Workforce today"
        description={project?.name}
        footer={
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <p className="font-display text-h4 font-semibold tabular text-ink">
                {present + absent}
                <span className="ml-1 text-tiny font-normal text-subtle">on the books</span>
              </p>
              <p className="text-micro tabular text-subtle">
                {present} present · {absent} absent
              </p>
            </div>
            <Button variant="accent" size="lg" className="flex-1" loading={saving} onClick={submit}>
              Save headcount
            </Button>
          </div>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          {crews.map((crew, index) => (
            <div key={index} className="rounded-panel border border-line p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <Input
                  value={crew.team}
                  onChange={(event) => setCrew(index, { team: event.target.value })}
                  placeholder="Contractor or team"
                  className="h-12 flex-1 text-base font-medium"
                />
                {crews.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCrews((current) => current.filter((_, i) => i !== index))}
                    aria-label="Remove team"
                    className="flex h-12 w-11 shrink-0 items-center justify-center rounded-control text-subtle active:bg-raised"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldBlock label="Present">
                  <Stepper
                    value={crew.present}
                    onChange={(value) => setCrew(index, { present: value })}
                    max={1000}
                    label="present"
                  />
                </FieldBlock>
                <FieldBlock label="Absent">
                  <Stepper
                    value={crew.absent}
                    onChange={(value) => setCrew(index, { absent: value })}
                    max={1000}
                    label="absent"
                  />
                </FieldBlock>
              </div>

              <div className="mt-3">
                <FieldBlock label="Shift">
                  <ChipGroup
                    options={SHIFTS}
                    value={crew.shift}
                    onChange={(value) => setCrew(index, { shift: value })}
                    columns={3}
                  />
                </FieldBlock>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FieldBlock label="Trade">
                  <Select
                    value={crew.trade}
                    onChange={(event) => setCrew(index, { trade: event.target.value })}
                    className="h-12"
                  >
                    <option value="">Choose a trade</option>
                    {['Civil', 'Steel fixing', 'Shuttering', 'Masonry', 'Electrical', 'Plumbing',
                      'Finishing', 'Plant operators', 'General'].map((trade) => (
                      <option key={trade} value={trade}>{trade}</option>
                    ))}
                  </Select>
                </FieldBlock>
                <FieldBlock label="Work assigned">
                  <Input
                    value={crew.work_assigned}
                    onChange={(event) => setCrew(index, { work_assigned: event.target.value })}
                    placeholder="North footing reinforcement"
                    className="h-12 text-base"
                  />
                </FieldBlock>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setCrews((current) => [...current, blankCrew()])}
            className="tap flex w-full items-center justify-center gap-2 rounded-control border border-dashed border-line-strong text-base font-medium text-muted active:bg-raised"
          >
            <Plus size={16} />
            Add another team
          </button>

          <FieldBlock label="Notes">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Two operators off sick; plant hire sending cover tomorrow."
              className="text-base"
            />
          </FieldBlock>

          {error && (
            <p role="alert" className="rounded-control border border-critical/25 bg-critical-wash px-3 py-2.5 text-base text-critical">
              {error}
            </p>
          )}
        </form>
      </Sheet>

      <SuccessBurst
        open={done}
        title="Headcount recorded"
        detail={`${present} present and ${absent} absent on site today.`}
        onDone={finish}
      />
    </>
  )
}
