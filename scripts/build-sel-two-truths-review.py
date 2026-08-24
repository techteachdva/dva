#!/usr/bin/env python3
"""Build teacher-review HTML + PDF for Tech Escape SEL Two Truths notifications."""

import re
import subprocess
import sys
from datetime import date
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "src/site/tech-escape/js/data/twoTruths.js"
OUT_DIR = ROOT / "src/site/tech-escape/docs"
HTML_PATH = OUT_DIR / "SEL-Two-Truths-Teacher-Review.html"
PDF_PATH = OUT_DIR / "SEL-Two-Truths-Teacher-Review.pdf"

CHROME_PATHS = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path("/usr/bin/google-chrome"),
    Path("/usr/bin/chromium"),
    Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
]


def parse_string_list(block: str) -> list[str]:
    m = re.search(r"statements:\s*\[(.*?)\]\s*,", block, re.DOTALL)
    if not m:
        return []
    inner = m.group(1)
    return [s.replace("\\'", "'") for s in re.findall(r"'((?:\\'|[^'])*)'", inner)]


def parse_items(text: str) -> list[dict]:
    start = text.index("const TWO_TRUTHS_DATA = [")
    chunk = text[start:]
    blocks = re.split(r"\n  \{", chunk)
    items = []
    for block in blocks:
        if "id: 'SEL-" not in block:
            continue
        item = {
            "id": re.search(r"id: '([^']+)'", block).group(1),
            "topic": re.search(r"topic: '([^']+)'", block).group(1),
            "sender": re.search(r"sender: '([^']+)'", block).group(1),
            "preview": re.search(r"preview: '([^']+)'", block).group(1),
            "statements": parse_string_list(block),
            "lieIndex": int(re.search(r"lieIndex: (\d+)", block).group(1)),
            "why": re.search(r"why: '((?:\\'|[^'])*)'", block).group(1).replace("\\'", "'"),
        }
        items.append(item)
    return items


