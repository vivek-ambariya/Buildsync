import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Package, Plus, Trash2 } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { formatDate, formatINR, formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Field, FieldRow, Input, Select } from '@/components/ui/Form'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

const CATEGORIES = ['Structural', 'Masonry', 'Electrical', 'Plumbing', 'Finishing', 'Facade', 'Other']
const UNITS = ['tonnes', 'bags', 'cum', 'sqm', 'rmt', 'nos', 'kg', 'ltr']

export function MaterialsTab({ project }) {
  const { can } = useAuth()
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(
    () => api.materials.list({ project_id: project.id }),
    [project.id],
  )

  const [showAtRisk, setShowAtRisk] = useState(false)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [removing, setRemoving] = useState(false)

  const grouped = useMemo(() => {
    let rows = data || []
    if (showAtRisk) rows = rows.filter((material) => material.status !== 'healthy')
    return rows.reduce((out, material) => {
      out[material.category] = out[material.category] || []
      out[material.category].push(material)
      return out
    }, {})
  }, [data, showAtRisk])

  const totals = useMemo(() => {
    const rows = data || []
    return {
      count: rows.length,
      atRisk: rows.filter((material) => material.status !== 'healthy').length,
      critical: rows.filter((material) => material.status === 'critical').length,
      value: rows.reduce((sum, material) => sum + material.required_qty * material.unit_cost, 0),
      committed: rows.reduce((sum, material) => sum + material.used_qty * material.unit_cost, 0),
    }
  }, [data])

  const remove = async () => {
    setRemoving(true)
    try {
      await api.materials.remove(deleting.id)
      toast.success('Material removed', deleting.name)
      setDeleting(null)
      reload()
    } catch (err) {
      toast.error('Could not remove that material', err.message)
    } finally {
      setRemoving(false)
    }
  }

  if (error) return <ErrorState title="We could not load the materials" description={error.message} onRetry={reload} />
  if (loading && !data) return <PanelSkeleton rows={6} />

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Materials tracked" value={formatNumber(totals.count)} />
        <Summary
          label="Below safe stock"
          value={formatNumber(totals.atRisk)}
          tone={totals.critical > 0 ? 'critical' : totals.atRisk > 0 ? 'warning' : 'healthy'}
          caption={totals.critical > 0 ? `${totals.critical} will stop work first` : 'within lead-time cover'}
        />
        <Summary label="Material budget" value={formatINR(totals.value)} caption="quantity × rate, whole build" />
        <Summary
          label="Consumed to date"
          value={formatINR(totals.committed)}
          caption={totals.value ? `${Math.round((totals.committed / totals.value) * 100)}% of material scope` : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer select-none items-center gap-2 text-base text-muted">
          <input
            type="checkbox"
            checked={showAtRisk}
            onChange={(event) => setShowAtRisk(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-line-strong accent-ink"
          />
          Only show what needs reordering
        </label>
        {can('manageMaterials') && (
          <Button variant="primary" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus size={15} />
            Add material
          </Button>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Panel>
          <EmptyState
            icon={Package}
            title={showAtRisk ? 'Everything is in stock' : 'No materials tracked yet'}
            description={
              showAtRisk
                ? 'Every material has more cover on site than its supplier needs to deliver a replacement.'
                : 'Add the materials this build consumes and BuildSync will watch the burn rate against supplier lead times.'
            }
            action={
              can('manageMaterials') && !showAtRisk ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <Plus size={15} />
                  Add the first material
                </Button>
              ) : null
            }
          />
        </Panel>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Panel key={category}>
            <PanelHeader title={category} description={`${items.length} ${items.length === 1 ? 'item' : 'items'}`} />
            <ul className="divide-y divide-line">
              {items.map((material) => (
                <MaterialRow
                  key={material.id}
                  material={material}
                  canEdit={can('manageMaterials')}
                  onEdit={() => setEditing(material)}
                  onDelete={() => setDeleting(material)}
                />
              ))}
            </ul>
          </Panel>
        ))
      )}

      <MaterialFormModal
        open={creating || Boolean(editing)}
        material={editing}
        project={project}
        onClose={() => { setCreating(false); setEditing(null) }}
        onSaved={() => { setCreating(false); setEditing(null); reload() }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        loading={removing}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={`Remove ${deleting?.name}?`}
        confirmLabel="Remove material"
        description="The stock record and its consumption history for this project will be deleted."
      />
    </div>
  )
}

