import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useAppStore } from "../store";
export type DatePrecision = "day" | "month" | "quarter" | "half-year" | "year";
const iso = (date: Date) => date.toISOString().slice(0, 10);
const endOfMonth = (year: number, month: number) =>
  iso(new Date(Date.UTC(year, month + 1, 0)));
const ordinal = (day: number) =>
  day +
  ([11, 12, 13].includes(day % 100)
    ? "th"
    : day % 10 === 1
      ? "st"
      : day % 10 === 2
        ? "nd"
        : day % 10 === 3
          ? "rd"
          : "th");
export function targetDateDayLabel(date: Date, today: string) {
  const label = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    timeZone: "UTC",
  });
  return `${iso(date) === today ? "Today, " : ""}${label} ${ordinal(date.getUTCDate())}, ${date.getUTCFullYear()}`;
}
export function formatTargetDate(value?: string | null, precision = "day") {
  if (!value) return "Target date";
  const d = new Date(value);
  return precision === "quarter"
    ? `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
    : precision === "half-year"
      ? `H${d.getUTCMonth() < 6 ? 1 : 2} ${d.getUTCFullYear()}`
      : precision === "year"
        ? String(d.getUTCFullYear())
        : d.toLocaleDateString(undefined, {
            month: precision === "month" ? "long" : "short",
            ...(precision === "month"
              ? { year: "numeric" as const }
              : { day: "numeric" as const }),
            timeZone: "UTC",
          });
}
export function parseTargetDate(
  input: string,
  now = new Date(),
): { date: string; precision: DatePrecision } | null {
  const text = input.trim().toLowerCase(),
    year = now.getUTCFullYear();
  if (!text) return null;
  if (["today", "tomorrow", "next week"].includes(text)) {
    const d = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(
      d.getUTCDate() + (text === "tomorrow" ? 1 : text === "next week" ? 7 : 0),
    );
    return { date: iso(d), precision: "day" };
  }
  let match = text.match(/^(?:q([1-4])\s*(\d{4})?|(\d{4})\s*q([1-4]))$/);
  if (match)
    return {
      date: endOfMonth(
        Number(match[2] || match[3] || year),
        Number(match[1] || match[4]) * 3 - 1,
      ),
      precision: "quarter",
    };
  match = text.match(/^h([12])\s*(\d{4})?$/);
  if (match)
    return {
      date: endOfMonth(Number(match[2] || year), Number(match[1]) * 6 - 1),
      precision: "half-year",
    };
  if (/^\d{4}$/.test(text) && Number(text) >= 1900)
    return { date: `${text}-12-31`, precision: "year" };
  match =
    text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) ||
    (text
      .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      ?.map((x, i, all) =>
        i === 0 ? x : i === 1 ? all[3] : i === 2 ? all[1] : all[2],
      ) as RegExpMatchArray | null);
  if (match) {
    const [y, m, d] = match.slice(1).map(Number),
      candidate = new Date(Date.UTC(y, m - 1, d));
    if (
      candidate.getUTCFullYear() === y &&
      candidate.getUTCMonth() === m - 1 &&
      candidate.getUTCDate() === d
    )
      return { date: iso(candidate), precision: "day" };
    return null;
  }
  match = text.match(/^([a-z]+)\s+(\d{4})$/);
  if (match) {
    const month = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].findIndex((m) => m === match![1] || m.slice(0, 3) === match![1]);
    if (month >= 0)
      return { date: endOfMonth(Number(match[2]), month), precision: "month" };
  }
  return null;
}
export function TargetDateControl({
  value,
  precision = "day",
  onChange,
  label = "Target date",
  triggerLabel,
  triggerContent,
  triggerClassName,
  minDate,
  maxDate,
  allowPeriods = true,
  showFooter = true,
}: {
  value?: string | null;
  precision?: string;
  onChange: (date: string | null, precision: string) => any;
  label?: string;
  triggerLabel?: string;
  triggerContent?: React.ReactNode;
  triggerClassName?: string;
  minDate?: string | null;
  maxDate?: string | null;
  allowPeriods?: boolean;
  showFooter?: boolean;
}) {
  const { data, user } = useAppStore();
  const weekName =
    (data.users.find((u) => u.id === user?.id) || user)?.preferences
      ?.weekStartsOn || "Monday";
  const weekStart = weekName === "Sunday" ? 0 : weekName === "Saturday" ? 6 : 1;
  const [open, setOpen] = useState(false),
    [kind, setKind] = useState(precision),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [month, setMonth] = useState(() => new Date(value || Date.now())),
    [rect, setRect] = useState<DOMRect | null>(null);
  const saving = useRef(false),
    anchor = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null),
    search = useRef<HTMLInputElement>(null),
    yearFocus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => search.current?.focus());
    const outside = (e: PointerEvent) => {
      if (
        !popup.current?.contains(e.target as Node) &&
        !anchor.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        anchor.current?.focus();
      }
    };
    const position = () =>
      setRect(anchor.current?.getBoundingClientRect() || null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);
  useEffect(() => {
    if (open && kind !== "day")
      yearFocus.current?.scrollIntoView({ block: "start" });
  }, [kind, open]);
  const validDate = (date: string) =>
    !(
      (minDate && date < minDate.slice(0, 10)) ||
      (maxDate && date > maxDate.slice(0, 10))
    );
  const choose = async (date: string | null, datePrecision = kind) => {
    if (saving.current) return;
    setError("");
    if (date && !validDate(date)) {
      setError(
        minDate && date < minDate.slice(0, 10)
          ? "Choose a date on or after the project start date."
          : "Choose a date on or before the project target date.",
      );
      return;
    }
    if (!allowPeriods && datePrecision !== "day") {
      setError("Enter a specific day.");
      return;
    }
    saving.current = true;
    try {
      const result = await onChange(date, datePrecision);
      if (result === null) {
        setError("Could not save this date.");
        return;
      }
      setOpen(false);
      anchor.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this date.");
    } finally {
      saving.current = false;
    }
  };
  const year = month.getUTCFullYear(),
    monthIndex = month.getUTCMonth();
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() - weekStart + 7) % 7));
  const days = Array.from(
    { length: 42 },
    (_, i) => new Date(start.getTime() + i * 86400000),
  );
  const today = iso(new Date());
  const initialYear = new Date(value || Date.now()).getUTCFullYear();
  const years = Array.from({ length: 10 }, (_, i) => initialYear - 4 + i);
  const monthLabel = month.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const width = 304;
  const left = Math.min(
    Math.max(8, rect?.left || 0),
    window.innerWidth - width - 8,
  );
  const top = rect
    ? rect.bottom + 380 > window.innerHeight && rect.top > 390
      ? rect.top - 380
      : Math.min(rect.bottom + 5, Math.max(8, window.innerHeight - 380))
    : 0;
  return (
    <>
      <button
        ref={anchor}
        className={triggerClassName || "feature-date-value"}
        type="button"
        onClick={() => {
          setKind(precision);
          setMonth(new Date(value || Date.now()));
          setQuery("");
          setError("");
          setRect(anchor.current?.getBoundingClientRect() || null);
          setOpen(!open);
        }}
        aria-label={triggerLabel || label}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {triggerContent || (
          <>
            <CalendarDays size={13} />
            {value ? formatTargetDate(value, precision) : label}
          </>
        )}
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={popup}
            className="feature-date-popover"
            role="dialog"
            aria-label={label}
            style={{ left, top, width }}
          >
            <div className="feature-date-search">
              <label htmlFor="target-date-search">{label}</label>
              <input
                id="target-date-search"
                ref={search}
                aria-label={"Enter " + label.toLowerCase()}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setError("");
                }}
                placeholder="Try: May 2027, Q4, 05/20/2027"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const parsed = parseTargetDate(query);
                    if (parsed) void choose(parsed.date, parsed.precision);
                    else
                      setError(
                        "Enter a day, month, quarter, half-year, or year.",
                      );
                  }
                }}
              />
            </div>
            <div
              className="feature-date-tabs"
              role="tablist"
              aria-label="Date precision"
            >
              {(allowPeriods
                ? (["day", "month", "quarter", "half-year", "year"] as const)
                : (["day"] as const)
              ).map((k) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  key={k}
                  className={kind === k ? "active" : ""}
                  onClick={() => setKind(k)}
                >
                  {k === "half-year"
                    ? "Half-year"
                    : k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
            {kind === "day" ? (
              <div className="feature-date-calendar">
                <div className="feature-between">
                  <strong>{monthLabel}</strong>
                  <div>
                    <button
                      type="button"
                      aria-label="Previous month"
                      onClick={() =>
                        setMonth(new Date(Date.UTC(year, monthIndex - 1, 1)))
                      }
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={() =>
                        setMonth(new Date(Date.UTC(year, monthIndex + 1, 1)))
                      }
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
                <div
                  className="feature-date-grid"
                  role="grid"
                  aria-label={monthLabel}
                >
                  {Array.from({ length: 7 }, (_, i) => (
                    <span role="columnheader" key={i}>
                      {
                        ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][
                          (i + weekStart) % 7
                        ]
                      }
                    </span>
                  ))}
                  {days.map((day) => {
                    const dayValue = iso(day);
                    return (
                      <button
                        type="button"
                        role="gridcell"
                        disabled={!validDate(dayValue)}
                        aria-label={targetDateDayLabel(day, today)}
                        aria-selected={value?.slice(0, 10) === dayValue}
                        key={dayValue}
                        className={`${day.getUTCMonth() !== monthIndex ? "outside" : ""} ${dayValue === today ? "today" : ""} ${value?.slice(0, 10) === dayValue ? "selected" : ""}`}
                        onClick={() => void choose(dayValue, "day")}
                        onKeyDown={(e) => {
                          if (
                            ![
                              "ArrowLeft",
                              "ArrowRight",
                              "ArrowUp",
                              "ArrowDown",
                            ].includes(e.key)
                          )
                            return;
                          e.preventDefault();
                          const next = new Date(
                            day.getTime() +
                              ({
                                ArrowLeft: -1,
                                ArrowRight: 1,
                                ArrowUp: -7,
                                ArrowDown: 7,
                              }[e.key] || 0) *
                                86400000,
                          );
                          if (next.getUTCMonth() !== monthIndex)
                            setMonth(
                              new Date(
                                Date.UTC(
                                  next.getUTCFullYear(),
                                  next.getUTCMonth(),
                                  1,
                                ),
                              ),
                            );
                          requestAnimationFrame(() =>
                            popup.current
                              ?.querySelector<HTMLButtonElement>(
                                `[data-date="${iso(next)}"]`,
                              )
                              ?.focus(),
                          );
                        }}
                        data-date={dayValue}
                      >
                        {day.getUTCDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="feature-date-periods">
                {years.map((y) => (
                  <div
                    className="feature-date-year"
                    key={y}
                    ref={y === initialYear ? yearFocus : undefined}
                  >
                    <span>{y}</span>
                    <div className={`period-${kind}`}>
                      {kind === "year" ? (
                        <button
                          type="button"
                          aria-label={`Year ${y}`}
                          onClick={() => void choose(`${y}-12-31`, "year")}
                        >
                          {y}
                        </button>
                      ) : kind === "quarter" ? (
                        [0, 1, 2, 3].map((q) => (
                          <button
                            type="button"
                            aria-label={`Q${q + 1} ${y}`}
                            key={q}
                            onClick={() =>
                              void choose(endOfMonth(y, q * 3 + 2), "quarter")
                            }
                          >
                            Q{q + 1}
                          </button>
                        ))
                      ) : kind === "half-year" ? (
                        [0, 1].map((h) => (
                          <button
                            type="button"
                            aria-label={`H${h + 1} ${y}`}
                            key={h}
                            onClick={() =>
                              void choose(endOfMonth(y, h * 6 + 5), "half-year")
                            }
                          >
                            H{h + 1}
                          </button>
                        ))
                      ) : (
                        Array.from({ length: 12 }, (_, m) => (
                          <button
                            type="button"
                            aria-label={`${new Date(Date.UTC(y, m, 1)).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" })} ${y}`}
                            key={m}
                            onClick={() =>
                              void choose(endOfMonth(y, m), "month")
                            }
                          >
                            {new Date(Date.UTC(y, m, 1)).toLocaleDateString(
                              undefined,
                              { month: "short", timeZone: "UTC" },
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <p className="feature-date-error" role="alert">
                {error}
              </p>
            )}
            {showFooter && (
              <div className="feature-date-footer">
                <button type="button" onClick={() => void choose(today, "day")}>
                  Today
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={() => void choose(null, "day")}
                  >
                    Remove date
                  </button>
                )}
              </div>
            )}
          </div>,
          anchor.current?.closest("dialog[open],.dropdown-content") ||
            document.body,
        )}
    </>
  );
}
