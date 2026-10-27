class_name StoryBank
extends RefCounted

# Extra lines for the ticker, History and the creature card's thoughts, on top
# of the pools in Tickertape and FollowPanel. Same voice: middle-school
# friendly, silly, dramatic, never gory, and logical about who eats whom.
# Births and deaths: %s is the creature's name. Kills and wounds: attacker's
# name, then target's name.

const BIRTHS: Dictionary = {
	"sheep": [
		"%s the lamb is born and has already been startled by a butterfly.",
		"%s the lamb arrives. Their first word is 'baa'. So is their second.",
		"Welcome, %s! The flock votes you Most Likely To Stand In A Field.",
		"%s the lamb is born and stares at the sky as if it owes them grass.",
	],
	"wolf": [
		"%s the pup is born and immediately loses a fight with a pinecone.",
		"%s the wolf pup arrives. The sheep hold an emergency meeting.",
		"%s the pup is born with paws far too big for the rest of them. Give it time.",
	],
	"human": [
		"Baby %s arrives and is handed straight to the nearest grandparent.",
		"%s is born. The village carpenter starts measuring for a very small chair.",
		"%s the baby yells so loudly a falcon reconsiders its career.",
	],
	"falcon": [
		"%s the falcon chick hatches and practises looking disappointed in everyone.",
		"%s hatches high in a tree. Fear of heights: not included.",
		"%s the falcon chick spots a beetle from the nest. Ambitions: confirmed.",
	],
	"robin": [
		"%s the robin hatches and sings a song that is mostly one note, loudly.",
		"%s the robin is born and has already claimed this whole bush.",
		"A tiny orange alarm clock named %s hatches at dawn. Sorry, everyone.",
	],
	"boar": [
		"%s the piglet arrives and roots up a carrot before opening both eyes.",
		"%s the boar is born. The mud puddle is finally complete.",
		"Snort! %s the piglet has joined the sounder and the sounder is louder now.",
	],
	"rabbit": [
		"%s the kit is born. The warren immediately needs a bigger warren.",
		"%s the rabbit hops out, freezes, and becomes a very convincing rock.",
		"%s the kit arrives with one ear up and one ear down. Iconic.",
	],
	"worm": [
		"%s the worm is born and heads down, the only direction that matters.",
		"%s the worm joins the soil team. Job: everything, quietly.",
	],
	"fish": [
		"%s the fish hatches and swims in a tiny, proud circle.",
		"%s the fry is born. Plan: avoid boars, bears, falcons and boredom.",
	],
	"spore": [
		"%s the mushroom pops up and pretends it was always there.",
		"Overnight, %s the mushroom appears, wearing a very fancy cap.",
	],
	"deer": [
		"A fawn named %s stands up on wobbly legs, falls over, and tries again.",
		"%s the fawn is born covered in spots, like someone flicked paint at them.",
		"%s the fawn arrives and already listens to everything with both ears.",
		"The herd welcomes %s, who is ninety percent legs.",
		"%s the fawn is born. Mountain lions write the name down. Mum says no.",
	],
	"goat": [
		"%s the kid is born on a slope and climbs it before lunch.",
		"%s the mountain goat arrives and headbutts a rock to say hello.",
		"A kid named %s is born and eats a flower, a leaf and part of a twig.",
		"%s the goat is born with the balance of a tightrope walker and the manners of a goat.",
	],
	"bear": [
		"%s the bear cub is born, small, round and already thinking about honey.",
		"A cub named %s tumbles out of the den and sits down very firmly.",
		"%s the cub is born. Future plans: fish, berries, nap, repeat.",
		"%s the bear cub arrives and hugs the first tree it meets.",
	],
	"lion": [
		"%s the mountain lion kit is born and practises stalking a leaf.",
		"A kit named %s opens golden eyes. The deer get a bad feeling.",
		"%s the mountain lion is born silently. Of course they are.",
		"%s the kit pounces on its own tail and wins.",
	],
	"beetle": [
		"%s the beetle hatches, shiny as a new button.",
		"%s the beetle is born and starts tidying the valley one crumb at a time.",
		"A beetle named %s arrives. Six legs, zero worries.",
		"%s the beetle hatches and immediately smells something dead. Exciting!",
	],
}

