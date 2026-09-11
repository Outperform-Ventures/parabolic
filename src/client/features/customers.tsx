import {CustomerRequestDirection} from '../customer-request-direction';
import {EntityIcon} from './entity-icon';
import {NativeSettingsIcon} from '../components/settings-icons';
import {CustomerChoiceSelect} from '../customer-status-select';
import {CustomerCommandMenu} from '../customer-command-menu';
import {isAttachmentUrl} from '../components/attachment-url';
import {CustomerEditor} from '../customer-editor';
import {sortIssueRequests,type RequestOrder} from '../issue-request-order';
import {patchUserPreferences,useAppStore} from '../store';
import {Dropdown,Icon,MenuItem} from '../components/ui';
import {IssueCustomerRequest} from '../issue-customer-request';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  BellOff,
  Building2,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Settings,
  Star,
  Triangle,
} from "lucide-react";
import { apiRequest } from "../store";
import { RichEditor } from "../components/ui";
import {
  Action,
  AddButton,
  Blank,
  Confirm,
  EntityMenu,
  FormDialog,
  Header,
  IssueLinks,
  Person,
  SearchBox,
  Status,
  Tabs,
  date,
  live,
  optionList,
  useActions,
  type FormField,
  type Row,
} from "./shared";
import { projectStatuses, projectStatusCategory } from "./project-statuses";

const defaults = {
  defaultTeamId: "",
  revenueUnit: "USD",
  tiers: ["Enterprise", "Growth", "Startup", "Individual"],
  statuses: ["Active", "Prospect", "Churned", "Lost"],
  statusColors: {Active:'#5e6ad2',Prospect:'#54caa0',Churned:'#f45b69',Lost:'#f2994a'} as Record<string,string>,
  statusDescriptions: {} as Record<string,string>,
  excludedDomains: [] as string[],
  genericDomains: [] as string[],
  revenueFrequency: 'annual',
  dataSource: 'none',
  manualEdits: true,
};
export function customerSettings(data: any) {
  return {
    ...defaults,
    ...data.workspaces.find((w: Row) => w.id === data.workspaceId)
      ?.customerSettings,
    tiers: live(data.customerTiers??[]).sort((a:Row,b:Row)=>a.position-b.position).map((tier:Row)=>tier.displayName),
  };
}
function revenue(value: any, unit: string) {
  if (value == null || value === "") return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: unit,
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${new Intl.NumberFormat().format(Number(value))} ${unit}`;
  }
}
function fields(data: any): FormField[] {
  const config = customerSettings(data);
  return [
    { key: "name", label: "Name", required: true },
    { key: "domain", label: "Domain", placeholder: "company.com" },
    { key: "email", label: "Contact email", type: "email" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "logoUrl", label: "Logo URL" },
    {
      key: "ownerId",
      label: "Owner",
      type: "select",
      options: optionList(data.users),
    },
    {
      key: "tier",
      label: "Tier",
      type: "select",
      options: ["", ...config.tiers].map((x) => ({
        value: x,
        label: x || "No tier",
      })),
    },
    {
      key: "status",
      label: "Customer status",
      type: "select",
      options: ["", ...config.statuses].map((x) => ({
        value: x,
        label: x || "No status",
      })),
    },
    {
      key: "revenue",
      label: `Revenue (${config.revenueUnit})`,
      type: "number",
      min: 0,
    },
    { key: "size", label: "Company size", type: "number", min: 0 },
  ];
}
function CompanyLogo({
  customer,
  large = false,
}: {
  customer: Row;
  large?: boolean;
}) {
  return (
    <span
      className={`feature-company-icon ${large ? "feature-large-icon" : ""}`}
    >
      {customer.logoUrl && (/^https?:\/\//.test(customer.logoUrl)||isAttachmentUrl(customer.logoUrl)) ? (
        <img src={customer.logoUrl} alt="" />
      ) : (
        customer.name?.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export function CustomersPage() {
  const { data } = useActions(),
    nav = useNavigate(),
    location = useLocation();
  const [query, setQuery] = useState(""),
    [adding, setAdding] = useState(false),
    [sort, setSort] = useState("name"),
    [descending, setDescending] = useState(false),
    [tier, setTier] = useState(""),
    [status, setStatus] = useState("");
  useEffect(() => {
    if (new URLSearchParams(location.search).get("new") === "1")
      setAdding(true);
  }, [location.key]);
  const config = customerSettings(data),
    counts = useMemo(() => {
      const values = new Map<string, number>();
      for (const request of live(data.requests))
        values.set(
          request.customerId,
          (values.get(request.customerId) ?? 0) + 1,
        );
      return values;
    }, [data.requests]);
  const customers = live(data.customers)
    .filter(
      (c) =>
        `${c.name} ${c.domain ?? ""} ${c.email ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!tier || c.tier === tier) &&
        (!status || c.status === status),
    )
    .sort((a, b) => {
      const value = sort === "requests"
        ? (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0)
        : ["revenue", "size"].includes(sort)
          ? Number(a[sort] ?? 0) - Number(b[sort] ?? 0)
          : String(a[sort] ?? "").localeCompare(String(b[sort] ?? ""));
      return descending ? -value : value;
    });
  const order = (next: string) => {
    setDescending(sort === next ? !descending : false);
    setSort(next);
  };
  const currency = (value: unknown) => value == null || value === "" ? "" : new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: config.revenueUnit,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
  const compactCurrency = (value: unknown) => value == null || value === "" ? "—" : new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: config.revenueUnit,
    notation: "compact",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(value));
  return (
    <section className="feature-page">
      <header className="feature-header customer-directory-header">
        <h2 className="feature-heading">Customers</h2>
        <div className="feature-header-actions"><AddButton onClick={() => setAdding(true)}>New customer</AddButton></div>
      </header>
      <div className="customer-directory-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Find by name or domain…" />
        <span className="spacer" />
        <Dropdown align="right" trigger={<button type="button" className="feature-icon-button" aria-label="Add filter"><Icon name="Filter" size={14}/></button>}>
          <div className="customer-directory-options" data-keep-open>
            <label>Tier<select aria-label="Filter customer tier" value={tier} onChange={e => setTier(e.target.value)}><option value="">All tiers</option>{config.tiers.map((x: string) => <option key={x}>{x}</option>)}</select></label>
            <label>Status<select aria-label="Filter customer status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{config.statuses.map((x: string) => <option key={x}>{x}</option>)}</select></label>
          </div>
        </Dropdown>
        <Dropdown align="right" trigger={<button type="button" className="feature-icon-button" aria-label="Display options"><Icon name="SlidersHorizontal" size={14}/></button>}>
          <div className="customer-directory-options" data-keep-open>
            <label>Ordering<select aria-label="Order customers" value={sort} onChange={e => { setSort(e.target.value); setDescending(false); }}><option value="name">Name</option><option value="requests">Requests</option><option value="revenue">Annual revenue</option><option value="size">Size</option><option value="status">Status</option><option value="tier">Tier</option></select></label>
          </div>
        </Dropdown>
      </div>
      {customers.length ? (
        <div className="customer-directory-table">
          <div className="customer-directory-head">
            {[["name","Name"],["requests","Requests"],["revenue","Annual revenue"],["size","Size"],["status","Status"],["tier","Tier"]].map(([value,label]) => <button type="button" key={value} onClick={() => order(value)} aria-label={`Order by ${label}`} aria-pressed={sort === value}>{label}</button>)}
            <span>Owner</span>
          </div>
          {customers.map(c => {
            const owner = data.users.find((user: Row) => user.id === c.ownerId)?.name || "Unassigned";
            const accessible = [c.name, c.name, counts.get(c.id) ?? 0, currency(c.revenue), c.size || "", c.status || "", c.tier || "", owner].filter(value => value !== "").join(" ");
            return <Link className="customer-directory-row" aria-label={accessible} to={`/customer/${c.id}`} key={c.id}>
              <span className="feature-name"><CompanyLogo customer={c}/>{c.name}</span>
              <span>{counts.get(c.id) ?? 0}</span>
              <span>{compactCurrency(c.revenue)}</span>
              <span>{c.size || "—"}</span>
              <span>{c.status || "—"}</span>
              <span>{c.tier || "—"}</span>
              <Person id={c.ownerId}/>
            </Link>;
          })}
        </div>
      ) : (
        <Blank
          icon={<Building2 size={30} />}
          title={
            query || tier || status ? "No matching customers" : "Customers"
          }
          description="Connect customer feedback to the work it inspires."
          action={
            <AddButton onClick={() => setAdding(true)}>New customer</AddButton>
          }
        />
      )}{" "}
      {adding && (
        <CustomerEditor onClose={()=>setAdding(false)} onSaved={c=>nav(`/customer/${c.id}`)}/>
      )}
    </section>
  );
}

