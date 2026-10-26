import { CustomerEditorClose } from "./customer-editor-icons";
import { CustomerRequestSourceIcon } from "./customer-request-source-icon";
import "./issue-delete-confirmation.css";
import { CustomerCommandMenu } from "./customer-command-menu";
import { matchesIssueAction } from "./issue-menu-keyboard";
import { IssueActionFilter, useIssueActionQuery } from "./issue-action-filter";
import type { Entity } from "../shared/types";
import React, { useEffect, useRef, useState } from "react";
import { batch, useAppStore } from "./store";
import { Button, Dropdown, Icon, Modal, RichEditor } from "./components/ui";
import "./issue-customer-request.css";
function requestSourceLabel(source: string) {
  if (!source) return "Source";
  try {
    return "via " + new URL(source).hostname;
  } catch {
    return source;
  }
}
function CustomerPickerImage({
  customer,
  size = 16,
  framed = false,
}: {
  customer?: Entity;
  size?: number;
  framed?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return customer?.logoUrl && !failed ? (
    framed ? (
      <span
        className="request-customer-logo-frame"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <span
          className="request-customer-logo-glow"
          style={{
            backgroundImage: `url(${JSON.stringify(customer.logoUrl)})`,
          }}
        />
        <img
          src={customer.logoUrl}
          alt=""
          width={size - 2}
          height={size - 2}
          onError={() => setFailed(true)}
        />
      </span>
    ) : (
      <img
        className="request-customer-image"
        src={customer.logoUrl}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
      />
    )
  ) : customer ? (
    <span
      className="request-customer-initial"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {String(customer.name ?? "?")
        .slice(0, 1)
        .toUpperCase()}
    </span>
  ) : (
    <span
      className="request-customer-unknown"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span>
        <svg
          width={size - 5}
          height={size - 5}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11.0247 12.3333C13.6728 12.3334 14.6225 13.529 14.9606 14.319C15.112 14.6739 14.806 15 14.4046 15H7.59537C7.18784 14.9997 6.8816 14.6641 7.04464 14.3073C7.40663 13.5172 8.38955 12.3333 11.0247 12.3333Z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11 7C12.1045 7 12.9998 7.89543 12.9998 9C12.9998 10.1046 12.1045 11 11 11C9.89553 11 9.00018 10.1046 9.00018 9C9.00018 7.89543 9.89553 7 11 7Z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10 4.25V3.75C10 3.05964 9.44036 2.5 8.75 2.5H3.75C3.05964 2.5 2.5 3.05964 2.5 3.75V13.25C2.5 13.3881 2.61193 13.5 2.75 13.5H4.25C4.66421 13.5 5 13.8358 5 14.25C5 14.6642 4.66421 15 4.25 15H2.75C1.7835 15 1 14.2165 1 13.25V3.75C1 2.23122 2.23122 1 3.75 1H8.75C10.2688 1 11.5 2.23122 11.5 3.75V4.25C11.5 4.66421 11.1642 5 10.75 5C10.3358 5 10 4.66421 10 4.25Z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M7.75 4.25C8.16421 4.25 8.5 4.58579 8.5 5C8.5 5.41421 8.16421 5.75 7.75 5.75H4.75C4.33579 5.75 4 5.41421 4 5C4 4.58579 4.33579 4.25 4.75 4.25H7.75Z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M6.5 7.25C6.91421 7.25 7.25 7.58579 7.25 8C7.25 8.41421 6.91421 8.75 6.5 8.75H4.75C4.33579 8.75 4 8.41421 4 8C4 7.58579 4.33579 7.25 4.75 7.25H6.5Z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M6.5 10.25C6.91421 10.25 7.25 10.5858 7.25 11C7.25 11.4142 6.91421 11.75 6.5 11.75H4.75C4.33579 11.75 4 11.4142 4 11C4 10.5858 4.33579 10.25 4.75 10.25H6.5Z"
          />
        </svg>
      </span>
    </span>
  );
}
export function IssueCustomerRequest({
  issueId,
  projectId,
  customerId: initialCustomerId,
  onClose,
}: {
  issueId?: string;
  projectId?: string;
  customerId?: string;
  onClose: () => void;
}) {
  const store = useAppStore(),
    [discarding, setDiscarding] = useState(false),
    [picking, setPicking] = useState(!initialCustomerId),
    [quickLook, setQuickLook] = useState(false),
    [newCustomerName, setNewCustomerName] = useState(""),
    [commandCustomer, setCommandCustomer] = useState<Entity | null>(null),
    [started, setStarted] = useState(!!initialCustomerId),
    [query, setQuery] = useState(""),
    [index, setIndex] = useState(0),
    [customerId, setCustomerId] = useState<string | null>(initialCustomerId ?? null),
    [editingIssueTitle, setEditingIssueTitle] = useState(false),
    [newIssueTitle, setNewIssueTitle] = useState(
      initialCustomerId
        ? `Customer request from ${store.data.customers.find((c) => c.id === initialCustomerId)?.name ?? "customer"}`
        : "Customer request",
    ),
    [body, setBody] = useState(""),
    [source, setSource] = useState(""),
    [sourceDraft, setSourceDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [upload, setUpload] = useState({ pending: false, error: "" }),
    [error, setError] = useState(""),
    pending = useRef(false),
    root = useRef<HTMLDivElement>(null);
  const customers: { id: string | null; name: string }[] = [
    { id: null, name: "Unknown customer" },
    ...store.data.customers
      .filter((c) => !c.deletedAt)
      .sort((a, b) => a.name.localeCompare(b.name)),
  ]
    .filter((c) => matchesIssueAction(c.name, query))
    .map((c) => ({ id: c.id, name: String(c.name) }));
  if (
    query.trim() &&
    !store.data.customers.some(
      (c) =>
        !c.deletedAt && c.name.toLowerCase() === query.trim().toLowerCase(),
    )
  )
    customers.push({
      id: "__new_customer__",
      name: 'Create new customer: "' + query.trim() + '"',
    });
  const activeCustomer = store.data.customers.find(
    (c) => c.id === customers[index]?.id,
  );
  useEffect(() => {
    document
      .querySelector(".issue-request-customer-picker [aria-selected=true]")
      ?.scrollIntoView({ block: "nearest" });
  }, [index, query]);
  const select = (id: string | null) => {
    setNewCustomerName(id === "__new_customer__" ? query.trim() : "");
    setCustomerId(id === "__new_customer__" ? null : id);
    setStarted(true);
    setPicking(false);
  };
  useEffect(() => {
    if (picking || !started) return;
    const node = root.current;
    if (!node) return;
    node.scrollIntoView({ block: "nearest" });
    const focus = () => {
      const editor = node.querySelector<HTMLElement>("[contenteditable=true]");
      if (editor) {
        editor.focus();
        return true;
      }
      return false;
    };
    if (focus()) return;
    const observer = new MutationObserver(() => {
      if (focus()) observer.disconnect();
    });
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [picking, started]);
  const resumeDraft = () => {
    setDiscarding(false);
    setTimeout(
      () =>
        root.current
          ?.querySelector<HTMLElement>("[contenteditable=true]")
          ?.focus(),
      0,
    );
  };
  const cancelDraft = () => {
    if (busy || upload.pending) return;
    if (
      body
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .trim() ||
      /<img\b|data-type="attachment"/.test(body) ||
      source.trim()
    )
      setDiscarding(true);
    else onClose();
  };
  const save = async () => {
    if (pending.current || upload.pending || upload.error) return;
    const text = body
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .trim();
    if (!text && !/<img\b|data-type="attachment"/.test(body)) return;
    let sourceUrl = source.trim();
    if (sourceUrl) {
      try {
        const u = new URL(sourceUrl);
        if (!["http:", "https:"].includes(u.protocol)) throw Error();
        sourceUrl = u.href;
      } catch {
        setError("Enter an http or https source URL.");
        return;
      }
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const issue = store.data.issues.find((i) => i.id === issueId),
        project = store.data.projects.find((p) => p.id === projectId);
      const fields = {
        ...(issueId ? { issueId } : { projectId }),
        customerId,
        title: issue?.title ?? project?.name ?? newIssueTitle,
        body,
        sourceUrl: sourceUrl || null,
        status: "Open",
      };
      if (!issueId && !projectId) {
        const team = store.data.teams.find(
          (candidate) => !candidate.deletedAt && !candidate.archivedAt,
        );
        if (!team) throw new Error("Create a team before creating an issue.");
        const createdIssueId = crypto.randomUUID();
        await batch([
          {
            kind: "issues",
            action: "create",
            id: createdIssueId,
            data: {
              teamId: team.id,
              customerId,
              title: newIssueTitle,
              description: body,
            },
          },
          {
            kind: "requests",
            action: "create",
            id: crypto.randomUUID(),
            data: { ...fields, issueId: createdIssueId, title: newIssueTitle },
          },
        ]);
      } else if (newCustomerName) {
        const id = crypto.randomUUID();
        await batch([
          {
            kind: "customers",
            action: "create",
            id,
            data: { name: newCustomerName },
          },
          {
            kind: "requests",
            action: "create",
            data: { ...fields, customerId: id },
          },
        ]);
      } else await store.create("requests", fields);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      pending.current = false;
    }
  };
  return (
    <>
      {discarding && (
        <Modal
          ariaLabel="Discard this request?"
          className="issue-delete-confirmation request-discard-confirmation"
          onClose={resumeDraft}
        >
          <div className="issue-delete-content">
            <h2>Discard this request?</h2>
            <p>Confirm that you want to discard this customer request.</p>
            <div className="issue-delete-buttons">
              <Button onClick={resumeDraft}>Cancel</Button>
              <Button autoFocus variant="danger" onClick={onClose}>
                Discard
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {commandCustomer && (
        <CustomerCommandMenu customer={commandCustomer} onClose={onClose} />
      )}
      {picking && !commandCustomer && (
        <Modal
          ariaLabel="Select customer"
          className={`issue-request-customer-picker${quickLook && activeCustomer ? " has-quicklook" : ""}`}
          onClose={() => (started ? setPicking(false) : onClose())}
        >
          <input
            autoFocus
            aria-label="Select customer…"
            placeholder="Select customer…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" && activeCustomer) {
                e.preventDefault();
                setQuickLook(true);
              }
              if (e.key === "ArrowLeft" && quickLook) {
                e.preventDefault();
                setQuickLook(false);
              }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) =>
                  customers.length
                    ? (i +
                        (e.key === "ArrowDown" ? 1 : -1) +
                        customers.length) %
                      customers.length
                    : 0,
                );
              }
              if (e.key === "Enter" && customers[index]) {
                e.preventDefault();
                if (e.altKey && activeCustomer)
                  setCommandCustomer(activeCustomer);
                else select(customers[index].id);
              }
            }}
          />
          <div className="request-picker-body">
            <div role="listbox" aria-label="Customers">
              {customers.map((c, i) => (
                <button
                  key={c.id ?? "unknown"}
                  role="option"
                  aria-selected={i === index}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => select(c.id)}
                >
                  {c.id === "__new_customer__" ? (
                    <Icon name="Plus" size={16} />
                  ) : (
                    <CustomerPickerImage
                      customer={store.data.customers.find(
                        (customer) => customer.id === c.id,
                      )}
                    />
                  )}
                  {c.name}
                </button>
              ))}
              {!customers.length && (
                <div className="menu-empty">No customers found</div>
              )}
            </div>
            {quickLook && activeCustomer && (
              <CustomerQuickLook customer={activeCustomer} />
            )}
          </div>
          {activeCustomer && (
            <div className="request-picker-footer">
              <button onClick={() => select(activeCustomer.id)}>
                <kbd>↵</kbd>Select
              </button>
              <span className="spacer" />
              <button onClick={() => setCommandCustomer(activeCustomer)}>
                <kbd>⌥ ↵</kbd>More actions
              </button>
              <button onClick={() => setQuickLook((v) => !v)}>
                {quickLook ? (
                  <>
                    <kbd>←</kbd>Close
                  </>
                ) : (
                  <>
                    Quick look<kbd>→</kbd>
                  </>
                )}
              </button>
            </div>
          )}
        </Modal>
      )}
      {started && (
        <div
          ref={root}
          className="issue-request-composer"
          aria-label="New customer request"
          onKeyDownCapture={(e) => {
            if (
              e.key === "Escape" &&
              !e.defaultPrevented &&
              !picking &&
              !busy &&
              !document.querySelector(
                ".dropdown-content,.editor-toolbar,[role=dialog],[role=listbox]",
              )
            ) {
              e.preventDefault();
              e.stopPropagation();
              cancelDraft();
            }
          }}
        >
          {!issueId && !projectId && (
            <div className="issue-request-new-target">
              <span>New issue</span>
              {editingIssueTitle ? (
                <input
                  autoFocus
                  aria-label="New issue title"
                  value={newIssueTitle}
                  onChange={(event) => setNewIssueTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Escape") {
                      event.preventDefault();
                      setEditingIssueTitle(false);
                    }
                  }}
                />
              ) : (
                <strong>{newIssueTitle}</strong>
              )}
              <button
                type="button"
                aria-label="Edit new issue title"
                onClick={() => setEditingIssueTitle(true)}
              >
                <Icon name="Pencil" size={13} />
              </button>
            </div>
          )}
          <Dropdown
            trigger={
              <button
                className="issue-request-customer-chip"
                aria-label="Search customers"
              >
                <CustomerPickerImage
                  key={customerId ?? "unknown"}
                  customer={store.data.customers.find(
                    (c) => c.id === customerId,
                  )}
                  size={14}
                />
                {newCustomerName ||
                  store.data.customers.find((c) => c.id === customerId)?.name ||
                  "Customer"}
              </button>
            }
          >
            <div className="issue-request-change-customer">
              <IssueActionFilter
                searchLabel="Search customers…"
                placeholder="Search customers…"
                initialSelection={customerId ?? undefined}
              >
                {store.data.customers
                  .filter((c) => !c.deletedAt)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <button
                      key={c.id}
                      className="menu-item"
                      role="menuitem"
                      data-action-value={c.id}
                      onClick={() => {
                        setNewCustomerName("");
                        setCustomerId(c.id);
                        setTimeout(
                          () =>
                            root.current
                              ?.querySelector<HTMLElement>(
                                "[contenteditable=true]",
                              )
                              ?.focus(),
                          0,
                        );
                      }}
                    >
                      <CustomerPickerImage customer={c} framed />
                      <span>{c.name}</span>
                      {c.id === customerId && (
                        <svg
                          className="request-customer-check"
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          aria-hidden="true"
                        >
                          <path d="M4.2996 7.23968C4.01775 6.93614 3.5432 6.91857 3.23966 7.20042C2.93613 7.48227 2.91856 7.95682 3.20041 8.26035L6.45041 11.7603C6.7612 12.095 7.29647 12.0766 7.58346 11.7212L12.8335 5.22127C13.0937 4.89904 13.0435 4.42683 12.7213 4.16657C12.399 3.9063 11.9268 3.95654 11.6665 4.27877L6.96051 10.1053L4.2996 7.23968Z" />
                        </svg>
                      )}
                    </button>
                  ))}
                <NewRequestCustomerChoice
                  customers={store.data.customers}
                  onSelect={(name) => {
                    setNewCustomerName(name);
                    setCustomerId(null);
                    setTimeout(
                      () =>
                        root.current
                          ?.querySelector<HTMLElement>("[contenteditable=true]")
                          ?.focus(),
                      0,
                    );
                  }}
                />
              </IssueActionFilter>
            </div>
          </Dropdown>
          <RichEditor
            onUploadStatusChange={setUpload}
            value={body}
            onChange={setBody}
            placeholder={!issueId && !projectId ? "Note" : "Add request details"}
          attachmentContext={issueId ? { issueId } : { projectId }}
          />
          <div className="issue-request-footer">
            <Dropdown
              closeOnEnter
              onEnter={() => setSource(sourceDraft)}
              trigger={
                <button
                  className="issue-request-source"
                  aria-label={source || "Add source"}
                  data-tooltip-label={source || undefined}
                >
                  <CustomerRequestSourceIcon />
                  <span>{requestSourceLabel(source)}</span>
                </button>
              }
            >
              <div className="issue-request-source-picker">
                <input
                  data-keep-open
                  autoFocus
                  aria-label="Paste link…"
                  placeholder="Paste link…"
                  value={sourceDraft}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setSourceDraft(e.target.value)}
                />
                <button
                  aria-label="Clear source"
                  title="Clear source"
                  onClick={() => {
                    setSource("");
                    setSourceDraft("");
                  }}
                >
                  <CustomerEditorClose />
                </button>
              </div>
            </Dropdown>
            <span className="spacer" />
            <button
              disabled={busy || upload.pending}
              className="icon-button"
              aria-label="Attach images, files, or videos"
              onClick={() =>
                root.current
                  ?.querySelector<HTMLInputElement>(
                    ".rich-editor input[type=file]",
                  )
                  ?.click()
              }
            >
              <Icon name="Paperclip" size={14} />
            </button>
            <Button
              className="issue-request-cancel"
              disabled={busy || upload.pending}
              onClick={cancelDraft}
            >
              {!issueId && !projectId ? "Discard" : "Cancel"}
            </Button>
            <Button
              disabled={
                busy || upload.pending || !!upload.error || !body.trim()
              }
              onClick={save}
            >
              {busy
                ? "Creating…"
                : !issueId && !projectId
                  ? "Add request"
                  : "Create"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function CustomerQuickLook({ customer }: { customer: Entity }) {
  const age = Number.isFinite(Date.parse(customer.createdAt))
    ? Math.max(
        0,
        Math.floor((Date.now() - Date.parse(customer.createdAt)) / 86400000),
      )
    : null;
  const revenue =
    customer.revenue == null
      ? "—"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          notation: "compact",
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(Number(customer.revenue)) + " /yr";
  return (
    <section
      className="request-customer-quicklook"
      aria-label="Customer quick look"
    >
      <header>
        <CustomerPickerImage key={customer.id} customer={customer} size={32} />
        <strong>{customer.name}</strong>
      </header>
      <dl>
        {[
          ["Domain", customer.domain || "—"],
          [
            "Created",
            age == null
              ? "—"
              : age === 0
                ? "Today"
                : age === 1
                  ? "1 day ago"
                  : age + " days ago",
          ],
          ["Status", customer.status || "—"],
          ["Revenue", revenue],
          ["Size", customer.size ?? "—"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {label === "Status" && (
                <span className="request-customer-status-dot" />
              )}
              {label === "Revenue" && <Icon name="Banknote" size={14} />}{" "}
              {label === "Size" && <Icon name="Clipboard" size={14} />}
              <span>{value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function NewRequestCustomerChoice({
  customers,
  onSelect,
}: {
  customers: Entity[];
  onSelect: (name: string) => void;
}) {
  const query = useIssueActionQuery().trim();
  if (
    !query ||
    customers.some(
      (c) =>
        !c.deletedAt && String(c.name).toLowerCase() === query.toLowerCase(),
    )
  )
    return null;
  return (
    <button
      className="menu-item"
      role="menuitem"
      data-action-value="new-customer"
      onClick={() => onSelect(query)}
    >
      <Icon name="Plus" size={16} />
      <span>Create new customer: "{query}"</span>
    </button>
  );
}
