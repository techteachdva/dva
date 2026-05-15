import os, glob

BASE = r"C:\Users\phili\OneDrive\Desktop\Physix\scenes\levels"

def fix_file(path):
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    in_complete_panel = False
    in_complete_title = False
    in_stars_label = False
    in_time_label = False
    in_rank_label = False

    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Detect node entry
        if stripped.startswith('[node name="CompletePanel"'):
            in_complete_panel = True
            in_complete_title = in_stars_label = in_time_label = in_rank_label = False
        elif stripped.startswith('[node name="CompleteTitle"'):
            in_complete_panel = False
            in_complete_title = True
            in_stars_label = in_time_label = in_rank_label = False
        elif stripped.startswith('[node name="StarsLabel"'):
            in_complete_panel = in_complete_title = in_time_label = in_rank_label = False
            in_stars_label = True
        elif stripped.startswith('[node name="TimeLabel"'):
            in_complete_panel = in_complete_title = in_stars_label = in_rank_label = False
            in_time_label = True
        elif stripped.startswith('[node name="RankLabel"'):
            in_complete_panel = in_complete_title = in_stars_label = in_time_label = False
            in_rank_label = True
        elif stripped.startswith('[node name="'):
            in_complete_panel = in_complete_title = in_stars_label = in_time_label = in_rank_label = False

        if in_complete_panel:
            if stripped.startswith("anchor_left ="):
                line = "anchor_left = 0.33\n"
            elif stripped.startswith("anchor_top ="):
                line = "anchor_top = 0.15\n"
            elif stripped.startswith("anchor_right ="):
                line = "anchor_right = 0.67\n"
            elif stripped.startswith("anchor_bottom ="):
                line = "anchor_bottom = 0.90\n"

        if in_complete_title:
            if stripped.startswith("anchor_top ="):
                line = "anchor_top = 0.06\n"
            elif stripped.startswith("anchor_bottom ="):
                line = "anchor_bottom = 0.16\n"
            elif stripped.startswith("theme_override_font_sizes/font_size ="):
                line = "theme_override_font_sizes/font_size = 34\n"
            elif stripped == 'text = "LEVEL COMPLETE!"':
                out.append(line)
                if i + 1 < len(lines) and not lines[i+1].strip().startswith("horizontal_alignment"):
                    out.append("horizontal_alignment = 1\n")
                i += 1
                continue

        if in_stars_label:
            if stripped.startswith("anchor_top ="):
                line = "anchor_top = 0.22\n"
            elif stripped.startswith("anchor_bottom ="):
                line = "anchor_bottom = 0.32\n"
            elif stripped == 'text = "☆☆☆"':
                out.append(line)
                if i + 1 < len(lines) and not lines[i+1].strip().startswith("horizontal_alignment"):
                    out.append("horizontal_alignment = 1\n")
                i += 1
                continue

        if in_time_label:
            if stripped.startswith("anchor_top ="):
                line = "anchor_top = 0.36\n"
            elif stripped.startswith("anchor_bottom ="):
                line = "anchor_bottom = 0.44\n"
            elif stripped == 'text = "Time: 00:00"':
                out.append(line)
                if i + 1 < len(lines) and not lines[i+1].strip().startswith("horizontal_alignment"):
                    out.append("horizontal_alignment = 1\n")
                i += 1
                continue

        if in_rank_label:
            if stripped.startswith("anchor_top ="):
                line = "anchor_top = 0.46\n"
            elif stripped.startswith("anchor_bottom ="):
                line = "anchor_bottom = 0.54\n"
            elif stripped.startswith("theme_override_font_sizes/font_size ="):
                line = "theme_override_font_sizes/font_size = 26\n"
            elif stripped == 'text = "Rank: A"':
                out.append(line)
                if i + 1 < len(lines) and not lines[i+1].strip().startswith("horizontal_alignment"):
                    out.append("horizontal_alignment = 1\n")
                i += 1
                continue

        out.append(line)
        i += 1

    with open(path, "w", encoding="utf-8") as f:
        f.writelines(out)

files = glob.glob(os.path.join(BASE, "**", "*.tscn"), recursive=True)
count = 0
for path in files:
    fix_file(path)
    count += 1

print(f"Fixed {count} level scene files.")
