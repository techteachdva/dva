#!/usr/bin/env python3
"""Deprecated — use Godot headless with LevelFactory instead.

  godot --headless --path . -s res://tools/regen_bonus_levels.gd

Bonus levels are built with the same sacred zones, runway, hoop rules, and
pot scatter as main levels (via LevelFactory.generate_bonus).
"""
import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main() -> int:
    godot = os.environ.get("GODOT", "godot")
    script = os.path.join(ROOT, "tools", "regen_bonus_levels.gd")
    print("Running:", godot, script)
    return subprocess.call([godot, "--headless", "--path", ROOT, "-s", script])


if __name__ == "__main__":
    sys.exit(main())
