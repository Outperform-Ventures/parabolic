#!/usr/bin/env python3
"""Index saved audit evidence without operating Parabolic or fetching the network."""
from pathlib import Path
import csv
import hashlib
import json
import re
import struct
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "audit"
CORRECTIONS = {
    "005": "Intermediate search screen with query; not populated results.",
    "006": "Populated search screenshot; AX may precede results. Use 007 for detail.",
    "009": "Attempt only: related submenu did not open. Prefer 118.",
    "010": "Attempt only: related submenu did not open. Prefer 118.",
    "012": "Priority tooltip/focus only. Actual menu is 013.",
    "026": "Attempt only: filter menu remains open. Prefer 028.",
    "027": "Attempt only: filter menu remains open. Prefer 028.",
    "028": "Advanced filter opened; temporary empty filter was removed.",
    "067": "Screenshot and AX disagree during navigation; prefer 084.",
    "086": "Inline initiative creation row, not a modal. Cancelled.",
    "094": "Save-to destination picker, not a full permissions dialog.",
    "107": "Support form inspected, no message sent.",
    "108": "Shortcut reference enumerated; not every shortcut executed.",
    "110": "Long console string truncated by AX; prefer clean 111–114 and derived JSON.",
    "111": "Exact native CSS and loaded-font values; DevTools docked right.",
    "112": "Exact semantic CSS variables; DevTools docked right.",
    "114": "Exact command palette computed styles; DevTools docked right.",
    "115": "Temporary second tab opened, subsequently closed before 122.",
    "118": "Actual expanded native Create related submenu.",
    "119": "Custom board named Triage; not intake-triage workflow.",
    "120": "Custom view breakdown/details; not intake-triage workflow.",
    "126": "History preview/current version; no version restored.",
    "127": "Returned to original GTM All issues; audit tab and DevTools closed.",
    "demo-04": "Initial board capture; prefer demo-05 for a clean board.",
    "demo-15": "Initiative detail has no assigned projects; not a populated rollup.",
    "demo-18": "Scrolled cycles overview; actual cycle detail is demo-19.",
}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def cell(value):
    return str(value).replace("|", "&#124;").replace("\n", " ")

def code_cell(value):
    value = str(value).replace("|", "\\|").replace("\n", " ")
    ticks = "`" * (max((len(x) for x in re.findall(r"`+", value)), default=0) + 1)
    return f"{ticks} {value} {ticks}"

records = []
for path in sorted((AUDIT / "observations").glob("*.txt")):
    m = re.match(r"^(\d{3}|demo-\d{2})-(.+)$", path.stem)
    if not m:
        continue
    ident, slug = m.groups()
    data = path.read_text()
    screenshot = AUDIT / "screenshots" / f"{path.stem}.png"
    record = {
        "id": ident,
        "name": slug.replace("-", " "),
        "source": "official-web-demo" if ident.startswith("demo") else "installed-macos-app",
        "observation_path": str(path.relative_to(AUDIT)),
        "observation_sha256": sha(path),
        "recorded_at_file_mtime": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
        "note": CORRECTIONS.get(ident, ""),
    }
    if screenshot.exists():
        raw = screenshot.read_bytes()
        record.update(screenshot_path=str(screenshot.relative_to(AUDIT)), screenshot_sha256=sha(screenshot),
                      raster_dimensions=list(struct.unpack(">II", raw[16:24])))
    else:
        record["note"] = (record["note"] + " Accessibility/console evidence only; no screenshot.").strip()
    route = re.search(r"HTML content .*?URL: ([^\n]+)", data)
    if route:
        record["observed_route"] = route.group(1)
    records.append(record)

native = [r for r in records if r["source"] == "installed-macos-app"]
demo = [r for r in records if r["source"] == "official-web-demo"]
counts = {"native_observations": len(native), "demo_observations": len(demo),
          "native_screenshots": sum("screenshot_path" in r for r in native),
          "demo_screenshots": sum("screenshot_path" in r for r in demo)}
(AUDIT / "capture-manifest.json").write_text(json.dumps({
    "description": "Recorded states, including corrected attempts; counts are not distinct pages/features or completed tests. mtime is a file timestamp, not an instrumented capture timestamp.",
    "counts": counts, "captures": records}, indent=2) + "\n")

lines = ["# Audit evidence index", "", "Captured 2026-09-05. The installed macOS app is primary evidence; the official public demo is separate supporting evidence.", "",
         f"{len(native)} native observations ({counts['native_screenshots']} screenshots) and {len(demo)} demo observations ({counts['demo_screenshots']} screenshots). These include menus, settings, repeated states, transition frames and attempted interactions. They are not a count of distinct pages or verified features.", "",
         "Captures contain the user's workspace content and remain local. Each observation records visible/accessibility state, not a proof that every listed action was executed. See [coverage](coverage-matrix.md), [visual audit](visual-audit.md), [demo audit](demo-audit.md) and the [hash manifest](capture-manifest.json).", ""]
for title, group in [("Installed macOS app", native), ("Official public demo", demo)]:
    lines += [f"## {title}", "", "| ID | Recorded surface | Evidence | Interpretation / limitation |", "|---|---|---|---|"]
    for r in group:
        links = f"[AX]({r['observation_path']})"
        if "screenshot_path" in r:
            links += f" · [PNG]({r['screenshot_path']})"
        lines.append(f"| {r['id']} | {cell(r['name'])} | {links} | {cell(r['note'])} |")
    lines.append("")
(AUDIT / "evidence-index.md").write_text("\n".join(lines))

# The AX reference has a heading, then repeated action container / label / chord.
shortcut_text = (AUDIT / "observations/108-keyboard-reference.txt").read_text()
shortcut_text = shortcut_text[shortcut_text.index("container Keyboard Shortcuts"):]
shortcuts = []
category = ""
action = None
action_indent = None
for line in shortcut_text.splitlines():
    hm = re.match(r"\s*\d+ heading (.*?), Value: 2$", line)
    if hm:
        category = hm.group(1)
        action = None
        continue
    cm = re.match(r"(\s*)\d+ container (.+)$", line)
    if cm and category:
        action, action_indent = cm.group(2), len(cm.group(1))
        continue
    tm = re.match(r"(\s*)\d+ text (.+)$", line)
    if tm and action and len(tm.group(1)) == action_indent:
        shortcuts.append({"category": category, "action": action, "shortcut": tm.group(2),
                          "status": "Listed in native shortcut reference; execution not individually verified"})
        action = None

with (AUDIT / "keyboard-shortcuts.csv").open("w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["category", "action", "shortcut", "status"])
    writer.writeheader()
    writer.writerows(shortcuts)
lines = ["# Native keyboard shortcut inventory", "", f"{len(shortcuts)} entries transcribed from [the installed app's shortcut reference](observations/108-keyboard-reference.txt) on 2026-09-05. These are advertised bindings, including editor syntax. They were not all executed. Scope/focus, browser conflicts and alternative keyboard layouts need separate verification.", "",
         "The original AX wording is preserved, including keys spelled out by accessibility. [CSV](keyboard-shortcuts.csv).", ""]
for category in dict.fromkeys(x["category"] for x in shortcuts):
    lines += [f"## {category}", "", "| Action | Binding |", "|---|---|"]
    lines += [f"| {cell(x['action'])} | {code_cell(x['shortcut'])} |" for x in shortcuts if x["category"] == category]
    lines.append("")
(AUDIT / "keyboard-shortcuts.md").write_text("\n".join(lines))
print(json.dumps({**counts, "shortcut_entries": len(shortcuts)}))
