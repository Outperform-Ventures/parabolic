import {useRef, useState, type ReactNode} from 'react';
import {pendingSaves} from './pending-saves';
import {Icon} from './components/ui';
import {EntityIcon} from './features/entity-icon';
import {getAppSnapshot, useAppStore} from './store';
import {useSectionReorder} from './section-reorder';
import {COMPOSER_LAYOUT_PREFERENCE, composerFields, normalizeComposerFieldLayout, type ComposerField, type ComposerFieldLayout} from './composer-field-layout';
import './composer-field-settings.css';

export function useComposerFieldLayout() {
  const store = useAppStore();
  const saved = store.user?.preferences?.[COMPOSER_LAYOUT_PREFERENCE];
  const [preview, setPreview] = useState<ComposerFieldLayout | null>(null);
  const sequence = useRef(0), writes = useRef(Promise.resolve());
  const change = (next: ComposerFieldLayout) => {
    const layout = normalizeComposerFieldLayout(next), revision = ++sequence.current, userId = store.user!.id;
    const previousWrite = writes.current;
    setPreview(layout);
    // Serialize preference patches and merge with the latest user preferences;
    // rapid drags/toggles must not overwrite one another or unrelated settings.
    writes.current = pendingSaves.track(() => previousWrite.then(async () => {
      const current = getAppSnapshot();
      if (current.user?.id !== userId) throw Error('Account changed before field settings could be saved.');
      await current.update('users', userId, {preferences: {...current.user.preferences, [COMPOSER_LAYOUT_PREFERENCE]: layout}});
    })).catch(error => store.toast(String(error))).finally(() => {
      if (revision === sequence.current) setPreview(null);
    });
  };
  return {layout: preview ?? normalizeComposerFieldLayout(saved), customized: preview !== null || !!saved, change};
}

export function ComposerActions({children}: {children: ReactNode}) {
  const [open, setOpen] = useState(false);
  return <details className="composer-settings-actions" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary data-keep-open tabIndex={0}>Issue actions</summary>
    {open && children}
  </details>;
}

export function ComposerFieldSettings({layout, onChange, projectId, estimateDisabled}: {
  layout: ComposerFieldLayout; onChange: (layout: ComposerFieldLayout) => void;
  projectId?: string; estimateDisabled: boolean;
}) {
  const [announcement, announce] = useState('');
  const reorder = useSectionReorder('issue-composer-fields', {fields: layout.order}, (_field, order) => {
    onChange({...layout, order: order as ComposerField[]}); announce('Field order saved');
  });
  return <div className="composer-field-settings" role="group" aria-label="New issue fields" data-keep-open>
    <div className="composer-field-settings-heading">New issue fields</div>
    <p>Drag to reorder · Click to show or hide</p>
    {layout.order.map(id => {
      const [, name, icon] = composerFields.find(([field]) => field === id)!;
      const visible = !layout.hidden.includes(id);
      const note = id === 'milestoneId' && !projectId ? 'Choose a project first' : id === 'estimate' && estimateDisabled ? 'Estimates disabled for this team' : '';
      return <div key={id} className="composer-field-setting reorderable-section" data-composer-setting={id} {...reorder.headerProps('fields', id)}>
        {reorder.handle('fields', id, name, 'field')}
        <button type="button" role="menuitemcheckbox" aria-checked={visible} aria-label={name}
          title={note || (visible ? `Hide ${name}` : `Show ${name}`)} onClick={() => {
            onChange({...layout, hidden: visible ? [...layout.hidden, id] : layout.hidden.filter(field => field !== id)});
            announce(`${name} ${visible ? 'hidden' : 'shown'} by default`);
          }}>
          {id === 'estimate' ? <EntityIcon entity={{icon: 'Estimate'}} size={16}/> : <Icon name={icon} size={15}/>}<span>{name}{note && <small>{note}</small>}</span>
          <Icon name={visible ? 'Eye' : 'EyeOff'} size={15}/>
        </button>
      </div>;
    })}
    <span className="native-visually-hidden" role="status" aria-live="polite">{announcement}</span>
  </div>;
}
