import React, { useState } from 'react';
import { Modal, Button } from './components/ui';
import { SlaIndicator, SlaPicker } from './slas';
import type { Entity } from '../shared/types';

/** Typed editing for optional imported fields that have no categorical picker. */
export function InlineIssueValue({ label, value, date = false, onChange }: { label: string; value: unknown; date?: boolean; onChange: (value: unknown) => Promise<unknown> }) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const structured = Array.isArray(value) || value !== null && typeof value === 'object';
  if (structured) return <span className="small muted" title={label}>{JSON.stringify(value)}</span>;
  const save = async () => {
    if (busy) return;
    const next = !draft.trim() ? null : typeof value === 'number' ? Number(draft) : typeof value === 'boolean' ? draft === 'true' : draft;
    if (typeof next === 'number' && !Number.isFinite(next)) { setError('Enter a valid number.'); return; }
    setBusy(true);
    try { if (await onChange(next) === null) throw new Error('Could not save this field.'); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <span className="inline-field-anchor" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <button type="button" className="inline-field-button small muted" aria-label={`Change ${label.toLowerCase()}`} onClick={() => { setDraft(String(value ?? '')); setError(''); setOpen(true); }}>{String(value)}</button>
    {open && <Modal title={`Edit ${label.toLowerCase()}`} onClose={() => setOpen(false)}><form onSubmit={e => { e.preventDefault(); void save(); }}><div className="modal-body"><label className="field"><span>{label}</span>{typeof value === 'boolean' ? <select className="input" aria-label={label} value={draft} onChange={e => setDraft(e.target.value)}><option value="true">Yes</option><option value="false">No</option></select> : <input autoFocus className="input" aria-label={label} type={date ? 'date' : typeof value === 'number' ? 'number' : 'text'} step="any" value={draft} onChange={e => setDraft(e.target.value)} />}</label>{error && <p role="alert" className="error-text">{error}</p>}</div><div className="modal-footer"><Button type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>Save</Button></div></form></Modal>}
  </span>;
}

export function InlineIssueSla({ issue }: { issue: Entity }) {
  const [open, setOpen] = useState(false);
  return <span className="inline-field-anchor" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}><SlaIndicator issue={issue} onClick={() => setOpen(true)} />{open && <SlaPicker issue={issue} onClose={() => setOpen(false)} />}</span>;
}
