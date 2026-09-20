import { useEffect, useMemo, useState } from 'react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { Button } from '@/components/ui/Button'
import { Field, FieldRow, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'

const CATEGORIES = ['Residential', 'Commercial', 'Retail', 'Industrial', 'Infrastructure', 'Institutional']
const STATUSES = ['planning', 'active', 'at_risk', 'delayed', 'on_hold', 'completed']

const today = () => new Date().toISOString().slice(0, 10)
const inMonths = (months) => {
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

const BLANK = {
  name: '', code: '', category: 'Residential', location: '', client: '',
  description: '', status: 'planning', start_date: today(), end_date: inMonths(18),
  budget: '', manager_id: '', team_ids: [],
}

/** Create or edit a project. Budgets are entered in crore, as they are quoted. */
export function ProjectFormModal({ open, onClose, onSaved, project }) {
  const toast = useToast()
  const editing = Boolean(project)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const { data: team } = useAsync(() => api.users.team(), [open], { immediate: open })

  const managers = useMemo(
    () => [...(team?.admin || []), ...(team?.project_manager || [])],
    [team],
  )
  const assignable = useMemo(
    () => [...(team?.site_engineer || []), ...(team?.contractor || []), ...(team?.project_manager || [])],
    [team],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    if (project) {
      setForm({
        name: project.name || '',
        code: project.code || '',
        category: project.category || 'Residential',
        location: project.location || '',
        client: project.client || '',
        description: project.description || '',
        status: project.status || 'planning',
        start_date: (project.start_date || '').slice(0, 10),
        end_date: (project.end_date || '').slice(0, 10),
        budget: project.budget ? String(project.budget / 10_000_000) : '',
        manager_id: project.manager_id || '',
        team_ids: (project.team || []).map((person) => person.id),
      })
    } else {
      setForm({ ...BLANK })
    }
  }, [open, project])

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const toggleTeam = (id) =>
    setForm((current) => ({
      ...current,
      team_ids: current.team_ids.includes(id)
        ? current.team_ids.filter((value) => value !== id)
        : [...current.team_ids, id],
    }))

  const submit = async (event) => {
    event.preventDefault()
    setError(null)

    if (new Date(form.end_date) <= new Date(form.start_date)) {
      setError('The completion date has to fall after the start date.')
      return
    }

    const payload = {
      ...form,
      budget: Number(form.budget) * 10_000_000,
      manager_id: form.manager_id || null,
    }
    if (editing) delete payload.code

    setSaving(true)
    try {
      if (editing) {
        await api.projects.update(project.id, payload)
        toast.success('Project updated', form.name)
      } else {
        await api.projects.create(payload)
        toast.success('Project created', `${form.name} is now in the portfolio`)
      }
      onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${project.name}` : 'New project'}
      description={editing ? 'Changes apply to everyone on the project immediately.' : 'Set up the schedule and budget. You can add tasks and materials next.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {editing ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FieldRow>
          <Field label="Project name" required>
            <Input value={form.name} onChange={set('name')} placeholder="Skyline Tower" required minLength={2} />
          </Field>
          <Field label="Project code" required hint={editing ? 'Codes cannot be changed once set.' : 'A short reference used on drawings and invoices.'}>
            <Input
              value={form.code}
              onChange={set('code')}
              placeholder="SKY-01"
              required
              disabled={editing}
              className="uppercase"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {STATUSES.map((value) => (
                <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Site location">
            <Input value={form.location} onChange={set('location')} placeholder="Bopal, Ahmedabad" />
          </Field>
          <Field label="Client">
            <Input value={form.client} onChange={set('client')} placeholder="Skyline Realty LLP" />
          </Field>
        </FieldRow>

        <FieldRow className="sm:grid-cols-3">
          <Field label="Start date" required>
            <Input type="date" value={form.start_date} onChange={set('start_date')} required />
          </Field>
          <Field label="Completion date" required>
            <Input type="date" value={form.end_date} onChange={set('end_date')} required />
          </Field>
          <Field label="Budget (₹ crore)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.budget}
              onChange={set('budget')}
              placeholder="18.50"
              required
            />
          </Field>
        </FieldRow>

        <Field label="Project manager">
          <Select value={form.manager_id} onChange={set('manager_id')}>
            <option value="">Assign later</option>
            {managers.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} — {person.title}
              </option>
            ))}
          </Select>
        </Field>

        {assignable.length > 0 && (
          <Field label="Site team" hint="Team members see this project in their portfolio.">
            <div className="flex flex-wrap gap-1.5">
              {assignable.map((person) => {
                const selected = form.team_ids.includes(person.id)
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggleTeam(person.id)}
                    aria-pressed={selected}
                    className={
                      selected
                        ? 'rounded-pill border border-ink bg-ink px-2.5 py-1 text-tiny font-medium text-paper transition-colors'
                        : 'rounded-pill border border-line px-2.5 py-1 text-tiny text-muted transition-colors hover:border-line-strong hover:text-ink'
                    }
                  >
                    {person.name}
                  </button>
                )
              })}
            </div>
          </Field>
        )}

        <Field label="Scope notes">
          <Textarea
            value={form.description}
            onChange={set('description')}
            rows={3}
            placeholder="3B + G + 22 residential tower, 176 units, with a two-level podium clubhouse."
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-control border border-critical/25 bg-critical-wash px-3 py-2.5 text-base text-critical">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
