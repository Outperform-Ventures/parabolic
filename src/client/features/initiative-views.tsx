import { Dropdown, MenuItem } from "../components/ui";
import { InitiativeGraph } from "./initiative-graph";
import { InitiativeCollection } from "./initiative-collection";
import { InitiativeViewTabs } from "./initiative-view-tabs";
import { InlineInitiative } from "./initiative-create";
import { ReminderBanner } from "../reminders";
import { EntityIcon, EntityIconPicker } from "./entity-icon";
import { displayNameFor } from "../display-name";
import { InitiativeHeaderActions } from "./initiative-actions";
import React, { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Layers,
  Box,
  ChevronRight,
  ChevronDown,
  FileText,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import {
  initiativeParentIds,
  initiativeDescendantIds,
  initiativeProjectRollup,
  INITIATIVE_STATUSES,
} from "../../shared/initiatives";
import {
  Action,
  AddButton,
  Blank,
  FormDialog,
  Header,
  live,
  MultipleProperty,
  optionList,
  Person,
  priorities,
  priorityName,
  Progress,
  Property,
  Row,
  SearchBox,
  SavedEditor,
  Status,
  Tabs,
  TargetDateControl,
  useActions,
} from "./shared";
import { ProjectStatusBadge, projectStatusCategory } from "./project-statuses";
import { ProjectCollection } from "./project-list";
import { formatTargetDate } from "./date-picker";
import "./initiative-views.css";

type Renderer = (item: Row) => React.ReactNode;
export function InitiativeWorkspace({
  renderCreate,
  view,
}: {
  renderCreate?: (close: () => void) => React.ReactNode;
  view?: Row;
}) {
  const { data } = useActions(),
    { teamId, initiativeTab } = useParams(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    [adding, setLocalAdding] = useState(false);
  const newFromRoute = params.get("new") === "1",
    setAdding = (value: boolean) => {
      setLocalAdding(value);
      if (!value && newFromRoute) {
        const next = new URLSearchParams(params);
        next.delete("new");
        navigate({ search: next.toString() }, { replace: true });
      }
    };
  const routeTab =
      initiativeTab === "active"
        ? "Active"
        : initiativeTab === "planned"
          ? "Planned"
          : initiativeTab
            ? "All initiatives"
            : undefined,
    tab = view
      ? "view-" + view.id
      : routeTab || params.get("tab") || "All initiatives",
    team = data.teams.find((item) => item.id === (teamId || view?.teamId));
  return (
    <section className="feature-page initiative-workspace">
      <Header
        title={
          view?.name || (team ? team.name + " initiatives" : "Initiatives")
        }
        breadcrumb={
          view ? { title: "Initiatives", to: "/initiatives" } : undefined
        }
        icon={
          view ? (
            <EntityIcon entity={view} fallback="Layers" size={15} />
          ) : undefined
        }
      >
        <AddButton onClick={() => setAdding(true)}>New initiative</AddButton>
      </Header>
      <InitiativeViewTabs
        active={tab}
        builtins={["Active", "Planned", "All initiatives"]}
        teamId={teamId}
        builtinHref={
          !teamId && !view
            ? (value) =>
                value === "Active"
                  ? "/initiatives/active"
                  : value === "Planned"
                    ? "/initiatives/planned"
                    : "/initiatives"
            : undefined
        }
        onBuiltin={(value) =>
          navigate(
            (teamId ? "/team/" + teamId + "/initiatives" : "/initiatives") +
              "?tab=" +
              encodeURIComponent(value),
          )
        }
      />
      {(adding || newFromRoute) &&
        (renderCreate ? (
          renderCreate(() => setAdding(false))
        ) : (
          <InlineInitiative teamId={teamId} onClose={() => setAdding(false)} />
        ))}
      <InitiativeCollection
        key={view?.id || teamId || "workspace"}
        view={view}
        teamId={teamId || view?.teamId}
        tab={tab}
      />
    </section>
  );
}

export function InitiativeSavedViewPage() {
  const { viewId } = useParams(),
    { data } = useActions(),
    view = live(data.views).find(
      (item) => item.id === viewId && item.entityType === "initiatives",
    );
  if (!view)
    return (
      <Blank
        title="View not found"
        action={<Link to="/views">Back to views</Link>}
      />
    );
  return view.initiativeId ? (
    <Navigate
      to={"/initiative/" + view.initiativeId + "/view-" + view.id}
      replace
    />
  ) : (
    <InitiativeWorkspace key={view.id} view={view} />
  );
}

export function InitiativeDetail({
  renderUpdates,
}: {
  renderUpdates: Renderer;
}) {
  const { initiativeId, tab: routeTab } = useParams();
  const { data, create, update, act } = useActions();
  const nav = useNavigate();
  const item = live(data.initiatives).find((i) => i.id === initiativeId);
  const [editing, setEditing] = useState(false),
    [sub, setSub] = useState(false),
    [attachSub, setAttachSub] = useState(false),
    [addProject, setAddProject] = useState(false),
    [resource, setResource] = useState(false),
    [linkEdit, setLinkEdit] = useState<{
      index: number;
      title: string;
      url: string;
    } | null>(null),
    [directOnly, setDirectOnly] = useState(false),
    [layout, setLayout] = useState("List");
  const savedView = routeTab?.startsWith("view-")
    ? live(data.views).find(
        (view) =>
          view.id === routeTab.slice(5) &&
          view.entityType === "initiatives" &&
          view.initiativeId === initiativeId,
      )
    : undefined;
  const tab = savedView
    ? "view-" + savedView.id
    : routeTab === "projects"
      ? "Projects"
      : ["activity", "updates"].includes(routeTab || "")
        ? "Activity"
        : "Overview";
  const descendants = useMemo(
    () =>
      initiativeId
        ? initiativeDescendantIds(data.initiatives, initiativeId)
        : new Set<string>(),
    [initiativeId, data.initiatives],
  );
  if (!item)
    return (
      <Blank
        title="Initiative not found"
        action={<Link to="/initiatives">Back to initiatives</Link>}
      />
    );
  const rollup = initiativeProjectRollup(
      data.initiatives,
      data.projects,
      item.id,
      !directOnly,
    ),
    projects = rollup.projects,
    directIds = new Set(rollup.directProjectIds),
    children = rollup.children,
    parents = initiativeParentIds(item);
  const patch = (v: Record<string, any>) =>
    act(() => update("initiatives", item.id, v));
  const attachProject = (id: string) => {
    const project = data.projects.find((p) => p.id === id)!;
    return act(() =>
      update("projects", id, {
        initiativeId: project.initiativeId || item.id,
        initiativeIds: [
          ...new Set([
            ...(project.initiativeIds || []),
            ...(project.initiativeId ? [project.initiativeId] : []),
            item.id,
          ]),
        ],
      }),
    );
  };
  const removeProject = async (project: Row) => {
    await act(() =>
      update("projects", project.id, {
        ...(project.initiativeId === item.id ? { initiativeId: null } : {}),
        initiativeIds: (project.initiativeIds || []).filter(
          (id: string) => id !== item.id,
        ),
      }),
    );
    if (item.projectIds?.includes(project.id))
      await patch({
        projectIds: item.projectIds.filter((id: string) => id !== project.id),
      });
  };
  const done = projects.filter(
    (p) => projectStatusCategory(p.status, data) === "completed",
  ).length;
  return (
    <section className="feature-page">
      <Header
        title={item.name}
        breadcrumb={{ title: "Initiatives", to: "/initiatives" }}
        icon={<EntityIcon entity={item} fallback="Layers" size={15} />}
      >
        <InitiativeHeaderActions
          item={item}
          onAddProject={() => setAddProject(true)}
          onDeleted={() => nav("/initiatives")}
        />
      </Header>
      <ReminderBanner kind="initiatives" id={item.id} />
      <InitiativeViewTabs
        builtins={["Overview", "Activity", "Projects"]}
        active={tab}
        scopeId={item.id}
        onBuiltin={(value) =>
          nav(`/initiative/${item.id}/${value.toLowerCase()}`)
        }
        builtinHref={(value) => `/initiative/${item.id}/${value.toLowerCase()}`}
      />
      {savedView ? (
        <InitiativeCollection
          key={savedView.id}
          view={savedView}
          scopeId={item.id}
        />
      ) : tab === "Projects" ? (
        <>
          <div className="initiative-filter-bar">
            <label>
              <input
                type="checkbox"
                checked={directOnly}
                onChange={(e) => setDirectOnly(e.target.checked)}
              />{" "}
              Only projects added directly
            </label>
            <select
              aria-label="Initiative project layout"
              value={layout}
              onChange={(e) => setLayout(e.target.value)}
            >
              {["List", "Board", "Timeline"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <AddButton onClick={() => setAddProject(true)}>
              Add project
            </AddButton>
          </div>
          <ProjectCollection
            projects={projects}
            layout={layout}
            storageKey={`initiative:${item.id}`}
          />
        </>
      ) : (
        <div className="feature-readable feature-initiative-detail">
          {tab === "Activity" ? (
            renderUpdates(item)
          ) : (
            <>
              <div className="feature-project-icon">
                <EntityIconPicker
                  label="Initiative icon"
                  fallback="Layers"
                  icon={item.icon}
                  color={item.color}
                  onChange={patch}
                />
              </div>
              <input
                aria-label="Initiative name"
                className="feature-title-input"
                defaultValue={item.name}
                key={`${item.id}:${item.name}`}
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== item.name &&
                  patch({ name: e.target.value.trim() })
                }
              />
              <input
                aria-label="Initiative summary"
                className="feature-summary-input"
                placeholder="Add a short summary…"
                defaultValue={item.summary || ""}
                key={`${item.id}:${item.summary}`}
                onBlur={(e) =>
                  e.target.value !== item.summary &&
                  patch({ summary: e.target.value })
                }
              />
              <div className="feature-properties-horizontal">
                <Property
                  label="Status"
                  value={item.status}
                  options={INITIATIVE_STATUSES}
                  onChange={(status) => patch({ status })}
                />
                <Property
                  label="Priority"
                  value={item.priority}
                  options={priorities}
                  onChange={(v) => patch({ priority: Number(v) })}
                />
                <Property
                  label="Owner"
                  value={item.ownerId}
                  options={optionList(data.users)}
                  onChange={(ownerId) => patch({ ownerId })}
                />
                <Property
                  label="Lead team"
                  value={item.leadTeamId || item.teamId}
                  options={optionList(data.teams, "No lead team")}
                  onChange={(leadTeamId) =>
                    patch({ leadTeamId: leadTeamId || null })
                  }
                />
                <div className="feature-property">
                  <span>Target date</span>
                  <TargetDateControl
                    value={item.targetDate}
                    precision={item.datePrecision || "day"}
                    onChange={(targetDate, datePrecision) =>
                      patch({ targetDate, datePrecision })
                    }
                  />
                </div>
                <MultipleProperty
                  label="Parents"
                  values={parents}
                  options={optionList(
                    data.initiatives.filter(
                      (i) => i.id !== item.id && !descendants.has(i.id),
                    ),
                  ).filter((o) => o.value)}
                  onChange={(parentIds) => patch({ parentIds })}
                />
                <MultipleProperty
                  label="Labels"
                  values={item.labelIds || []}
                  options={optionList(
                    data.labels.filter(
                      (label) =>
                        (label.entityType || "issues") === "initiatives",
                    ),
                  ).filter((o) => o.value)}
                  onChange={(labelIds) => patch({ labelIds })}
                />
              </div>
              {parents.length > 0 && (
                <div className="feature-inline-properties">
                  Part of{" "}
                  {parents.map((id) => (
                    <Link key={id} to={`/initiative/${id}`}>
                      {data.initiatives.find((i) => i.id === id)?.name ||
                        "Initiative"}
                    </Link>
                  ))}
                </div>
              )}
              <div className="feature-resource-row">
                <span className="muted">Resources</span>
                <button onClick={() => setResource(true)}>
                  <Plus size={13} />
                  Add document or link…
                </button>
                {live(data.documents)
                  .filter((d) => d.initiativeId === item.id)
                  .map((d) => (
                    <Link key={d.id} to={`/document/${d.id}`}>
                      <FileText size={13} />
                      {d.title}
                    </Link>
                  ))}
                {(item.links || []).map((link: any, index: number) => (
                  <span key={index} className="feature-inline">
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.title || link.url}
                      <ArrowUpRight size={12} />
                    </a>
                    <Dropdown
                      trigger={
                        <button
                          type="button"
                          aria-label={
                            "Resource options " + (link.title || link.url)
                          }
                        >
                          ⋯
                        </button>
                      }
                    >
                      <MenuItem
                        onClick={() =>
                          setLinkEdit({
                            index,
                            title: link.title || "",
                            url: link.url,
                          })
                        }
                      >
                        Edit link
                      </MenuItem>
                      <MenuItem
                        onClick={() =>
                          void patch({
                            links: item.links.filter(
                              (_: unknown, i: number) => i !== index,
                            ),
                          })
                        }
                      >
                        Remove link
                      </MenuItem>
                    </Dropdown>
                  </span>
                ))}
              </div>
              {renderUpdates(item)}
              <section className="feature-section">
                <h3>Description</h3>
                <SavedEditor
                  key={item.id}
                  collaboration={{
                    kind: "initiatives",
                    id: item.id,
                    field: "description",
                  }}
                  value={item.description || ""}
                  onSave={(description) => patch({ description })}
                  placeholder="Describe the initiative’s goals…"
                />
              </section>
              <InitiativeGraph initiative={item} directOnly={directOnly} />
              <section className="feature-section">
                <div className="feature-between">
                  <h3>
                    Sub-initiatives{" "}
                    <span className="muted">{children.length}</span>
                  </h3>
                  <span className="feature-inline">
                    <Action onClick={() => setAttachSub(true)}>
                      Add existing
                    </Action>
                    <AddButton onClick={() => setSub(true)}>
                      Add sub-initiative
                    </AddButton>
                  </span>
                </div>
                {children.map((child) => {
                  const childProjects = initiativeProjectRollup(
                    data.initiatives,
                    data.projects,
                    child.id,
                  ).projects;
                  return (
                    <div key={child.id} className="feature-linked-row">
                      <Link to={`/initiative/${child.id}`}>
                        <Layers size={16} />
                        {child.name}
                      </Link>
                      <Status value={child.status} />
                      <span className="muted">
                        {childProjects.length} projects
                      </span>
                      <Action
                        onClick={() =>
                          act(() =>
                            update("initiatives", child.id, {
                              parentIds: initiativeParentIds(child).filter(
                                (id) => id !== item.id,
                              ),
                            }),
                          )
                        }
                      >
                        Remove
                      </Action>
                    </div>
                  );
                })}
                {!children.length && (
                  <p className="muted">No sub-initiatives</p>
                )}
              </section>
              <section className="feature-section">
                <div className="feature-between">
                  <h3>
                    Projects <span className="muted">{projects.length}</span>
                  </h3>
                  <AddButton onClick={() => setAddProject(true)}>
                    Add project
                  </AddButton>
                </div>
                <div className="feature-between initiative-progress">
                  <label>
                    <input
                      type="checkbox"
                      checked={directOnly}
                      onChange={(e) => setDirectOnly(e.target.checked)}
                    />{" "}
                    Only projects added directly
                  </label>
                  <span>
                    {done} of {projects.length} completed
                  </span>
                  <Progress
                    value={projects.length ? (done / projects.length) * 100 : 0}
                  />
                </div>
                {projects.map((project) => {
                  const health = live(data.updates)
                    .filter((u) => u.projectId === project.id)
                    .sort((a, b) =>
                      b.createdAt.localeCompare(a.createdAt),
                    )[0]?.health;
                  return (
                    <div className="feature-linked-row" key={project.id}>
                      <Link to={`/project/${project.id}`}>
                        <Box size={16} />
                        {project.name}
                      </Link>
                      <ProjectStatusBadge value={project.status} />
                      {health && (
                        <Link
                          to={`/project/${project.id}/updates`}
                          className={`feature-health ${health.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          {health}
                        </Link>
                      )}
                      {directIds.has(project.id) ? (
                        <Action onClick={() => removeProject(project)}>
                          Remove
                        </Action>
                      ) : (
                        <span className="muted">From sub-initiative</span>
                      )}
                    </div>
                  );
                })}
                {!projects.length && <p className="muted">No projects yet</p>}
              </section>
            </>
          )}
        </div>
      )}
      {editing && (
        <FormDialog
          title="Edit initiative"
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "summary", label: "Summary" },
          ]}
          initial={item}
          submit="Save changes"
          onClose={() => setEditing(false)}
          onSave={patch}
        />
      )}{" "}
      {sub && (
        <FormDialog
          title="New sub-initiative"
          fields={[
            { key: "name", label: "Name", required: true },
            { key: "summary", label: "Summary" },
          ]}
          onClose={() => setSub(false)}
          onSave={(v) =>
            act(() =>
              create("initiatives", {
                ...v,
                parentIds: [item.id],
                status: "planned",
              }),
            )
          }
        />
      )}{" "}
      {attachSub && (
        <FormDialog
          title="Add sub-initiative"
          fields={[
            {
              key: "initiativeId",
              label: "Initiative",
              required: true,
              type: "select",
              options: optionList(
                data.initiatives.filter(
                  (i) =>
                    i.id !== item.id &&
                    !children.some((c) => c.id === i.id) &&
                    !initiativeDescendantIds(data.initiatives, i.id).has(
                      item.id,
                    ),
                ),
                "Select an initiative",
              ),
            },
          ]}
          onClose={() => setAttachSub(false)}
          onSave={(v) => {
            const child = data.initiatives.find(
              (i) => i.id === v.initiativeId,
            )!;
            return act(() =>
              update("initiatives", child.id, {
                parentIds: [...initiativeParentIds(child), item.id],
              }),
            );
          }}
        />
      )}{" "}
      {addProject && (
        <FormDialog
          title="Add project"
          fields={[
            {
              key: "projectId",
              label: "Project",
              required: true,
              type: "select",
              options: optionList(
                data.projects.filter((p) => !directIds.has(p.id)),
                "Select a project",
              ),
            },
          ]}
          onClose={() => setAddProject(false)}
          onSave={(v) => attachProject(v.projectId)}
        />
      )}{" "}
      {linkEdit && (
        <FormDialog
          title="Edit resource link"
          fields={[
            { key: "title", label: "Title", required: true },
            { key: "url", label: "Link", required: true },
          ]}
          initial={linkEdit}
          submit="Save changes"
          onClose={() => setLinkEdit(null)}
          onSave={(values) => {
            let url;
            try {
              url = new URL(values.url);
            } catch {
              throw Error("Enter a valid URL.");
            }
            if (!["http:", "https:"].includes(url.protocol))
              throw Error("Use an HTTP or HTTPS URL.");
            const current = item.links?.[linkEdit.index];
            if (
              !current ||
              current.url !== linkEdit.url ||
              (current.title || "") !== linkEdit.title
            )
              throw Error("This resource changed. Reopen it and try again.");
            return patch({
              links: item.links.map((link: any, index: number) =>
                index === linkEdit.index
                  ? { ...link, title: values.title, url: url.href }
                  : link,
              ),
            });
          }}
        />
      )}{" "}
      {resource && (
        <FormDialog
          title="Add resource"
          fields={[
            { key: "title", label: "Title", required: true },
            { key: "url", label: "Link (leave empty to create a document)" },
          ]}
          onClose={() => setResource(false)}
          onSave={async (v) => {
            if (v.url) {
              let url;
              try {
                url = new URL(v.url);
              } catch {
                throw Error("Enter a valid URL.");
              }
              if (!["http:", "https:"].includes(url.protocol))
                throw Error("Use an HTTP or HTTPS URL.");
              return patch({ links: [...(item.links || []), v] });
            }
            const doc = await act(() =>
              create("documents", {
                title: v.title,
                content: "",
                initiativeId: item.id,
                visibility: "workspace",
              }),
            );
            if (doc) nav(`/document/${doc.id}`);
            return doc;
          }}
        />
      )}
    </section>
  );
}