const DEATHS: Dictionary = {
	"sheep": [
		"%s the sheep has gone to graze in the great meadow upstairs.",
		"%s the sheep has passed. The flock says 'baa' slightly quieter.",
		"Rest well, %s. Your wool will warm a worm's opinion of you.",
	],
	"wolf": [
		"%s the wolf lies down for the last time. The pack howls long into the night.",
		"%s the wolf is gone. The rabbits throw a very small, very nervous party.",
	],
	"human": [
		"%s the villager has died. The village tells their best joke at the fireside.",
		"%s is gone. Their garden keeps growing, just to be stubborn.",
	],
	"falcon": [
		"%s the falcon makes one last lazy circle, then is gone from the sky.",
		"%s the falcon has flown its last. The beetles finally relax.",
	],
	"robin": [
		"%s the robin's song has stopped. The bush is very quiet now.",
		"Little %s the robin is gone. Some worm somewhere feels lucky.",
	],
	"boar": [
		"%s the boar has stopped snorting. The mud keeps their shape a while.",
		"%s the boar is gone. Every truffle in the valley breathes out.",
	],
	"rabbit": [
		"%s the rabbit has made their final hop.",
		"%s the rabbit is gone. The warren counts again, and gets a different number.",
	],
	"worm": [
		"%s the worm has died, deep in the soil they spent their life improving.",
	],
	"fish": [
		"%s the fish floats up, done with swimming forever.",
		"%s the fish is gone. The river carries on, because rivers do.",
	],
	"spore": [
		"%s the mushroom wilts and returns its spores to the wind.",
	],
	"deer": [
		"%s the deer has bounded away for the last time.",
		"%s the deer lies down in the long grass and does not get up.",
		"The herd stands quiet for %s the deer, then moves on, as herds must.",
		"%s the deer is gone. The meadow grows a little taller where they browsed.",
	],
	"goat": [
		"%s the goat has climbed their final hill.",
		"%s the mountain goat is gone. Somewhere a rock feels unheadbutted.",
		"%s the goat has died. The slope is a little lonelier.",
	],
	"bear": [
		"%s the bear has gone into the longest hibernation of all.",
		"%s the bear is gone. The fish of the river cannot believe their luck.",
		"The valley shakes a little less. %s the bear has died.",
	],
	"lion": [
		"%s the mountain lion slips away as quietly as they lived.",
		"%s the mountain lion is gone. The deer sleep easier tonight.",
		"%s the lion has died. Their favourite rock stays warm till sunset.",
	],
	"beetle": [
		"%s the beetle has stopped scuttling. The worms will take it from here.",
		"%s the beetle is gone, after a long career in cleaning up.",
		"%s the beetle flips over for the last time. Nobody can help.",
	],
}

const KILLS: Dictionary = {
	"wolf->deer": [
		"%s the wolf runs %s the deer down after a long chase across the meadow.",
		"The pack closes in. %s the wolf brings down %s the deer.",
		"%s the wolf was hungrier than %s the deer was fast.",
	],
	"wolf->rabbit": [
		"%s the wolf snaps up %s the rabbit. Fast, but not fast enough.",
		"%s the wolf zagged when %s the rabbit zigged. Dinner.",
	],
	"wolf->goat": [
		"%s the wolf corners %s the goat on a slope too gentle to save them.",
	],
	"wolf->boar": [
		"%s the wolf takes on %s the boar. The tusks were not enough this time.",
	],
	"lion->deer": [
		"From the long grass, %s the mountain lion pounces on %s the deer.",
		"%s the mountain lion waited an hour for %s the deer. Patience pays.",
		"Nobody ever hears %s the mountain lion coming. Not even %s the deer.",
	],
	"lion->goat": [
		"%s the mountain lion leaps from the rocks onto %s the goat.",
		"%s the mountain lion climbs higher than %s the goat ever could.",
	],
	"lion->sheep": [
		"%s the mountain lion slips into the flock and leaves with %s the sheep.",
	],
	"lion->boar": [
		"%s the mountain lion and %s the boar fight in the brush. The lion walks away.",
	],
	"lion->rabbit": [
		"%s the mountain lion swats %s the rabbit like a toy. A snack, really.",
	],
	"bear->fish": [
		"%s the bear scoops %s the fish clean out of the river. Splash!",
		"%s the bear catches %s the fish mid-jump. Terrible timing, fish.",
		"%s the bear stands in the river like a statue, then grabs %s the fish.",
	],
	"bear->sheep": [
		"%s the bear lumbers into the flock and %s the sheep doesn't lumber out.",
	],
	"bear->deer": [
		"%s the bear surprises %s the deer at the edge of the woods.",
	],
	"bear->rabbit": [
		"%s the bear flips a log and finds %s the rabbit. Bad luck, rabbit.",
	],
	"falcon->beetle": [
		"%s the falcon drops out of the sky and snatches %s the beetle. Crunchy.",
		"%s the falcon proves %s the beetle's shell is not armour after all.",
	],
	"falcon->worm": [
		"%s the falcon plucks %s the worm off the grass like spaghetti.",
	],
	"boar->rabbit": [
		"%s the boar roots up a burrow and finds %s the rabbit inside.",
	],
	"boar->fish": [
		"%s the boar splashes into the shallows and comes out with %s the fish.",
		"%s the boar finds %s the fish stranded on the bank. Lucky boar.",
	],
	"robin->worm": [
		"%s the robin tugs %s the worm out of the lawn. A classic.",
		"%s the robin tilts their head, listens, and finds %s the worm.",
	],
	"robin->fish": [
		"%s the robin catches %s the fish, somehow. Nobody is more surprised than the robin.",
	],
	"human->deer": [
		"%s the hunter brings home %s the deer. The village eats well tonight.",
	],
	"human->fish": [
		"%s the villager pulls %s the fish from the river with a whoop.",
		"%s casts a line and %s the fish bites. Supper!",
	],
	"human->boar": [
		"%s the villager and %s the boar have a very loud argument. The villager wins.",
	],
	"wolf->sheep": [
		"%s the wolf slips past the flock's lookout and takes %s the sheep.",
		"%s the wolf has been following %s the sheep all day. Today it paid off.",
	],
	"generic": [
		"%s the %s catches %s the %s. The food web takes its share.",
		"%s the %s is quicker today. %s the %s is not.",
		"It's a hard valley. %s the %s brings down %s the %s.",
	],
}

