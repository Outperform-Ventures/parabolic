import { guestCapabilities } from "../../shared/guest-capabilities";
import React, { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { LayoutGrid, LayoutDashboard, Plus } from "lucide-react";
import { DirectoryEmpty } from "./directory-empty";
import { Dropdown, Avatar, Icon } from "../components/ui";
import { NativeControlIcon } from "../components/sidebar-icons";
import { ViewForm } from "./view-builder";
import { DashboardEditor } from "./insights";
import { ViewOwner } from "./view-owner";
import { EntityIcon } from "./entity-icon";
import {
  Action,
  AddButton,
  Blank,
  Header,
  EntityMenu,
  Property,
  optionList,
  date,
  live,
  useActions,
  type Row,
} from "./shared";
import "./views-directory.css";

type Display = {
  sort: "name" | "owner" | "createdAt" | "updatedAt";
  direction: "asc" | "desc";
  createdAt: boolean;
  updatedAt: boolean;
  owner: boolean;
};
const defaults: Display = {
  sort: "name",
  direction: "asc",
  createdAt: false,
  updatedAt: false,
  owner: true,
};
const labels = {
  name: "Name",
  owner: "Owner",
  createdAt: "Created",
  updatedAt: "Updated",
};
export function ViewsDirectory() {
  const { teamId } = useParams();
  const [params] = useSearchParams();
  const { data, user } = useActions(),
    capabilities = guestCapabilities(data, user?.id);
  if (!capabilities.canTeam(teamId))
    return (
      <Blank
        title="View directory unavailable"
        description="This directory is outside your team access."
      />
    );
  return (
    <Directory
      key={
        (teamId || "workspace") +
        ":" +
        (params.get("type") === "dashboards" ? "dashboards" : "views")
      }
    />
  );
}
function Directory() {
  const { teamId } = useParams(),
    { data, user, create, update, remove, act } = useActions(),
    nav = useNavigate(),
    [params, setParams] = useSearchParams(),
    host = useRef<HTMLElement>(null);
  const { guest } = guestCapabilities(data, user?.id),
    models = [
      "issues",
      "projects",
      ...(!guest ? ["initiatives"] : []),
      ...(!guest || teamId ? ["dashboards"] : []),
    ] as const;
  const type = models.find((model) => model === params.get("type")) || "issues",
    dashboard = type === "dashboards",
    kind = dashboard ? "dashboards" : "views",
    adding = params.get("new") === "1",
    canCreate = !dashboard || !guest;
  const team = teamId
      ? data.teams.find((item) => item.id === teamId)
      : undefined,
    collectionFavorite =
      teamId &&
      data.favorites.find(
        (item) =>
          !item.deletedAt &&
          item.userId === user?.id &&
          item.entityKind === "teams" &&
          item.entityId === teamId &&
          item.section === "views",
      );
  const toggleCollectionFavorite = () =>
    teamId &&
    team &&
    void act(() =>
      collectionFavorite
        ? remove("favorites", collectionFavorite.id)
        : create("favorites", {
            userId: user?.id,
            entityId: teamId,
            entityKind: "teams",
            type: "team",
            section: "views",
            icon: "Layers",
            label: "Views " + team.name,
            route:
              "/team/" +
              teamId +
              "/views" +
              (type === "issues" ? "" : "?type=" + type),
          }),
    );
  const preferenceKey = (teamId || "workspace") + ":" + kind,
    currentUser = data.users.find((item) => item.id === user?.id),
    saved = currentUser?.preferences?.viewDirectory?.[preferenceKey];
  const [display, setDisplay] = useState<Display>({
    ...defaults,
    ...saved?.default,
    ...saved?.current,
  });
  const displayRef = useRef(display),
    defaultRef = useRef<Display | undefined>(saved?.default),
    preferencesRef = useRef<Record<string, any>>(
      currentUser?.preferences || {},
    );
  useEffect(() => {
    preferencesRef.current = currentUser?.preferences || {};
  }, [currentUser?.preferences]);
  const configure = (patch: Partial<Display>, saveDefault = false) => {
    const next = { ...displayRef.current, ...patch };
    displayRef.current = next;
    setDisplay(next);
    if (saveDefault) defaultRef.current = next;
    if (user) {
      const preferences = {
        ...preferencesRef.current,
        viewDirectory: {
          ...preferencesRef.current.viewDirectory,
          [preferenceKey]: {
            default: defaultRef.current,
            current: next,
          },
        },
      };
      preferencesRef.current = preferences;
      void act(() =>
        update("users", user.id, {
          preferences,
        }),
      );
    }
  };
  const setAdding = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set("new", "1");
    else next.delete("new");
    setParams(next, { replace: !open });
  };
  const startAdding = () => {
    if (!teamId && type === "issues") nav("/views/issues/new");
    else setAdding(true);
  };
  useEffect(() => {
    const listener = (event: Event) => {
      if (
        !event.defaultPrevented &&
        (event as CustomEvent).detail?.command === "display-options"
      ) {
        event.preventDefault();
        host.current
          ?.querySelector<HTMLButtonElement>(
            '[aria-label="Directory display options"]',
          )
          ?.click();
      }
    };
    window.addEventListener("workspace-command", listener);
    return () => window.removeEventListener("workspace-command", listener);
  }, []);
  const owner = (row: Row) =>
    data.users.find((person) => person.id === (row.ownerId || row.creatorId))
      ?.name || "";
  const rows = live(data[kind])
    .filter(
      (row) =>
        row.placement !== "issueTab" &&
        (dashboard || (row.entityType || "issues") === type) &&
        (!teamId || row.teamId === teamId),
    )
    .sort((a, b) => {
      const first = display.sort === "owner" ? owner(a) : a[display.sort] || "",
        second = display.sort === "owner" ? owner(b) : b[display.sort] || "";
      return (
        String(first).localeCompare(String(second), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * (display.direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id)
      );
    });
  const groups = teamId
    ? [{ name: "", rows }]
    : [
        {
          name: dashboard ? "Personal dashboards" : "Personal views",
          rows: rows.filter((row) =>
            ["private", "personal"].includes(row.visibility),
          ),
        },
        {
          name: "Workspace",
          rows: rows.filter(
            (row) => !["private", "personal"].includes(row.visibility),
          ),
        },
      ].filter((group) => group.rows.length);
  const order = (sort: Display["sort"]) =>
    configure({
      sort,
      direction:
        display.sort === sort
          ? display.direction === "asc"
            ? "desc"
            : "asc"
          : sort.endsWith("At")
            ? "desc"
            : "asc",
      ...(sort === "name" ? {} : { [sort]: true }),
    });
  return (
    <section ref={host} className="feature-page views-directory">
      <Header title={dashboard ? "Dashboards" : "Views"}>
        {teamId && !dashboard && (
          <button
            type="button"
            className="icon-button"
            role="switch"
            aria-checked={!!collectionFavorite}
            aria-label={
              collectionFavorite ? "Remove from favorites" : "Add to favorites"
            }
            onClick={toggleCollectionFavorite}
          >
            <Icon
              name="Star"
              size={15}
              style={collectionFavorite ? { fill: "currentColor" } : undefined}
            />
          </button>
        )}
        {canCreate &&
          (dashboard ? (
            <AddButton onClick={() => setAdding(true)}>New dashboard</AddButton>
          ) : (
            <Action aria-label="Create new view" onClick={startAdding}>
              <Plus size={14} />
              New view
            </Action>
          ))}
      </Header>
      <div className="views-directory-toolbar">
        <nav className="views-directory-models" aria-label="View models">
          {models.map((model) => {
            const next = new URLSearchParams(params);
            next.set("type", model);
            next.delete("new");
            return (
              <Link
                key={model}
                to={"?" + next.toString()}
                aria-current={type === model ? "page" : undefined}
              >
                {model[0].toUpperCase() + model.slice(1)}
              </Link>
            );
          })}
        </nav>
        <Dropdown
          align="right"
          trigger={
            <Action
              aria-label="Directory display options"
              title="Display options"
            >
              <NativeControlIcon name="Display options" size={14} />
            </Action>
          }
        >
          <div className="views-directory-display" data-keep-open>
            <label>
              Ordering
              <select
                className="input"
                aria-label="Directory ordering"
                value={display.sort}
                onChange={(e) => {
                  const sort = e.target.value as Display["sort"];
                  configure({
                    sort,
                    direction: sort.endsWith("At") ? "desc" : "asc",
                    ...(sort === "name" ? {} : { [sort]: true }),
                  });
                }}
              >
                {(["name", "owner", "updatedAt", "createdAt"] as const).map(
                  (field) => (
                    <option key={field} value={field}>
                      {labels[field]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Direction
              <select
                className="input"
                aria-label="Directory order direction"
                value={display.direction}
                onChange={(e) =>
                  configure({ direction: e.target.value as "asc" | "desc" })
                }
              >
                <option value="asc">
                  {display.sort.endsWith("At") ? "Oldest first" : "A to Z"}
                </option>
                <option value="desc">
                  {display.sort.endsWith("At") ? "Newest first" : "Z to A"}
                </option>
              </select>
            </label>
            <span>Display properties</span>
            <div className="views-directory-property-toggles">
              {(["createdAt", "updatedAt", "owner"] as const).map((field) => (
                <button
                  type="button"
                  key={field}
                  className="button"
                  aria-pressed={display[field]}
                  onClick={() => configure({ [field]: !display[field] })}
                >
                  {labels[field]}
                </button>
              ))}
            </div>
            <div className="views-directory-defaults">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  configure({ ...defaults, ...defaultRef.current })
                }
              >
                Reset to view default
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => configure({}, true)}
              >
                Save as default for view
              </button>
            </div>
          </div>
        </Dropdown>
      </div>
      <div className="views-directory-list">
        {rows.length > 0 && (
          <div className="views-directory-columns">
            <button onClick={() => order("name")}>Name</button>
            {display.createdAt && (
              <button onClick={() => order("createdAt")}>Created</button>
            )}
            {display.updatedAt && (
              <button onClick={() => order("updatedAt")}>Updated</button>
            )}
            {display.owner && (
              <button style={{ width: 140 }} onClick={() => order("owner")}>
                Owner
              </button>
            )}
            <span />
          </div>
        )}
        {groups.map((group) => (
          <React.Fragment key={group.name}>
            {group.name && (
              <h3 className="views-directory-group">
                {group.name.startsWith("Personal") && (
                  <Avatar user={user} size={16} />
                )}
                <span>
                  {group.name}
                  {group.name.startsWith("Personal")
                    ? " · Only visible to you"
                    : ""}
                </span>
              </h3>
            )}
            {group.rows.map((row) => (
              <div
                className="feature-linked-row views-directory-row"
                key={row.id}
              >
                <Link
                  to={dashboard ? `/dashboards/${row.id}` : `/view/${row.id}`}
                >
                  <EntityIcon
                    entity={row}
                    fallback={dashboard ? "LayoutDashboard" : "LayoutGrid"}
                  />
                  <span>
                    {row.name}
                    <small>{row.description || ""}</small>
                  </span>
                </Link>
                {display.createdAt && (
                  <span
                    className="views-directory-date"
                    data-directory-column="createdAt"
                  >
                    {date(row.createdAt)}
                  </span>
                )}
                {display.updatedAt && (
                  <span
                    className="views-directory-date"
                    data-directory-column="updatedAt"
                  >
                    {date(row.updatedAt)}
                  </span>
                )}
                {display.owner && (
                  <div
                    className="views-directory-owner"
                    data-directory-column="owner"
                  >
                    {dashboard ? (
                      ["private", "personal"].includes(row.visibility) ? (
                        <span>{owner(row) || "No owner"}</span>
                      ) : (
                        <Property
                          label="Owner"
                          value={row.ownerId || row.creatorId}
                          options={optionList(data.users).filter(
                            (option) => option.value,
                          )}
                          onChange={(ownerId) =>
                            void act(() =>
                              update("dashboards", row.id, { ownerId }),
                            )
                          }
                        />
                      )
                    ) : (
                      <ViewOwner view={row} compact />
                    )}
                  </div>
                )}
                <span className="views-directory-meta muted">
                  {row.visibility || "Personal"}
                </span>
                {<EntityMenu kind={kind} item={row} />}
              </div>
            ))}
          </React.Fragment>
        ))}
        {!rows.length &&
          (dashboard ? (
            <Blank
              icon={<LayoutDashboard size={30} />}
              title="Dashboards"
              description="Save charts and reports for quick access."
              action={
                canCreate ? (
                  <AddButton onClick={() => setAdding(true)}>
                    New dashboard
                  </AddButton>
                ) : undefined
              }
            />
          ) : (
            <DirectoryEmpty
              kind="views"
              model={type}
              onCreate={canCreate ? startAdding : undefined}
            />
          ))}{" "}
      </div>
      {adding &&
        canCreate &&
        (dashboard ? (
          <DashboardEditor
            initialTeamId={teamId}
            onClose={() => setAdding(false)}
            onSave={async (values) => {
              const saved = await act(() =>
                create("dashboards", { ...values, widgets: [] }),
              );
              if (saved) nav("/dashboards/" + saved.id);
              return saved;
            }}
          />
        ) : (
          <ViewForm
            key={type}
            initialEntityType={type as "issues" | "projects" | "initiatives"}
            teamId={teamId}
            onClose={() => setAdding(false)}
            onSaved={(row) => nav(`/view/${row.id}`)}
          />
        ))}
    </section>
  );
}
