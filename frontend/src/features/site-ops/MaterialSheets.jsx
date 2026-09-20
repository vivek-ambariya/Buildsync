import { useEffect, useState } from 'react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Form'
import { Sheet } from './Sheet'
import { SuccessBurst } from './SuccessBurst'
import { ChipGroup, FieldBlock, SEVERITY_OPTIONS, Stepper } from './controls'
import { useSite } from './SiteContext'

/**
 * Recording what went into the work today.
 *
 * The quantity on site is shown beside the field as it is typed, because the
 * one mistake worth preventing here is reporting more consumption than the
 * site was holding — which silently corrupts every reorder date downstream.
 */
export function MaterialUsageSheet({ open, onClose, material, onSaved }) {
  const { projectId } = useSite()
  const [materialId, setMaterialId] = useState(material?.id || '')
  const [quantity, setQuantity] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [taskId, setTaskId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const { data: materials } = useAsync(
    () => (open && projectId ? api.site.materials(projectId) : Promise.resolve([])),
    [open, projectId],
    { immediate: open },
  )
  const { data: tasks } = useAsync(
    () => (open && projectId ? api.site.tasks({ project_id: projectId }) : Promise.resolve([])),
    [open, projectId],
    { immediate: open },
  )

  const selected = material?.id === materialId ? material : (materials || []).find((m) => m.id === materialId)
  const available = Number(selected?.available_qty || 0)
  const over = Number(quantity) > available

  useEffect(() => {
    if (!open) return
    setMaterialId(material?.id || '')
    setQuantity('')
    setDate(new Date().toISOString().slice(0, 10))
    setTaskId('')
    setNotes('')
    setError(null)
  }, [open, material])

  const submit = async (event) => {
    event?.preventDefault?.()
    setError(null)
    if (!materialId) return setError('Choose which material was used.')
    if (!(Number(quantity) > 0)) return setError('Enter the quantity used.')

    setSaving(true)
    try {
      await api.site.recordUsage(materialId, {
        quantity_used: Number(quantity),
        date,
        task_id: taskId || null,
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
    onSaved?.()
  }

  return (
    <>
      <Sheet
        open={open && !done}
        onClose={onClose}
        title="Record material usage"
        description="Drawn straight off the stock held on site."
        footer={
          <Button variant="accent" size="lg" className="w-full" loading={saving} onClick={submit} disabled={over}>
            Record usage
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-5">
          <FieldBlock label="Material" required>
            <Select value={materialId} onChange={(event) => setMaterialId(event.target.value)} className="h-12">
              <option value="">Choose a material</option>
              {(materials || []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({formatNumber(option.available_qty, 1)} {option.unit} on site)
                </option>
              ))}
            </Select>
          </FieldBlock>

          <FieldBlock
            label="Quantity used"
            required
            hint={selected ? `${formatNumber(available, 1)} ${selected.unit} on site right now.` : undefined}
          >
            <Stepper
              value={quantity}
              onChange={setQuantity}
              step={1}
              max={Math.max(1, Math.ceil(available))}
              suffix={selected?.unit}
              label="quantity"
            />
            {over && (
              <p className="mt-2 rounded-control border border-amber/35 bg-amber-wash px-3 py-2 text-tiny text-amber-deep">
                That is more than the {formatNumber(available, 1)} {selected?.unit} on site. Record what was actually
                used, then raise a request for the rest.
              </p>
            )}
          </FieldBlock>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock label="Date">
              <Input
                type="date"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setDate(event.target.value)}
                className="h-12 text-base"
              />
            </FieldBlock>
            <FieldBlock label="Task">
              <Select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="h-12">
                <option value="">Not task specific</option>
                {(tasks || []).map((option) => (
                  <option key={option.id} value={option.id}>{option.title}</option>
                ))}
              </Select>
            </FieldBlock>
          </div>

          <FieldBlock label="Notes">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Poured into the north footing."
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

      <SuccessBurst open={done} title="Usage recorded" detail="Stock on site has been updated." onDone={finish} />
    </>
  )
}

/** Asking for stock the site does not have. The project manager decides. */
export function MaterialRequestSheet({ open, onClose, material, onSaved }) {
  const { projectId, project } = useSite()
  const [materialId, setMaterialId] = useState(material?.id || '')
  const [name, setName] = useState(material?.name || '')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState(material?.unit || 'units')
  const [reason, setReason] = useState('')
  const [urgency, setUrgency] = useState('medium')
  const [neededBy, setNeededBy] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const { data: materials } = useAsync(
    () => (open && projectId ? api.site.materials(projectId) : Promise.resolve([])),
    [open, projectId],
    { immediate: open },
  )

  useEffect(() => {
    if (!open) return
    setMaterialId(material?.id || '')
    setName(material?.name || '')
    setQuantity('')
    setUnit(material?.unit || 'units')
    setReason('')
    setUrgency('medium')
    setNeededBy('')
    setError(null)
  }, [open, material])

  const pick = (id) => {
    setMaterialId(id)
    const found = (materials || []).find((m) => m.id === id)
    if (found) {
      setName(found.name)
      setUnit(found.unit || 'units')
    }
  }

  const submit = async (event) => {
    event?.preventDefault?.()
    setError(null)
    if (!name.trim()) return setError('Name the material you need.')
    if (!(Number(quantity) > 0)) return setError('How much do you need?')
    if (reason.trim().length < 3) return setError('Say why it is needed — that is what gets it approved.')

    setSaving(true)
    try {
      await api.site.requestMaterial({
        project_id: projectId,
        material_id: materialId || null,
        material_name: name.trim(),
        required_qty: Number(quantity),
        unit,
        reason: reason.trim(),
        urgency,
        needed_by: neededBy || null,
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
    onSaved?.()
  }

  return (
    <>
      <Sheet
        open={open && !done}
        onClose={onClose}
        title="Request material"
        description={project?.name}
        footer={
          <Button variant="accent" size="lg" className="w-full" loading={saving} onClick={submit}>
            Send request
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-5">
          <FieldBlock label="How urgent" required>
            <ChipGroup options={SEVERITY_OPTIONS} value={urgency} onChange={setUrgency} columns={4} />
          </FieldBlock>

          <FieldBlock label="Material" required>
            <Select value={materialId} onChange={(event) => pick(event.target.value)} className="h-12">
              <option value="">Something not on the list</option>
              {(materials || []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({formatNumber(option.available_qty, 1)} {option.unit} on site)
                </option>
              ))}
            </Select>
            {!materialId && (
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name the material"
                className="mt-2 h-12 text-base"
              />
            )}
          </FieldBlock>

          <FieldBlock label="Quantity required" required>
            <div className="flex gap-2">
              <div className="flex-1">
                <Stepper value={quantity} onChange={setQuantity} step={1} max={100000} label="quantity" />
              </div>
              <Input
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                className="h-12 w-24 text-center text-base"
                aria-label="Unit"
              />
            </div>
          </FieldBlock>

          <FieldBlock label="Why it is needed" required>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Slab pour on level 6 is scheduled for Thursday and stock on site covers two days."
              className="text-base"
            />
          </FieldBlock>

          <FieldBlock label="Needed by">
            <Input
              type="date"
              value={neededBy}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setNeededBy(event.target.value)}
              className="h-12 text-base"
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
        title="Request sent"
        detail="The project manager has been notified and will approve or decline it."
        onDone={finish}
      />
    </>
  )
}