const WOUNDS: Dictionary = {
	"lion->deer": [
		"%s the mountain lion pounces, but %s the deer kicks free and runs!",
	],
	"lion->goat": [
		"%s the mountain lion lunges. %s the goat leaps somewhere no lion should follow.",
	],
	"bear->fish": [
		"%s the bear swipes and misses. %s the fish does a little victory flip.",
	],
	"wolf->deer": [
		"%s the wolf nips at %s the deer, who bounds off on springs for legs.",
	],
	"falcon->rabbit": [
		"%s the falcon dives! %s the rabbit dodges into a bush just in time.",
	],
	"generic": [
		"%s the %s goes for %s the %s and only gets a mouthful of fur. Escape!",
		"%s the %s attacks, but %s the %s lives to tell the tale.",
		"Close call! %s the %s nearly had %s the %s.",
	],
}

const MURMURS: Array[String] = [
	"A deer heard a twig snap. It was its own twig. It ran away anyway.",
	"A mountain goat is standing somewhere impossible, looking smug.",
	"A bear is having a nap. Do not wake the bear.",
	"A mountain lion has been watching the same deer for an hour. The deer has no idea.",
	"A beetle rolls past carrying something twice its size. Respect.",
	"Two goats bonk heads. Both act like they won.",
	"A bear sits in the river and waits for dinner to swim by. Lazy genius.",
	"A deer and a rabbit graze side by side, sharing nothing but nervousness.",
	"A falcon lands on a treetop and surveys its kingdom. The kingdom is mostly grass.",
	"A beetle tries to climb a blade of grass. The grass wins. The beetle tries again.",
	"A villager is teaching a child to fish. The child is teaching the fish to hide.",
	"A boar has found an apple. Nothing else matters to the boar right now.",
	"A robin is standing on a sleeping sheep. Nobody has told the sheep.",
	"A wolf yawns. Every rabbit in sight suddenly remembers an appointment.",
	"A goat ate something it shouldn't have. It regrets nothing.",
	"A bear sniffs the air. Somewhere, a berry bush trembles.",
	"The worms vote on where to dig next. The vote is a tie, as always.",
	"A mountain lion washes its face with great dignity.",
	"A deer is eating the moss off a tree. The tree is not thrilled.",
	"A fish has swum upstream for an hour and is very proud of itself.",
	"A rabbit thumps twice. Twelve rabbits vanish at once.",
	"A villager has fallen asleep on the job. The job is also asleep.",
	"A sheep has wandered off from the flock. It is now having an adventure.",
	"A beetle finds a dead thing and calls all its friends. Party time.",
	"A mushroom pops up exactly where a sheep was about to step. Rude.",
	"The goats have reached the top of the slope. Now they must come down. They do not want to.",
	"A bear cub copies its mother's every move, including the dramatic sigh.",
	"A falcon sneezes mid-dive and has to pretend it meant to land there.",
	"A deer stares at you. Yes, you. It knows you're watching.",
	"Somewhere, a boar is arguing with a log. The log is winning.",
]

