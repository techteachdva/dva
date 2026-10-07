"""Build a readable ITEM Diagnostic question-bank workbook from the JSON export."""
import json
from collections import defaultdict
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "scripts" / ".item-question-bank.json"
OUT = ROOT / "src" / "site" / "notes" / "Media Arts and Tech" / "ITEM Diagnostic Question Bank.xlsx"

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

INK = "14221E"
HEADER_BG = "0F3D32"
HEADER_FONT = "F8FAF6"
ZEBRA = "F4F7F4"
WHITE = "FFFFFF"
GREEN = "D7F5E3"
GREEN_INK = "14532D"
AMBER = "FEF3C7"
AMBER_INK = "78350F"
BAND = "E7F2EC"
MUTED = "5C6B64"
LINE = "D5DDD8"
TITLE = "0B3B2E"

TERMINAL_FILL = {
    "Design Lab": "E7F6EF",
    "Network Closet": "E8F1FB",
    "Data Vault": "FFF6E4",
    "Code Bay": "F3EEF8",
}

thin = Border(
    left=Side(style="thin", color=LINE),
    right=Side(style="thin", color=LINE),
    top=Side(style="thin", color=LINE),
    bottom=Side(style="thin", color=LINE),
)
wrap = Alignment(wrap_text=True, vertical="top")
wrap_center = Alignment(wrap_text=True, vertical="center", horizontal="center")
header_align = Alignment(wrap_text=True, vertical="center", horizontal="left")


def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)


def font(size=11, bold=False, color=INK, name="Calibri"):
    return Font(name=name, size=size, bold=bold, color=color)


def correct_letters(q):
    return ", ".join(LETTERS[i] for i in q["correct"] if 0 <= i < len(q["options"]))


def correct_text(q):
    parts = []
    for i in q["correct"]:
        if 0 <= i < len(q["options"]):
            parts.append(f"{LETTERS[i]}. {q['options'][i]}")
    return "\n".join(parts)


def style_header(ws, row, cols):
    for col in range(1, cols + 1):
        cell = ws.cell(row, col)
        cell.fill = fill(HEADER_BG)
        cell.font = font(11, True, HEADER_FONT)
        cell.alignment = header_align
        cell.border = thin
    ws.row_dimensions[row].height = 28
    ws.auto_filter.ref = f"A{row}:{get_column_letter(cols)}{ws.max_row}"
    ws.freeze_panes = f"A{row + 1}"
    ws.auto_filter.ref = f"A{row}:{get_column_letter(cols)}{row}"
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_setup.paperSize = ws.PAPERSIZE_TABLOID
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.horizontalCentered = True
    ws.oddHeader.left.text = "ITEM Diagnostic question bank"
    ws.oddFooter.right.text = "Page &P of &N"
    ws.print_title_rows = f"{row}:{row}"
    ws.page_margins.left = 0.4
    ws.page_margins.right = 0.4
    ws.page_margins.top = 0.6
    ws.page_margins.bottom = 0.5
    ws.sheet_view.zoomScale = 110


def set_widths(ws, widths):
    for i, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = width