function MaterialRow({ material, canEdit, onEdit, onDelete }) {
  const metrics = material.metrics || {}
  const tone = material.status === 'critical' ? 'critical' : material.status === 'low_stock' ? 'warning' : 'healthy'
  const consumed = material.required_qty ? (material.used_qty / material.required_qty) * 100 : 0

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-medium text-ink">{material.name}</p>
            <StatusBadge status={material.status} size="sm" pulse={material.status === 'critical'} />
          </div>
          <p className="mt-0.5 text-tiny text-muted">
            {material.supplier || 'No supplier set'} · {material.lead_time_days} day lead time ·{' '}
            {formatINR(material.unit_cost, { compact: false })}/{material.unit}
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" onClick={onEdit}>Update stock</Button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1.5 text-subtle transition-colors hover:bg-critical-wash hover:text-critical"
              aria-label={`Remove ${material.name}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <div className="flex items-center justify-between text-tiny">
            <span className="text-muted">Consumed against scope</span>
            <span className="tabular text-ink">
              {formatNumber(material.used_qty, 1)} of {formatNumber(material.required_qty, 1)} {material.unit}
            </span>
          </div>
          <ProgressBar value={consumed} tone="ink" showPlannedMarker={false} className="mt-2" />
        </div>

        <dl className="grid grid-cols-3 gap-x-5 sm:w-72">
          <Stat label="On site" value={`${formatNumber(material.available_qty, 1)}`} unit={material.unit} />
          <Stat
            label="Days cover"
            value={metrics.days_of_cover > 900 ? '—' : formatNumber(metrics.days_of_cover, 0)}
            tone={tone}
          />
          <Stat
            label="Reorder by"
            value={formatDate(metrics.reorder_by, { withYear: false })}
            tone={tone === 'critical' ? 'critical' : undefined}
          />
        </dl>
      </div>

      {material.status !== 'healthy' && metrics.shortfall > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-control bg-raised px-3 py-2 text-tiny text-muted">
          <AlertTriangle size={13} className={cn('mt-0.5 shrink-0', tone === 'critical' ? 'text-critical' : 'text-amber-deep')} />
          {formatNumber(metrics.shortfall, 1)} {material.unit} short of finishing the build at the current rate.
          Placing the order by {formatDate(metrics.reorder_by)} keeps the site running.
        </p>
      )}
    </li>
  )
}

function Stat({ label, value, unit, tone }) {
  return (
    <div>
      <dt className="text-micro text-subtle">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-base tabular',
          tone === 'critical' ? 'text-critical' : tone === 'warning' ? 'text-amber-deep' : 'text-ink',
        )}
      >
        {value}
        {unit && <span className="ml-0.5 text-micro text-subtle">{unit}</span>}
      </dd>
    </div>
  )
}

function MaterialFormModal({ open, onClose, onSaved, project, material }) {
  const toast = useToast()
  const editing = Boolean(material)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      material
        ? {
            name: material.name, category: material.category, unit: material.unit,
            required_qty: material.required_qty, available_qty: material.available_qty,
            used_qty: material.used_qty, unit_cost: material.unit_cost,
            supplier: material.supplier, lead_time_days: material.lead_time_days,
          }
        : {
            name: '', category: 'Structural', unit: 'tonnes', required_qty: '',
            available_qty: '', used_qty: 0, unit_cost: '', supplier: '', lead_time_days: 7,
          },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, material])

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    const payload = {
      ...form,
      required_qty: Number(form.required_qty),
      available_qty: Number(form.available_qty),
      used_qty: Number(form.used_qty),
      unit_cost: Number(form.unit_cost),
      lead_time_days: Number(form.lead_time_days),
    }
    setSaving(true)
    try {
      if (editing) {
        await api.materials.update(material.id, payload)
        toast.success('Stock updated', form.name)
      } else {
        await api.materials.create({ ...payload, project_id: project.id })
        toast.success('Material added', form.name)
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
      title={editing ? `Update ${material.name}` : 'Add material'}
      description={editing ? 'Stock status is recalculated against the supplier lead time.' : `Tracked on ${project?.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {editing ? 'Save' : 'Add material'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Material" required>
          <Input value={form.name || ''} onChange={set('name')} placeholder="TMT Steel Fe550D" required disabled={editing} />
        </Field>

        <FieldRow className="sm:grid-cols-3">
          <Field label="Category">
            <Select value={form.category || ''} onChange={set('category')}>
              {CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label="Unit">
            <Select value={form.unit || ''} onChange={set('unit')}>
              {UNITS.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label="Rate (₹ per unit)" required>
            <Input type="number" min="0" step="0.01" value={form.unit_cost ?? ''} onChange={set('unit_cost')} required />
          </Field>
        </FieldRow>

        <FieldRow className="sm:grid-cols-3">
          <Field label="Required for the build" required>
            <Input type="number" min="0" step="0.1" value={form.required_qty ?? ''} onChange={set('required_qty')} required />
          </Field>
          <Field label="On site now" required>
            <Input type="number" min="0" step="0.1" value={form.available_qty ?? ''} onChange={set('available_qty')} required />
          </Field>
          <Field label="Consumed so far">
            <Input type="number" min="0" step="0.1" value={form.used_qty ?? ''} onChange={set('used_qty')} />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Supplier">
            <Input value={form.supplier || ''} onChange={set('supplier')} placeholder="Shree Balaji Steels" />
          </Field>
          <Field label="Lead time (days)" hint="How long the supplier needs to deliver a fresh order.">
            <Input type="number" min="0" max="180" value={form.lead_time_days ?? ''} onChange={set('lead_time_days')} />
          </Field>
        </FieldRow>

        {error && (
          <p role="alert" className="rounded-control border border-critical/25 bg-critical-wash px-3 py-2.5 text-base text-critical">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

function Summary({ label, value, caption, tone }) {
  return (
    <Panel className="p-4">
      <p className="text-tiny text-muted">{label}</p>
      <p
        className={cn(
          'mt-1.5 font-display text-h3 tabular',
          tone === 'critical' ? 'text-critical' : tone === 'warning' ? 'text-amber-deep' : tone === 'healthy' ? 'text-healthy' : 'text-ink',
        )}
      >
        {value}
      </p>
      {caption && <p className="mt-1 text-micro text-subtle">{caption}</p>}
    </Panel>
  )
}
