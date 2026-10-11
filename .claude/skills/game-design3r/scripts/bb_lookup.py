#!/usr/bin/env python3
"""Look up mechanism entries in Building Blocks of Tabletop Game Design.

Reads the PDF that lives in the dva repo (research/building-blocks-of-tabletop-of-mechanisms.pdf),
caches its text in the system temp dir (never in the repo), and prints entries.

Usage:
  python bb_lookup.py TRN-16                 # print one entry (Description / Discussion / Sample Games)
  python bb_lookup.py TRN-16 VIC-10 ACT-11   # several entries
  python bb_lookup.py --search "quarterback" # find which entries mention a phrase
  python bb_lookup.py --chapter VIC          # chapter intro (the text before the first VIC entry)
  python bb_lookup.py --list                 # every code and name
  python bb_lookup.py --pdf PATH ...         # use a different copy of the PDF
"""
import argparse
import hashlib
import os
import re
import subprocess
import sys
import tempfile

PDF_NAME = "building-blocks-of-tabletop-of-mechanisms.pdf"
CODE_RE = re.compile(r"^\s*([A-Z]{3})-(\d{2})\s*([A-Z].*?)\s*$")
CHAPTERS = {
    "STR": "Game Structure", "TRN": "Turn Order and Structure", "ACT": "Actions", "RES": "Resolution",
    "VIC": "Game End and Victory", "UNC": "Uncertainty", "ECO": "Economics", "AUC": "Auctions",
    "WPL": "Worker Placement", "MOV": "Movement", "ARC": "Area Control", "SET": "Set Collection",
    "CAR": "Card Mechanisms",
}


def find_pdf(explicit):
    if explicit:
        return explicit
    here = os.path.dirname(os.path.abspath(__file__))
    d = here
    for _ in range(8):
        cand = os.path.join(d, "research", PDF_NAME)
        if os.path.exists(cand):
            return cand
        d = os.path.dirname(d)
    sys.exit(f"Could not find research/{PDF_NAME} above {here}. Pass --pdf PATH.")


def extract_text(pdf):
    key = hashlib.sha1(f"{pdf}:{os.path.getmtime(pdf)}".encode()).hexdigest()[:12]
    cache = os.path.join(tempfile.gettempdir(), f"bb_text_{key}.txt")
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return f.read()
    text = None
    try:
        text = subprocess.run(["pdftotext", pdf, "-"], capture_output=True, check=True).stdout.decode("utf-8", "replace")
    except Exception:
        pass
    if not text:
        try:
            import fitz  # PyMuPDF
            with fitz.open(pdf) as doc:
                text = "\n".join(page.get_text() for page in doc)
        except ImportError:
            from pypdf import PdfReader
            text = "\n".join((p.extract_text() or "") for p in PdfReader(pdf).pages)
    with open(cache, "w", encoding="utf-8") as f:
        f.write(text)
    return text


def clean(lines):
    out = []
    for ln in lines:
        s = ln.rstrip()
        # Drop running headers / footers like "42  Building Blocks of Tabletop Game Design" or "Actions  73".
        if re.match(r"^\s*\d+\s+Building Blocks of Tabletop Game Design\s*$", s):
            continue
        if re.match(r"^\s*[A-Z][A-Za-z ,&/-]{2,40}\s+\d{1,3}\s*$", s) and "-" not in s[:8]:
            continue
        out.append(s)
    text = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def index_entries(text):
    """Return list of (code, name, start_line) for entry headings in the body (not the contents pages)."""
    lines = text.splitlines()
    heads, seen = [], set()
    for i, ln in enumerate(lines):
        m = CODE_RE.match(ln)
        if not m:
            continue
        code = f"{m.group(1)}-{m.group(2)}"
        name = re.sub(r"\s+\d+$", "", m.group(3)).strip()
        # A real entry heading is followed shortly by "Description".
        window = "\n".join(lines[i + 1:i + 25])
        if re.search(r"^\s*Description\b", window, re.M) and code not in seen:
            seen.add(code)
            heads.append((code, name, i))
    return lines, heads


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("codes", nargs="*")
    ap.add_argument("--search")
    ap.add_argument("--chapter")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--pdf")
    ap.add_argument("--max-chars", type=int, default=12000)
    a = ap.parse_args()

    text = extract_text(find_pdf(a.pdf))
    lines, heads = index_entries(text)

    if a.list:
        for code, name, _ in heads:
            print(f"{code}  {name}")
        return

    if a.search:
        pat = re.compile(re.escape(a.search), re.I)
        for n, (code, name, start) in enumerate(heads):
            end = heads[n + 1][2] if n + 1 < len(heads) else len(lines)
            hits = [l.strip() for l in lines[start:end] if pat.search(l)]
            if hits:
                print(f"{code}  {name}  ({len(hits)} hit{'s' if len(hits) > 1 else ''})")
                for h in hits[:3]:
                    print(f"    ... {h[:140]}")
        return

    if a.chapter:
        ch = a.chapter.upper()[:3]
        first = next((s for c, _, s in heads if c.startswith(ch)), None)
        if first is None:
            sys.exit(f"No chapter {ch}. Chapters: {', '.join(CHAPTERS)}")
        # The intro starts at the chapter title line, searching back from the first entry.
        title = CHAPTERS[ch]
        start = next((i for i in range(first - 1, max(first - 400, 0), -1) if lines[i].strip() == title), first - 80)
        print(clean(lines[start:first])[: a.max_chars])
        return

    if not a.codes:
        ap.print_help()
        return
    by_code = {c: (n, name, s) for n, (c, name, s) in enumerate(heads)}
    for raw in a.codes:
        code = raw.upper()
        if code not in by_code:
            print(f"== {code}: not found (try --list or --search)\n")
            continue
        n, name, start = by_code[code]
        end = heads[n + 1][2] if n + 1 < len(heads) else len(lines)
        body = clean(lines[start:end])
        if len(body) > a.max_chars:
            body = body[: a.max_chars] + "\n[... truncated; raise --max-chars]"
        print(f"== {code} {name}\n{body}\n")


if __name__ == "__main__":
    main()