# Seasonal asides, picked when the valley is quiet.
const SEASON_MURMURS: Dictionary = {
	"Spring": [
		"Spring! Everything is green, everyone is hungry and every bush has babies in it.",
		"The rain fills the river. The fish cheer. The rabbits move house.",
		"Lambs, fawns and kits everywhere. The predators can't believe their luck.",
		"The grass is growing so fast you can almost hear it.",
	],
	"Summer": [
		"Summer heat. The sheep look for shade. The shade is full of sheep.",
		"The berries are ripe and the bears have noticed.",
		"Long days. The falcons hunt till sunset and still want more.",
		"The river runs low and lazy. The fish are getting nervous.",
	],
	"Autumn": [
		"Autumn. Apples drop and every boar in the valley comes running.",
		"The mushrooms are out. The worms are thrilled. The air smells like soup.",
		"The bears are eating everything in sight. Winter is coming and they know it.",
		"Leaves fall. A rabbit is buried in them and quite happy about it.",
	],
	"Winter": [
		"Winter. The river freezes and the fish huddle underneath, waiting for spring.",
		"The bears are asleep. Nobody walks past the den. Just in case.",
		"Moss is the only thing growing. The deer are very interested in moss.",
		"Snow on the meadow. Every footprint tells a story, and most of them are wolves.",
	],
}

# A creature's past, recalled when something happens to it again.
# Tally and survivor lines: [name, ordinal like 3rd]. Falls: [name, count].
const SAGA_TALLY: Array[String] = [
	"That's %s's %s catch. A legend in the making.",
	"%s makes their %s catch. The valley is learning that name.",
	"%s's %s catch, and counting.",
]
const SAGA_SURVIVOR: Array[String] = [
	"%s escaped again! That's their %s close call. Luckiest creature in the valley?",
	"%s survives a %s attack. Some creatures just refuse to quit.",
	"Another near miss for %s, the %s time. Somebody write a song.",
]
const SAGA_FALL_SURVIVOR: Array[String] = [
	"%s had escaped %s attacks. Not this time.",
	"%s's luck has finally run out, after %s narrow escapes.",
]
const SAGA_FALL_HUNTER: Array[String] = [
	"%s, who caught %s in their life, will hunt no more.",
	"The great hunter %s, %s catches, is gone.",
]
const SAGA_OLD: Array[String] = [
	"%s lived a long, full life. They saw %s seasons.",
	"%s grew old and grey and wise. %s seasons is a good run.",
]