def paint_question_row(ws, row, q, option_cols, zebra=False):
    base = TERMINAL_FILL.get(q["terminal"], ZEBRA if zebra else WHITE)
    for col in range(1, ws.max_column + 1):
        cell = ws.cell(row, col)
        cell.fill = fill(base)
        cell.font = font(11)
        cell.alignment = wrap
        cell.border = thin
    # Highlight the correct option cells.
    for index in q["correct"]:
        col = option_cols[0] + index
        if col < option_cols[0] + len(q["options"]):
            cell = ws.cell(row, col)
            cell.fill = fill(GREEN)
            cell.font = font(11, True, GREEN_INK)
    type_col = 8
    if q["type"].startswith("Select"):
        cell = ws.cell(row, type_col)
        cell.fill = fill(AMBER)
        cell.font = font(11, True, AMBER_INK)
    letters_col = option_cols[0] + option_cols[1]
    ws.cell(row, letters_col).font = font(12, True, GREEN_INK)
    ws.cell(row, letters_col).alignment = wrap_center
    # Taller rows so wrapped questions stay readable.
    longest = max([len(q["question"]), len(q["why"]), *[len(o) for o in q["options"]]])
    lines = max(2, min(6, (longest // 42) + 1))
    ws.row_dimensions[row].height = 18 * lines + 8


def write_questions(ws, questions, title):
    headers = [
        "ID",
        "Terminal",
        "Topic",
        "Standard code",
        "Standard",
        "Strand",
        "Level",
        "Answer type",
        "Question",
        "A",
        "B",
        "C",
        "D",
        "Correct",
        "Correct answer",
        "Why this is right",
        "Also aligns to",
        "In diagnostic pool",
    ]
    ws.sheet_properties.tabColor = HEADER_BG
    ws["A1"] = title
    ws["A1"].font = font(16, True, TITLE)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    ws.row_dimensions[1].height = 26
    ws["A2"] = (
        "Green cells are the correct options. Amber means select every correct option. "
        "Filter the header row to slice by standard, terminal, or level."
    )
    ws["A2"].font = font(11, False, MUTED)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(headers))
    ws.row_dimensions[2].height = 20

    header_row = 4
    for col, header in enumerate(headers, start=1):
        ws.cell(header_row, col, header)
    option_start = 10  # column J
    for i, q in enumerate(questions):
        row = header_row + 1 + i
        values = [
            q["id"],
            q["terminal"],
            q["topic"],
            q["code"],
            q["standard"],
            q["strand"],
            q["level"],
            q["type"],
            q["question"],
            q["options"][0] if len(q["options"]) > 0 else "",
            q["options"][1] if len(q["options"]) > 1 else "",
            q["options"][2] if len(q["options"]) > 2 else "",
            q["options"][3] if len(q["options"]) > 3 else "",
            correct_letters(q),
            correct_text(q),
            q["why"],
            q["secondary"],
            "Yes" if q["inDiagnostic"] else "No",
        ]
        for col, value in enumerate(values, start=1):
            ws.cell(row, col, value)
        paint_question_row(ws, row, q, (option_start, 4), zebra=i % 2 == 1)

    last = header_row + len(questions)
    style_header(ws, header_row, len(headers))
    ws.auto_filter.ref = f"A{header_row}:{get_column_letter(len(headers))}{last}"
    ws.freeze_panes = "A5"
    ws.auto_filter.ref = f"A{header_row}:{get_column_letter(len(headers))}{last}"
    set_widths(
        ws,
        [12, 18, 32, 14, 28, 34, 18, 22, 54, 40, 40, 40, 40, 12, 46, 54, 36, 18],
    )
    ws.auto_filter.ref = f"A{header_row}:{get_column_letter(len(headers))}{last}"
    for col in (1, 4, 7, 8, 14, 18):
        for row in range(header_row + 1, last + 1):
            ws.cell(row, col).alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
    ws.sheet_view.zoomScale = 110
    ws.print_title_rows = "4:4"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_setup.paperSize = ws.PAPERSIZE_TABLOID
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.oddHeader.left.text = title
    ws.oddFooter.right.text = "Page &P of &N"
    ws.page_margins.left = 0.4
    ws.page_margins.right = 0.4
    ws.page_margins.top = 0.55
    ws.page_margins.bottom = 0.45
    ws.sheet_view.showGridLines = False


def write_summary(ws, questions):
    ws.sheet_properties.tabColor = "B45309"
    ws["A1"] = "Questions per ITEM standard"
    ws["A1"].font = font(16, True, TITLE)
    ws.merge_cells("A1:G1")
    ws.row_dimensions[1].height = 26
    headers = ["Standard code", "Standard", "Strand", "Benchmark", "Questions", "Terminals", "IDs"]
    for col, header in enumerate(headers, start=1):
        cell = ws.cell(3, col, header)
        cell.fill = fill(HEADER_BG)
        cell.font = font(11, True, HEADER_FONT)
        cell.alignment = header_align
        cell.border = thin
    grouped = defaultdict(list)
    for q in questions:
        grouped[q["code"] or "(untagged)"].append(q)
    codes = sorted(grouped)
    for i, code in enumerate(codes):
        rows = grouped[code]
        sample = rows[0]
        terminals = ", ".join(sorted({q["terminal"] for q in rows}))
        ids = ", ".join(q["id"] for q in rows)
        values = [
            code,
            sample["standard"],
            sample["strand"],
            sample["benchmark"],
            len(rows),
            terminals,
            ids,
        ]
        row = 4 + i
        for col, value in enumerate(values, start=1):
            cell = ws.cell(row, col, value)
            cell.font = font(11, col == 5, INK)
            cell.alignment = wrap if col != 5 else wrap_center
            cell.border = thin
            cell.fill = fill(ZEBRA if i % 2 else WHITE)
        longest = max(len(sample["benchmark"] or ""), 40)
        ws.row_dimensions[row].height = min(72, 18 * max(2, longest // 70 + 1))
    last = 3 + len(codes)
    ws.auto_filter.ref = f"A3:G{last}"
    ws.freeze_panes = "A4"
    set_widths(ws, [14, 32, 36, 72, 14, 36, 42])
    ws.row_dimensions[3].height = 24
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 120
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = "3:3"

    # Terminal counts under the table
    start = last + 3
    ws.cell(start, 1, "Questions per terminal").font = font(14, True, TITLE)
    term_headers = ["Terminal", "Topic", "Questions", "Select-all questions"]
    for col, header in enumerate(term_headers, start=1):
        cell = ws.cell(start + 1, col, header)
        cell.fill = fill(HEADER_BG)
        cell.font = font(11, True, HEADER_FONT)
        cell.alignment = header_align
        cell.border = thin
    by_terminal = defaultdict(list)
    for q in questions:
        by_terminal[q["terminal"]].append(q)
    order = ["Design Lab", "Network Closet", "Data Vault", "Code Bay"]
    for i, name in enumerate(order):
        rows = by_terminal.get(name, [])
        topic = rows[0]["topic"] if rows else ""
        multi = sum(1 for q in rows if q["type"].startswith("Select"))
        values = [name, topic, len(rows), multi]
        row = start + 2 + i
        for col, value in enumerate(values, start=1):
            cell = ws.cell(row, col, value)
            cell.font = font(11, col == 1)
            cell.fill = fill(TERMINAL_FILL.get(name, WHITE))
            cell.border = thin
            cell.alignment = wrap
        ws.row_dimensions[row].height = 22


def write_start(ws, questions):
    ws.sheet_properties.tabColor = "047857"
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 130
    set_widths(ws, [28, 88])
    lines = [
        ("ITEM Diagnostic question bank", True, 22, TITLE),
        ("Where the questions actually live", True, 14, TITLE),
        (
            "There is no separate question-bank file for the diagnostic. "
            "The authored questions are in src/site/tech-escape/js/data/questions.js. "
            "The diagnostic page loads that same bank through src/site/scripts/item-diagnostic-loader.js, "
            "which copies each question onto window.ITEMDiagnosticBank.",
            False, 12, INK,
        ),
        ("How a student quiz is drawn", True, 14, TITLE),
        (
            "A live diagnostic does not show every question. src/site/scripts/item-diagnostic-questions.js "
            "draws 20 questions from the ITEM-tagged items, aiming for one question per ITEM standard, then fills any "
            "gaps from that pool. Eight Network Closet questions are tagged only to CSTA 2-NI-04, so they stay in "
            "Tech Escape and are marked “No” in the diagnostic-pool column. Answer order is shuffled when the quiz "
            "runs, so the A–D order in this sheet is the authored order, not the order a student sees.",
            False, 12, INK,
        ),
        ("How to read this workbook", True, 14, TITLE),
        (
            "By standard — every question, grouped by ITEM code. This is the lesson-planning view.\n"
            "By terminal — the same questions in Tech Escape order: Design Lab, Network Closet, Data Vault, Code Bay.\n"
            "Summary — how many questions sit on each standard.\n\n"
            "Green option cells are correct. Amber “Select all that apply” means more than one option is correct. "
            "Open this file in Google Sheets with File → Import, or upload it to Drive and choose Open with Google Sheets.",
            False, 12, INK,
        ),
        ("Counts", True, 14, TITLE),
    ]
    row = 1
    for text, bold, size, color in lines:
        cell = ws.cell(row, 1, text)
        cell.font = font(size, bold, color)
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
        if size >= 20:
            ws.row_dimensions[row].height = 32
        elif bold:
            ws.row_dimensions[row].height = 24
        else:
            ws.row_dimensions[row].height = 78 if "By standard" in text or "live diagnostic" in text or "no separate" in text else 48
        row += 1

    counts = [
        ("Questions in the bank", len(questions)),
        ("Used by the diagnostic draw", sum(1 for q in questions if q["inDiagnostic"])),
        ("Select-all questions", sum(1 for q in questions if q["type"].startswith("Select"))),
        ("ITEM standards covered", len({q["code"] for q in questions if q["code"]})),
    ]
    header_row = row
    for col, header in enumerate(["", ""], start=1):
        pass
    ws.cell(row, 1, "What").font = font(11, True, HEADER_FONT)
    ws.cell(row, 2, "Count").font = font(11, True, HEADER_FONT)
    for col in (1, 2):
        ws.cell(row, col).fill = fill(HEADER_BG)
        ws.cell(row, col).alignment = header_align
        ws.cell(row, col).border = thin
    row += 1
    for label, count in counts:
        ws.cell(row, 1, label).font = font(12)
        ws.cell(row, 2, count).font = font(12, True)
        for col in (1, 2):
            ws.cell(row, col).fill = fill(BAND)
            ws.cell(row, col).border = thin
            ws.cell(row, col).alignment = Alignment(vertical="center")
        ws.row_dimensions[row].height = 22
        row += 1
    ws.oddFooter.left.text = "Source: src/site/tech-escape/js/data/questions.js"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.orientation = "landscape"
    ws.print_area = f"A1:B{row - 1}"
    # silence unused
    _ = header_row


def main():
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    questions = payload["questions"]
    by_standard = sorted(questions, key=lambda q: (q["code"], q["id"]))
    by_terminal = sorted(questions, key=lambda q: q["order"])

    wb = Workbook()
    start = wb.active
    start.title = "Start here"
    write_start(start, questions)

    by_std = wb.create_sheet("By standard")
    write_questions(by_std, by_standard, "ITEM Diagnostic questions, grouped by standard")

    by_term = wb.create_sheet("By terminal")
    write_questions(by_term, by_terminal, "ITEM Diagnostic questions, in Tech Escape terminal order")

    summary = wb.create_sheet("Summary")
    write_summary(summary, questions)

    # Named range-friendly print
    wb.properties.title = "ITEM Diagnostic Question Bank"
    wb.properties.creator = "DVA"
    wb.properties.subject = "ITEM 2025 diagnostic questions from the Tech Escape question bank"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    print(f"Wrote {len(questions)} questions to {OUT}")


if __name__ == "__main__":
    main()
