import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {DurableDraftStorage} from './durable-draft-storage';
import {IssueTitleDraft} from './issue-title-draft';
import {getAppSnapshot, useAppStore} from './store';

const drafts = new DurableDraftStorage(() => localStorage);

// The caller keys this editor by issue/user identity so a late save can never
// use the next issue's ID or consume its draft.
export function IssueTitleEditor({issueId, value, readOnly, showProperties}: {
  issueId: string; value: string; readOnly: boolean; showProperties: boolean;
}) {
  const store = useAppStore(), input = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(value);
  const latest = useRef(value); latest.current = value;
  const [draft] = useState(() => new IssueTitleDraft(
    `issue-edit:${store.user?.id}:${issueId}`, drafts,
    () => getAppSnapshot().data.issues.find(issue => issue.id === issueId)?.title ?? latest.current,
    title => store.update('issues', issueId, {title}),
  ));
  const commit = () => void draft.flush().catch(error => store.toast(String(error)));
  useEffect(() => {
    const recovered = draft.recover();
    if (recovered !== undefined) { setTitle(recovered.trim() ? recovered : latest.current); commit(); }
    window.addEventListener('pagehide', commit);
    return () => { window.removeEventListener('pagehide', commit); commit(); };
  }, [draft]);
  useEffect(() => { if (!draft.dirty) setTitle(value); }, [value, draft]);
  const fontSize = store.data.users.find(user => user.id === store.user?.id)?.preferences?.fontSize;
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    let active = true;
    const resize = () => {
      if (!active || !element.isConnected) return;
      element.style.height = 'auto'; element.style.height = `${element.scrollHeight}px`;
    };
    resize(); void document.fonts.ready.then(resize);
    window.addEventListener('resize', resize);
    return () => { active = false; window.removeEventListener('resize', resize); };
  }, [title, showProperties, fontSize]);
  return <textarea ref={input} className="detail-title" readOnly={readOnly}
    aria-label="Issue title" value={title} rows={1}
    onChange={event => {
      setTitle(event.target.value);
      if (!draft.change(event.target.value)) store.toast('This title draft could not be saved on this device. Keep this window open until it can be saved.');
    }}
    onBlur={() => { if (!title.trim()) setTitle(latest.current); commit(); }}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing || !['Enter', 'Escape'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); event.currentTarget.blur();
    }} />;
}
