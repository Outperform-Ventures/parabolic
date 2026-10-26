import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DueDateIndicator } from './due-date';
import { IssueDueMenu } from './issue-due-menu';
import { IssueCustomDue } from './issue-custom-due';
import { useInlineMenuPosition } from './use-inline-menu-position';

export function InlineDueDatePicker({ value, now, onChange }: { value: string; now: Date; onChange: (date: string | null) => Promise<unknown> }) {
  const [open, setOpen] = useState(false), [custom, setCustom] = useState(false), [error, setError] = useState('');
  const anchor = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), saving = useRef(false);
  useInlineMenuPosition(open, anchor, menu);
  const close = () => { setOpen(false); anchor.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!anchor.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', key, true); };
  }, [open]);
  const save = async (date: string | null) => {
    if (saving.current) return;
    saving.current = true; setError('');
    try {
      if (await onChange(date) === null) throw new Error('Could not save the due date.');
      close();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { saving.current = false; }
  };
  return <>
    <DueDateIndicator value={value} now={now} buttonRef={anchor} expanded={open || custom} onClick={() => { setError(''); setOpen(!open); }} />
    {open && createPortal(<div ref={menu} className="menu inline-due-date-menu" role="menu" aria-label="Change due date" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <IssueDueMenu value={value} inline onRemove={() => void save(null)} onSelect={date => void save(date)} onCustom={() => { setOpen(false); setCustom(true); }} />
      {error && <p role="alert" className="error-text">{error}</p>}
    </div>, document.body)}
    {custom && <span onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}><IssueCustomDue native value={value} onSave={onChange} onClose={() => { setCustom(false); anchor.current?.focus({ preventScroll: true }); }} /></span>}
  </>;
}
