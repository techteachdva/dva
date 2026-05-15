extends StaticBody3D
class_name IcePatch

@export var ice_friction: float = 0.005
@export var ice_bounce:   float = 0.05

func _ready() -> void:
	physics_material_override          = PhysicsMaterial.new()
	physics_material_override.friction = ice_friction
	physics_material_override.bounce   = ice_bounce
