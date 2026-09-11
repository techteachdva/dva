#!/usr/bin/env python3
"""Merge SOMNIA BACKUP (user layout/mechanics) with current repo (Sanket assets/a11y)."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKUP = Path(r"C:\Users\phili\Desktop\SOMNIA BACKUP\somnia")
CURRENT = REPO / "src/site/somnia"

# Sanket-only files to preserve from current build.
SANKET_PRESERVE = {
    "audio/dreams-become-real.mp3",
    "audio/ethereal-relaxation.mp3",
    "audio/magic-escape-room.mp3",
    "audio/that-zen-moment.mp3",
    "js/dialog-a11y.js",
    "js/phase-skip.js",
}

VERSION_LABEL = "Somnia v 13.0"
VERSION_RULES = "/** SOMNIA 13.0 rules helpers */"
VERSION_GUIDE_FOOTER = f"      <p class=\"overview-footer\">{VERSION_LABEL} — cooperative rules reference.</p>"


def copy_backup_tree() -> list[str]:
    copied: list[str] = []
    for src in BACKUP.rglob("*"):
        if not src.is_file():
            continue
        rel = src.relative_to(BACKUP).as_posix()
        if rel in SANKET_PRESERVE:
            continue
        dest = CURRENT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        copied.append(rel)
    return copied


def webp_asset_references() -> list[str]:
    updated: list[str] = []
    targets = list((CURRENT / "data").glob("*.json"))
    targets += [
        CURRENT / "js/data.js",
        CURRENT / "js/ui.js",
        CURRENT / "js/event-landscapes.js",
    ]
    for path in targets:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        new_text = text.replace(".png", ".webp")
        if new_text != text:
            path.write_text(new_text, encoding="utf-8", newline="\n")
            updated.append(path.relative_to(CURRENT).as_posix())
    return updated


def remove_png_duplicates() -> int:
    images = CURRENT / "images"
    removed = 0
    if not images.exists():
        return removed
    for png in images.rglob("*.png"):
        if png.with_suffix(".webp").exists():
            png.unlink()
            removed += 1
    return removed


def patch_dialog_a11y() -> None:
    for rel in ("js/play.js", "js/setup.js"):
        path = CURRENT / rel
        text = path.read_text(encoding="utf-8")
        if "dialog-a11y.js" not in text:
            text = text.replace(
                'import { initDeviceMode } from "./device-mode.js";',
                'import { initDeviceMode } from "./device-mode.js";\n'
                'import { initDialogAccessibility } from "./dialog-a11y.js";',
            )
        if "initDialogAccessibility();" not in text:
            text = re.sub(
                r"(initDeviceMode\(\);)",
                r"\1\n  initDialogAccessibility();",
                text,
                count=1,
            )
        path.write_text(text, encoding="utf-8", newline="\n")


def patch_version_labels() -> None:
    for rel in ("index.html", "play.html"):
        path = CURRENT / rel
        text = path.read_text(encoding="utf-8")
        text = re.sub(
            r'<span class="version-label">[^<]*</span>',
            f'<span class="version-label">{VERSION_LABEL}</span>',
            text,
        )
        path.write_text(text, encoding="utf-8", newline="\n")

    rules = CURRENT / "js/rules.js"
    lines = rules.read_text(encoding="utf-8").splitlines()
    if lines:
        lines[0] = VERSION_RULES
    rules.write_text("\n".join(lines) + "\n", encoding="utf-8")

    guide = CURRENT / "js/guide.js"
    guide_text = guide.read_text(encoding="utf-8")
    guide_text = re.sub(
        r'<p class="overview-footer">[^<]*</p>',
        VERSION_GUIDE_FOOTER,
        guide_text,
    )
    guide.write_text(guide_text, encoding="utf-8", newline="\n")


def main() -> None:
    copied = copy_backup_tree()
    webp_files = webp_asset_references()
    removed_png = remove_png_duplicates()
    patch_dialog_a11y()
    patch_version_labels()

    print(f"Copied {len(copied)} files from backup.")
    print(f"Updated WebP paths in: {', '.join(webp_files) or '(none)'}")
    print(f"Removed obsolete PNG duplicates: {removed_png}")
    print(f"Preserved Sanket files: {', '.join(sorted(SANKET_PRESERVE))}")
    print("Merge complete.")


if __name__ == "__main__":
    main()