def build_html(items: list[dict]) -> str:
    total = len(items)
    dc = sum(1 for q in items if q["topic"] == "Digital Citizenship")
    sel = sum(1 for q in items if q["topic"] == "Social Emotional Learning")
    today = date.today().isoformat()

    cards = []
    labels = ["A", "B", "C"]
    for idx, item in enumerate(items, start=1):
        stmts = []
        for i, text in enumerate(item["statements"]):
            is_lie = i == item["lieIndex"]
            cls = "is-lie" if is_lie else "is-truth"
            tag = "LIE" if is_lie else "TRUTH"
            stmts.append(
                f'<li class="stmt {cls}">'
                f'<span class="stmt-label">{labels[i]}</span>'
                f'<span class="stmt-text">{escape(text)}</span>'
                f'<span class="stmt-tag">{tag}</span></li>'
            )
        cards.append(
            f"""
    <article class="card" id="{escape(item['id'])}">
      <header class="card-head">
        <div class="card-num">{idx} of {total}</div>
        <div class="card-id">{escape(item['id'])}</div>
        <div class="card-topic">{escape(item['topic'])}</div>
      </header>
      <div class="sender">{escape(item['sender'])}</div>
      <p class="preview">{escape(item['preview'])}</p>
      <p class="prompt">Which one is the lie? (Students do not see TRUTH/LIE labels in the game.)</p>
      <ul class="statements">{''.join(stmts)}</ul>
      <div class="why">
        <strong>Why the lie is wrong</strong>
        <p>{escape(item['why'])}</p>
      </div>
      <div class="notes">
        <strong>Teacher notes / suggested edits</strong>
        <div class="notes-box"></div>
      </div>
    </article>"""
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Tech Escape — SEL Two Truths &amp; One Lie (Teacher Review)</title>
<style>
  @page {{ size: letter; margin: 0.65in 0.7in; }}
  * {{ box-sizing: border-box; }}
  body {{
    font-family: "Segoe UI", Calibri, Arial, sans-serif;
    font-size: 15pt;
    line-height: 1.45;
    color: #111;
    background: #fff;
    margin: 0;
  }}
  .cover {{ page-break-after: always; padding: 0.5in 0 1in; }}
  .cover h1 {{ font-size: 32pt; line-height: 1.15; margin: 0 0 0.35in; color: #0d2847; }}
  .cover .sub {{ font-size: 20pt; color: #2a5a8a; margin-bottom: 0.5in; }}
  .cover p {{ font-size: 16pt; max-width: 7in; margin: 0.2in 0; }}
  .cover ul {{ font-size: 16pt; margin: 0.25in 0; padding-left: 0.35in; }}
  .cover .meta {{ margin-top: 0.6in; font-size: 13pt; color: #444; }}
  .legend {{
    border: 2px solid #ccc; border-radius: 10px;
    padding: 0.25in 0.35in; margin: 0.4in 0; font-size: 14pt;
  }}
  .legend strong {{ display: block; margin-bottom: 0.1in; }}
  .card {{ page-break-after: always; padding-bottom: 0.35in; }}
  .card:last-child {{ page-break-after: auto; }}
  .card-head {{
    display: flex; flex-wrap: wrap; gap: 0.15in 0.35in; align-items: baseline;
    margin-bottom: 0.15in; border-bottom: 3px solid #0d2847; padding-bottom: 0.12in;
  }}
  .card-num {{ font-size: 14pt; font-weight: 700; color: #555; }}
  .card-id {{ font-size: 18pt; font-weight: 800; color: #0d2847; font-family: Consolas, monospace; }}
  .card-topic {{ font-size: 14pt; font-weight: 600; color: #2a5a8a; flex: 1; }}
  .sender {{ font-size: 22pt; font-weight: 700; margin: 0.12in 0 0.08in; }}
  .preview {{ font-size: 18pt; font-weight: 600; margin: 0 0 0.2in; color: #222; }}
  .prompt {{ font-size: 13pt; color: #555; margin: 0 0 0.15in; }}
  .statements {{ list-style: none; margin: 0 0 0.25in; padding: 0; }}
  .stmt {{
    display: grid; grid-template-columns: 0.45in 1fr auto;
    gap: 0.12in 0.2in; align-items: start;
    padding: 0.18in 0.2in; margin-bottom: 0.12in;
    border-radius: 8px; border: 2px solid #ddd; font-size: 17pt;
  }}
  .stmt.is-truth {{ background: #eef8f0; border-color: #3d8f5a; }}
  .stmt.is-lie {{ background: #fdeeee; border-color: #c44; }}
  .stmt-label {{ font-weight: 800; font-size: 18pt; color: #0d2847; }}
  .stmt-text {{ font-weight: 500; }}
  .stmt-tag {{
    font-size: 11pt; font-weight: 800; letter-spacing: 0.06em;
    padding: 0.06in 0.12in; border-radius: 4px; white-space: nowrap;
  }}
  .is-truth .stmt-tag {{ background: #3d8f5a; color: #fff; }}
  .is-lie .stmt-tag {{ background: #b33; color: #fff; }}
  .why {{
    font-size: 15pt; background: #f4f7fb; border-left: 5px solid #2a5a8a;
    padding: 0.18in 0.22in; margin-bottom: 0.2in;
  }}
  .why strong {{ display: block; font-size: 14pt; margin-bottom: 0.08in; color: #2a5a8a; }}
  .why p {{ margin: 0; }}
  .notes strong {{ display: block; font-size: 14pt; margin-bottom: 0.08in; color: #444; }}
  .notes-box {{
    min-height: 0.9in; border: 2px dashed #aaa; border-radius: 8px; background: #fafafa;
  }}
  @media print {{
    body {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  }}
</style>
</head>
<body>
  <section class="cover">
    <h1>Tech Escape — SEL Notifications</h1>
    <p class="sub">Two Truths &amp; One Lie — Teacher Review Packet</p>
    <p>
      These are the <strong>text-message style notifications</strong> that pop up during
      <em>Tech Escape</em> while students explore the haunted computer lab.
      Each scenario has <strong>two true statements and one lie</strong>.
      Students must spot the lie before the timer runs out.
    </p>
    <ul>
      <li><strong>{total}</strong> scenarios total</li>
      <li><strong>{dc}</strong> Digital Citizenship</li>
      <li><strong>{sel}</strong> Social Emotional Learning</li>
    </ul>
    <div class="legend">
      <strong>How to use this packet</strong>
      Each page shows <span style="color:#3d8f5a;font-weight:700">TRUTH</span> and
      <span style="color:#b33;font-weight:700">LIE</span> labels for review only —
      students do not see these in the game.
      Use the notes box to suggest edits or new scenarios. Return feedback to update the game bank.
    </div>
    <p class="meta">
      Source: src/site/tech-escape/js/data/twoTruths.js<br />
      Generated: {today} · DVA Media Arts &amp; Tech
    </p>
  </section>
  {''.join(cards)}
</body>
</html>"""


def chrome_pdf(html_path: Path, pdf_path: Path) -> bool:
    chrome = next((p for p in CHROME_PATHS if p.is_file()), None)
    if not chrome:
        return False
    url = html_path.resolve().as_uri()
    cmd = [
        str(chrome),
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--allow-file-access-from-files",
        f"--print-to-pdf={pdf_path.resolve()}",
        "--no-pdf-header-footer",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(result.stderr or result.stdout, file=sys.stderr)
        return False
    return pdf_path.is_file()


def main() -> int:
    text = DATA_PATH.read_text(encoding="utf-8")
    items = parse_items(text)
    if len(items) != 50:
        print(f"Warning: expected 50 items, parsed {len(items)}", file=sys.stderr)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    html = build_html(items)
    HTML_PATH.write_text(html, encoding="utf-8")
    print(f"Wrote {HTML_PATH}")

    if chrome_pdf(HTML_PATH, PDF_PATH):
        print(f"Wrote {PDF_PATH}")
    else:
        print("Chrome not found — open the HTML file and use Print → Save as PDF.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
