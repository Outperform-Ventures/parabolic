import {useTemplateNavigationGuard} from './template-navigation-guard';
import React, { useRef, useState } from "react";
import './features/project-template-canvas.css';
import {TemplateUpload} from './template-upload';
import {useNavigate,useSearchParams} from 'react-router-dom';
import { useAppStore } from "./store";
import type { Entity } from "../shared/types";
import {
  Button,
  DatePicker,
  Field,
  Icon,
  Modal,
  RichEditor,
  TextInput,
} from "./components/ui";
import { PropertyPicker } from "./issues";
import {
  ProjectTemplatePlanEditor,
  ProjectTemplateProperties,
  validateProjectTemplatePlan,
} from "./features/project-template-plan";
import {NativeProjectTemplateCanvas} from "./features/native-project-template";
import {EntityIconPicker} from "./features/entity-icon";
import { EntityMenu } from "./features/shared";
import { issueTemplates, type TemplateField } from "./template-utils";

export function FormTemplateFields({
  template,
  fields,
  onChange,
}: {
  template: Entity;
  fields: Record<string, any>;
  onChange: (fields: Record<string, any>) => void;
}) {
  const { data } = useAppStore();
  const latest=useRef({fields,onChange});latest.current={fields,onChange};
  const teamScopes=new Set<string>();let currentTeam=data.teams.find(team=>team.id===fields.teamId);
  while(currentTeam&&!teamScopes.has(currentTeam.id)){teamScopes.add(currentTeam.id);currentTeam=data.teams.find(team=>team.id===(currentTeam!.parentId||currentTeam!.parentTeamId));}
  const answer = (field: TemplateField, value: any) => {
    const next={
      ...latest.current.fields,
      ...(field.property ? { [field.property]: value } : {}),
      templateAnswers: { ...latest.current.fields.templateAnswers, [field.id]: value },
    };latest.current.fields=next;latest.current.onChange(next);
  };
  return (
    <div className="template-form-fields">
      {((template.formFields as TemplateField[]) ?? []).map((field) => {
        const options=(field.options||[]).map(option=>typeof option==='object'?{value:option.value??option.id??option.label,label:option.label}:{value:option,label:option});
        const value = field.property
          ? fields[field.property]
          : fields.templateAnswers?.[field.id];
        if (field.type === "instructions")
          return (
            <p className="template-instructions" key={field.id}>
              {field.label}
            </p>
          );
        const label = `${field.label}${field.required ? " *" : ""}`;
        return (
          <div key={field.id} data-template-field-id={field.id} style={{display:"contents"}}><Field label={label} description={field.description}>
            {field.type==='file' ? <TemplateUpload key={template.id+':'+field.id} label={field.label} value={value} onChange={value=>answer(field,value)}/> : field.property === "priority" ? (
              <select
                className="input"
                aria-label={field.label}
                value={value ?? 0}
                onChange={(e) => answer(field, Number(e.target.value))}
              >
                {["No priority", "Urgent", "High", "Medium", "Low"].map(
                  (name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ),
                )}
              </select>
            ) : field.property === "customerId" ? (
              <select
                className="input"
                aria-label={field.label}
                value={value ?? ""}
                onChange={(e) => answer(field, e.target.value)}
              >
                <option value="">Select customer…</option>
                {data.customers
                  .filter((c) => !c.deletedAt)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            ) : field.property === "labelIds" ? (
              <select
                className="input"
                aria-label={field.label}
                value={
                  (value ?? []).find((id: string) =>
                    data.labels.some(
                      (l) => l.id === id && l.group === field.group,
                    ),
                  ) ?? ""
                }
                onChange={(e) =>
                  answer(
                    field,
                    [
                      ...(value ?? []).filter(
                        (id: string) =>
                          !data.labels.some(
                            (l) => l.id === id && l.group === field.group,
                          ),
                      ),
                      e.target.value,
                    ].filter(Boolean),
                  )
                }
              >
                <option value="">Select label…</option>
                {data.labels
                  .filter(
                    (l) =>
                      !l.deletedAt && !l.archivedAt &&
                      l.group === field.group &&
                      (!l.teamId || teamScopes.has(l.teamId)),
                  )
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            ) : field.type === 'checkbox' ? <input type="checkbox" aria-label={field.label} checked={value===true} onChange={event=>answer(field,event.target.checked)}/> : field.type === 'number' ? <input className="input" type="number" step="any" aria-label={field.label} value={value??''} onChange={event=>answer(field,event.target.value===''?'':Number(event.target.value))}/> : field.type === "date" || field.property === "dueDate" ? (
              <DatePicker
                label={field.label}
                value={value ?? ""}
                onChange={(v) => answer(field, v)}
              />
            ) : field.type === "textarea" ? (
              <textarea
                className="input"
                rows={3}
                aria-label={field.label}
                value={value ?? ""}
                onChange={(e) => answer(field, e.target.value)}
              />
            ) : field.type === "select" ? (
              <select
                className="input"
                aria-label={field.label}
                value={value ?? ""}
                onChange={(e) => answer(field, options.find(option=>String(option.value)===e.target.value)?.value??'')}
              >
                <option value="">Select…</option>
                {options.map((option) => (
                  <option key={String(option.value)} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : field.type === "checkboxes" ? (
              <span className="template-checkboxes">
                {options.map((option) => (
                  <label key={String(option.value)}>
                    <input
                      type="checkbox"
                      checked={(value ?? []).includes(option.value)}
                      onChange={(e) =>
                        answer(
                          field,
                          e.target.checked
                            ? [...(value ?? []), option.value]
                            : (value ?? []).filter((v: string|number) => v !== option.value),
                        )
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </span>
            ) : (
              <TextInput
                aria-label={field.label}
                value={value ?? ""}
                onChange={(e) => answer(field, e.target.value)}
              />
            )}
          </Field></div>
        );
      })}
    </div>
  );
}

export function TemplatesSettings({ teamId,defaultKind="all" }: { teamId?: string;defaultKind?:string }) {
  const store = useAppStore(),
    navigate=useNavigate(),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState(defaultKind),
    [choosingIssueType,setChoosingIssueType]=useState(false);
  const [params, setParams] = useSearchParams();
  const templateId = params.get('template');
  const requestedNew=['issue','document','project'].includes(params.get('new')||'')?params.get('new'):null;
  const sourceIssue=params.get('fromIssue')?store.data.issues.find(issue=>issue.id===params.get('fromIssue')&&!issue.deletedAt):undefined;
  const sourceProperties=sourceIssue?Object.fromEntries(['statusId','priority','assigneeId','projectId','milestoneId','estimate','labelIds'].filter(key=>sourceIssue[key]!==undefined).map(key=>[key,sourceIssue[key]])):{};
  const linkedTemplate = store.data.templates.find(t=>t.id===templateId && !t.deletedAt && !t.archivedAt);
  const editing:Entity|Record<string,any>|null|undefined = templateId ? (store.initialSyncing ? null : linkedTemplate) : requestedNew?{name:sourceIssue?.title??"",type:requestedNew,teamId:teamId??sourceIssue?.teamId??"",title:sourceIssue?.title??"",description:sourceIssue?.description??"",properties:{priority:0,labelIds:[],...sourceProperties},formFields:[],subIssues:[]}:null;
  const setEditing = (value: Entity | Record<string, any> | null,mode?:'standard'|'form') => {
    const next = new URLSearchParams(params);
    next.delete("new");
    next.delete("fromIssue");
    next.delete("mode");
    if(value&&!value.id)next.set("new",value.type||"issue");
    if(value&&!value.id&&value.type==='issue'&&mode)next.set('mode',mode);
    if (value?.id) next.set('template', value.id);
    else next.delete('template');
    setParams(next);
  };
  const team = store.data.teams.find((t) => t.id === teamId);
  const templates = store.data.templates.filter(
    (t) =>
      !t.deletedAt &&
      !t.archivedAt &&
      (!teamId ||
        issueTemplates(store.data, teamId).some((x) => x.id === t.id) ||
        t.teamId === teamId) &&
      (kind === "all" || t.type === kind) &&
      t.name.toLowerCase().includes(query.toLowerCase()),
  );
  const newDraft=()=>({
    name: "",
    type: defaultKind==='all'?"issue":defaultKind,
    teamId: teamId ?? "",
    title: "",
    description: "",
    properties: { priority: 0, labelIds: [] },
    formFields: [],
    subIssues: [],
  });
  const startNew=()=>defaultKind==='issue'&&!teamId?setChoosingIssueType(true):setEditing(newDraft());
  const closeEditor=()=>params.get('return')==='documents'?navigate('/settings/documents'):setEditing(null);
  if(requestedNew&&params.get("fromIssue")&&!sourceIssue)return <p role="status">{store.initialSyncing?"Loading issue…":"Issue not found"}</p>;
  if(editing)return <TemplateEditor key={editing.id??"new:"+editing.type+':'+(params.get('mode')||'standard')} initial={editing} issueMode={params.get('mode')==='form'||!!editing.formFields?.length?'form':'standard'} onClose={closeEditor}/>;
  if(!teamId&&['issue','project'].includes(defaultKind)){
    const noun=defaultKind==='project'?'project':'issue',title=noun[0].toUpperCase()+noun.slice(1)+' templates';
    return <div className="workspace-template-settings">
      <div className="feature-setting-title"><div><h1>{title}</h1><p>These templates are available when creating {noun}s for any team in the workspace. To create<br className="workspace-template-break"/> templates that only apply to specific teams, add them as team templates. <a href="https://parabolic.app/docs/issue-templates" target="_blank" rel="noreferrer">Docs ↗</a></p></div></div>
      <div className="feature-settings-card workspace-template-card">
        {!templates.length?<div className="feature-settings-row workspace-template-empty"><span>No {noun} templates</span><Button onClick={startNew}><Icon name="Plus"/>New template</Button></div>:<>{templates.map(t=><div className="feature-settings-row" key={t.id}><Icon name={t.type==='project'?'Box':'FileText'}/><div><strong>{t.name}</strong><p>{t.formFields?.length?'Form':'Standard'} template</p></div><Button onClick={()=>setEditing(t)}>Edit</Button><EntityMenu kind="templates" item={t}/></div>)}<div className="feature-settings-row workspace-template-add"><span/><Button onClick={startNew}><Icon name="Plus"/>New template</Button></div></>}
      </div>
      {choosingIssueType&&<Modal title="Choose issue template type" onClose={()=>setChoosingIssueType(false)} className="template-type-dialog"><div className="template-type-options"><button type="button" className="template-type-option" onClick={()=>{setChoosingIssueType(false);setEditing(newDraft(),'standard')}}><span><strong>Standard</strong><small>Basic template with title, description,<br/>and default attributes</small></span><span className="template-type-preview standard"><b>Issue title</b><i>Add description…</i><em><span>◌ Backlog</span><span>⋯ Priority</span><span>•••</span></em></span></button><button type="button" className="template-type-option" onClick={()=>{setChoosingIssueType(false);setEditing(newDraft(),'form')}}><span><strong>Custom Form</strong><small>Define structured fields and inputs.<br/>Ideal for Asks</small></span><span className="template-type-preview form"><b>Repro steps</b><i>Enter text</i><b>Platform</b><i>Select an option⌄</i></span></button></div></Modal>}
      {templateId&&!store.initialSyncing&&!linkedTemplate&&<p role="status">Template not found</p>}
    </div>;
  }
  return (
    <>
      <div className="feature-setting-title">
        <div>
          <h1>Templates</h1>
          <p>Reusable issue forms, project plans, and documents.</p>
        </div>
        <Button
          onClick={startNew}
        >
          <Icon name="Plus" />
          New template
        </Button>
      </div>
      <div className="template-toolbar">
        <TextInput
          aria-label="Search templates"
          placeholder="Search templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input"
          aria-label="Template type filter"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {["all", "issue", "project", "document"].map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </div>
      <div className="feature-settings-card">
        {templates.map((t) => (
          <div className="feature-settings-row" key={t.id}>
            <Icon name={t.type === "project" ? "Box" : "FileText"} />
            <div>
              <strong>{t.name}</strong>
              <p>
                {t.formFields?.length ? "Form" : (t.type ?? "Issue")} template ·{" "}
                {store.data.teams.find((team) => team.id === t.teamId)?.name ??
                  "Workspace"}
                {t.subIssues?.length
                  ? ` · ${t.subIssues.length} sub-issues`
                  : ""}
              </p>
            </div>
            <Button onClick={() => setEditing(t)}>Edit</Button>
            <EntityMenu kind="templates" item={t} />
          </div>
        ))}
      </div>
      {!templates.length && (
        <div className="empty-state">
          <Icon name="FileText" size={30} />
          <h3>No templates</h3>
          <p>Create a template for recurring work.</p>
        </div>
      )}
      {team && (
        <section className="feature-setting-section">
          <h3>Default templates</h3>
          <div className="feature-settings-card">
            {[
              ["defaultTemplateId", "Team members"],
              ["nonMemberDefaultTemplateId", "Other workspace members"],
              ["defaultProjectTemplateId", "New projects"],
            ].map(([property, label]) => (
              <div className="feature-settings-row" key={property}>
                <strong>{label}</strong>
                <select
                  className="input"
                  aria-label={`${label} default template`}
                  value={team[property] ?? ""}
                  onChange={(e) =>
                    void store
                      .update("teams", team.id, {
                        [property]: e.target.value || null,
                      })
                      .catch((e) => store.toast(e.message))
                  }
                >
                  <option value="">No default template</option>
                  {(property === "defaultProjectTemplateId"
                    ? store.data.templates.filter(
                        (t) =>
                          !t.deletedAt &&
                          t.type === "project" &&
                          (!t.teamId || t.teamId === teamId),
                      )
                    : issueTemplates(store.data, teamId).filter(
                        (t) =>
                          property !== "defaultTemplateId" ||
                          !t.formFields?.length,
                      )
                  ).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}
      {templateId && !store.initialSyncing && !linkedTemplate && <p role="status">Template not found</p>}
    </>
  );
}

function TemplateEditorFrame({project,title,onClose,onSave,children}:{project:boolean;title:string;onClose:()=>void;onSave:()=>void;children:React.ReactNode}){
 if(!project)return <Modal title={title} onClose={onClose} wide className="template-editor">{children}</Modal>;
 return <section className="template-editor project-template-editor project-template-page" aria-label={title} onKeyDown={event=>{if((event.metaKey||event.ctrlKey)&&(event.key==='Enter'||event.key==='s')){event.preventDefault();onSave();}}}><button className="feature-text-button template-page-back" onClick={onClose}><Icon name="ArrowLeft" size={14}/>Project templates</button><header className="template-page-heading"><h1>{title}</h1></header>{children}</section>;
}

function TemplateEditor({
  initial,
  issueMode='standard',
  onClose,
}: {
  initial: Record<string, any>;
  issueMode?:'standard'|'form';
  onClose: () => void;
}) {
  const store = useAppStore(),
    [draft, setDraft] = useState({ ...initial }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [advanced,setAdvanced]=useState(false),
    [visibilityOpen,setVisibilityOpen]=useState(false);
  const baseline=useRef(JSON.stringify(initial)),guard=useTemplateNavigationGuard(draft.type!=="document"&&JSON.stringify(draft)!==baseline.current);
  const close=()=>guard.request(onClose);
  const set = (key: string, value: any) =>
    setDraft((v) => ({ ...v, [key]: value }));
  const property = (key: string, value: any) =>
    setDraft((v) => ({ ...v, properties: { ...v.properties, [key]: value } }));
  const save = async () => {
    if (busy || !draft.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (draft.type === "project")
        validateProjectTemplatePlan(draft.projectPlan);
      const body = {
        ...draft,
        teamId: draft.teamId || null,
        properties: {
          ...draft.properties,
          title: draft.title,
          description: draft.description,
          ...(draft.teamId ? { teamId: draft.teamId } : {}),
        },
      };
      if (!draft.teamId) {
        delete body.properties.teamId;
        body.properties.labelIds=(body.properties.labelIds||[]).filter((id:string)=>!store.data.labels.find(label=>label.id===id)?.teamId);
        delete body.properties.statusId;
        delete body.properties.cycleId;
      }
      if (initial.id) await store.update("templates", initial.id, body);
      else await store.create("templates", body);
      guard.allow();onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const teamField=(<Field label="Team">
            <select
              className="input"
              aria-label="Template team"
              value={draft.teamId ?? ""}
              onChange={(e) =>
                setDraft((v) => ({
                  ...v,
                  teamId: e.target.value,
                  properties: {
                    ...v.properties,
                    statusId: null,
                    cycleId: null,
                    labelIds: [],
                  },
                }))
              }
            >
              <option value="">{draft.type==='issue'?'Team':'Workspace'}</option>
              {store.data.teams
                .filter((t) => !t.deletedAt)
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </Field>);
  if(draft.type==='issue')return <>
    <section className={`template-editor issue-template-page ${issueMode==='form'?'issue-template-form-page':'issue-template-standard-page'}`} aria-label={initial.id?'Edit template':'New template'} onKeyDown={event=>{if((event.metaKey||event.ctrlKey)&&(event.key==='Enter'||event.key==='s')){event.preventDefault();void save()}}}>
      <button className="feature-text-button template-page-back" onClick={close}><Icon name="ChevronLeft" size={14}/>Issue templates</button>
      <div className="issue-template-editor-content">
        <div className="issue-template-identity"><span className="issue-template-icon"><Icon name="FileText" size={18}/></span><TextInput autoFocus aria-label="Template name" placeholder="Template name" value={draft.name} onChange={event=>set('name',event.target.value)}/><TextInput aria-label="Template description" placeholder="Add an optional template description…" value={draft.templateDescription??''} onChange={event=>set('templateDescription',event.target.value)}/></div>
        {issueMode==='standard'?<div className="issue-template-content-card"><TextInput aria-label="Template default title" placeholder="Issue title" value={draft.title??''} onChange={event=>set('title',event.target.value)}/><RichEditor templateMode value={draft.description??''} onChange={value=>set('description',value)} placeholder="Add description…"/></div>:<section className="issue-template-form-fields"><header><h2>Form fields</h2><p>Choose which form fields to show when creating an issue with this template</p></header><TemplateFieldBuilder nativePage fields={draft.formFields??[]} onChange={value=>set('formFields',value)}/></section>}
        <section className="issue-template-defaults"><header><h2>Default properties</h2><p>{issueMode==='standard'?'Automatically applied upon issue creation, and editable when composing within Parabolic':'Automatically applied upon issue creation'}</p></header><div className="template-default-properties"><span className="issue-team-property"><Icon name="Contact" size={13}/>{teamField}</span>{(['priority','assigneeId','projectId','estimate','labelIds'] as const).map(field=><PropertyPicker key={field} field={field} value={draft.properties?.[field]} teamId={draft.teamId} onChange={value=>property(field,value)}/>) }<Button aria-label="Open menu" className="issue-template-more" onClick={()=>setAdvanced(value=>!value)}><Icon name="MoreHorizontal" size={14}/></Button></div></section>
        {advanced&&<div className="issue-template-advanced"><SubIssueBuilder items={draft.subIssues??[]} onChange={value=>set('subIssues',value)} teamId={draft.teamId}/></div>}
        {error&&<p className="feature-error" role="alert">{error}</p>}
        <div className="issue-template-actions"><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!draft.name.trim()||busy} onClick={save}>{busy?'Saving…':initial.id?'Save template':'Create'}</Button></div>
      </div>
    </section>
    {guard.pending&&<Modal title="Discard changes?" onClose={guard.cancel}><div className="modal-body"><p>You have unsaved changes to this template. They will be lost if you continue.</p></div><div className="modal-footer"><Button onClick={guard.cancel}>Cancel</Button><Button variant="danger" onClick={guard.confirm}>Discard</Button></div></Modal>}
  </>;
  if(draft.type==='project')return <>
    <section className="template-editor project-template-editor project-template-page native-project-template-page" aria-label={initial.id?'Edit project template':'New project template'} onKeyDown={event=>{if((event.metaKey||event.ctrlKey)&&(event.key==='Enter'||event.key==='s')){event.preventDefault();void save()}}}>
      <button className="feature-text-button template-page-back" onClick={close}><Icon name="ChevronLeft" size={14}/>Project templates</button>
      <header className="template-page-heading"><h1>{initial.id?'Edit project template':'New project template'}</h1></header>
      <div className="native-project-template-content">
        <Field label="Name"><TextInput aria-label="Template name" placeholder="Add a descriptive name…" value={draft.name} onChange={event=>set('name',event.target.value)}/></Field>
        <section className="native-project-card" aria-label="Project template details">
          <span className="native-project-icon"><EntityIconPicker compact label="Choose icon" fallback="Box" size={16} icon={draft.properties?.icon} color={draft.properties?.color} onChange={({icon,color})=>set('properties',{...draft.properties,icon,color})}/></span>
          <TextInput aria-label="Template default title" placeholder="Project name" value={draft.title??''} onChange={event=>set('title',event.target.value)}/>
          <TextInput aria-label="Template project summary" placeholder="Add a short summary…" value={draft.properties?.summary??''} onChange={event=>property('summary',event.target.value)}/>
          <NativeProjectTemplateCanvas properties={draft.properties||{}} onPropertiesChange={value=>set('properties',value)} description={draft.description??''} onDescriptionChange={value=>set('description',value)} plan={draft.projectPlan} onPlanChange={value=>set('projectPlan',value)} teamId={draft.teamId}/>
        </section>
        {error&&<p className="feature-error" role="alert">{error}</p>}
        <footer className="native-project-template-footer">
          <span>Visibility</span><div className="native-template-visibility"><button type="button" aria-label="Template visibility" aria-expanded={visibilityOpen} onClick={()=>setVisibilityOpen(value=>!value)}><Icon name="Building2" size={14}/>{draft.teamId?store.data.teams.find(team=>team.id===draft.teamId)?.name||'Team':'Workspace'}</button>{visibilityOpen&&<div className="native-template-visibility-menu" role="menu"><button type="button" role="menuitem" onClick={()=>{setDraft(value=>({...value,teamId:'',properties:{...value.properties,statusId:null,cycleId:null,labelIds:[]}}));setVisibilityOpen(false)}}>Workspace</button>{store.data.teams.filter(team=>!team.deletedAt).map(team=><button type="button" role="menuitem" key={team.id} onClick={()=>{setDraft(value=>({...value,teamId:team.id,properties:{...value.properties,statusId:null,cycleId:null,labelIds:[]}}));setVisibilityOpen(false)}}>{team.name}</button>)}</div>}</div>
          <Button onClick={close}>Cancel</Button><Button variant="primary" disabled={!draft.name.trim()||busy} onClick={save}>{busy?'Saving…':initial.id?'Save':'Create'}</Button>
        </footer>
      </div>
    </section>
    {guard.pending&&<Modal title="Discard changes?" onClose={guard.cancel}><div className="modal-body"><p>You have unsaved changes to this template. They will be lost if you continue.</p></div><div className="modal-footer"><Button onClick={guard.cancel}>Cancel</Button><Button variant="danger" onClick={guard.confirm}>Discard</Button></div></Modal>}
  </>;
  return (
    <>
    <TemplateEditorFrame project={draft.type==="project"} title={draft.type==="project"?(initial.id?"Edit project template":"New project template"):(initial.id?"Edit template":"New template")} onClose={close} onSave={()=>void save()}>
      <div className="modal-body">
        <div className="template-editor-basics">
          <Field label="Template name">
            <TextInput
              autoFocus
              aria-label="Template name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Template type">
            <select
              className="input"
              aria-label="Template type"
              value={draft.type}
              onChange={(e) => set("type", e.target.value)}
            >
              {["issue", "project", "document"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          {draft.type!=="project"&&teamField}
        </div>
        <Field label="Default title">
          <TextInput
            aria-label="Template default title"
            placeholder={draft.type==='project'?'Project name':'Title or {{field-id}}'}
            value={draft.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
          />
        </Field>
        <Field label="Description">
          <RichEditor
            templateMode
            value={draft.description ?? ""}
            onChange={(v) => set("description", v)}
            placeholder="Add instructions, placeholders, and context…"
          />
        </Field>
        {draft.type === "project" && (
          <>
            <ProjectTemplateProperties
              value={draft.properties || {}}
              onChange={(v) => set("properties", v)}
            />
            <ProjectTemplatePlanEditor
              value={draft.projectPlan}
              onChange={(v) => set("projectPlan", v)}
              teamId={draft.teamId}
            />
          </>
        )}
        {draft.type === "issue" && (
          <>
            <div className="template-default-properties">
              {(
                [
                  "statusId",
                  "priority",
                  "assigneeId",
                  "projectId",
                  "labelIds",
                  "estimate",
                  "cycleId",
                ] as const
              )
                .filter(
                  (field) =>
                    draft.teamId || !["statusId", "cycleId"].includes(field),
                )
                .map((field) => (
                  <PropertyPicker
                    key={field}
                    field={field}
                    value={draft.properties?.[field]}
                    teamId={draft.teamId}
                    onChange={(v) => property(field, v)}
                  />
                ))}
            </div>
            <TemplateFieldBuilder
              fields={draft.formFields ?? []}
              onChange={(v) => set("formFields", v)}
            />
            <SubIssueBuilder
              items={draft.subIssues ?? []}
              onChange={(v) => set("subIssues", v)}
              teamId={draft.teamId}
            />
          </>
        )}
        {error && (
          <p className="feature-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        {draft.type==="project"&&<div className="template-page-visibility"><span>Visibility</span>{teamField}</div>}
        <Button onClick={close}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!draft.name.trim() || busy}
          onClick={save}
        >
          {busy ? "Saving…" : initial.id ? "Save template" : "Create template"}
        </Button>
      </div>
    </TemplateEditorFrame>
    {guard.pending&&<Modal title="Discard changes?" onClose={guard.cancel}><div className="modal-body"><p>You have unsaved changes to this template. They will be lost if you continue.</p></div><div className="modal-footer"><Button onClick={guard.cancel}>Cancel</Button><Button variant="danger" onClick={guard.confirm}>Discard</Button></div></Modal>}
    </>
  );
}

function TemplateFieldBuilder({
  fields,
  onChange,
  nativePage=false,
}: {
  fields: TemplateField[];
  onChange: (fields: TemplateField[]) => void;
  nativePage?:boolean;
}) {
  const patch = (i: number, value: Partial<TemplateField>) =>
    onChange(fields.map((f, index) => (index === i ? { ...f, ...value } : f)));
  const move = (index: number, offset: number) => {
    const next = [...fields];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  return (
    <section className="template-builder">
      <div className="template-builder-title">
        {nativePage&&fields.length===0?<span>No fields added yet</span>:<h3>{nativePage?'Fields':'Form fields'}</h3>}
        <Button
          onClick={() =>
            onChange([
              ...fields,
              {
                id: crypto.randomUUID(),
                label: "",
                type: "text",
                required: false,
              },
            ])
          }
        >
          <Icon name="Plus" size={13} />
          {nativePage?'Add field':'Add form field'}
        </Button>
      </div>
      {fields.map((field, i) => (
        <div className="template-field-row" key={field.id}>
          <div className="template-field-main">
            <TextInput
              aria-label={`Field ${i + 1} label`}
              placeholder="Field label"
              value={field.label}
              onChange={(e) => patch(i, { label: e.target.value })}
            />
            <select
              className="input"
              aria-label={`Field ${i + 1} type`}
              value={field.type}
              onChange={(e) =>
                patch(i, {
                  type: e.target.value as TemplateField["type"],
                  property: e.target.value === "property" ? "title" : undefined,
                })
              }
            >
              {[
                ["text", "Text"],
                ["textarea", "Long text"],
                ["select", "Dropdown"],
                ["checkboxes", "Checkboxes"],
                ["date", "Date"],
                ["file", "File upload"],
                ["instructions", "Instructions"],
                ["property", "Issue property"],
              ].map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button
              disabled={i === 0}
              aria-label={`Move field ${i + 1} up`}
              onClick={() => move(i, -1)}
            >
              <Icon name="ArrowUp" size={13} />
            </Button>
            <Button
              disabled={i === fields.length - 1}
              aria-label={`Move field ${i + 1} down`}
              onClick={() => move(i, 1)}
            >
              <Icon name="ArrowDown" size={13} />
            </Button>
            <Button
              aria-label={`Remove field ${i + 1}`}
              onClick={() => onChange(fields.filter((_, index) => index !== i))}
            >
              <Icon name="Trash2" size={13} />
            </Button>
          </div>
          {field.type === "property" && (
            <>
              <select
                className="input"
                aria-label={`Field ${i + 1} property`}
                value={field.property ?? "title"}
                onChange={(e) => patch(i, { property: e.target.value })}
              >
                {[
                  ["title", "Title"],
                  ["priority", "Priority"],
                  ["dueDate", "Due date"],
                  ["customerId", "Customer"],
                  ["labelIds", "Label group"],
                ].map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              {field.property === "labelIds" && (
                <TextInput
                  aria-label={`Field ${i + 1} label group`}
                  placeholder="Label group name"
                  value={field.group ?? ""}
                  onChange={(e) => patch(i, { group: e.target.value })}
                />
              )}
            </>
          )}
          {["select", "checkboxes"].includes(field.type) && (
            <textarea
              className="input"
              aria-label={`Field ${i + 1} options`}
              placeholder="One option per line"
              value={field.options?.map(option=>typeof option==='object'?option.label:option).join("\n") ?? ""}
              onChange={(e) =>
                patch(i, { options: e.target.value.split("\n") })
              }
            />
          )}
          {field.type!=="instructions"&&<TextInput aria-label={`Field ${i+1} description`} placeholder="Add description…" value={field.description||""} onChange={event=>patch(i,{description:event.target.value})}/>}
          <div className="template-field-foot">
            <label>
              <input
                type="checkbox"
                checked={!!field.required}
                disabled={field.type === "instructions"}
                onChange={(e) => patch(i, { required: e.target.checked })}
              />
              Required
            </label>
            <span className="muted">
              Placeholder: {"{{"}
              {field.id}
              {"}}"}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}

function SubIssueBuilder({
  items,
  onChange,
  teamId,
}: {
  items: Record<string, any>[];
  onChange: (items: Record<string, any>[]) => void;
  teamId?: string;
}) {
  return (
    <section className="template-builder">
      <div className="template-builder-title">
        <h3>Sub-issues</h3>
        <Button
          onClick={() =>
            onChange([...items, { title: "", description: "", priority: 0 }])
          }
        >
          <Icon name="Plus" size={13} />
          Add template sub-issue
        </Button>
      </div>
      {items.map((item, i) => (
        <div className="template-field-row" key={i}>
          <div className="template-field-main">
            <TextInput
              aria-label={`Sub-issue ${i + 1} title`}
              placeholder="Sub-issue title"
              value={item.title ?? ""}
              onChange={(e) =>
                onChange(
                  items.map((x, index) =>
                    index === i ? { ...x, title: e.target.value } : x,
                  ),
                )
              }
            />
            <PropertyPicker
              field="assigneeId"
              value={item.assigneeId}
              teamId={teamId}
              onChange={(assigneeId) =>
                onChange(
                  items.map((x, index) =>
                    index === i ? { ...x, assigneeId } : x,
                  ),
                )
              }
            />
            <Button
              aria-label={`Remove sub-issue ${i + 1}`}
              onClick={() => onChange(items.filter((_, index) => index !== i))}
            >
              <Icon name="Trash2" size={13} />
            </Button>
          </div>
          <textarea
            className="input"
            aria-label={`Sub-issue ${i + 1} description`}
            placeholder="Description"
            value={item.description ?? ""}
            onChange={(e) =>
              onChange(
                items.map((x, index) =>
                  index === i ? { ...x, description: e.target.value } : x,
                ),
              )
            }
          />
        </div>
      ))}
    </section>
  );
}