export function CustomerPage() {
  const { customerId } = useParams(),
    store = useActions(),
    { data, create, update, remove, act } = store,
    nav = useNavigate();
  const [edit, setEdit] = useState(false),
    [request, setRequest] = useState<Row | boolean>(false),
    [requestTargetIssueId, setRequestTargetIssueId] = useState<string | null>(null),
    [customerMenu, setCustomerMenu] = useState(false),
    [tab, setTab] = useState("Requests"),
    [requestViewOverride, setRequestViewOverride] = useState<Record<string, any>>({});
  const customer = live(data.customers).find((c) => c.id === customerId);
  if (!customer)
    return (
      <Blank
        title={
          store.initialSyncing ? "Loading customer…" : "Customer not found"
        }
      />
    );
  const requests = live(data.requests).filter(
      (r) => r.customerId === customer.id,
    ),
    issueIds = new Set(requests.map((r) => r.issueId)),
    projectIds = new Set(requests.flatMap((r) => customerRequestProjectIds(r,data.issues)));
  const issues = live(data.issues).filter(
      (i) => issueIds.has(i.id) || i.customerId === customer.id,
    ),
    projects = live(data.projects).filter((p) => projectIds.has(p.id));
  const config = customerSettings(data),
    user = data.users.find((candidate) => candidate.id === store.user?.id),
    requestView = {
      ...(user?.preferences?.customerRequestView?.[customer.id] ?? {}),
      ...requestViewOverride,
    },
    grouping = ["none", "status"].includes(requestView.grouping)
      ? requestView.grouping
      : "none",
    requestOrder = ["createdAt", "updatedAt"].includes(requestView.ordering)
      ? requestView.ordering
      : "createdAt",
    completed = ["all", "open", "completed"].includes(requestView.completed)
      ? requestView.completed
      : "all",
    showImportantFirst = requestView.showImportantFirst !== false,
    requestProperties = {
      id: requestView.properties?.id !== false,
      priority: requestView.properties?.priority !== false,
      status: requestView.properties?.status !== false,
      target: requestView.properties?.target !== false,
    },
    patchRequestView = (patch: Record<string, unknown>) => {
      setRequestViewOverride((current) => ({ ...current, ...patch }));
      return user
        ? void patchUserPreferences(user.id, {
            customerRequestView: {
              [customer.id]: { ...requestView, ...patch },
            },
          }).catch((error) => store.toast(error.message))
        : undefined;
    },
    favorite = live(data.favorites).find(
      (f) =>
        (f.entityId === customer.id || f.customerId === customer.id) &&
        f.userId === store.user?.id,
    ),
    subscription = live(data.subscriptions).find(
      (s) =>
        (s.entityId === customer.id || s.customerId === customer.id) &&
        s.userId === store.user?.id,
    );
  const requestStatus = (item: Row) => {
      const issue = data.issues.find((candidate) => candidate.id === item.issueId),
        project = data.projects.find((candidate) => candidate.id === item.projectId),
        workStatus = issue
          ? data.statuses.find((status) => status.id === issue.statusId)?.type
          : project
            ? projectStatusCategory(project.status, data)
            : null;
      return workStatus === "canceled"
        ? "Canceled"
        : workStatus === "completed"
          ? "Completed"
          : (item.status ?? "Open");
    },
    visibleRequests = requests.filter((item) => {
      const done = ["Completed", "Canceled"].includes(requestStatus(item));
      return completed === "all" || (completed === "completed" ? done : !done);
    }),
    ordered = visibleRequests.sort((a, b) =>
      (showImportantFirst ? Number(!!b.important) - Number(!!a.important) : 0) ||
      String(b[requestOrder] ?? b.createdAt).localeCompare(
        String(a[requestOrder] ?? a.createdAt),
      ),
    ),
    requestGroups = grouping === "status"
      ? Object.entries(
          Object.groupBy(ordered, (item) => requestStatus(item)),
        ).map(([label, items]) => [label, items ?? []] as const)
      : [["", ordered] as const];
  const annualRevenue=customer.revenue==null||customer.revenue===''?'—':new Intl.NumberFormat(undefined,{style:'currency',currency:config.revenueUnit,notation:'compact',minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(customer.revenue));
  return (
    <section className="feature-page">
      <Header
        title={customer.name}
        icon={<Building2 size={16} />}
        breadcrumb={{ title: "Customers", to: "/customers" }}
      >
        <Action
          role="switch"
          aria-checked={!!favorite}
          title={favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={() =>
            act(() =>
              favorite
                ? remove("favorites", favorite.id)
                : create("favorites", {
                    entityId: customer.id,
                    entityKind: "customers",
                    customerId: customer.id,
                    label: customer.name,
                    route: `/customer/${customer.id}`,
                    type: "customer",
                  }),
            )
          }
        >
          <Star size={15} fill={favorite ? "currentColor" : "none"} />
        </Action>
        <button type="button" className="feature-icon-button" aria-label="Open customer menu" aria-haspopup="menu" aria-expanded={customerMenu} onClick={()=>setCustomerMenu(true)}><MoreHorizontal size={17}/></button>
        <Action title="Copy page URL" onClick={()=>void act(()=>navigator.clipboard.writeText(location.href),'Link copied')}><Icon name="Link" size={15}/></Action>
        <Action
          title="Setup customer notifications"
          onClick={() =>
            act(() =>
              subscription
                ? remove("subscriptions", subscription.id)
                : create("subscriptions", {
                    entityId: customer.id,
                    entityKind: "customers",
                    customerId: customer.id,
                  }),
            )
          }
        >
          {subscription ? <BellOff size={15} /> : <Bell size={15} />}
        </Action>
      </Header>
      <div className="feature-readable customer-detail">
        <div className="customer-detail-summary">
          <CompanyLogo customer={customer} large />
          <div className="customer-detail-identity"><h1>{customer.name}</h1><span>{customer.domain || "No domain"}</span></div>
          <Action title="Edit customer" onClick={()=>setEdit(true)}><Icon name="Pencil" size={14}/></Action>
        </div>
        <div className="customer-detail-properties" aria-label="Customer properties">
          <div><span>Status</span><button onClick={()=>setEdit(true)}><Status value={customer.status||'No status'}/></button></div>
          <div><span>Revenue</span><strong>{annualRevenue}<small>/yr</small></strong></div>
          <div><span>Size</span><strong>{customer.size??'—'}</strong></div>
          <div><span>Owner</span><button onClick={()=>setEdit(true)}><Person id={customer.ownerId}/></button></div>
        </div>
        <Tabs
          items={["Requests", "Issues", "Projects"]}
          active={tab}
          onChange={setTab}
        />
        {tab === "Requests" ? (
          <>
            <div className="customer-detail-request-heading">
              <h2>Requests <span>{requests.length}</span></h2>
              <Dropdown align="right" trigger={<button className="feature-icon-button" aria-label="Display options"><Icon name="SlidersHorizontal" size={14}/></button>}>
                <div className="customer-request-display" data-keep-open>
                  <label><span>Grouping</span><CustomerChoiceSelect compact name="Request grouping" value={grouping} options={["none","status"]} labels={{none:"None",status:"Status"}} onChange={(value)=>patchRequestView({grouping:value})}/></label>
                  <label><span>Ordering</span><CustomerChoiceSelect compact name="Request ordering" value={requestOrder} options={["createdAt","updatedAt"]} labels={{createdAt:"Created date",updatedAt:"Updated date"}} onChange={(value)=>patchRequestView({ordering:value})}/></label>
                  <label><span>Completed</span><CustomerChoiceSelect compact name="Completed requests" value={completed} options={["all","open","completed"]} labels={{all:"All",open:"Open",completed:"Completed"}} onChange={(value)=>patchRequestView({completed:value})}/></label>
                  <label><span>Show important first</span><input type="checkbox" aria-label="Show important first" checked={showImportantFirst} onChange={(event)=>patchRequestView({showImportantFirst:event.target.checked})}/></label>
                  <div className="menu-separator" />
                  <strong>Display properties</strong>
                  {([['id','ID'],['priority','Priority'],['status','Status'],['target','Target/Due date']] as const).map(([key,label])=><label key={key}><span>{label}</span><input type="checkbox" aria-label={`Show ${label}`} checked={requestProperties[key]} onChange={(event)=>patchRequestView({properties:{...requestProperties,[key]:event.target.checked}})}/></label>)}
                </div>
              </Dropdown>
              <AddButton onClick={() => setRequest(true)}>Add customer request</AddButton>
            </div>
            {requestGroups.map(([label, items]) => (
              <React.Fragment key={label || "all"}>
                {label && <h3 className="customer-request-group">{label}<span>{items.length}</span></h3>}
                {items.map((r) => (
                  <CustomerDetailRequestRow
                    key={r.id}
                    request={r}
                    properties={requestProperties}
                    onEdit={() => setRequest(r)}
                    onNewOnIssue={(issueId) => setRequestTargetIssueId(issueId)}
                  />
                ))}
              </React.Fragment>
            ))}
            {!ordered.length && (
              <Blank
                title="No requests yet"
                action={
                  <AddButton onClick={() => setRequest(true)}>
                    Add request
                  </AddButton>
                }
              />
            )}
          </>
        ) : tab === "Issues" ? (
          <IssueLinks issues={issues} />
        ) : (
          <div className="feature-issue-list">
            {projects.map((p) => (
              <Link key={p.id} to={`/project/${p.id}`}>
                <Status
                  value={
                    projectStatuses(data).find((s) => s.id === p.status)
                      ?.name ?? p.status
                  }
                />
                <span className="feature-issue-title">{p.name}</span>
                <Person id={p.leadId} />
                <ChevronRight size={14} />
              </Link>
            ))}
            {!projects.length && <Blank title="No linked projects" />}
          </div>
        )}
      </div>
      {edit && (
        <CustomerEditor customer={customer} onClose={()=>setEdit(false)}/>
      )}{" "}
      {request === true && (
        <IssueCustomerRequest
          customerId={customer.id}
          onClose={() => setRequest(false)}
        />
      )}
      {typeof request === "object" && (
        <RequestEditor
          request={request}
          customerId={customer.id}
          onClose={() => setRequest(false)}
        />
      )}{" "}
      {customerMenu&&<CustomerCommandMenu customer={customer} variant="detail" onClose={()=>setCustomerMenu(false)} onDeleted={()=>nav('/customers')}/>}
      {requestTargetIssueId&&<RequestEditor customerId={customer.id} issueId={requestTargetIssueId} onClose={()=>setRequestTargetIssueId(null)}/>}
    </section>
  );
}

function customerRequestAge(value:string){const elapsed=Math.max(0,Date.now()-new Date(value).getTime());if(elapsed<60_000)return '<1min';if(elapsed<3_600_000)return Math.floor(elapsed/60_000)+'min';if(elapsed<86_400_000)return Math.floor(elapsed/3_600_000)+'h';return Math.floor(elapsed/86_400_000)+'d'}
function CustomerDetailRequestRow({request,onEdit,onNewOnIssue,properties}:{request:Row;onEdit:()=>void;onNewOnIssue:(issueId:string)=>void;properties:{id:boolean;priority:boolean;status:boolean;target:boolean}}){
 const {data,update,create,remove,act}=useActions(),nav=useNavigate(),[deleting,setDeleting]=useState(false),issue=data.issues.find(item=>item.id===request.issueId),project=data.projects.find(item=>item.id===request.projectId);
 const target=issue?'/issues/'+issue.id+'#customerRequest-'+encodeURIComponent(request.id):project?'/project/'+project.id+'/requests#customerRequest-'+encodeURIComponent(request.id):'';
 const status=issue?data.statuses.find(item=>item.id===issue.statusId)?.name??'Open':request.status??'Open';
 const createIssue=async()=>{const team=data.teams.find(item=>!item.deletedAt&&!item.archivedAt);if(!team)return;const created=await act(()=>create('issues',{teamId:team.id,title:request.title,description:request.body??'',customerId:request.customerId}));await act(()=>update('requests',request.id,{issueId:created.id,projectId:null}));};
 return <article className="customer-detail-request" data-request-id={request.id}>
  <button className={`request-important ${request.important?'active':''}`} aria-label={request.important?'Remove important flag':'Mark request important'} aria-pressed={!!request.important} onClick={()=>act(()=>update('requests',request.id,{important:!request.important}))}><Triangle size={14} fill={request.important?'currentColor':'none'}/></button>
  {target?<Link className="customer-detail-request-title" aria-label="Open issue" to={target}>{request.title}</Link>:<button className="customer-detail-request-title" onClick={onEdit}>{request.title}</button>}
  <span className="customer-request-row-properties">
    {properties.id&&issue?.identifier&&<small>{issue.identifier}</small>}
    {properties.priority&&issue&&<small>Priority {issue.priority??0}</small>}
    {properties.status&&<small>{status}</small>}
    {properties.target&&<small>{issue?.dueDate??project?.targetDate??'No target date'}</small>}
  </span>
  <time dateTime={request.createdAt} aria-label={'Created at '+new Date(request.createdAt).toLocaleString()}>{customerRequestAge(request.createdAt)}</time>
  <Dropdown align="right" menuClassName="customer-request-row-menu" trigger={<button className="feature-icon-button" aria-label="Open menu"><MoreHorizontal size={17}/></button>}>
    <MenuItem onClick={()=>act(()=>update('requests',request.id,{important:!request.important}))}>{request.important?'Remove important flag':'Mark as important'}</MenuItem>
    <div data-keep-open><Dropdown align="right" trigger={<button className="menu-item" role="menuitem">Move to</button>}>
      <div className="customer-request-target-menu">
        <strong>Issues</strong>{live(data.issues).map(item=><MenuItem key={item.id} onClick={()=>act(()=>update('requests',request.id,{issueId:item.id,projectId:null}))}>{item.identifier??item.title}</MenuItem>)}
        <div className="menu-separator"/><strong>Projects</strong>{live(data.projects).map(item=><MenuItem key={item.id} onClick={()=>act(()=>update('requests',request.id,{projectId:item.id,issueId:null}))}>{item.name}</MenuItem>)}
      </div>
    </Dropdown></div>
    <MenuItem onClick={()=>void act(()=>navigator.clipboard.writeText(new URL(target||`/customer/${request.customerId}#customerRequest-${request.id}`,location.origin).href),'Link copied')}>Copy link</MenuItem>
    <MenuItem onClick={()=>void createIssue()} disabled={!!issue}>Create issue from request…</MenuItem>
    <MenuItem onClick={onEdit}>Edit request</MenuItem>
    <MenuItem onClick={()=>issue&&onNewOnIssue(issue.id)} disabled={!issue}>New request on issue</MenuItem>
    <div data-keep-open><Dropdown align="right" trigger={<button className="menu-item" role="menuitem">Change customer…</button>}>
      {live(data.customers).map(item=><MenuItem key={item.id} onClick={()=>act(()=>update('requests',request.id,{customerId:item.id}))}>{item.name}</MenuItem>)}
    </Dropdown></div>
    <MenuItem onClick={()=>target&&nav(target)} disabled={!target}>Open issue</MenuItem>
    <MenuItem danger onClick={()=>setDeleting(true)}>Delete</MenuItem>
  </Dropdown>
  {deleting&&<Confirm title="Delete customer request?" description="This request will move to Recently deleted and can be restored." onClose={()=>setDeleting(false)} onConfirm={()=>act(()=>remove('requests',request.id))}/>}
 </article>;
}

export function RequestEditor({
  request,
  customerId,
  issueId,
  projectId,
  onClose,
}: {
  request?: Row;
  customerId?: string;
  issueId?: string;
  projectId?: string;
  onClose: () => void;
}) {
  const { data, create, update, act, batch } = useActions();
  const [body, setBody] = useState(request?.body ?? ""),
    [target, setTarget] = useState<"issue" | "project">(
      (request?.projectId ?? projectId) ? "project" : "issue",
    );
  const customer = data.customers.find(
    (c) => c.id === (request?.customerId ?? customerId),
  );
  const targetFields: FormField[] =
    target === "issue"
      ? [
          {
            key: "issueId",
            label: "Link to issue",
            type: "select",
            options: optionList(data.issues, "Create a new issue"),
          },
        ]
      : [
          {
            key: "projectId",
            label: "Link to project",
            required: true,
            type: "select",
            options: optionList(data.projects, "Choose project"),
          },
        ];
  return (
    <FormDialog
      title={request ? "Edit customer request" : "New customer request"}
      fields={[
        {
          key: "customerId",
          label: "Customer",
          type: "select",
          options: optionList(data.customers, "Choose customer"),
        },
        { key: "title", label: "Title", required: true },
        ...targetFields,
        { key: "requesterName", label: "Requester name" },
        { key: "requesterEmail", label: "Requester email", type: "email" },
        { key: "sourceUrl", label: "Source URL", placeholder: "https://" },
        {
          key: "important",
          label: "Important to this customer",
          type: "checkbox",
        },
      ]}
      initial={
        request ?? {
          customerId: customerId ?? "",
          issueId: issueId ?? "",
          projectId: projectId ?? "",
          requesterEmail: customer?.email ?? "",
          title: customer ? `Customer request from ${customer.name}` : "",
          important: false,
        }
      }
      submit={request ? "Save changes" : "Add request"}
      onClose={onClose}
      onSave={async (v) => {
        const payload: Record<string, any> = {
          ...v,
          body,
          important: !!v.important,
          issueId: target === "issue" ? v.issueId || null : null,
          projectId: target === "project" ? v.projectId || null : null,
        };
        if (payload.sourceUrl && !/^https?:\/\//i.test(payload.sourceUrl))
          throw new Error("Enter an http or https source URL.");
        if (target === "project" && !payload.projectId)
          throw new Error("Select a project.");
        if (target === "issue" && !payload.issueId) {
          const config = customerSettings(data),
            team =
              data.teams.find((t) => t.id === config.defaultTeamId) ??
              live(data.teams)[0];
          if (!team) throw new Error("Create a team before creating an issue.");
          const issueId = crypto.randomUUID();
          payload.issueId = issueId;
          // The request and its new issue are one transaction and one undo.
          return act(() => batch([
            {kind:"issues",action:"create",id:issueId,data:{title:payload.title,description:body,teamId:team.id,customerId:payload.customerId}},
            request
              ? {kind:"requests",action:"update",id:request.id,data:payload}
              : {kind:"requests",action:"create",id:crypto.randomUUID(),data:{...payload,status:"Open"}},
          ]));
        }
        return act(() =>
          request
            ? update("requests", request.id, payload)
            : create("requests", { ...payload, status: "Open" }),
        );
      }}
    >
      <label className="feature-field">
        <span>Link request to</span>
        <select
          aria-label="Request target type"
          className="input"
          value={target}
          onChange={(e) => setTarget(e.target.value as "issue" | "project")}
        >
          <option value="issue">Issue</option>
          <option value="project">Project</option>
        </select>
      </label>
      <div className="feature-field">
        <span>Request details</span>
        <RichEditor
          value={body}
          onChange={setBody}
          placeholder="What does the customer need?"
          attachmentContext={{ issueId: request?.issueId ?? issueId }}
        />
      </div>
    </FormDialog>
  );
}

export function CustomerRequestPage() {
  const {requestId} = useParams();
  const {data, initialSyncing} = useActions();
  const [editing, setEditing] = useState(false);
  const request = live(data.requests).find(item => item.id === requestId);
  if (initialSyncing) return <Blank title="Loading request…"/>;
  if (!request) return <Blank title="Customer request not found"/>;
  const anchor = '#customerRequest-' + encodeURIComponent(request.id);
  if (request.issueId && live(data.issues).some(item => item.id === request.issueId))
    return <Navigate replace to={'/issues/' + encodeURIComponent(request.issueId) + anchor}/>;
  if (request.projectId && live(data.projects).some(item => item.id === request.projectId))
    return <Navigate replace to={'/project/' + encodeURIComponent(request.projectId) + '/requests' + anchor}/>;
  if (request.customerId && live(data.customers).some(item => item.id === request.customerId))
    return <Navigate replace to={'/customer/' + encodeURIComponent(request.customerId) + anchor}/>;
  return <section className="feature-page"><Header title="Customer request"/><div className="feature-readable"><RequestCard request={request} onEdit={()=>setEditing(true)}/></div>{editing && <RequestEditor request={request} onClose={()=>setEditing(false)}/>}</section>;
}

function RequestCard({
  request,
  onEdit,
  showCustomer = false,
}: {
  request: Row;
  onEdit: () => void;
  showCustomer?: boolean;
}) {
  const location = useLocation();
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    const encodedId = encodeURIComponent(request.id);
    if (location.hash !== '#customerRequest-' + encodedId && location.hash !== '#request-' + encodedId) return;
    const frame = requestAnimationFrame(() => {
      card.current?.scrollIntoView({block:'center'});
      card.current?.focus({preventScroll:true});
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash, request.id]);
  const { data, update, act } = useActions(),
    customer = data.customers.find((c) => c.id === request.customerId),
    issue = data.issues.find((i) => i.id === request.issueId),
    project = data.projects.find((p) => p.id === request.projectId);
  const workStatus = issue
    ? data.statuses.find((s) => s.id === issue.statusId)?.type
    : project
      ? projectStatusCategory(project.status, data)
      : null;
  const requestStatus =
    workStatus === "canceled"
      ? "Canceled"
      : workStatus === "completed"
        ? "Completed"
        : (request.status ?? "Open");
  return (
    <article ref={card} tabIndex={-1} id={'customerRequest-' + request.id} className="feature-request" data-request-id={request.id}>
      <div className="feature-between">
        <button
          className={`request-important ${request.important ? "active" : ""}`}
          aria-label={
            request.important
              ? "Remove important flag"
              : "Mark request important"
          }
          aria-pressed={!!request.important}
          onClick={() =>
            act(() =>
              update("requests", request.id, { important: !request.important }),
            )
          }
        >
          <Triangle
            size={14}
            fill={request.important ? "currentColor" : "none"}
          />
        </button>
        <button className="feature-text-button request-title" onClick={onEdit}>
          <strong>{request.title}</strong>
        </button>
        <Status value={requestStatus} />
        <EntityMenu kind="requests" item={request} onEdit={onEdit} />
      </div>
      {showCustomer && customer && (
        <Link
          className="customer-request-customer"
          to={`/customer/${customer.id}`}
        >
          <CompanyLogo customer={customer} />
          {customer.name}
          <span className="muted">{customer.tier}</span>
        </Link>
      )}
      {request.body && (
        <div className="customer-request-body">
          <RichEditor value={request.body} onChange={() => {}} readOnly />
        </div>
      )}
      <div className="feature-between request-footer">
        <span className="muted">
          {request.requesterName || request.requesterEmail || "Customer"} ·{" "}
          {date(request.createdAt)}
        </span>
        {request.sourceUrl && /^https?:\/\//i.test(request.sourceUrl) && (
          <a href={request.sourceUrl} target="_blank" rel="noreferrer">
            Source <ExternalLink size={12} />
          </a>
        )}
        {issue ? (
          <Link to={`/issues/${issue.id}`}>
            {issue.identifier || issue.title} <ChevronRight size={12} />
          </Link>
        ) : project ? (
          <Link to={`/project/${project.id}`}>
            {project.name} <ChevronRight size={12} />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

/** A request attached to an issue also belongs to that issue's current project. */
export function customerRequestProjectIds(request:Row,issues:Row[]):string[]{
  const issue=request.issueId?issues.find(issue=>issue.id===request.issueId&&!issue.deletedAt):undefined;
  return [...new Set([request.projectId,issue?.projectId].filter((id):id is string=>typeof id==='string'&&!!id))];
}

export function EntityCustomerRequests({
  issueId,
  projectId,
  hideEmpty = false,
  startOpen = false,
  onRequestClose,
}: {
  issueId?: string;
  projectId?: string;
  hideEmpty?: boolean;
  startOpen?: boolean;
  onRequestClose?: () => void;
}) {
  const store=useAppStore();
  const [collapsed,setCollapsed]=useState(false);
  const { data } = useActions(),
    [editing, setEditing] = useState<Row | boolean>(false);
  const user=data.users.find(u=>u.id===store.user?.id),prefs=user?.preferences?.issueCustomerRequests?.[data.workspaceId]??{},order:RequestOrder=['created','customer','revenue'].includes(prefs.order)?prefs.order:'created',importantFirst=prefs.importantFirst!==false,reversed=prefs.reversed===true;
  const preference=(patch:Record<string,unknown>)=>{if(user)void patchUserPreferences(user.id,{issueCustomerRequests:{[data.workspaceId]:patch}}).catch(e=>store.toast(e.message));};
  const matching = live(data.requests).filter((r) =>
    issueId ? r.issueId === issueId : !!projectId&&customerRequestProjectIds(r,data.issues).includes(projectId),
  );
  const requests=issueId?sortIssueRequests(matching,data.customers,order,importantFirst,reversed):matching;
  const startRequest=()=>{setCollapsed(false);setEditing(true)};
  const closeInlineRequest=()=>{setEditing(false);onRequestClose?.()};
  useEffect(()=>{if(startOpen)setEditing(true)},[startOpen]);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.command === "new-customer-request") {
        if(detail.issueId&&detail.issueId!==issueId)return;
        event.preventDefault();
        setCollapsed(false);setEditing(true);
      }
    };
    window.addEventListener("workspace-command", listener);
    const key = (e: KeyboardEvent) => {
      if (
        e.ctrlKey &&
        e.key.toLowerCase() === "r" &&
        !e.metaKey &&
        !e.shiftKey &&
        (/Mac/.test(navigator.platform) ? !e.altKey : e.altKey)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setCollapsed(false);setEditing(true);
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("workspace-command", listener);
      window.removeEventListener("keydown", key, true);
    };
  }, [issueId, projectId]);
  return (
    <>
    {(!hideEmpty || requests.length > 0 || editing===true) && <section data-empty-request-section={!!issueId&&hideEmpty&&requests.length===0?true:undefined} className={`entity-customer-requests feature-section ${issueId?'issue-customers-section':''}`}>
      {issueId?<div className="issue-customers-header"><button className="issue-customers-toggle" aria-label={collapsed?'Expand customers section':'Collapse customers section'} aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}><Icon name={collapsed?'ChevronRight':'ChevronDown'} size={10}/>Customers</button><span className="spacer"/><Dropdown align="right" snapToPixels trapFocus trigger={<button className="issue-customers-control" aria-label="Display options" data-tooltip-label="Show display options"><Icon name="SlidersHorizontal" size={14}/></button>}><div className="issue-request-display" data-keep-open><div className="issue-request-order-row"><span>Ordering</span><span className="issue-request-order-controls"><CustomerChoiceSelect compact name="View ordering" value={order} options={['created','customer','revenue']} labels={{created:'Created date',customer:'Customer',revenue:'Revenue'}} onChange={value=>preference({order:value})}/><CustomerRequestDirection reversed={reversed} onChange={()=>preference({reversed:!reversed})}/></span></div><label><span>Show important first</span><input type="checkbox" aria-label="Show important first" checked={importantFirst} onChange={e=>preference({importantFirst:e.target.checked})}/></label></div></Dropdown><button className="issue-customers-control" aria-label="Add customer request" onClick={startRequest}><Icon name="Plus" size={14}/></button></div>:<div className="feature-between"><h3>Customer requests{requests.length ? ` · ${requests.length}` : ''}</h3><AddButton onClick={startRequest}>Customer request</AddButton></div>}
      <div hidden={!!issueId&&collapsed}>
      {editing===true&&<IssueCustomerRequest issueId={issueId} projectId={projectId} onClose={closeInlineRequest}/>}
      {requests.map((r) => (
        <RequestCard
          key={r.id}
          request={r}
          showCustomer
          onEdit={() => setEditing(r)}
        />
      ))}
      </div>
    </section>}
      {editing && editing!==true && (
        <RequestEditor
          request={typeof editing === "object" ? editing : undefined}
          issueId={issueId}
          projectId={projectId}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

function CustomerInlineEditor({initial,onCancel,onSave,submitLabel='Create',domain=false,colorPicker=true}:{initial:{name?:string;description?:string;color?:string};onCancel:()=>void;onSave:(values:{name:string;description:string;color:string})=>Promise<unknown>;submitLabel?:string;domain?:boolean;colorPicker?:boolean}){
  const [name,setName]=useState(initial.name||''),[description,setDescription]=useState(initial.description||''),[color,setColor]=useState(initial.color||'#858699'),[saving,setSaving]=useState(false),[error,setError]=useState('');
  return <form className={`customer-inline-editor${domain?' customer-domain-editor':''}`} onSubmit={async event=>{event.preventDefault();if(!name.trim()||saving)return;setSaving(true);setError('');try{await onSave({name:name.trim(),description:description.trim(),color});onCancel()}catch(error){setError(error instanceof Error?error.message:'Unable to save')}finally{setSaving(false)}}}>
    {!domain&&colorPicker&&<input type="color" aria-label="Color" value={color} onChange={event=>setColor(event.target.value)}/>}
    <input aria-label={domain?'Domain or email address':'Name'} placeholder={domain?'Domain or email address':'Name'} value={name} onChange={event=>setName(event.target.value)} autoFocus/>
    {!domain&&<input aria-label="Description" placeholder="Description…" value={description} onChange={event=>setDescription(event.target.value)}/>}
    {error&&<span role="alert">{error}</span>}
    <span className="customer-inline-spacer"/>
    <button type="button" onClick={onCancel}>Cancel</button>
    <button type="submit" aria-label="Submit" disabled={!name.trim()||saving}>{submitLabel}</button>
  </form>;
}

export function CustomerRequestSettings() {
  const { data, update, act } = useActions(),
    workspace = data.workspaces.find((w) => w.id === data.workspaceId),
    config = customerSettings(data);
  const [statusEdit,setStatusEdit]=useState<{index:number;name:string;color:string;description:string}|null|true>(null),
    [listEdit,setListEdit]=useState<{kind:'excludedDomains'|'genericDomains';value:string}|null>(null);
  const patch=async(changes:Record<string,any>)=>{if(!workspace)return false;return act(()=>update('workspaces',workspace.id,{customerSettings:{...(workspace.customerSettings||{}),...changes}}))};
  const saveStatus=async(values:Record<string,any>)=>{const statuses=[...config.statuses],previous=statusEdit&&statusEdit!==true?statusEdit.name:null,name=String(values.name||'').trim();if(!name)throw Error('Enter a status name.');if(statuses.some((value:string,index:number)=>value.toLowerCase()===name.toLowerCase()&&index!==(statusEdit&&statusEdit!==true?statusEdit.index:-1)))throw Error('Status names must be unique.');if(statusEdit&&statusEdit!==true)statuses[statusEdit.index]=name;else statuses.push(name);const colors={...config.statusColors},descriptions={...config.statusDescriptions};if(previous&&previous!==name){delete colors[previous];delete descriptions[previous]}colors[name]=values.color;descriptions[name]=values.description||'';return patch({statuses,statusColors:colors,statusDescriptions:descriptions})};
  const removeStatus=(index:number)=>{const statuses=config.statuses.filter((_:string,i:number)=>i!==index),name=config.statuses[index],colors={...config.statusColors},descriptions={...config.statusDescriptions};delete colors[name];delete descriptions[name];return patch({statuses,statusColors:colors,statusDescriptions:descriptions})};
  const addListValue=async(values:Record<string,any>)=>{if(!listEdit)return false;const value=String(values.value||'').trim().toLowerCase();if(!value)throw Error('Enter a domain or email.');const items=config[listEdit.kind]||[];if(items.some((item:string)=>item.toLowerCase()===value))throw Error('This entry already exists.');return patch({[listEdit.kind]:[...items,value]})};
  const count=live(data.customers).length;
  const teamOptions=['',...live(data.teams).map(team=>team.id)],teamLabels=Object.fromEntries([['','No default team'],...live(data.teams).map(team=>[team.id,team.name])]),teamLeading=Object.fromEntries([['',<Icon key="none" name="CircleDashed" size={14}/>],...live(data.teams).map(team=>[team.id,<EntityIcon key={team.id} entity={team} size={14}/>])]);
  const currencyLabels:Record<string,string>={USD:'USD ($)',EUR:'EUR (€)',GBP:'GBP (£)',AUD:'AUD ($)',BRL:'BRL (R$)',CAD:'CAD ($)',CHF:'CHF (CHF)',CNY:'CNY (¥)',DKK:'DKK (kr)',HKD:'HKD ($)',INR:'INR (₹)',JPY:'JPY (¥)',KRW:'KRW (₩)',MXN:'MXN ($)',NOK:'NOK (kr)',NZD:'NZD ($)',SEK:'SEK (kr)',SGD:'SGD ($)',TWD:'TWD ($)',ZAR:'ZAR (R)'};
  return (
    <div className="customer-settings">
      <h1>Customer requests</h1>
      <p className="customer-settings-intro">Associate customers with projects and issues to align development efforts with real user needs.<br/>Manage and track customer requests across your entire organization. <a href="https://parabolic.app/docs/customer-requests" target="_blank" rel="noreferrer">Docs ↗</a></p>
      <div className="feature-settings-card customer-enable-card"><div className="feature-settings-row"><div><strong>Enable Customer requests</strong><p>Workspace-wide access to create and view customer requests</p></div><button role="switch" aria-label="Enable customer requests" aria-checked={workspace?.customersEnabled!==false} className={`feature-toggle ${workspace?.customersEnabled!==false?'on':''}`} onClick={()=>workspace&&void act(()=>update('workspaces',workspace.id,{customersEnabled:workspace.customersEnabled===false}))}><i/></button></div></div>
      <div className="feature-settings-card customer-manage-card"><Link className="customer-settings-leading" to="/customers"><span className="customer-settings-icon"><NativeSettingsIcon name="Customer requests" fallback={<Building2 size={15}/>} /></span><span><strong>Manage customers</strong><small>Manage your list of customers and their requests</small></span><span className="customer-settings-count">{count} {count===1?'customer':'customers'}</span><ChevronRight size={15}/></Link></div>
      <section className="customer-settings-section"><h2>Issue routing</h2><p>When a new issue is created from a customer page, it will be routed to the default team’s triage or<br/>backlog. This centralizes customer requests for ease of management and prioritization.</p><div className="feature-settings-card customer-routing-card"><div className="feature-settings-row"><strong id="customer-default-team-label">Default team for customer requests</strong><span className="customer-setting-select customer-team-select"><CustomerChoiceSelect name="Default request team" labelId="customer-default-team-label" value={config.defaultTeamId} options={teamOptions} labels={teamLabels} leading={teamLeading} onChange={defaultTeamId=>void patch({defaultTeamId})}/></span></div></div></section>
      <section className="customer-settings-section"><h2>Customer statuses</h2><p>Define statuses for segmenting customers</p><div className="feature-settings-card customer-list-card customer-status-card"><div className="customer-list-header"><span>{config.statuses.length} customer {config.statuses.length===1?'status':'statuses'}</span><button aria-label="Create new customer status" onClick={()=>setStatusEdit(true)}><Plus size={14}/></button></div>{config.statuses.map((name:string,index:number)=><div className="customer-list-row" key={name}><span className="customer-color" style={{background:config.statusColors?.[name]||'#858699'}}/><span className="customer-list-name">{name}</span><Dropdown align="right" alignOffset={-1} menuClassName="customer-row-menu" trigger={<button className="customer-list-remove" aria-label="Open menu"><MoreHorizontal size={14}/></button>}><MenuItem icon="Pencil" onClick={()=>setStatusEdit({index,name,color:config.statusColors?.[name]||'#858699',description:config.statusDescriptions?.[name]||''})}>Edit</MenuItem><MenuItem icon="Trash2" danger onClick={()=>void removeStatus(index)}>Delete</MenuItem></Dropdown></div>)}{statusEdit&&<CustomerInlineEditor initial={statusEdit===true?{color:'#858699'}:statusEdit} submitLabel={statusEdit===true?'Create':'Save'} onCancel={()=>setStatusEdit(null)} onSave={saveStatus}/>}</div></section>
      <CustomerTierSettings/>
      <section className="customer-settings-section"><h2>Display options</h2><div className="feature-settings-card"><div className="feature-settings-row"><div><strong id="customer-revenue-format-label">Revenue formatting</strong><p>Data imports must be in annual figures, but can be displayed as monthly or annual</p></div><span className="customer-setting-select customer-format-select"><CustomerChoiceSelect name="Revenue formatting" labelId="customer-revenue-format-label" value={config.revenueFrequency} options={['monthly','annual']} labels={{monthly:'Monthly',annual:'Annual'}} onChange={revenueFrequency=>void patch({revenueFrequency})}/></span></div><div className="feature-settings-row"><div><strong id="customer-revenue-currency-label">Revenue currency</strong><p>The currency used when displaying customer revenue</p></div><span className="customer-setting-select customer-currency-select"><CustomerChoiceSelect name="Revenue currency" labelId="customer-revenue-currency-label" value={config.revenueUnit} options={Object.keys(currencyLabels)} labels={currencyLabels} onChange={revenueUnit=>void patch({revenueUnit})}/></span></div></div></section>
      <section className="customer-settings-section"><h2>Customer attributes data source</h2><p>Sync customer attributes from an external data source</p><div className="feature-settings-card customer-data-source-card"><div className="feature-settings-row"><strong>External data source</strong><span className="customer-data-source-value">None</span></div><div className="feature-settings-row"><div><strong>Enable manual edits</strong><p>Attributes can be edited in the Parabolic UI</p></div><button role="switch" aria-label="Enable manual customer edits" aria-checked={config.manualEdits!==false} className={`feature-toggle ${config.manualEdits!==false?'on':''}`} onClick={()=>void patch({manualEdits:config.manualEdits===false})}><i/></button></div></div></section>
      {([['excludedDomains','Excluded domains and emails','Domains and emails that should never create customer requests'],['genericDomains','Generic domains and emails',<>Domains and emails that are not associated with a specific customer. Common providers like<br/>Gmail, Outlook, etc. are already included. <a href="https://parabolic.app/docs/customer-requests" target="_blank" rel="noreferrer">List of generic domains ↗</a></>]] as const).map(([kind,title,description])=>{const items=config[kind]||[],editing=listEdit?.kind===kind;return <section className="customer-settings-section customer-domain-section" key={kind}><h2>{title}</h2><p>{description}</p><div className="feature-settings-card customer-list-card"><div className="customer-list-header"><span>{items.length?`${items.length} ${items.length===1?(kind==='excludedDomains'?'exclusion':'custom generic domain or email'):(kind==='excludedDomains'?'exclusions':'custom generic domains and emails')}`:`No ${kind==='excludedDomains'?'exclusions':'custom generic domains and emails'}`}</span><button aria-label={`Add ${title.toLowerCase()}`} onClick={()=>setListEdit({kind,value:''})}><Plus size={14}/></button></div>{items.map((value:string)=><div className="customer-list-row" key={value}><span>{value}</span><Dropdown align="right" alignOffset={-1} menuClassName="customer-row-menu" trigger={<button className="customer-list-remove" aria-label="Open menu"><MoreHorizontal size={14}/></button>}><MenuItem onClick={()=>void patch({[kind]:items.filter((item:string)=>item!==value)})}>Remove</MenuItem></Dropdown></div>)}{editing&&<CustomerInlineEditor domain initial={{name:listEdit?.value||''}} submitLabel="Add" onCancel={()=>setListEdit(null)} onSave={async values=>addListValue({value:values.name})}/>}</div></section>})}
    </div>
  );
}

function CustomerTierSettings(){
 const {data,create,update,remove,act}=useActions(),[editing,setEditing]=useState<Row|null|undefined>(undefined),[error,setError]=useState('');
 const tiers=live(data.customerTiers).sort((a,b)=>a.position-b.position);
 const removeTier=async(tier:Row)=>{setError('');try{await apiRequest('/api/v1/customerTiers/'+tier.id,{method:'DELETE'})}catch(error){setError(error instanceof Error?error.message:'Unable to delete tier')}};
 return <section className="customer-settings-section" aria-label="Customer tiers"><h2>Customer tiers</h2><p>Define tiers for segmenting customers</p>{error&&<p role="alert">{error}</p>}<div className="feature-settings-card customer-list-card"><div className="customer-list-header"><span>{tiers.length?`${tiers.length} customer ${tiers.length===1?'tier':'tiers'}`:'No customer tiers'}</span><button aria-label="Create new customer tier" onClick={()=>setEditing(null)}><Plus size={14}/></button></div>{tiers.map(tier=><div className="customer-list-row" key={tier.id}><span className="customer-color" style={{background:tier.color}}/><span className="customer-list-name">{tier.displayName}</span><Dropdown align="right" alignOffset={-1} menuClassName="customer-row-menu" trigger={<button type="button" className="customer-list-remove" aria-label="Open menu"><MoreHorizontal size={14}/></button>}><MenuItem icon="Pencil" onClick={()=>setEditing(tier)}>Edit</MenuItem><MenuItem icon="Trash2" danger onClick={()=>void removeTier(tier)}>Delete</MenuItem></Dropdown></div>)}{editing!==undefined&&<CustomerInlineEditor colorPicker={false} initial={editing?{name:editing.displayName||editing.name,description:editing.description,color:editing.color}:{color:'#858699'}} submitLabel={editing?'Save':'Create'} onCancel={()=>setEditing(undefined)} onSave={values=>act(()=>editing?update('customerTiers',editing.id,{name:values.name,displayName:values.name,color:values.color,description:values.description}):create('customerTiers',{name:values.name,displayName:values.name,color:values.color,description:values.description,position:Math.max(0,...tiers.map(t=>t.position))+1}))}/>}</div></section>;
}
