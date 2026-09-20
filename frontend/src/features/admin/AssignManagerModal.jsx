import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { api } from '@/lib/api'
import { projectService } from '@/services'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'

/**
 * Hand a project to a different manager.
 *
 * Separate from the full project form because this one field decides who can
 * act on the project at all, and it is worth being able to change it without
 * opening a dialog that can also rewrite the budget and the dates.
 */
export function AssignManagerModal({ open, onClose, onSaved, project }) {
  const toast = useToast()
  const [managerId, setManagerId] = useState('')
  const [saving, setSaving] = useState(false)
  const { data: team } = useAsync(() => api.users.team(), [open], { immediate: open })

  const managers = useMemo(
    () => [...(team?.admin || []), ...(team?.project_manager || [])],
    [team],
  )

  useEffect(() => {
    if (open) setManagerId(project?.manager_id || '')
  }, [open, project])

  if (!project) return null

  const changed = managerId && managerId !== project.manager_id
  const next = managers.find((person) => person.id === managerId)

  const submit = async () => {
    if (!changed) return onClose()
    setSaving(true)
    try {
      await projectService.update(project.id, { manager_id: managerId })
      toast.success(`${project.name} reassigned to ${next?.name || 'a new manager'}.`)
      onSaved?.()
      onClose()
    } catch (error) {
      toast.error(error.status === 403 ? 'Your role cannot reassign a project manager.' : error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign project manager"
      description={project.name}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!changed}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3 rounded-panel border border-line bg-raised px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-micro text-subtle">Current manager</p>
          <p className="mt-0.5 truncate text-base font-medium text-ink">
            {project.manager_name || 'Unassigned'}
          </p>
        </div>
        <ArrowRight size={15} className="shrink-0 text-subtle" />
        <div className="min-w-0">
          <p className="text-micro text-subtle">New manager</p>
          <p className="mt-0.5 truncate text-base font-medium text-ink">
            {changed ? next?.name : '—'}
          </p>
        </div>
      </div>

      <Field
        label="Manager"
        className="mt-4"
        hint="Only admins and project managers can run a project."
      >
        <Select value={managerId} onChange={(event) => setManagerId(event.target.value)}>
          <option value="">Select a manager…</option>
          {managers.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
              {person.id === project.manager_id ? ' (current)' : ''}
            </option>
          ))}
        </Select>
      </Field>

      {changed && (
        <p className="mt-4 text-tiny leading-relaxed text-muted">
          The new manager gains full control of this project's schedule, budget and team.
          The previous manager keeps their other projects.
        </p>
      )}
    </Modal>
  )
}
