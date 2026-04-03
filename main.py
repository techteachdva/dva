"""
Pedagogy Profile — teacher self-assessment with radar chart (1 = center, 100 = edge).
"""
from __future__ import annotations

import sys
import tkinter as tk
import tkinter.font as tkfont
from tkinter import messagebox, scrolledtext, ttk

from profile_analysis import build_analysis_report
from questions_data import INSTRUMENT_FRAMEWORK, N_QUESTIONS, QUESTIONS, SHORT_FIELD_LABELS, SPECTRUM_POLES, Field
from scoring import compute_field_scores, compute_raw_field_totals, rank_fields

LIKERT_LABELS: tuple[str, ...] = (
    "Strongly Disagree",
    "Disagree",
    "Neutral",
    "Agree",
    "Strongly Agree",
)

# Order for radar plot (angles spaced evenly)
FIELD_ORDER: tuple[Field, ...] = (
    Field.TEACHER_TO_STUDENT,
    Field.TRADITIONAL_TO_PROCESS,
    Field.BEHAVIORISM_TO_CONSTRUCTIVISM,
    Field.COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM,
    Field.DIRECT_TO_EXPERIENTIAL,
    Field.CONSTRUCTIVISM_INDEX,
)

class PedagogyProfileApp:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("Pedagogy Profile")
        # Large default geometry; _maximize_window fills the display when possible.
        self.root.minsize(1024, 720)

        self.responses: dict[int, int] = {}
        self.current_index = 0
        self._keybind_ids: list[tuple[str, str]] = []

        self._setup_styles()
        self._init_layout_constants()
        self._maximize_window()
        self._build_welcome()
        self.root.protocol("WM_DELETE_WINDOW", self.root.destroy)

    def _unbind_keys(self) -> None:
        for seq, fid in self._keybind_ids:
            try:
                self.root.unbind(seq, fid)
            except Exception:
                pass
        self._keybind_ids.clear()

    def _init_layout_constants(self) -> None:
        """Readable line length from display size (used for wraplength)."""
        self.root.update_idletasks()
        sw = self.root.winfo_screenwidth()
        self._wrap_main = max(720, min(1400, sw - 120))
        self._wrap_results_left = max(520, min(900, sw // 2 - 100))

    def _maximize_window(self) -> None:
        """Use nearly the full screen (maximized on Windows; fallback fills work area)."""
        self.root.update_idletasks()
        try:
            self.root.state("zoomed")
        except tk.TclError:
            try:
                self.root.attributes("-zoomed", True)
            except tk.TclError:
                sw = self.root.winfo_screenwidth()
                sh = self.root.winfo_screenheight()
                self.root.geometry(f"{sw}x{sh}+0+0")

    def _setup_styles(self) -> None:
        # Use tkinter.font.Font so multi-word families like "Segoe UI" parse correctly
        # (raw strings / tuples in ttk can trigger TclError: expected integer but got "UI").
        self._font_title = tkfont.Font(self.root, family="Segoe UI", size=28, weight="bold")
        self._font_header = tkfont.Font(self.root, family="Segoe UI", size=22, weight="bold")
        self._font_sub = tkfont.Font(self.root, family="Segoe UI", size=16)
        self._font_body = tkfont.Font(self.root, family="Segoe UI", size=17)
        self._font_body_bold = tkfont.Font(self.root, family="Segoe UI", size=17, weight="bold")
        self._font_option = tkfont.Font(self.root, family="Segoe UI", size=16)

        style = ttk.Style()
        if "vista" in style.theme_names():
            style.theme_use("vista")
        style.configure("TButton", font=self._font_body, padding=(18, 12))
        style.configure("Title.TLabel", font=self._font_title)
        style.configure("Header.TLabel", font=self._font_header)
        style.configure("Sub.TLabel", font=self._font_sub, foreground="#333")
        style.configure("Body.TLabel", font=self._font_body, foreground="#1a1a1a")

    def _clear(self) -> None:
        self._unbind_keys()
        for w in self.root.winfo_children():
            w.destroy()

    def _build_welcome(self) -> None:
        self._clear()
        self.current_index = 0
        self.responses.clear()
        self._init_layout_constants()

        outer = ttk.Frame(self.root, padding=40)
        outer.pack(fill=tk.BOTH, expand=True)

        ttk.Label(outer, text="Pedagogy Profile", style="Title.TLabel").pack(anchor=tk.W)
        intro = (
            f"{INSTRUMENT_FRAMEWORK}\n\n"
            f"You will complete {N_QUESTIONS} statements using a **1–5** Likert scale.\n\n"
            "Your report shows **mean Likert** per spectrum (1–5, reverse-scored where needed) and a **1–100** radar "
            "derived from those means."
        )
        ttk.Label(outer, text=intro, wraplength=self._wrap_main, justify=tk.LEFT, style="Body.TLabel").pack(
            anchor=tk.W, pady=(20, 32)
        )

        ttk.Button(outer, text="Begin questionnaire", command=self._build_question).pack(anchor=tk.W)

    def _build_question(self) -> None:
        if self.current_index >= len(QUESTIONS):
            self._build_results()
            return

        self._clear()
        q = QUESTIONS[self.current_index]
        self._init_layout_constants()

        outer = ttk.Frame(self.root, padding=40)
        outer.pack(fill=tk.BOTH, expand=True)

        progress = f"Question {self.current_index + 1} of {len(QUESTIONS)}"
        ttk.Label(outer, text=progress, style="Sub.TLabel").pack(anchor=tk.E)

        ttk.Label(outer, text=q.spectrum.value, style="Sub.TLabel").pack(anchor=tk.W, pady=(0, 10))

        ttk.Label(outer, text=q.stem, wraplength=self._wrap_main, justify=tk.LEFT, style="Header.TLabel").pack(
            anchor=tk.W, pady=(0, 20)
        )

        none = 0
        prior = self.responses.get(q.id, none)
        var = tk.IntVar(value=prior if prior is not None else none)

        scale_frame = ttk.Frame(outer)
        scale_frame.pack(anchor=tk.W, fill=tk.X)

        for i, label in enumerate(LIKERT_LABELS, start=1):
            rb = tk.Radiobutton(
                scale_frame,
                text=f"{i} — {label}",
                variable=var,
                value=i,
                anchor=tk.W,
                justify=tk.LEFT,
                font=self._font_option,
                indicatoron=1,
                padx=4,
                pady=6,
            )
            rb.pack(anchor=tk.W, fill=tk.X, pady=6)

        btn_row = ttk.Frame(outer)
        btn_row.pack(fill=tk.X, pady=(32, 0))

        def next_q() -> None:
            if var.get() < 1:
                messagebox.showinfo("Response needed", "Please select one option before continuing.")
                return
            self.responses[q.id] = var.get()
            self.current_index += 1
            self._build_question()

        def back_q() -> None:
            if self.current_index == 0:
                self._build_welcome()
                return
            self.current_index -= 1
            self._build_question()

        ttk.Button(btn_row, text="Back", command=back_q).pack(side=tk.LEFT)
        ttk.Button(btn_row, text="Next", command=next_q).pack(side=tk.RIGHT)

        # Keyboard input: 1–5 selects choice, Enter advances.
        def on_keypress(e: tk.Event) -> None:  # type: ignore[name-defined]
            ks = getattr(e, "keysym", "")
            ch = getattr(e, "char", "")
            if ks in ("1", "2", "3", "4", "5") or ch in ("1", "2", "3", "4", "5"):
                try:
                    var.set(int(ks if ks in ("1", "2", "3", "4", "5") else ch))
                except Exception:
                    return
            elif ks in ("KP_1", "KP_2", "KP_3", "KP_4", "KP_5"):
                var.set(int(ks[-1]))

        def on_enter(_: tk.Event) -> None:  # type: ignore[name-defined]
            next_q()

        self._keybind_ids.append(("<KeyPress>", self.root.bind("<KeyPress>", on_keypress)))
        self._keybind_ids.append(("<Return>", self.root.bind("<Return>", on_enter)))
        # Make sure keypresses go to the window.
        self.root.focus_force()

    def _build_results(self) -> None:
        # Heavy imports only when drawing results (faster app startup; avoids long import under Ctrl+C).
        import numpy as np
        from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
        from matplotlib.figure import Figure

        self._clear()
        self._init_layout_constants()
        scores = compute_field_scores(self.responses)  # 1–100
        raw_totals = compute_raw_field_totals(self.responses)  # 1–5 means
        ranked_high, ranked_low = rank_fields(scores)

        outer = ttk.Frame(self.root, padding=28)
        outer.pack(fill=tk.BOTH, expand=True)

        paned = ttk.PanedWindow(outer, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)

        left = ttk.Frame(paned, padding=(0, 0, 20, 0))
        right = ttk.Frame(paned, padding=(20, 0, 0, 0))
        paned.add(left, weight=3)
        paned.add(right, weight=2)

        ttk.Label(left, text="Your Pedagogy Profile", style="Title.TLabel").pack(anchor=tk.W)

        strengths = ", ".join(SHORT_FIELD_LABELS[f] for f, _ in ranked_high[:2])
        growth = ", ".join(SHORT_FIELD_LABELS[f] for f, _ in ranked_low[:2])

        ttk.Label(
            left,
            text=(
                f"Quick glance — relative strengths: {strengths}. Growth edges: {growth}. "
                "Full interpretation below. Radar: 1 = center, 100 = outer edge."
            ),
            wraplength=self._wrap_results_left,
            justify=tk.LEFT,
            style="Body.TLabel",
        ).pack(anchor=tk.W, pady=(12, 12))

        report = build_analysis_report(scores, raw_totals)
        detail = scrolledtext.ScrolledText(
            left,
            height=28,
            width=52,
            wrap=tk.WORD,
            font=self._font_body,
            padx=12,
            pady=12,
        )
        detail.pack(fill=tk.BOTH, expand=True)
        detail.insert(tk.END, report)

        # Improve readability: larger bold section headers and comfortable spacing.
        font_header = tkfont.Font(self.root, family="Segoe UI", size=20, weight="bold")
        font_subheader = tkfont.Font(self.root, family="Segoe UI", size=16, weight="bold")
        font_body = tkfont.Font(self.root, family="Segoe UI", size=15)
        detail.configure(font=font_body)
        detail.tag_configure("h1", font=font_header, spacing1=10, spacing3=6, foreground="#111")
        detail.tag_configure("h2", font=font_subheader, spacing1=10, spacing3=4, foreground="#222")
        detail.tag_configure("rule", foreground="#888")
        detail.tag_configure("tight", spacing1=2, spacing3=2)

        # Tag section headers (all-caps lines) and divider rules.
        for i, line in enumerate(report.splitlines(), start=1):
            if not line.strip():
                continue
            if set(line.strip()) == {"—"}:
                detail.tag_add("rule", f"{i}.0", f"{i}.end")
                continue
            # Main section headers are uppercase words (e.g., FRAMEWORK, SNAPSHOT)
            if line.strip().isupper() and len(line.strip()) <= 28:
                detail.tag_add("h1", f"{i}.0", f"{i}.end")
                continue
            # Emphasize "Next step" line as a subheader-ish callout
            if line.startswith("Next step:"):
                detail.tag_add("h2", f"{i}.0", f"{i}.end")

        detail.configure(state=tk.DISABLED)

        # Radar: 1–100 as radial distance (1 ≈ inner, 100 = outer ring)
        dpi = 110
        fig = Figure(figsize=(8.0, 8.0), dpi=dpi)
        fig.patch.set_facecolor("#fafafa")
        ax = fig.add_subplot(111, polar=True)

        n = len(FIELD_ORDER)
        angles = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()
        values = [scores[f] for f in FIELD_ORDER]
        labels = [SHORT_FIELD_LABELS[f] for f in FIELD_ORDER]

        # close polygon
        angles_closed = angles + [angles[0]]
        values_closed = values + [values[0]]

        ax.set_theta_offset(np.pi / 2)
        ax.set_theta_direction(-1)
        ax.set_ylim(0, 100)
        ax.set_yticks([20, 40, 60, 80, 100])
        ax.set_yticklabels(["20", "40", "60", "80", "100"], fontsize=13, color="#555")
        ax.set_xticks(angles)
        # Avoid long axis labels overlapping; we draw pole labels ourselves.
        ax.set_xticklabels([""] * n)

        def _wrap_label(s: str) -> str:
            # Keep labels readable without long horizontal runs.
            if len(s) <= 18:
                return s
            parts = s.replace("-", " - ").split()
            lines: list[str] = []
            cur: list[str] = []
            for p in parts:
                nxt = ((" ".join(cur + [p])).replace(" - ", "-")).strip()
                if cur and len(nxt) > 18:
                    lines.append(((" ".join(cur)).replace(" - ", "-")).strip())
                    cur = [p]
                else:
                    cur.append(p)
            if cur:
                lines.append(((" ".join(cur)).replace(" - ", "-")).strip())
            return "\n".join(lines[:2])

        # Pole labels:
        # - Low pole labels go INSIDE each sector (mid-wedge) so they don't collide at the center.
        # - High pole labels sit near the rim, aligned with the axis.
        sector = (2 * np.pi) / n
        for idx, (ang, f, short) in enumerate(zip(angles, FIELD_ORDER, labels)):
            low, high = SPECTRUM_POLES.get(f, (short, short))

            # Low pole label (inside the wedge, closer to center but not at r≈0)
            # Stagger radii slightly to avoid collisions between adjacent wedges.
            inner_r = 26 + (4 if idx % 2 == 0 else -2)
            ax.text(
                ang + sector / 2,
                inner_r,
                _wrap_label(low),
                fontsize=10.0,
                color="#444",
                ha="center",
                va="center",
                linespacing=1.05,
                bbox=dict(boxstyle="round,pad=0.18", facecolor="#ffffff", edgecolor="none", alpha=0.65),
            )

            # High pole label (near rim, on the axis)
            ax.text(
                ang,
                104,
                _wrap_label(high),
                fontsize=11.0,
                color="#111",
                ha="center",
                va="center",
                linespacing=1.05,
            )

        ax.plot(angles_closed, values_closed, color="#2563eb", linewidth=2.8, alpha=0.9)
        ax.fill(angles_closed, values_closed, color="#2563eb", alpha=0.14)
        ax.grid(True, linestyle="--", alpha=0.5)
        ax.tick_params(axis="both", labelsize=13)

        fig.tight_layout()
        canvas = FigureCanvasTkAgg(fig, master=right)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        btn_row = ttk.Frame(outer)
        btn_row.pack(fill=tk.X, pady=(20, 0))
        ttk.Button(btn_row, text="Start over", command=self._build_welcome).pack(side=tk.LEFT)
        ttk.Button(btn_row, text="Quit", command=self.root.destroy).pack(side=tk.RIGHT)

    def run(self) -> None:
        self.root.mainloop()


def main() -> None:
    app = PedagogyProfileApp()
    app.run()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        # Ctrl+C in the terminal stops mainloop; not an app fault.
        sys.exit(0)