# The creature card's inner voice. Several lines per situation; the card
# shows one for a while, then another, so reading it keeps paying off.
const THOUGHTS: Dictionary = {
	"flee": [
		"Something is after me!", "Run now, think later!", "Not today, not today, not today!",
		"Legs, do your thing!", "Why is it always me?",
	],
	"hurt": [
		"I'm hurt badly. I need somewhere safe.", "Ow. Ow. Everything is ow.",
		"Just need to lie low and heal.", "That did not go well.",
	],
	"starving": [
		"So hungry I can barely stand.", "I'd eat anything. Anything!",
		"My stomach is making noises I've never heard.", "Food. Food. Food. Food.",
	],
	"cranky": [
		"Slept on rocks all night. Don't talk to me.", "Everything is annoying today.",
		"I need a proper bed. Or at least a softer rock.",
	],
	"old": [
		"My bones ache. I've seen a lot of seasons.", "Back in my day, the grass was taller.",
		"Slow and steady. Mostly slow.", "I remember when this valley was quieter.",
	],
	"peckish": [
		"My stomach is growling. Food first.", "Is it snack time? It feels like snack time.",
		"I could eat. I could always eat.",
	],
	"pack": [
		"The pack is with me. Let's hunt.", "Together we're unstoppable.", "Stay close. Move as one.",
	],
	"herd": [
		"Safe in the middle of the flock.", "Lots of friends, lots of eyes. Good.",
		"Nobody gets me in here.", "If something comes, it eats someone at the edge first.",
	],
	"alone": [
		"Where did everyone go? It isn't safe out here alone.", "Hello? Anyone?",
		"I'm sure I was with the others a minute ago.", "Too quiet. Way too quiet.",
	],
	"dark": [
		"It's dark. I should be tucked up somewhere safe.", "What was that noise?",
		"The night is full of teeth.", "Home. I want to be home.",
	],
	"night_owl": [
		"The night belongs to me.", "Everyone's asleep. Perfect.", "The moon is up. Time to get busy.",
	],
	"too_bright": [
		"Too bright. I'll wait for the moon.", "Ugh, daytime.", "Wake me when it's dark.",
	],
	"Graze": ["Mm, sweet grass.", "Chew, chew, chew, look up, chew.", "This patch is the best patch.", "Crunchy. Green. Perfect."],
	"Eat": ["Finally, a proper meal.", "Don't watch me eat, it's rude.", "Mmm. Worth the wait.", "Best. Meal. Ever."],
	"Hunt": ["Easy... stay downwind...", "I can smell something tasty.", "Low and slow. Low and slow.", "There. Over there."],
	"Chase": ["Faster! Don't let it get away!", "Almost... almost...", "You can't run forever!"],
	"Sleep": ["Zzz...", "Zzz... five more minutes...", "Zzz... dreaming of snacks...", "Zzz... mmph... no, the other field..."],
	"Wander": ["Something will turn up.", "Just seeing what's over there.", "Every day's an adventure.", "I wonder what's past that tree."],
	"Walk": ["Where's the rest of the flock?", "Left foot, right foot.", "Nice day for a stroll."],
	"Idle": ["Nothing to worry about. Probably.", "Just standing. Professionally.", "Hmm.", "Thinking about nothing at all."],
	"Mate": ["Ahem. Lovely evening, isn't it?", "Do I look all right?", "Be cool. Be cool.", "Nice fur. I mean, hello."],
	"Swim": ["Upstream, downstream, it's all water.", "Bubbles!", "Swim, swim, avoid the bear."],
	"Forage": ["Something good is under here somewhere.", "Sniff, sniff, sniff... aha!", "Dig, dig, dig."],
	"Build": ["One more beam and it'll stand.", "Measure twice, cut once.", "This hut will be the best hut."],
	"Patrol": ["I can see everything from up here.", "Nothing escapes my eyes.", "Wind under the wings. Lovely."],
}
const SPECIES_THOUGHTS: Dictionary = {
	"sheep": ["Is that a wolf? No, a rock. Probably a rock.", "Baa.", "I wonder if grass ever gets tired of me."],
	"wolf": ["I smell sheep.", "Where's the rest of the pack?", "One day I'll catch that falcon."],
	"human": ["The village needs more timber.", "I should check on the huts.", "What's for supper?"],
	"falcon": ["I can see a beetle from here. Three, actually.", "Treetop or sky? Decisions.", "Beneath me, all of it."],
	"robin": ["This bush is mine. All mine.", "Worm. Worm. Worm?", "I'll sing about it later."],
	"boar": ["Truffles. I know you're there.", "Mud bath, then nap.", "Who wants to fight? Anyone?"],
	"rabbit": ["Every shadow is a hawk.", "Hop, freeze, hop, freeze.", "Clover! My favourite!"],
	"worm": ["Down here it's peaceful.", "The soil says hello.", "Dirt in, better dirt out."],
	"fish": ["Bears have long arms.", "The current is strong today.", "Blub."],
	"deer": ["Did something move?", "Ears up. Always ears up.", "This moss is delicious."],
	"goat": ["Higher. Always higher.", "I could climb that.", "Bonk first, ask later."],
	"bear": ["Fish. Berries. Nap. In that order.", "Winter's coming. Eat more.", "Who's been in my river?"],
	"lion": ["Patience.", "The deer don't know I'm here.", "The best hunts are quiet ones."],
	"beetle": ["Something died nearby. Lovely.", "Six legs, one job.", "Clean-up crew, reporting in."],
	"mushroom": ["Slowly... slowly...", "Spores away!", "The network is buzzing today."],
}

# Other ways to tell a memory on the creature card, by its kind. The feeling
# word stays; the reason is told differently each time.
const MEMORIES: Dictionary = {
	"meal": [
		"after eating until it couldn't move", "after the best meal in days",
		"after a snack that turned into a feast", "after finally filling its belly",
	],
	"wound": [
		"after a fight it would rather forget", "from a wound that stings with every step",
		"after a scrape that was much too close",
	],
	"herd_in": [
		"surrounded by friendly faces", "back among its own at last", "in a crowd that has its back",
	],
	"herd_out": [
		"lost and far from home", "when it looked up and everyone was gone", "alone on an empty stretch of valley",
	],
	"dusk": ["as the stars came out", "as the shadows grew long", "as the valley went dark"],
	"dawn": ["as the sun climbed over the ridge", "as the birds started singing", "with the first warm light"],
	"hunger": ["with an empty belly", "after a long day with nothing to eat", "dreaming of food it couldn't find"],
	"home": ["tucked up warm under a roof", "safe at home with the door shut"],
	"rough": ["after sleeping on a rock", "after a night of wind and no roof"],
	"flee": ["when something with teeth came close", "running from a shadow that was real this time"],
	"warm": ["toward the others like it", "watching its own kind nearby"],
}
