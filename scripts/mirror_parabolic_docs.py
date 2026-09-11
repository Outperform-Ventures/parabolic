#!/usr/bin/env python3
"""Archive public Parabolic documentation with provenance, links and image assets.

Dependencies: pip install beautifulsoup4 markdownify
Example: python3 scripts/mirror_parabolic_docs.py
Network access is limited to published, robots-permitted documentation and images.
Raw HTML remains authoritative; Markdown is a convenient article-body extraction.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import mimetypes
from pathlib import Path
import re
import sys
import threading
import time
from urllib import error, parse, request, robotparser
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).parent / ".python-deps"))
from bs4 import BeautifulSoup
from markdownify import markdownify

BASE = "https://parabolic.app"
USER_AGENT = "PublicDocumentationArchive/1.0 (personal research; rate limited)"
ROOT = Path(__file__).resolve().parents[1]
STARTED = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
PREFIXES = ("/docs", "/developers", "/enablement", "/method")
IMAGE_HOSTS = {"parabolic.app", "webassets.parabolic.app", "static.parabolic.app", "cdn.sanity.io", "assets.parabolic.app"}
lock = threading.Lock()
next_request = 0.0
interval = 0.35


def dump(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def fetch(url: str, limit=20 * 1024 * 1024):
    global next_request
    with lock:
        delay = max(0, next_request - time.monotonic())
        next_request = time.monotonic() + delay + interval
    if delay:
        time.sleep(delay)
    req = request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with request.urlopen(req, timeout=40) as response:
            length = int(response.headers.get("Content-Length", "0"))
            if length > limit:
                raise ValueError(f"asset exceeds {limit} bytes ({length})")
            data = response.read(limit + 1)
            if len(data) > limit:
                raise ValueError(f"response exceeds {limit} bytes")
            return data, {"status": response.status, "final_url": response.url,
                          "content_type": response.headers.get("Content-Type", ""),
                          "last_modified": response.headers.get("Last-Modified"),
                          "etag": response.headers.get("ETag")}
    except error.HTTPError as exc:
        return b"", {"status": exc.code, "final_url": exc.url, "error": str(exc)}


def canonical(url: str, base=BASE):
    u = parse.urlsplit(parse.urljoin(base, url))
    if u.scheme not in ("http", "https"):
        return None
    path = re.sub(r"/+", "/", u.path).rstrip("/") or "/"
    return parse.urlunsplit(("https", u.netloc.lower(), path, "", ""))


def in_scope(url):
    u = parse.urlsplit(url)
    return u.netloc == "parabolic.app" and any(u.path == p or u.path.startswith(p + "/") for p in PREFIXES)


def rel_doc(url):
    path = parse.urlsplit(url).path.strip("/")
    return Path(path + ("/index" if path in {p.strip('/') for p in PREFIXES} else ""))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--output", type=Path, default=ROOT / "reference/parabolic-docs")
    ap.add_argument("--refresh", action="store_true", help="Refetch cached successful pages")
    ap.add_argument("--skip-images", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--asset-budget-mb", type=int, default=512)
    ap.add_argument("--max-image-mb", type=int, default=64, help="Maximum individual image payload, including animated GIFs")
    args = ap.parse_args()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    robots_raw, robots_meta = fetch(BASE + "/robots.txt")
    (out / "robots.txt").write_bytes(robots_raw)
    rp = robotparser.RobotFileParser()
    rp.parse(robots_raw.decode().splitlines())
    sitemaps = rp.site_maps() or [BASE + "/sitemap.xml"]
    published = set()
    provenance = []
    while sitemaps:
        sitemap = sitemaps.pop(0)
        data, meta = fetch(sitemap)
        filename = "sitemap.xml" if not provenance else f"sitemap-{len(provenance)}.xml"
        (out / filename).write_bytes(data)
        provenance.append({"url": sitemap, "path": filename, "sha256": digest(data), **meta})
        tree = ET.fromstring(data)
        urls = [e.text for e in tree.iter() if e.tag.endswith("loc")]
        if tree.tag.endswith("sitemapindex"):
            sitemaps.extend(urls)
        else:
            published.update(canonical(u) for u in urls if in_scope(canonical(u)))
    discovered = set(published)
    done = {}
    all_media = {}
    old = {}
    if (out / "manifest.json").exists():
        old = {p["url"]: p for p in json.loads((out / "manifest.json").read_text())["pages"]}

    def page(url):
        rel = rel_doc(url)
        raw_path = out / "html" / rel.with_suffix(".html")
        md_path = out / "markdown" / rel.with_suffix(".md")
        meta = {"url": url, "fetched_at": STARTED, "discovery": "sitemap" if url in published else "internal-link"}
        if not rp.can_fetch(USER_AGENT, url):
            return {**meta, "status": "robots-disallowed"}, [], []
        try:
            if not args.refresh and raw_path.exists() and old.get(url, {}).get("status") == 200:
                data = raw_path.read_bytes()
                response = {k: v for k, v in old[url].items() if k in {"status", "final_url", "content_type", "last_modified", "etag"}}
                meta["fetched_at"] = old[url]["fetched_at"]
            else:
                data, response = fetch(url)
            meta.update(response)
            if meta.get("status") != 200:
                return meta, [], []
            raw_path.parent.mkdir(parents=True, exist_ok=True)
            raw_path.write_bytes(data)
            soup = BeautifulSoup(data, "html.parser")
            title = soup.find("h1") or soup.find("title")
            meta["title"] = title.get_text(" ", strip=True) if title else url
            links = sorted({canonical(a.get("href", ""), url) for a in soup.select("a[href]") if canonical(a.get("href", ""), url)})
            body = soup.find("article") or soup.find("main") or soup.body
            media = []
            for element in body.find_all(["img", "video", "source", "iframe", "a"]):
                attrs = ["src", "poster"]
                if element.name == "a":
                    attrs = ["href"] if re.search(r"\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|pdf)(\?|$)", element.get("href", ""), re.I) else []
                for attr in attrs:
                    value = element.get(attr)
                    if value and not value.startswith("data:"):
                        full = parse.urljoin(url, value)
                        kind = "image" if element.name == "img" or attr == "poster" else "embed" if element.name == "iframe" else "linked-file" if element.name == "a" else "video"
                        media.append({"url": full, "kind": kind, "alt": element.get("alt", ""), "source_page": url})
                if element.get("srcset"):
                    for item in element["srcset"].split(","):
                        val = item.strip().split(" ")[0]
                        if val:
                            media.append({"url": parse.urljoin(url, val), "kind": "image-variant", "alt": element.get("alt", ""), "source_page": url})
            for element in body.find_all(["script", "style", "noscript"]):
                element.decompose()
            for element in body.find_all(True):
                for attr in ("href", "src", "poster"):
                    if element.has_attr(attr):
                        element[attr] = parse.urljoin(url, element[attr])
            md = markdownify(str(body), heading_style="ATX", bullets="-", strip=["button"]).replace("\u2060", "")
            md = re.sub(r"\n{3,}", "\n\n", md).strip()
            front = f"<!-- Source: {url}\nRetrieved: {meta['fetched_at']}\nRaw HTML SHA-256: {digest(data)}\nArticle/main extraction; consult raw HTML for embedded state. -->\n\n"
            md_path.parent.mkdir(parents=True, exist_ok=True)
            md_path.write_text(front + md + "\n")
            meta.update({"html_path": str(raw_path.relative_to(out)), "markdown_path": str(md_path.relative_to(out)),
                         "sha256": digest(data), "bytes": len(data), "text_characters": len(body.get_text(" ", strip=True)),
                         "links": links, "media_urls": sorted({m["url"] for m in media})})
            return meta, [u for u in links if in_scope(u)], media
        except Exception as exc:
            return {**meta, "status": "error", "error": str(exc)}, [], []

    while discovered - done.keys():
        batch = sorted(discovered - done.keys())
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for meta, links, media in pool.map(page, batch):
                done[meta["url"]] = meta
                discovered.update(links)
                for m in media:
                    record = all_media.setdefault(m["url"], {"url": m["url"], "kinds": [], "alt_texts": [], "source_pages": []})
                    for target, value in [("kinds", m["kind"]), ("alt_texts", m["alt"]), ("source_pages", m["source_page"])]:
                        if value and value not in record[target]:
                            record[target].append(value)
                if len(done) % 20 == 0:
                    print(f"Archived {len(done)} pages; {len(discovered)} discovered", flush=True)
    pages = sorted(done.values(), key=lambda p: p["url"])
    dump(out / "manifest.json", {"started_at": STARTED, "robots": robots_meta, "sitemaps": provenance,
                                 "scope_prefixes": PREFIXES, "sitemap_url_count": len(published), "pages": pages})
    print(f"Page corpus ready: {len(pages)} pages. Starting media archive.", flush=True)
    media_records = sorted(all_media.values(), key=lambda x: x["url"])
    dump(out / "media-manifest.json", media_records)
    budget = args.asset_budget_mb * 1024 * 1024
    used = 0
    budget_lock = threading.Lock()
    asset_robots = {"parabolic.app": rp}
    image_hosts = {parse.urlsplit(m["url"]).netloc for m in media_records if "image" in m["kinds"]}
    for host in sorted(image_hosts & IMAGE_HOSTS - {"parabolic.app"}):
        try:
            data, meta = fetch(f"https://{host}/robots.txt")
            (out / "asset-robots").mkdir(exist_ok=True)
            (out / "asset-robots" / f"{host}.txt").write_bytes(data)
            robot = robotparser.RobotFileParser()
            robot.parse(data.decode(errors="replace").splitlines() if meta.get("status") == 200 else [])
            asset_robots[host] = robot
        except Exception:
            pass

    def asset(m):
        nonlocal used
        url = m["url"]
        host = parse.urlsplit(url).netloc
        if args.skip_images:
            return {**m, "status": "not-downloaded", "reason": "--skip-images"}
        if "image" not in m["kinds"]:
            return {**m, "status": "link-preserved", "reason": "non-image or alternative responsive size"}
        if host not in IMAGE_HOSTS:
            return {**m, "status": "link-preserved", "reason": "host outside image allowlist"}
        if host in asset_robots and not asset_robots[host].can_fetch(USER_AGENT, url):
            return {**m, "status": "robots-disallowed"}
        key = digest(url.encode())[:24]
        existing = list((out / "images").glob(key + ".*")) if (out / "images").exists() else []
        try:
            if existing and not args.refresh:
                file = existing[0]
                data = file.read_bytes()
                response = {"status": 200, "content_type": mimetypes.guess_type(file)[0], "final_url": url}
            else:
                with budget_lock:
                    if used >= budget:
                        return {**m, "status": "link-preserved", "reason": "total image byte budget reached"}
                data, response = fetch(url, limit=args.max_image_mb * 1024 * 1024)
                if response.get("status") != 200:
                    return {**m, **response}
                mime = response.get("content_type", "").split(";")[0]
                if not mime.startswith("image/"):
                    return {**m, "status": "link-preserved", "reason": f"unexpected media type {mime}"}
                ext = mimetypes.guess_extension(mime) or ".img"
                file = out / "images" / (key + ext)
                file.parent.mkdir(exist_ok=True)
                with budget_lock:
                    if used + len(data) > budget:
                        return {**m, "status": "link-preserved", "reason": "total image byte budget reached"}
                    used += len(data)
                file.write_bytes(data)
            return {**m, **response, "path": str(file.relative_to(out)), "bytes": len(data), "sha256": digest(data), "fetched_at": STARTED}
        except Exception as exc:
            return {**m, "status": "error", "error": str(exc)}

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        complete_media = []
        for m in pool.map(asset, media_records):
            complete_media.append(m)
            if len(complete_media) % 100 == 0:
                print(f"Processed {len(complete_media)}/{len(media_records)} media links", flush=True)
    dump(out / "media-manifest.json", complete_media)
    # Replace image URLs in a second offline-friendly Markdown tree.
    image_paths = {m["url"]: m["path"] for m in complete_media if m.get("path")}
    import os
    for p in pages:
        if not p.get("markdown_path"):
            continue
        source = out / p["markdown_path"]
        dest = out / "offline" / Path(p["markdown_path"]).relative_to("markdown")
        content = source.read_text()
        for url in p["media_urls"]:
            if url in image_paths:
                content = content.replace(url, os.path.relpath(out / image_paths[url], dest.parent))
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content)
    ok = [p for p in pages if p.get("status") == 200]
    errors = [p for p in pages if p.get("status") != 200]
    downloaded = [m for m in complete_media if m.get("path")]
    summary = {"started_at": STARTED, "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
               "sitemap_pages_in_scope": len(published), "discovered_pages": len(pages), "successful_pages": len(ok),
               "page_errors": [{"url": p["url"], "status": p["status"], "error": p.get("error")} for p in errors],
               "by_section": {prefix: sum(parse.urlsplit(p["url"]).path == prefix or parse.urlsplit(p["url"]).path.startswith(prefix + "/") for p in ok) for prefix in PREFIXES},
               "media_links": len(complete_media), "downloaded_images": len(downloaded), "downloaded_image_bytes": sum(m["bytes"] for m in downloaded),
               "html_bytes": sum(p.get("bytes", 0) for p in pages),
               "exclusions": ["Authenticated content and private workspace data", "Entire marketing site, changelog archive and integration marketplace", "Video/audio payloads and third-party embeds (links retained)", "Responsive image variants beyond the primary image src", f"Image hosts outside explicit allowlist; images >{args.max_image_mb} MiB; images over total budget", "Unlinked or undiscoverable documentation URLs"]}
    dump(out / "coverage.json", summary)
    index = ["# Parabolic public documentation archive", "", f"Retrieved {STARTED}. Official published sources; reference material only.", "",
             f"{len(ok)} successful pages of {len(pages)} discovered; {len(published)} sitemap URLs in scope. {len(downloaded)} images archived.", "",
             "See `coverage.json` for exclusions/errors, `manifest.json` for page provenance and SHA-256 hashes, and `media-manifest.json` for image/embed references.", "",
             "`markdown/` preserves remote source links. `offline/` uses locally archived images. `html/` preserves the original server response, including app hydration data.", "",
             "Reproduce: `python3 scripts/mirror_parabolic_docs.py` (dependencies: `beautifulsoup4 markdownify`). Cached pages/images are reused; pass `--refresh` to fetch anew. Requests start at most once per 350 ms, with four workers by default.", ""]
    for prefix in PREFIXES:
        index.extend([f"## {prefix.strip('/')}", ""])
        for p in ok:
            if parse.urlsplit(p["url"]).path == prefix or parse.urlsplit(p["url"]).path.startswith(prefix + "/"):
                index.append(f"- [{p['title']}]({p['markdown_path']}) — [source]({p['url']})")
        index.append("")
    if errors:
        index.extend(["## Fetch errors", ""] + [f"- {p['status']}: {p['url']}" for p in errors] + [""])
    index.extend(["## Scope limits", ""] + [f"- {x}" for x in summary["exclusions"]] + [""])
    (out / "README.md").write_text("\n".join(index))
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
