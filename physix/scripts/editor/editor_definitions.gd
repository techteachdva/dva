extends Object
class_name EditorDefinitions

enum Mode { TRACK, OBSTACLE, CHECKPOINT }

const PALETTE: Array[Dictionary] = [
	{ "id": "bumper", "name": "Bumper", "scene": "res://scenes/obstacles/bumper.tscn", "category": "Obstacles" },
	{ "id": "boost", "name": "Speed Boost", "scene": "res://scenes/obstacles/speed_boost.tscn", "category": "Obstacles" },
	{ "id": "brake", "name": "Brake Pad", "scene": "res://scenes/obstacles/brake_pad.tscn", "category": "Obstacles" },
	{ "id": "grav", "name": "Gravity Zone", "scene": "res://scenes/obstacles/gravity_zone.tscn", "category": "Obstacles" },
	{ "id": "wind", "name": "Wind Zone", "scene": "res://scenes/obstacles/wind_zone.tscn", "category": "Obstacles" },
	{ "id": "magnet", "name": "Magnet Zone", "scene": "res://scenes/obstacles/magnet_zone.tscn", "category": "Obstacles" },
	{ "id": "ice", "name": "Ice Patch", "scene": "res://scenes/obstacles/ice_patch.tscn", "category": "Obstacles" },
	{ "id": "spike", "name": "Spike Trap", "scene": "res://scenes/obstacles/spike_trap.tscn", "category": "Obstacles" },
	{ "id": "move", "name": "Moving Plat", "scene": "res://scenes/obstacles/moving_platform.tscn", "category": "Obstacles" },
	{ "id": "tutorial", "name": "Tutorial Trigger", "scene": "res://scenes/obstacles/tutorial_trigger.tscn", "category": "Obstacles" },
	{ "id": "coin", "name": "Coin", "scene": "res://scenes/coin.tscn", "category": "Collectibles" },
	{ "id": "finish", "name": "Finish Zone", "scene": "", "category": "Meta" },
]

const PATTERNS: Array[Dictionary] = [
	{ "id": "snake", "name": "Snake", "category": "Patterns" },
	{ "id": "gauntlet", "name": "Gauntlet", "category": "Patterns" },
	{ "id": "slalom", "name": "Slalom", "category": "Patterns" },
	{ "id": "tunnel", "name": "Tunnel", "category": "Patterns" },
]

const SEGMENT_TYPES: Dictionary = {
	"straight": {"name": "Straight", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": false},
	"ramp_up": {"name": "Ramp Up", "length": 20, "width": 8, "ramp": 3, "bank": 0, "ice": false},
	"ramp_down": {"name": "Ramp Down", "length": 20, "width": 8, "ramp": -3, "bank": 0, "ice": false},
	"gap": {"name": "Gap", "length": 10, "width": 8, "ramp": 0, "bank": 0, "ice": false},
	"ice": {"name": "Ice", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": true},
	"narrow": {"name": "Narrow", "length": 20, "width": 5, "ramp": 0, "bank": 0, "ice": false},
	"wide": {"name": "Wide", "length": 20, "width": 12, "ramp": 0, "bank": 0, "ice": false},
	"bank_left": {"name": "Bank Left", "length": 20, "width": 8, "ramp": 0, "bank": 15, "ice": false},
	"bank_right": {"name": "Bank Right", "length": 20, "width": 8, "ramp": 0, "bank": -15, "ice": false},
}

const HOOP_HEIGHTS: Dictionary = {
	"ground": {"name": "Ground Hoop", "offset": 0.2},
	"mid": {"name": "Mid Hoop", "offset": 1.5},
	"high": {"name": "High Hoop", "offset": 3.0},
}

const SNAP_DIRS: Array[Dictionary] = [
	{"id": "UL", "dx": -1, "dy": 1, "label": "Up-Left"},
	{"id": "U", "dx": 0, "dy": 1, "label": "Up"},
	{"id": "UR", "dx": 1, "dy": 1, "label": "Up-Right"},
	{"id": "L", "dx": -1, "dy": 0, "label": "Left"},
	{"id": "M", "dx": 0, "dy": 0, "label": "Middle"},
	{"id": "R", "dx": 1, "dy": 0, "label": "Right"},
	{"id": "DL", "dx": -1, "dy": -1, "label": "Down-Left"},
	{"id": "D", "dx": 0, "dy": -1, "label": "Down"},
	{"id": "DR", "dx": 1, "dy": -1, "label": "Down-Right"},
]

const UI_MARGIN := 10.0
const UI_TOP_BAR := 96.0
const UI_PALETTE_WIDTH := 148.0
const UI_PROPS_WIDTH := 168.0
const UI_TIMELINE_HEIGHT := 56.0
