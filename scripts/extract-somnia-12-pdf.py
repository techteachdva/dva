#!/usr/bin/env python3
"""Extract text from Somnia 12.pdf into scripts/somnia-12-pdf-extract.txt."""
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
PDF = Path(r"C:\Users\phili\Downloads\Interdisciplinary Review\Somnia 12.pdf")
OUT = ROOT / "scripts" / "somnia-12-pdf-extract.txt"

def main():
    reader = PdfReader(str(PDF))
    lines = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        lines.append(f"=== PAGE {i} ===")
        lines.append(text.strip())
        lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Extracted {len(reader.pages)} pages -> {OUT}")

if __name__ == "__main__":
    main()
