extends RefCounted
class_name GameplayFacts

## Shared gameplay tips shown on the world map and at level start.
## Order is shuffled per save; each fact appears once before any repeat.

const ALL_FACTS: Array[String] = [
	# Checkpoints & stars
	"Every level has six hex checkpoint hoops. Pass them all to chase three stars and record a fastest time!",
	"Checkpoint hoops give your ball a speed burst when you roll through — chain them to keep momentum!",
	"Three stars means you cleared every checkpoint. Two stars means you got most of them; one star means you finished the run.",
	"Your fastest time is only saved when you pass all six checkpoints on that run.",
	"Checkpoint hoops turn green after you pass them and save your progress on the track.",
	# Lives & economy
	"You start with three lives. Falling off the track costs one life — use them wisely!",
	"Retrying a level from the pause menu costs one life. The button always says so before you confirm.",
	"Run out of lives and it's Game Over. Buy an extra life in the Shop on the world map for 10 coins.",
	"Coins you collect stay in your wallet when you Continue. Breakable pots refill every time you replay a level!",
	"The Shop is on the world map only — buy skins, music, extra lives, and world keys there.",
	"World keys unlock the next locked world for 50–100 coins if you haven't earned enough stars yet.",
	# Movement & physics
	"Hold W or Up to accelerate like a gas pedal. Let go and your ball coasts on momentum — it won't stop instantly!",
	"Press Space to jump. Downhill slopes are your friend: speed you earn on the drop pays for the next climb.",
	"Newton's First Law is the secret: an object in motion stays in motion — that's why coasting feels so good!",
	"Ice patches have almost no friction. Steer early and expect to slide!",
	"Gravity zones can boost or reduce your weight. Read the zone color before you commit to a jump.",
	"Wind zones push you sideways — counter-steer and aim for the center of the track.",
	"Bumper arenas ricochet your ball. Use the chaos to reach coins off the main line.",
	# Worlds & progression
	"Six worlds, six levels each, plus bonus tracks and secret gauntlets to discover.",
	"World 1 teaches gravity and motion. World 2 adds ice and friction. Later worlds mix wind, magnets, and bumpers!",
	"Unlock the next world by earning at least two stars on every level in the previous world — or buy a world key.",
	"Bonus levels reward big coin payouts. Secret levels are for players who master the gauntlet.",
	# Level design philosophy
	"Wide straightaways let you read the track. Narrow sections test precision at speed.",
	"Every level opens and closes with a calm straight — no traps in the sacred start and finish zones.",
	"Risk coins sit on the outer edge of turns. The safe path still gets you to the finish!",
	# Tech & behind the scenes
	"Physix runs in Godot 4 with real 3D physics — the engine calculates forces dozens of times every second.",
	"Godot uses invisible collision shapes so the ball knows what is solid. What you see is the art; physics uses simpler shapes.",
	"Your progress, stars, coins, lives, and which tips you've seen are stored in a save file when you Continue.",
	"Physix was designed by Phil Carroll (DM Zemo) with momentum-first level design: speed must be earned, read, and conserved.",
	"Each world's color matches its physics theme — green beginner slopes, blue ice, gold gravity, and more.",
	"The level editor lets you build and share custom tracks. Test them, then paste the code for friends!",
	"Music tracks you buy in the Shop appear in the Music menu on the world map — pick a vibe and roll.",
	# Name, secrets & Phil
	"The intentional misspelling of Physics → Physix is called sensational spelling — it makes the title pop!",
	"Levels stay locked until you meet the requirements. Some paths have a secret requirement you won't see on the map.",
	"There is a secret code that unlocks extra secret levels. Keep your ears open and your keyboard ready!",
	"Try typing \"jilly\" on the World Map — something special to honor a special person.",
	"Physix is the 6th game Phil has vibe-coded, and it's his most complex game yet.",
	"Phil designed Physix to appeal to a wide audience — casual gamers and serious completionists alike.",
	"Physix started as a side project so Phil could take a break from Purple Worm Escape development.",
	"Physix is made in Godot, an open-source game engine. Phil first learned about Godot through YouTube.",
]


static func format_did_you_know(fact: String) -> String:
	return "Did you know? " + fact
