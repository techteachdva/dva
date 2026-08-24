#!/usr/bin/env python3
"""Build Kahoot xlsx, PDF (AI import), and host guide from questions.json."""

import json
import html
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


def ensure_pkg(module: str, pip_name: str | None = None):
    try:
        return __import__(module)
    except ImportError:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", pip_name or module, "-q"]
        )
        return __import__(module)


openpyxl = ensure_pkg("openpyxl")
Workbook = openpyxl.Workbook
fpdf_mod = ensure_pkg("fpdf")
FPDF = fpdf_mod.FPDF

ROOT = Path(__file__).parent
data = json.loads((ROOT / "questions.json").read_text(encoding="utf-8"))
LABELS = ["A", "B", "C", "D"]

REPLACEMENTS = {
    "\u2026": "...",
    "\u2014": "-",
    "\u2013": "-",
    "\u201c": '"',
    "\u201d": '"',
    "\u2018": "'",
    "\u2019": "'",
    "\u00be": "3/4",
    "\u00bd": "1/2",
    "\u00ae": "(R)",
    "\u2122": "(TM)",
}


def pdf_text(value: str) -> str:
    text = str(value)
    for src, dst in REPLACEMENTS.items():
        text = text.replace(src, dst)
    return text.encode("latin-1", "replace").decode("latin-1")


POSTERS_DIR = ROOT / "posters"
POSTER_CACHE = ROOT / "poster-urls.json"
USER_AGENT = "Mozilla/5.0 (compatible; CurtBirthdayKahoot/1.0; educational trivia)"

# TMDB movie IDs for reliable poster CDN URLs
TMDB_IDS = {
    1: 5206,
    2: 745,
    3: 17695,
    4: 565,
    5: 948,
    6: 377,
    7: 346364,
    8: 419430,
    9: 447332,
    10: 493922,
    11: 530385,
    12: 348,
    13: 694,
    14: 170,
    15: 2667,
    16: 138843,
    17: 578,
    18: 762965,
    19: 597,
    20: 329,
    21: 603,
    22: 862,
    23: 671,
    24: 13,
    25: 120,
    26: 12,
    27: 22,
    28: 1726,
    29: 19995,
    30: 155,
    31: 299534,
    32: 109445,
    33: 284054,
    34: 27205,
    35: 496243,
    36: 76341,
    37: 150540,
    38: 545611,
    39: 361743,
    40: 346698,
    41: 872585,
    42: 438631,
    43: 569094,
    44: 1022789,
    45: 402431,
    46: 76600,
    47: 762504,
    48: 1034541,
    49: 917496,
    50: 762441,
}


