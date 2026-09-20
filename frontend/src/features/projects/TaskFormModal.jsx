import { useEffect, useMemo, useState } from 'react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { Button } from '@/components/ui/Button'
import { Field, FieldRow, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'

const STATUSES = ['not_started', 'in_progress', 'completed', 'delayed']
const PRIORITIES = ['low', 'medium', 'high', 'critical']

const today = () => new Date().toISOString().slice(0, 10)
const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

export function TaskFormModal({ open, onClose, onSaved, project, task, phases = [] }) {
  const toast = useToast()
  const editing = Boolean(task)
  const { data: team } = useAsync(() => api.users.team(), [open], { immediate: open })

  const assignable = useMemo(
    () => [
      ...(team?.project_manager || []),
      ...(team?.site_engineer || []),
      ...(team?.contractor || []),
    ],
    [team],
  )

  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      task
        ? {
            title: task.title || '',
            description: task.description || '',
            phase: task.phase || phases[0] || 'General',
            assignee_id: task.assignee_id || '',
            start_date: (task.start_date || '').slice(0, 10),
            deadline: (task.deadline || '').slice(0, 10),
            progress: task.progress ?? 0,
            status: task.status || 'not_started',
            priority: task.priority || 'medium',
          }
        : {
            title: '',
            description: '',
            phase: phases[0] || 'General',
            assignee_id: '',
            start_date: today(),
            deadline: inDays(14),
            progress: 0,
            status: 'not_started',
            priority: 'medium',
          },
    )
  }, [open, task, phases])

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (new Date(form.deadline) < new Date(form.start_date)) {
      setError('The deadline cannot fall before the start date.')
      return
    }

    const payload = {
      ...form,
      progress: Number(form.progress),
      assignee_id: form.assignee_id || null,
    }

    setSaving(true)
    try {
      if (editing) {
        await api.tasks.update(task.id, payload)
        toast.success('Task updated', form.title)
      } else {
        await api.tasks.create({ ...payload, project_id: project.id })
        toast.success('Task created', form.title)
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
      title={editing ? 'Edit task' : 'New task'}
      description={editing ? undefined : `Added to ${project?.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {editing ? 'Save task' : 'Create task'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="What needs doing" required>
          <Input value={form.title || ''} onChange={set('title')} placeholder="Slab concreting, eighth floor" required minLength={2} />
        </Field>

        <FieldRow>
          <Field label="Phase">
            <Select value={form.phase || ''} onChange={set('phase')}>
              {[...new Set([...phases, 'General', form.phase].filter(Boolean))].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned to">
            <Select value={form.assignee_id || ''} onChange={set('assignee_id')}>
              <option value="">Unassigned</option>
              {assignable.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} — {person.title}
                </option>
              ))}
            </Select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Start date" required>
            <Input type="date" value={form.start_date || ''} onChange={set('start_date')} required />
          </Field>
          <Field label="Deadline" required>
            <Input type="date" value={form.deadline || ''} onChange={set('deadline')} required />
          </Field>
        </FieldRow>

        <FieldRow className="sm:grid-cols-3">
          <Field label="Status">
            <Select value={form.status || ''} onChange={set('status')}>
              {STATUSES.map((value) => (
                <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority || ''} onChange={set('priority')}>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label={`Progress — ${form.progress || 0}%`}>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={form.progress || 0}
              onChange={set('progress')}
              className="mt-3 w-full accent-ink"
            />
          </Field>
        </FieldRow>

        <Field label="Notes">
          <Textarea value={form.description || ''} onChange={set('description')} rows={2} placeholder="Anything the site needs to know before starting." />
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
