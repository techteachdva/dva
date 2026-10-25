extends SceneTree

# Dev check: every name in every list passes the classroom filter.
# godot --headless --path . -s res://scripts/dev/name_check.gd
func _initialize() -> void:
	var bad: Array = []
	for k: String in NameLists.LISTS.keys():
		var list: Array = NameLists.LISTS[k]
		if list.size() < 100:
			print("SHORT ", k, " ", list.size())
		for n: String in list:
			if not NameGenerator.is_clean(n):
				bad.append(n)
	for list in [NameGenerator._wizard_names, NameGenerator._builder_names]:
		for n: String in list:
			if not NameGenerator.is_clean(n):
				bad.append(n)
	print("blocked in lists: ", bad)
	print("filter catches: ", ["Cock", "Tit", "Dickon", "Big Butt"].filter(func(n): return not NameGenerator.is_clean(n)))
	quit()
