#!/usr/bin/env -S godot --headless --script
extends SceneTree
func _init():
    var _ = load("res://scripts/effects/fx_manager.gd")
    var _ = load("res://scripts/effects/floating_text.gd")
    var _ = load("res://scripts/simulation_director.gd")
    var _ = load("res://scripts/combat_system.gd")
    var _ = load("res://scripts/agents/sheep.gd")
    var _ = load("res://scripts/agents/wolf.gd")
    var _ = load("res://scripts/agents/human.gd")
    var _ = load("res://scripts/agents/falcon.gd")
    var _ = load("res://scripts/agents/robin.gd")
    var _ = load("res://scripts/agents/boar.gd")
    var _ = load("res://scripts/agents/worm.gd")
    print("OK")
    quit()