def fetch_tmdb_poster_url(movie_id: int) -> str | None:
    import re

    page = f"https://www.themoviedb.org/movie/{movie_id}"
    req = urllib.request.Request(page, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        html = resp.read().decode("utf-8", "ignore")
    match = re.search(r"https://image\.tmdb\.org/t/p/w\d+/([A-Za-z0-9_.]+)", html)
    if not match:
        return None
    return f"https://image.tmdb.org/t/p/w342/{match.group(1)}"


def load_poster_cache() -> dict:
    if POSTER_CACHE.exists():
        return json.loads(POSTER_CACHE.read_text(encoding="utf-8"))
    return {}


def save_poster_cache(cache: dict) -> None:
    POSTER_CACHE.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def download_poster(url: str, dest: Path) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = resp.read()
    if len(data) < 500:
        return False
    dest.write_bytes(data)
    return True


def prepare_posters(questions: list) -> None:
    """Download posters locally so host-guide.html works offline / from file://."""
    POSTERS_DIR.mkdir(exist_ok=True)
    cache = load_poster_cache()
    print("Fetching posters...")

    ok = 0
    for q in questions:
        qid = str(q["id"])
        dest = POSTERS_DIR / f"{qid}.jpg"

        if qid not in cache:
            movie_id = TMDB_IDS.get(q["id"])
            if movie_id:
                try:
                    url = fetch_tmdb_poster_url(movie_id)
                    if url:
                        cache[qid] = url
                        save_poster_cache(cache)
                    time.sleep(1.0)
                except Exception as exc:
                    print(f"  #{qid} TMDB lookup failed: {exc}")
            else:
                print(f"  #{qid} no TMDB id")

        poster_url = cache.get(qid)
        if poster_url:
            q["image"] = poster_url
            try:
                if not dest.exists() or dest.stat().st_size < 500:
                    download_poster(poster_url, dest)
                if dest.exists() and dest.stat().st_size > 500:
                    q["poster_local"] = f"posters/{qid}.jpg"
                    ok += 1
                    print(f"  #{qid} ok")
                    continue
            except Exception as exc:
                print(f"  #{qid} download failed: {exc}")

        if dest.exists() and dest.stat().st_size > 500:
            q["poster_local"] = f"posters/{qid}.jpg"
            ok += 1
            print(f"  #{qid} kept existing")
        else:
            q["poster_local"] = None
            print(f"  #{qid} MISSING poster")

    print(f"Posters ready: {ok}/{len(questions)}")


def build_pdf():
    """Kahoot AI PDF import format — clear multiple-choice blocks for extraction."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(18, 18, 18)

    # Title / instructions page
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, "Curt's Birthday Movie Kahoot", ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.ln(4)
    pdf.multi_cell(
        0,
        6,
        "50 multiple-choice quiz questions for Kahoot AI import.\n"
        "Topics: blockbuster movies (1990s-2026), classic horror, modern horror.\n\n"
        "Kahoot import steps:\n"
        "1. Create -> AI Question Generator -> Upload PDF\n"
        "2. Turn ON 'Extract questions from the PDF'\n"
        "3. Choose Quiz format -> Generate -> review -> Add to kahoot\n\n"
        "Each question below uses: Question, four answers (A-D), Correct Answer, Time limit.",
    )

    for q in data["questions"]:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 12)
        pdf.multi_cell(0, 7, pdf_text(f"Question {q['id']}: {q['question']}"))
        pdf.ln(2)

        pdf.set_font("Helvetica", "", 11)
        for i, answer in enumerate(q["answers"]):
            pdf.multi_cell(0, 6, pdf_text(f"{LABELS[i]}) {answer}"))

        correct_letter = LABELS[q["correct"] - 1]
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, f"Correct Answer: {correct_letter}", ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, f"Time limit: {q['time']} seconds", ln=True)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 6, pdf_text(f"Category: {q['category']}"), ln=True)
        pdf.set_text_color(0, 0, 0)

    out = ROOT / "curt-birthday-movies-kahoot.pdf"
    try:
        pdf.output(str(out))
    except PermissionError:
        alt = ROOT / "curt-birthday-movies-kahoot-new.pdf"
        pdf.output(str(alt))
        print(f"  (PDF locked — wrote {alt.name} instead)")
        return alt
    return out


prepare_posters(data["questions"])

headers = [
    "Question",
    "Answer 1",
    "Answer 2",
    "Answer 3",
    "Answer 4",
    "Time limit (seconds)",
    "Correct answer(s)",
    "Image link",
]

wb = Workbook()
ws = wb.active
ws.title = "Quiz"
ws.append(headers)

for q in data["questions"]:
    ws.append(
        [
            q["question"][:95],
            q["answers"][0][:60],
            q["answers"][1][:60],
            q["answers"][2][:60],
            q["answers"][3][:60],
            q["time"],
            q["correct"],
            q["image"],
        ]
    )

xlsx_path = ROOT / "curt-birthday-movies-kahoot.xlsx"
wb.save(xlsx_path)

tsv_lines = ["\t".join(headers)]
for q in data["questions"]:
    row = [
        q["question"][:95],
        q["answers"][0][:60],
        q["answers"][1][:60],
        q["answers"][2][:60],
        q["answers"][3][:60],
        str(q["time"]),
        str(q["correct"]),
        q["image"],
    ]
    tsv_lines.append("\t".join(row))
(ROOT / "curt-birthday-movies-kahoot.tsv").write_text("\n".join(tsv_lines), encoding="utf-8")

category_counts: dict[str, int] = {}
for q in data["questions"]:
    category_counts[q["category"]] = category_counts.get(q["category"], 0) + 1

cards = []
for q in data["questions"]:
    answers_html = ""
    for i, a in enumerate(q["answers"], start=1):
        cls = "correct" if i == q["correct"] else ""
        mark = " ✓" if i == q["correct"] else ""
        answers_html += f'<li class="{cls}">{html.escape(a)}{mark}</li>\n'

    poster_src = html.escape(q.get("poster_local") or q.get("image", ""))
    poster_fallback = html.escape(q.get("image", ""))
    img_tag = (
        f'<img src="{poster_src}" '
        f'data-remote="{poster_fallback}" '
        f'alt="Movie poster for question {q["id"]}" loading="lazy" '
        f'onerror="if(this.dataset.remote && this.src!==this.dataset.remote){{this.src=this.dataset.remote}}else{{this.classList.add(\'missing\')}}" />'
    )

    cards.append(
        f"""
    <article class="card">
      <div class="card-top">
        <span class="num">#{q['id']}</span>
        <span class="cat">{html.escape(q['category'])}</span>
        <span class="time">{q['time']}s</span>
      </div>
      <div class="card-body">
        {img_tag}
        <div class="card-text">
          <h2>{html.escape(q['question'])}</h2>
          <ol class="answers">
            {answers_html}
          </ol>
        </div>
      </div>
    </article>"""
    )

stats_html = "".join(
    f'<span class="stat">{count} {html.escape(cat)}</span>'
    for cat, count in category_counts.items()
)

guide = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Curt's Birthday Movie Kahoot — Host Guide</title>
  <style>
    :root {{
      --bg: #0d0a12;
      --card: #16121f;
      --border: rgba(255,255,255,.1);
      --text: #f3eef8;
      --muted: #9d93ab;
      --accent: #e11d48;
      --gold: #fbbf24;
      --green: #4ade80;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
    }}
    .hero {{
      padding: 40px 24px;
      text-align: center;
      background: linear-gradient(180deg, rgba(225,29,72,.15), transparent);
      border-bottom: 1px solid var(--border);
    }}
    .hero h1 {{
      font-size: clamp(2rem, 6vw, 3rem);
      margin: 0 0 8px;
      letter-spacing: .04em;
    }}
    .hero p {{ color: var(--muted); max-width: 640px; margin: 0 auto; }}
    .stats {{
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;
      margin-top: 20px;
    }}
    .stat {{
      padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px;
      font-size: .8rem; color: var(--gold);
    }}
    .grid {{
      max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px;
      display: grid; gap: 20px;
    }}
    .card {{
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card);
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }}
    .card-top {{
      display: flex; gap: 10px; align-items: center;
      padding: 10px 14px; border-bottom: 1px solid var(--border);
      font-size: .75rem; text-transform: uppercase; letter-spacing: .12em;
    }}
    .num {{ color: var(--accent); font-weight: 700; }}
    .cat {{ color: var(--muted); flex: 1; }}
    .time {{ color: var(--gold); }}
    .card-body {{
      display: grid; grid-template-columns: 120px 1fr; gap: 16px;
      padding: 14px;
    }}
    .card-body img {{
      width: 120px; height: 180px; object-fit: cover; border-radius: 4px;
      border: 1px solid var(--border);
      background: #1a1420;
    }}
    .card-body img.missing {{
      object-fit: contain;
      background: linear-gradient(145deg, #1a1420, #2a1520);
    }}
    .card-text h2 {{
      font-size: 1.05rem; margin: 0 0 12px; line-height: 1.35;
    }}
    .answers {{ margin: 0; padding-left: 1.2rem; }}
    .answers li {{ margin: 4px 0; color: var(--muted); }}
    .answers li.correct {{ color: var(--green); font-weight: 700; }}
    .print-note {{
      max-width: 1100px; margin: 0 auto; padding: 0 16px 24px;
      color: var(--muted); font-size: .9rem;
    }}
    @media (max-width: 640px) {{
      .card-body {{ grid-template-columns: 1fr; }}
      .card-body img {{ width: 100%; height: auto; max-height: 280px; }}
    }}
    @media print {{
      body {{ background: #fff; color: #000; }}
      .hero {{ background: none; }}
      .card {{ border-color: #ccc; background: #fff; }}
      .answers li {{ color: #333; }}
      .answers li.correct {{ color: #0a6b0a; }}
      .print-note {{ display: none; }}
    }}
  </style>
</head>
<body>
  <header class="hero">
    <h1>Curt's Birthday Movie Kahoot</h1>
    <p>50 blockbuster trivia questions (1990s–2026) · classic horror + modern hits · host answer key with posters</p>
    <div class="stats">
      <span class="stat">50 questions</span>
      {stats_html}
    </div>
  </header>
  <p class="print-note">Posters are bundled in the <code>posters/</code> folder — open this file from that directory so images load reliably.</p>
  <main class="grid">{"".join(cards)}</main>
</body>
</html>"""

(ROOT / "host-guide.html").write_text(guide, encoding="utf-8")

pdf_path = build_pdf()

print("Built:")
print(" ", pdf_path.name)
print(" ", xlsx_path.name)
print("  curt-birthday-movies-kahoot.tsv")
print("  host-guide.html")
