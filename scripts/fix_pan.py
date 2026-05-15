import sys

path = r"C:\Users\phili\OneDrive\Desktop\Physix\scripts\world_map.gd"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# 1. Fix _process panning
if "Right-click drag panning" in lines[684] and "get_global_mouse_position()" in lines[686]:
    lines[684] = lines[684].replace("Right-click drag panning", "Right-click drag panning (screen-space to avoid camera feedback loop)")
    lines[686] = lines[686].replace("get_global_mouse_position()", "get_viewport().get_mouse_position()")
    print("Fixed _process panning")
else:
    print("ERROR: _process lines mismatch")
    print(f"684: {repr(lines[684])}")
    print(f"686: {repr(lines[686])}")

# 2. Remove right-click from _unhandled_input
found = False
for i in range(len(lines)):
    if "elif event.button_index == MOUSE_BUTTON_RIGHT:" in lines[i]:
        if i + 7 < len(lines) and "get_viewport().set_input_as_handled()" in lines[i+7]:
            del lines[i:i+8]
            found = True
            print("Removed right-click from _unhandled_input")
            break
        else:
            print("ERROR: Right-click block length mismatch")
            for j in range(i, min(i+10, len(lines))):
                print(f"{j}: {repr(lines[j])}")
            break
if not found:
    print("ERROR: Could not find right-click block")

# 3. Add right-click to _input
input_idx = None
for i, line in enumerate(lines):
    if line.startswith("func _input(event: InputEvent) -> void:"):
        input_idx = i
        break

if input_idx is not None:
    new_block = [
        "\t# Right-click drag panning — handle early so UI nodes don't steal it\n",
        "\tif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT:\n",
        "\t\tif event.pressed:\n",
        "\t\t\t_panning = true\n",
        "\t\t\t_pan_last_mouse = get_viewport().get_mouse_position()\n",
        "\t\telse:\n",
        "\t\t\t_panning = false\n",
        "\t\tget_viewport().set_input_as_handled()\n",
        "\t\treturn\n",
        "\n",
    ]
    for j, new_line in enumerate(new_block):
        lines.insert(input_idx + 1 + j, new_line)
    print("Added right-click to _input")
else:
    print("ERROR: _input not found")

with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)
