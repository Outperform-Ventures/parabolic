import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal } from "../components/ui";
import { apiRequest, useAppStore } from "../store";

export type HelpAction = "support" | "feedback" | "performance";
type Destination = { configured: boolean; email: string | null };
const accepted =
  /^(?:image\/(?:png|jpeg|gif|webp)|video\/(?:mp4|webm|quicktime)|application\/(?:pdf|json)|text\/plain)$/;
const fileLimit = 5_000_000,
  fileCount = 3;
async function configuration(): Promise<Destination> {
  try {
    return await apiRequest("/api/v1/support");
  } catch {
    return { configured: false, email: null };
  }
}
function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function upload(file: File) {
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
  return apiRequest("/api/v1/attachments", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      content,
    }),
  });
}

function MessageDialog({
  kind,
  onClose,
}: {
  kind: "support" | "feedback";
  onClose: () => void;
}) {
  const title = kind === "support" ? "Contact us" : "Send feedback",
    label = kind === "support" ? "Question" : "Feedback";
  const [message, setMessage] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [destination, setDestination] = useState<Destination | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  const attachment = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void configuration().then(setDestination);
  }, []);
  const fileError = useMemo(
    () =>
      files.length > fileCount
        ? `Attach at most ${fileCount} files`
        : files.find((file) => file.size > fileLimit)
          ? "Each attachment must be 5 MB or smaller"
          : files.find((file) => !accepted.test(file.type))
            ? "Use an image, video, PDF, JSON, or text attachment"
            : "",
    [files],
  );
  const submit = async () => {
    if (!destination?.configured || !message.trim() || fileError) return;
    setBusy(true);
    setError("");
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const value = await upload(file);
        uploaded.push(value.id);
      }
      await apiRequest("/api/v1/support", {
        method: "POST",
        body: JSON.stringify({ kind, message, attachmentIds: uploaded }),
      });
      setSent(true);
    } catch (value) {
      for (const id of uploaded)
        void apiRequest("/api/v1/attachments/" + id, {
          method: "DELETE",
        }).catch(() => {});
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBusy(false);
    }
  };
  if (sent)
    return (
      <Modal title={title} onClose={onClose}>
        <div className="modal-body support-command">
          <p role="status">
            Your message was queued for your internal support team.
          </p>
        </div>
        <div className="modal-footer">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </Modal>
    );
  return (
    <Modal title={title} onClose={onClose} className="support-command-modal">
      <div className="modal-body support-command">
        <p>
          {kind === "support"
            ? "Include any relevant details, or email us directly at"
            : "Share an idea or tell us what could work better."}
          {kind === "support" && destination?.email && (
            <>
              {" "}
              <a href={"mailto:" + encodeURIComponent(destination.email)}>
                {destination.email}
              </a>
              .
            </>
          )}
        </p>
        <label>
          {label}
          <textarea
            autoFocus
            aria-label={label}
            value={message}
            maxLength={10_000}
            rows={7}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={
              kind === "support"
                ? "How can we help?"
                : "What would you like to share?"
            }
          />
        </label>
        <input
          ref={attachment}
          className="support-attachment-input"
          aria-label="Add attachment"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,application/json,text/plain"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
        <Button onClick={() => attachment.current?.click()}>
          Attach images, files, or videos
        </Button>
        {!!files.length && (
          <ul className="support-files">
            {files.map((file, index) => (
              <li key={file.name + index}>
                <span>{file.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFiles((current) => current.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {fileError && <p role="alert">{fileError}</p>}
        {error && <p role="alert">{error}</p>}
        {destination && !destination.configured && (
          <p role="status">
            Support is not configured for this deployment. Save the draft and
            share it with your internal support team.
          </p>
        )}
      </div>
      <div className="modal-footer">
        {destination && !destination.configured && (
          <Button
            onClick={() =>
              download(
                kind === "support"
                  ? "parabolic-support.txt"
                  : "parabolic-feedback.txt",
                message,
              )
            }
          >
            Save draft
          </Button>
        )}
        <Button
          variant="primary"
          disabled={
            busy || !destination?.configured || !message.trim() || !!fileError
          }
          onClick={() => void submit()}
        >
          {busy ? "Sending…" : "Send"}
        </Button>
      </div>
    </Modal>
  );
}
export function ContactSupportDialog({ onClose }: { onClose: () => void }) {
  return <MessageDialog kind="support" onClose={onClose} />;
}
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  return <MessageDialog kind="feedback" onClose={onClose} />;
}

export function PerformanceReportDialog({ onClose }: { onClose: () => void }) {
  const store = useAppStore(),
    [description, setDescription] = useState(""),
    [report, setReport] = useState(""),
    [destination, setDestination] = useState<Destination | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  useEffect(() => {
    void configuration().then(setDestination);
  }, []);
  const capture = async () => {
    setError("");
    try {
      const navigation = performance.getEntriesByType("navigation")[0] as
          PerformanceNavigationTiming | undefined,
        desktop = await window.desktop?.getDiagnostics?.();
      setReport(
        JSON.stringify(
          {
            format: "parabolic-diagnostics-v1",
            capturedAt: new Date().toISOString(),
            description,
            environment: {
              platform: window.desktop?.platform ?? "web",
              browser: navigator.userAgent,
              language: navigator.language,
              viewport: {
                width: innerWidth,
                height: innerHeight,
                scale: devicePixelRatio,
              },
            },
            application: {
              online: store.online,
              pendingChanges: store.pending,
              conflicts: store.conflicts.length,
              failedChanges: store.failures.length,
              hydrating: store.hydrating,
            },
            performance: {
              pageAgeMs: Math.round(performance.now()),
              domReadyMs: navigation
                ? Math.round(navigation.domContentLoadedEventEnd)
                : null,
              loadMs: navigation ? Math.round(navigation.loadEventEnd) : null,
              resources: performance.getEntriesByType("resource").length,
            },
            ...(desktop ? { desktop } : {}),
          },
          null,
          2,
        ),
      );
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  };
  const send = async () => {
    if (!report || !destination?.configured) return;
    setBusy(true);
    setError("");
    let id: string | undefined;
    try {
      const value = await upload(
        new File([report], "parabolic-diagnostics.json", {
          type: "application/json",
        }),
      );
      id = value.id;
      await apiRequest("/api/v1/support", {
        method: "POST",
        body: JSON.stringify({
          kind: "performance",
          message: description.trim() || "Performance problem report",
          attachmentIds: [id],
        }),
      });
      setSent(true);
    } catch (value) {
      if (id)
        void apiRequest("/api/v1/attachments/" + id, {
          method: "DELETE",
        }).catch(() => {});
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Report performance problem"
      onClose={onClose}
      className="support-command-modal"
    >
      <div className="modal-body support-command">
        {sent ? (
          <p role="status">Your reviewed performance report was queued.</p>
        ) : (
          <>
            <p>
              Describe the slowdown, capture diagnostics, then review the
              complete report before saving or sending it.
            </p>
            <label>
              Problem description
              <textarea
                autoFocus
                aria-label="Problem description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
              />
            </label>
            <p className="muted">
              The report includes timings, sync counts, browser and device
              versions, viewport, connection mode, and desktop process metrics.
              It excludes account identifiers, entity contents, URLs, filesystem
              paths, cookies, and credentials.
            </p>
            <Button onClick={() => void capture()}>Capture diagnostics</Button>
            {report && (
              <label>
                Diagnostic report
                <textarea
                  aria-label="Diagnostic report"
                  readOnly
                  value={report}
                  rows={10}
                />
              </label>
            )}
            {error && <p role="alert">{error}</p>}
            {destination && !destination.configured && (
              <p role="status">
                Support is not configured. You can still save the reviewed
                report locally.
              </p>
            )}
            {window.desktop ? (
              <Button
                onClick={() => void window.desktop?.openDeveloperTools?.()}
              >
                Open developer tools
              </Button>
            ) : (
              <p>
                Use your browser developer tools Performance panel to record a
                profile.
              </p>
            )}
          </>
        )}
      </div>
      <div className="modal-footer">
        {report && (
          <Button
            onClick={() =>
              download("parabolic-diagnostics.json", report, "application/json")
            }
          >
            Save diagnostic report
          </Button>
        )}
        {!sent && (
          <Button
            variant="primary"
            disabled={!report || !destination?.configured || busy}
            onClick={() => void send()}
          >
            {busy ? "Sending…" : "Send reviewed report"}
          </Button>
        )}
      </div>
    </Modal>
  );
}
export function HelpDialog({
  onClose,
  onShortcuts,
}: {
  onClose: () => void;
  onShortcuts: () => void;
}) {
  return (
    <Modal title="Help & support" onClose={onClose}>
      <div className="help-content">
        <Button
          onClick={() => {
            onClose();
            onShortcuts();
          }}
        >
          Keyboard shortcuts guide
        </Button>
        <p>
          Use the command menu to contact support, send feedback, or capture a
          performance report.
        </p>
      </div>
    </Modal>
  );
}
