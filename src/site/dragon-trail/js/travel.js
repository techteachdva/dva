// Dragon Trail Web - Travel System

const ENVIRONMENTAL_EVENTS = [
    { name: 'Storm', type: 'negative', description: 'The sky splits open with a thunderclap that shakes your very bones. Rain lashes down in sheets so thick you cannot see ten paces ahead. You huddle beneath a rock overhang, shivering, as lightning turns the world white and then black again. The storm rages for hours, stealing a full day from your journey and leaving you chilled to the marrow.', effect: async () => { await advanceDays(1); Resources.modifyHealth(-5); } },
    { name: 'Wild Animal Encounter', type: 'negative', description: 'A rustle in the undergrowth is your only warning before a massive shape lunges from the shadows. Claws flash. You roll aside just in time, but the beast is already turning for a second strike. The wilderness does not forgive the unprepared, and today it has chosen you as its prey.', effect: async () => { await simulateAttack('fauna', 'wild_beast'); } },
    { name: 'Pleasant Weather', type: 'positive', description: 'For once, the world seems kind. A gentle breeze carries the scent of wildflowers across the plain. Sunlight filters through clouds like honey poured through gauze. You walk with a lighter step, and somehow the ache in your shoulders fades. It is the kind of day that makes you believe you might actually survive this.', effect: async () => { Resources.modifyHealth(5); } },
    { name: 'Bandit Ambush', type: 'negative', description: 'The first arrow whistles past your ear before you even know they are there. Figures emerge from behind boulders and dead trees, ragged men with hungry eyes and rusted blades. They demand your supplies in voices hoarse from road dust and desperation. When you refuse, they attack without hesitation.', effect: async () => { Resources.modify('supplies', -1); await simulateAttack('humanoid', 'bandit'); } },
    { name: 'Abandoned Supplies', type: 'positive', description: 'You crest a ridge and find a broken cart tilted against a tree, its horse long gone and its driver nowhere to be found. Crates are scattered across the ground, some already looted, others still sealed. You pick through the remains with a mix of gratitude and guilt, wondering what fate befell the owner.', effect: async () => { Resources.modify('supplies', 3); } },
    { name: 'Shortcut', type: 'positive', description: 'An old goat path winds down into a valley you had not seen from the main trail. Mossy stones suggest it was once a proper road, perhaps built by travelers long dead. You follow it with cautious hope, and to your astonishment it rejoins the main trail miles ahead. The dragon drew closer today, and you did not even suffer for it.', effect: async () => { travelMiles(50); } },
    { name: 'Gold Discovery', type: 'positive', description: 'Your boot kicks something hard and yellow beneath a tangle of roots. You kneel and brush away dirt to reveal a leather pouch, rotted through but still holding a handful of coins stamped with a king\'s face you do not recognize. Someone buried a small fortune here and never returned to claim it. Their loss.', effect: async () => { Resources.modifyGold(Utils.randInt(5, 15)); } },
    { name: 'Slain Bandits', type: 'positive', description: 'You come upon a campsite littered with bodies. Flies buzz in thick clouds. The bandits clearly turned on each other after a night of drinking, and the survivors fled without their loot. You step over outstretched hands and help yourself to what they left behind, trying not to look at the faces.', effect: async () => { Resources.modifyGold(Utils.randInt(10, 50)); } },
    { name: 'Herbalist Encounter', type: 'neutral', description: 'An old woman with bark-stained fingers steps from the tree line as if she grew from the soil itself. She carries a basket of roots and leaves, and her eyes see too much. She offers to sell you herbs at prices that seem almost charitable, though you wonder what she sees in your palm when you pay her.', effect: async () => { await handleHerbalistEncounter(); } },
    { name: 'Random Trader', type: 'neutral', description: 'A wagon creaks toward you down the trail, pulled by a mule that looks as tired as you feel. The driver tips his hat and spreads his wares across a blanket: dried meat, water skins, odds and ends from a dozen lands. He talks too much and smiles too little, but his prices are fair.', effect: async () => { await handleTrade(Utils.choice(['food_for_supplies', 'supplies_for_food', 'gold_for_food', 'gold_for_water'])); } },
    { name: 'Waterfall', type: 'positive', description: 'You hear it before you see it: a roar like a hundred horses galloping over stone. Then the trees part and there it is, a curtain of water falling from cliffs so high they vanish into cloud. The pool beneath is clear and cold and tastes of minerals and salvation. You fill every container you have.', effect: async () => { Resources.modify('water', 32); } },
    { name: 'Water Merchant', type: 'neutral', description: 'A gaunt man sits beside a cart stacked with clay vessels, each sealed with wax. He sells water by the skin at prices that make you wince, but his wares are clean and cold, and he knows every spring within fifty miles. You haggle out of principle, then buy anyway.', effect: async () => { await handleWaterMerchant(); } },
    { name: 'Empty Waterskin', type: 'positive', description: 'Half-buried in sand at the edge of a dry streambed, you find a waterskin of good leather, empty but unbroken. Someone dropped it here and never looked back, or perhaps they did not survive to need it again. You rinse it with a splash of your own water and claim it.', effect: async () => { Resources.modify('waterskins', Utils.randInt(2, 3)); } },
    { name: 'Stumbled Upon Wood', type: 'positive', description: 'A lightning-struck oak has fallen across the trail, splitting into lengths that any fire would be glad to accept. You spend an hour hacking free what you can carry, sweat mixing with sap. The smell of fresh wood follows you for miles, a scent of campsites yet to come.', effect: async () => { Resources.modify('wood', Utils.randInt(3, 9)); } },
    { name: 'Lost Trail', type: 'negative', description: 'The markers vanish. One moment you are following a clear path, the next you are standing in identical-looking brush with no notion of which way is forward. You spend hours circling, backtracking, cursing your own inattention. By the time you find the trail again, a full day is gone and your boots are full of blisters.', effect: async () => { await advanceDays(1); } },
    { name: 'Hidden Cache', type: 'positive', description: 'A stone that looks wrong catches your eye. You pry it loose and find a hollow beneath stuffed with oilcloth packages. Dried meat, flint, a knife still sharp. Someone prepared for trouble and never came back for their insurance. You whisper a thank-you to the wind and pack it all away.', effect: async () => { Resources.modify('supplies', Utils.randInt(2, 5)); } },
    { name: 'River Crossing', type: 'positive', description: 'The river is wide and slow, deceptively calm. You build a rough raft from driftwood and lash your gear above the waterline. The crossing takes all day, and by the time you reach the far bank your legs are shaking and your clothes are soaked, but the water you gathered will keep you alive for days.', effect: async () => { await advanceDays(1); Resources.modify('water', 32); } },
    { name: 'Ancient Ruins', type: 'positive', description: 'Columns of white stone rise from the jungle like the ribs of some enormous dead god. Vines choke doorways that once led to halls of light. You pick through the rubble carefully, half-expecting a curse, and find trinkets left by pilgrims who came here seeking blessings they never received.', effect: async () => { Resources.modifyGold(Utils.randInt(15, 30)); } },
    { name: 'Wild Berries', type: 'positive', description: 'A thicket of dark berries hangs heavy along the trail, so ripe they stain your fingers purple when you touch them. You sample one cautiously, then another, then fill your pockets. They are tart and sweet and taste of summer, a brief reminder that the world is not only made of dust and danger.', effect: async () => { Resources.modify('food', Utils.randInt(3, 7)); } },
    { name: 'Expensive Merchant', type: 'negative', description: 'A merchant with silk sleeves and a smile like a knife has set up shop in the middle of nowhere. His prices are insulting, his goods are mediocre, and he knows you have nowhere else to go. You bargain with the desperation of a drowning man, but he holds all the cards today.', effect: async () => { await handleTrade(Utils.choice(['food_for_supplies', 'supplies_for_food', 'gold_for_food', 'gold_for_water']), false); } },
    { name: 'Stranded Pilgrim', type: 'positive', description: 'An old man sits beside the trail, his feet wrapped in bloody rags. He begs for water and food in a voice that has given up on being heard. You share what you can spare, and in gratitude he tells you about a hidden spring two miles north. You find it just where he said, and the water tastes like mercy.', effect: async () => { Resources.modify('water', 16); Resources.modify('food', 2); } },
    { name: 'Burned Village', type: 'positive', description: 'The smell of charred wood leads you to a hamster of blackened timbers and still-warm ash. Raiders came through recently, leaving nothing alive. You scavenge through the ruins with a heavy heart, finding supplies the raiders overlooked in their haste. The dead watch you in silence.', effect: async () => { Resources.modify('supplies', Utils.randInt(1, 4)); Resources.modify('food', Utils.randInt(1, 3)); } },
    { name: 'Old Well', type: 'positive', description: 'At the center of a clearing stands a stone well, its rope frayed but its bucket intact. You crank it up with aching arms and hear the blessed sound of sloshing water. The well is deep and cold and tastes of limestone. You drink your fill and tie the bucket back where you found it.', effect: async () => { Resources.modify('water', 20); } },
    { name: 'Hunting Weir', type: 'positive', description: 'A primitive trap made of woven branches funnels animals into a deadfall. It was built by hands long gone, but it still works: a rabbit dangles from the snare, dead and untouched by rot. You reset the trap out of respect for its maker and carry the meat with you.', effect: async () => { Resources.modify('food', Utils.randInt(4, 8)); } },
    { name: 'Broken Bridge', type: 'negative', description: 'The trail ends at a ravine spanned by what was once a fine stone bridge, now collapsed into the torrent below. You spend hours finding a safe ford downstream, scrambling over wet rocks and clinging to roots. By the time you reach the other side, your legs are jelly and your nerves are raw.', effect: async () => { await advanceDays(1); Resources.modifyHealth(-5); } },
    { name: 'Friendly Dog', type: 'positive', description: 'A scrawny hound follows you for half a day, never begging, just walking three paces behind. Eventually it trots ahead and starts digging at a patch of earth. You investigate and find a leather purse, long buried, still holding a few coins. The dog watches you with knowing eyes, then vanishes into the brush.', effect: async () => { Resources.modifyGold(Utils.randInt(5, 12)); } },
    { name: 'Fungal Grove', type: 'positive', description: 'A circle of pale mushrooms glows faintly in the twilight, each cap large enough to serve as a plate. You know enough to avoid the poisonous ones, but several varieties here are edible and savory. You harvest carefully, leaving the smallest to spread, and walk away with a sack of earthy riches.', effect: async () => { Resources.modify('food', Utils.randInt(4, 7)); Resources.modify('herbs', Utils.randInt(1, 3)); } },
    { name: 'Wandering Smith', type: 'neutral', description: 'A dwarf with soot-blackened arms and a portable forge has made camp beside a stream. He sharpens blades, mends armor, and complains about the weather in three languages. He sells you a bundle of supplies at reasonable prices and warns you about bandits on the road ahead.', effect: async () => { Resources.modify('supplies', 2); Resources.modifyGold(-5); } },
    { name: 'Abandoned Campfire', type: 'positive', description: 'Ashes still warm. A pot of stew, untouched. Whoever left here did so in a hurry, perhaps frightened by something in the dark. You eat the stew because waste is a sin on the trail, and you gather the firewood they left stacked. The night feels colder here than it should.', effect: async () => { Resources.modify('food', 3); Resources.modify('wood', Utils.randInt(2, 4)); } },
    { name: 'Bee Tree', type: 'positive', description: 'A hollow oak hums with industry. Bees swarm around a crack in the trunk, guarding golden treasure within. You smoke them out with a green branch, wincing at every sting, and scrape out combs of dark honey so rich it tastes like liquid sunlight. The sweetness stays on your tongue for miles.', effect: async () => { Resources.modify('food', Utils.randInt(5, 8)); } },
    { name: 'Collapsed Mine', type: 'positive', description: 'The mouth of an old mine gapes in the hillside, supported by beams that have not rotted yet. You venture a few paces inside and find tools left by miners who struck a thin vein and moved on. A rusted pick, a leather helmet, and a small pouch of silver dust that a jeweler would pay handsomely for.', effect: async () => { Resources.modifyGold(Utils.randInt(10, 25)); } }
];

const UNEVENTFUL_TRAVEL_PHRASES = [
    'Your journey was brisk and particularly uneventful. The time flew by.',
    'The trail stretched ahead, empty and patient. Not even the wind disturbed your passage.',
    'Hours passed in a comfortable blur of footfalls and birdcalls. You begin to think the wilds have forgotten you.',
    'The miles melted beneath your boots without complaint. It is the kind of day that makes you believe in luck.',
    'Not a soul, not a beast, not a storm cloud crossed your path. The world held its breath while you walked.',
    'You whistle a tune your mother used to hum. The hills do not answer, but they do not interrupt either.',
    'A heron follows you for half a day, gliding from pond to pond, never close enough to touch. You decide it is a good omen.',
    'The sun climbs, peaks, and descends without incident. You make camp early, almost disappointed.',
    'You find a stretch of trail so smooth it might have been paved by forgotten hands. You walk it gratefully, savoring the rare peace.',
    'A rabbit watches you pass from the safety of a thicket. Its nose twitches. You nod to it like an old friend.',
    'Clouds drift overhead in shapes that remind you of home: a cottage, a dog, a loaf of bread. You do not remember the last time you thought of bread.',
    'The silence is so complete you can hear your own heartbeat. It is steady. It is strong. You are still alive.',
    'You pass a milestone carved with a face you do not recognize. Someone laughed here once, long ago. You smile in their memory.',
    'A warm rain begins as you crest a hill, but it passes in minutes, leaving only the scent of wet stone and gratitude.',
    'Your shadow stretches long across the trail, keeping perfect pace. It is the most loyal companion you have ever had.'
];

const BIOME_EVENT_CHAINS = {
    'Forest': [
        { name: 'Whispering Woods', desc: 'The trees seem to speak your name. Not the wind, not the creak of branches, but actual syllables formed from the rustle of leaves. You turn and ask who is there, and the forest laughs in a thousand green voices. You flee with scratches you do not remember receiving.', effect: async () => { Resources.modifyHealth(-3); } },
        { name: 'Forest Shrine', desc: 'An ancient shrine hums with power. It is overgrown with moss and forget-me-nots, and the stone basin at its center holds water that glows faintly blue. You drink without thinking, and the taste is honey and lightning. When you open your eyes, the cuts on your hands have closed.', effect: async () => { Resources.modifyHealth(10); Resources.modify('herbs', 2); } },
        { name: 'Deep Grove', desc: 'You find a grove untouched by time. The flowers here are varieties you have only seen in books, and the air smells of cinnamon and sap. At the center of the grove stands a pedestal of white stone, and on it rests a pouch of coins stamped with a king who died a thousand years ago.', effect: async () => { Resources.modifyGold(Utils.randInt(10, 20)); } },
        { name: 'Hollow Oak', desc: 'A tree larger than a house has rotted from within, leaving a chamber big enough to stand in. The walls are lined with shelves carved by woodpeckers or by hands much smaller than yours. You find acorns that rattle like dice, a vial of amber sap, and a cloak woven from spider silk.', effect: async () => { Resources.modify('supplies', 2); Resources.modify('herbs', 2); Resources.modifyGold(10); } },
        { name: 'Wolf Circle', desc: 'You come upon a clearing where wolves have arranged bones in a spiral pattern larger than your camp. The bones are bleached and old, but the earth inside the circle is warm. You step inside and feel something ancient settle over you like a blanket. The wolves watch from the tree line but do not approach.', effect: async () => { Resources.modifyHealth(5); GameState.player.maxHealth += 3; GameState.player.health += 3; } }
    ],
    'Mountain': [
        { name: 'Avalanche Warning', desc: 'Rocks tumble down the slope! You hear the rumble before you see the dust, and you flatten yourself against the cliff face as stones the size of heads bounce past. One clips your shoulder, spinning you around, but you cling to the rock and wait for the mountain to finish its tantrum.', effect: async () => { Resources.modifyHealth(-10); } },
        { name: 'Ice Cave', desc: 'A frozen cave glitters in the moonlight. The walls are curtains of crystal that magnify the stars outside, and the floor is a lake of ice so clear you can see fish suspended beneath your feet. You chip meltwater from the wall and find a cache of supplies left by climbers who never returned.', effect: async () => { Resources.modify('water', 16); Resources.modify('supplies', 2); } },
        { name: 'Peak Shrine', desc: 'At the summit, you find offerings left by climbers. Coins frozen to the stone, a lock of hair weighted with a silver bead, a climbing axe with a carved handle. You leave a ration of your own and take the axe, feeling the weight of every prayer that has been offered here.', effect: async () => { Resources.modifyGold(Utils.randInt(15, 30)); } },
        { name: 'Eagle\'s Nest', desc: 'High on a ledge accessible only by a crumbling stair, you find an eagle\'s nest the size of a cart. The chicks are gone, but the nest holds treasures: rings dropped by prey, a dagger hilt, and a leather satchel containing dried meat and a flask of brandy. You take what you need and retreat before the parents return.', effect: async () => { Resources.modify('food', 4); Resources.modifyGold(Utils.randInt(10, 20)); } },
        { name: 'Hot Spring', desc: 'Behind a wall of steam in a volcanic vent, you discover a pool of water hot enough to turn your skin pink. The minerals in the water smell of sulfur and healing, and after soaking for an hour your blisters are gone and your muscles feel like they belong to someone younger.', effect: async () => { Resources.modifyHealth(15); Resources.modify('water', 8); } }
    ],
    'Swamp': [
        { name: 'Misty Path', desc: 'Fog coils around your ankles, thick as cream and cold as well water. You follow a path that seems to shift beneath your feet, and twice you pass the same dead tree though you walked straight. By the time you find solid ground, the fog has left a chill in your lungs that takes hours to warm.', effect: async () => { Resources.modifyHealth(-5); } },
        { name: 'Swamp Witch', desc: 'A hag offers a deal in exchange for herbs. She lives in a house built on the back of a sleeping turtle, and her eyes are the color of pond scum. She takes your herbs with trembling hands and brews a tea that tastes of dirt and renewal. You feel your heart grow stronger, literally, and you hope the price is only gold.', effect: async () => { Resources.modify('herbs', -2); GameState.player.maxHealth += 5; GameState.player.health += 5; } },
        { name: 'Sunken Relic', desc: 'You pull a rusted chest from the muck. It takes an hour of digging with your hands, and the smell never washes off, but inside is a fortune in silver coins fused together by centuries of peat. You chip them apart with your knife and count them by firelight, grinning through the filth.', effect: async () => { Resources.modifyGold(Utils.randInt(20, 40)); } },
        { name: 'Ghost Light', desc: 'A pale blue light drifts through the cypress knees, and against your better judgment you follow it. It leads you to a boat half-sunk in the mud, and inside the boat is a body still wearing a pack. The light vanishes when you touch the body, but the pack holds rations and a sealed jar of clean water.', effect: async () => { Resources.modify('food', 3); Resources.modify('water', 12); } },
        { name: 'Crocodile Throne', desc: 'A flat rock in the center of a lagoon serves as a basking spot for a crocodile larger than your horse. It slides into the water as you approach, leaving behind scales that have dried to the consistency of iron. You pry one loose and find that merchants pay dearly for armor made from swamp-dragon hide.', effect: async () => { Resources.modifyGold(Utils.randInt(15, 25)); } }
    ],
    'Desert': [
        { name: 'Sandstorm', desc: 'Grit fills your eyes and lungs. The storm arrives without warning, a wall of ochre that swallows the sun and turns day to twilight. You wrap your face in cloth and huddle behind a dune, but the sand finds every gap, every opening, and scrubs your skin raw. When it passes, you are a statue of dust.', effect: async () => { Resources.modifyHealth(-8); Resources.modify('water', -2); } },
        { name: 'Oasis', desc: 'Palm trees shade a hidden pool. You smell it before you see it: green life in a world of gold. The water is sweet and cold, and the dates hanging overhead are ripe and sticky. You drink until your belly rounds, and you fill every skin while dragonflies the size of sparrows watch from the reeds.', effect: async () => { Resources.modify('water', 32); Resources.modify('food', 5); } },
        { name: 'Ruined Caravan', desc: 'A merchant\'s bones and his wares. The skeleton still wears silk, and the cart still holds bolts of cloth turned to dust, but the strongbox beneath the driver\'s seat is iron and has survived the sun. You break the lock and find gold enough to buy a kingdom, or at least a better sword.', effect: async () => { Resources.modifyGold(Utils.randInt(10, 25)); Resources.modify('supplies', 2); } },
        { name: 'Salt Flat Mirage', desc: 'The heat haze shows you a city of spires and gardens, and you walk toward it for hours before your companion tackles you at the edge of a sinkhole. The city was never there, but the hole is real, and at the bottom lies the wreck of an airship, its canvas rotted but its brass fittings still bright.', effect: async () => { Resources.modifyGold(Utils.randInt(15, 30)); Resources.modify('supplies', 1); } },
        { name: 'Scorpion Den', desc: 'You disturb a nest of scorpions the size of lobsters while searching for shade. They chase you across the dunes for a hundred yards before giving up, and in your flight you stumble over a sun-bleached crate stamped with a military insignia. Inside are sealed rations and a waterskin, still full.', effect: async () => { Resources.modify('food', 5); Resources.modify('water', 8); } }
    ],
    'Plains': [
        { name: 'Prairie Fire', desc: 'Smoke on the horizon approaches fast. You run before the wall of flame, lungs burning, legs pumping, until you reach a creek wide enough to stop the spread. You lie in the water with only your nose above the surface as the fire passes overhead, and when you rise the world is black and warm and quiet.', effect: async () => { Resources.modifyHealth(-5); advanceDays(1); } },
        { name: 'Nomad Camp', desc: 'Travelers share stories and stew. They are riding horses with braided manes and they wear wool in colors that do not exist in cities. They invite you to their fire without asking your name, and the stew is thick with barley and mutton. They tell you the dragon was seen three days ahead, flying west.', effect: async () => { Resources.modify('food', 5); Resources.modifyHealth(5); } },
        { name: 'Standing Stones', desc: 'Monoliths older than memory. They are arranged in a circle that hums when the wind blows from the north, and the grass inside the circle is a different shade of green than the grass outside. You gather herbs that grow only in the shadow of the stones, and you leave before the sun sets because the circle feels like a door.', effect: async () => { Resources.modify('herbs', 3); } },
        { name: 'Bison Graveyard', desc: 'A valley holds the bones of a hundred bison, piled like bleached timber. The smell is ancient, dry, and somehow holy. You find flint tools among the ribs, and a pouch of dried meat preserved by the salt in the soil. The crows here are fat and fearless, and they watch you with the patience of undertakers.', effect: async () => { Resources.modify('food', 6); Resources.modify('supplies', 1); } },
        { name: 'Wagon Circle', desc: 'A circle of burned wagons tells the story of a battle you are glad you missed. The defenders fought to the last, and their bones are still armed. You gather arrows from the ground, patch a torn waterskin, and take a cookpot that has been blackened by a hundred meals. The dead do not mind.', effect: async () => { Resources.modify('supplies', 2); Resources.modify('water', 4); } }
    ],
    'Tundra': [
        { name: 'Blizzard', desc: 'Whiteout conditions blind you. The snow falls sideways, driven by a wind that screams like a thing alive. You tie yourself to your companion with a rope so you do not lose each other, and you walk in circles until you find a snow cave already dug by some animal. You huddle inside, sharing warmth, while the storm tries to bury the world.', effect: async () => { Resources.modifyHealth(-10); Resources.modify('wood', 2); } },
        { name: 'Frozen Lake', desc: 'Fish flash beneath the ice. The surface is black glass, and when you strike it with an axe the hole steams like a wound. The fish are pale and fat, and they taste of clean water and patience. You eat them raw because the cold has already cooked them, and you save the rest for the trail ahead.', effect: async () => { Resources.modify('food', 8); } },
        { name: 'Icebound Ship', desc: 'A vessel locked in the frost. It is a whaler from a northern kingdom, its sails turned to rags and its hull split by ice. You board it through a hole in the side and find the captain\'s log, his silver flask, and a chest of trade goods frozen solid. You chip out what you can carry and leave the rest for the next thaw.', effect: async () => { Resources.modifyGold(Utils.randInt(20, 50)); } },
        { name: 'Mammoth Tusk', desc: 'A tusk the size of a tent post juts from the permafrost, ivory still white beneath the dirt. You spend half a day digging it free with a makeshift spade, and when it comes loose it hums against your palms like a tuning fork. A trader in the mountains pays triple its weight in gold for ivory from the deep ice.', effect: async () => { Resources.modifyGold(Utils.randInt(30, 60)); } },
        { name: 'Aurora Cave', desc: 'A cave mouth faces north, and inside the walls are painted with minerals that glow in the dark. The aurora outside is so bright it illuminates the cave even at midnight, and you sleep on a bed of moss that has not seen a footprint in centuries. You dream of stars, and wake with frost in your hair and gold in your hand.', effect: async () => { Resources.modifyHealth(10); Resources.modifyGold(Utils.randInt(10, 20)); } }
    ],
    'Jungle': [
        { name: 'Canopy Trap', desc: 'A vine snare catches your ankle. You are hoisted upside down before you can draw breath, and the blood rushes to your head as you spin. You cut yourself down with a knife throw that almost misses, and you land badly on a root that leaves a bruise the color of a plum. The trap was meant for boar, but it works on fools too.', effect: async () => { Resources.modifyHealth(-7); } },
        { name: 'Monkey Troop', desc: 'Curious primates lead you to fruit. They chatter and swing from branch to branch, looking back to make sure you follow. You do, because they know where the water is, and because their eyes are too clever to ignore. They vanish when you reach the grove, but the mangoes are real and ripe and dripping with sweetness.', effect: async () => { Resources.modify('food', 6); } },
        { name: 'Overgrown Temple', desc: 'Vines part to reveal gold eyes. Stone guardians flank a doorway that leads into darkness, and inside the air is cool and smells of incense that has not burned in a thousand years. You take a golden mask from the altar, and herbs from the garden that has overgrown the courtyard, and you do not look behind you when the vines rustle.', effect: async () => { Resources.modifyGold(Utils.randInt(15, 35)); Resources.modify('herbs', 2); } },
        { name: 'Giant Waterfall', desc: 'The river simply ends, dropping into a void of mist and rainbows. The roar is so loud you must shout to be heard, and the spray so thick you are soaked before you reach the edge. Behind the curtain of water you find a cave where someone has stored dried fish, fire-starting kits, and a waterproof map to the lower trail.', effect: async () => { Resources.modify('food', 4); Resources.modify('supplies', 2); } },
        { name: 'Strangler Fig', desc: 'A tree has been entirely consumed by a fig, its host rotted away until only the fig remains, hollow at the core. You climb inside and find a nest built by someone who lived here once: a hammock of vines, a clay stove, and a stash of jungle medicines that the rain has not touched. You thank the tree and take what you need.', effect: async () => { Resources.modify('herbs', Utils.randInt(3, 5)); Resources.modifyHealth(5); } }
    ]
};

const WEATHER_TYPES = [
    { name: 'Clear', effect: 'none', desc: 'The skies are clear. Sunlight pours down in a flood of gold, warming the stones and drawing steam from the damp earth. It is the kind of day that makes you believe the world is not your enemy, even if you know better.' },
    { name: 'Rain', effect: 'slow', desc: 'Rain soaks the ground, slowing travel. It starts as a drizzle and builds to a steady pour that finds every hole in your cloak and every crack in your boots. The trail becomes mud that sucks at your heels, and the world smells of wet stone and regret.' },
    { name: 'Storm', effect: 'danger', desc: 'Lightning splits the sky. Travel is perilous. Thunder rolls across the land like cannon fire, and the wind carries hail that stings any skin left exposed. You walk with your shoulders hunched and your eyes half-closed, hoping the next flash does not show you something worse than the storm.' },
    { name: 'Heat Wave', effect: 'thirst', desc: 'The heat is oppressive. Water consumption doubles. The air shimmers above the ground, and every breath feels like inhaling soup. Your tongue sticks to the roof of your mouth, and the sun is a hammer that strikes the crown of your head with every step.' },
    { name: 'Fog', effect: 'hidden', desc: 'Thick fog limits visibility. It rises from the ground like breath from a sleeping giant, swallowing landmarks and distances until you can barely see your own hand. Sounds are muffled, directions meaningless, and every shadow in the gray could be a friend or a predator.' },
    { name: 'Snow', effect: 'slow', desc: 'Snowdrifts make the path treacherous. The flakes fall soft as feathers but accumulate into walls of white that hide holes, roots, and ice. Your breath freezes in your mustache, and the silence is so complete you can hear your own heartbeat echoing in your ears.' },
    { name: 'Hail', effect: 'danger', desc: 'Ice falls from the sky in pellets the size of marbles. They rattle off your armor like musket balls and leave welts on any skin left bare. You pull your hood low and walk with one arm shielding your face, counting the bruises you will discover by firelight.' },
    { name: 'Dust Storm', effect: 'slow', desc: 'The wind lifts the desert itself and hurls it at you. Grit fills every fold of cloth, every seam of leather, and every line on your face. You wrap your face until only your eyes show, and even they burn, and the world beyond your nose is simply brown.' },
    { name: 'Mist', effect: 'hidden', desc: 'A silver mist hangs in the valleys, neither thick enough to stop you nor thin enough to ignore. It beads on your hair and drips down your collar, and every tree looks like a figure watching. You walk faster than you mean to, and you do not know why.' },
    { name: 'Overcast', effect: 'none', desc: 'The sky is a single sheet of gray from horizon to horizon. No sun, no shadow, no sense of time passing. It is warm enough to travel but cold enough to make you wish for a fire, and the light is flat and dead and makes the world look like a painting of itself.' },
    { name: 'Sleet', effect: 'danger', desc: 'Rain turns to ice before it hits the ground, coating every surface in a glaze that snaps twigs and bends grass. You slip twice, catch yourself once, and the third time you fall hard enough to bruise your pride and your hip. The world is a crystal that hates you.' },
    { name: 'Calm After Storm', effect: 'none', desc: 'The storm has passed and left the world washed clean. The air smells of ozone and wet earth, and puddles reflect the sky like mirrors dropped from heaven. Birds return to the trees and you return to the trail, both of you cautious, both of you grateful.' }
];

const SCOUTING_EVENTS = [
    { name: 'Herb Patch', description: 'You discover a patch of medicinal herbs growing in the shade of a fallen log. The leaves are broad and silver-veined, and when you crush one between your fingers it smells of camphor and old winters. You harvest carefully, leaving the smallest shoots to spread, and walk away with a fistful of remedies.', effect: async () => { Resources.modify('herbs', Utils.randInt(3, 6)); } },
    { name: 'Fresh Water', description: 'You find a clear stream threading between mossy stones, so cold it makes your teeth ache. The water tastes of minerals and something older than iron. You fill every skin and bladder you have, and splash your face until the dust of the trail is nothing but memory.', effect: async () => { Resources.modify('water', Utils.randInt(8, 16)); } },
    { name: 'Animal Tracks', description: 'You spot tracks leading to a hunting ground: deer hooves pressed into soft mud, still holding water from this morning. You follow them to a clearing where the grass is cropped short and the droppings are fresh. The hunt is brief, and the meat is lean and sweet.', effect: async () => { Resources.modify('food', Utils.randInt(5, 10)); } },
    { name: 'Bandit Camp', description: 'You scout a bandit camp from afar, counting six bedrolls around a fire that has burned to coals. They are gone, perhaps hunting, perhaps raiding. You slip in and take what they left behind: a half-full waterskin, a bag of dried apples, and a dagger with a cracked handle.', effect: async () => { Resources.modify('water', 4); Resources.modify('food', 2); } },
    { name: 'Hidden Path', description: 'A shortcut reveals itself when a branch snaps back into place, showing a cleft in the rock you would have walked past a hundred times. It is narrow and dark and smells of bats, but it emerges onto the main road two hours later. You make better time than you dared hope.', effect: async () => { travelMiles(Utils.randInt(10, 25)); } },
    { name: 'Old Shrine', description: 'An old shrine restores your spirit. It is nothing more than three stacked stones and a wooden bowl that holds rainwater, but someone has left fresh flowers and a pinch of salt. You kneel without knowing why, and when you rise the weight on your shoulders feels lighter.', effect: async () => { Resources.modifyHealth(Utils.randInt(5, 15)); } },
    { name: 'Treasure Cache', description: 'You find hidden treasure in a hollow tree marked with a symbol you do not recognize: a crescent moon inside a square. Inside is a leather bag heavy with silver coins, a ring set with cloudy amber, and a note that says "For the next traveler who needs it more than I do."', effect: async () => { Resources.modifyGold(Utils.randInt(10, 25)); } },
    { name: 'Broken Cart', description: 'A broken cart has scattered supplies across a slope of loose shale. The axle is splintered, the horse is bones, and the driver is nowhere. You pick through the wreckage with a heavy heart, finding sealed jars of preserves and a bolt of canvas that will patch your tent.', effect: async () => { Resources.modify('supplies', Utils.randInt(1, 3)); } },
    { name: 'Wildfire Smoke', description: 'Smoke in the distance delays you. The wind shifts and carries the smell of burning pine and cooked meat, and you know the fire is closer than you thought. You backtrack to a streambed and wait until nightfall, when the glow on the horizon finally fades.', effect: async () => { await advanceDays(1); } },
    { name: 'Friendly Wanderer', description: 'A wanderer shares food beside a fire he built from driftwood. He does not give his name and you do not ask. He roasts tubers wrapped in clay and offers you salt from a tin stamped with a foreign seal. You eat in silence, and in the morning he is gone before you wake.', effect: async () => { Resources.modify('food', Utils.randInt(2, 5)); } },
    { name: 'Dangerous Terrain', description: 'Rough terrain injures you. A scree slope gives way beneath your heel and you slide ten feet before catching a root that tears free in your hand. The cut on your palm is shallow but bleeds through your glove. You bind it with a strip torn from your shirt and limp onward.', effect: async () => { Resources.modifyHealth(-10); } },
    { name: "Scout's Luck", description: 'Nothing of note today. The land is flat and brown and offers no shade, no water, no shelter. You walk until your shadow is longer than your patience, and make camp in a place that looks exactly like every other place you have seen. The night is quiet.', effect: async () => { Terminal.println('The area is quiet.', 'cyan'); } },
    { name: 'Overgrown Orchard', description: 'You stumble upon an orchard planted by hands long dead. The trees are gnarled and heavy with fruit that has gone small and bitter with neglect. You gather what you can reach, dodging bees and thorns, and fill your pockets with hard little apples that soften when stewed.', effect: async () => { Resources.modify('food', Utils.randInt(4, 7)); } },
    { name: 'Cairn Marker', description: 'A cairn of flat stones marks a hidden spring you would have missed entirely. The water bubbles up through white gravel, so clear you can count the pebbles on the bottom. You drink until your stomach sloshes, then fill every container and build your own cairn beside the first.', effect: async () => { Resources.modify('water', Utils.randInt(10, 18)); } },
    { name: 'Abandoned Snare', description: 'An abandoned snare hangs empty in a thicket, the rope frayed but the trigger still sound. You reset it with fresh cord and bait it with a scrap of dried fruit from your pack. By dusk it has caught a hare, and you dine on meat that tastes of patience and luck.', effect: async () => { Resources.modify('food', Utils.randInt(3, 6)); } },
    { name: 'Fungal Bloom', description: 'A rotted stump erupts with mushrooms the color of old parchment, each cap broad as a saucer. You recognize them from a drawing in the herbalist\'s manual: edible, savory, and rich enough to replace meat in a stew. You cut them at the stem and carry them like a bouquet.', effect: async () => { Resources.modify('food', Utils.randInt(3, 6)); Resources.modify('herbs', Utils.randInt(1, 2)); } },
    { name: 'Beehive', description: 'A hollow oak hums with industry. You smoke the bees out with a green branch, wincing at every sting, and scrape out combs of dark honey so rich it tastes like liquid sunlight. The sweetness stays on your tongue for miles, and the wax seals a dozen minor wounds.', effect: async () => { Resources.modify('food', Utils.randInt(5, 8)); } },
    { name: 'Fallen Merchant', description: 'You find a merchant sprawled beside his overturned pack mule, victim of a fever rather than violence. His wares are scattered: salt, needles, a flask of oil, and a small iron cookpot. You take what you need and cover him with his own tarp, saying words his gods might hear.', effect: async () => { Resources.modify('supplies', Utils.randInt(2, 4)); Resources.modifyGold(Utils.randInt(5, 10)); } },
    { name: 'Signal Fire', description: 'A column of smoke draws you to a ridge where a signal fire still smolders. The builders are gone, but they left behind a cache of wood, a waterskin, and a note begging rescue. You take the wood and water, and add your own note beneath theirs: "I am also walking toward the dragon."', effect: async () => { Resources.modify('wood', Utils.randInt(3, 6)); Resources.modify('water', 8); } },
    { name: 'Collapsed Tent', description: 'A tent collapsed beneath snow or time, its canvas still good beneath the rot of its poles. You cut away the mildewed edges and salvage enough waterproof cloth to patch your own gear. Beneath the tent you find a cooking knife and a tin of tea leaves, still fragrant.', effect: async () => { Resources.modify('supplies', Utils.randInt(1, 2)); Resources.modify('food', 1); } }
];

function changeWeather() {
    const biome = GameState.journey.currentBiome.toLowerCase();
    let candidates = [...WEATHER_TYPES];
    if (biome.includes('desert')) candidates = candidates.filter(w => w.name !== 'Snow' && w.name !== 'Rain');
    if (biome.includes('tundra') || biome.includes('mountain')) candidates = candidates.filter(w => w.name !== 'Heat Wave');
    if (biome.includes('swamp')) candidates = candidates.filter(w => w.name !== 'Snow');
    const next = Utils.choice(candidates);
    GameState.data.weather = { condition: next.name, duration: Utils.randInt(1, 3) };
    Terminal.println(`\nThe weather changes: ${next.name}. ${next.desc}`, 'cyan');
    GameState.addJournalEntry(`Weather changed to ${next.name}.`);
}

function applyWeatherEffects() {
    const weather = GameState.data.weather;
    const difficulty = GameState.data.difficulty;
    const stormDamage = { 0: -3, 1: -5, 2: -8, 3: -12 };
    const heatDrain = { 0: 0, 1: -1, 2: -2, 3: -3 };
    const fogChance = { 0: 0.10, 1: 0.15, 2: 0.25, 3: 0.35 };
    switch (weather.condition) {
        case 'Storm':
        case 'Hail':
        case 'Sleet':
            const dmg = stormDamage[difficulty] || -5;
            Resources.modifyHealth(dmg);
            Terminal.println(`The storm lashes you. ${dmg} HP.`, 'red');
            break;
        case 'Heat Wave':
        case 'Dust Storm':
            const drain = heatDrain[difficulty] || -1;
            if (drain < 0) {
                Resources.modify('water', drain);
                Terminal.println(`The heat drains you. ${drain} water.`, 'yellow');
            } else {
                Terminal.println('The heat is fierce, but you manage your water carefully.', 'green');
            }
            break;
        case 'Fog':
        case 'Mist':
            if (Math.random() < (fogChance[difficulty] || 0.15)) {
                Terminal.println('You stumble in the fog and lose time.', 'yellow');
                return false; // signals reduced miles
            }
            break;
        case 'Snow':
            if (difficulty >= 2) {
                Resources.modifyHealth(-3);
                Terminal.println('The snow bites deeper than it should. -3 HP.', 'red');
            }
            break;
    }
    return true;
}

function getWeatherCombatMod() {
    const weather = GameState.data.weather.condition;
    if (weather === 'Rain') return -1;
    if (weather === 'Fog') return -2;
    if (weather === 'Clear') return +1;
    return 0;
}

function getNextBiome() {
    const current = GameState.journey.currentBiome;
    const connections = Config.BIOME_CONNECTIONS[current];
    if (!connections || connections.length === 0) return current;
    return Utils.choice(connections);
}

function travelMiles(amount) {
    GameState.journey.totalMilesTraveled = Math.min(Config.TOTAL_MILES, GameState.journey.totalMilesTraveled + amount);
    if (GameState.journey.totalMilesTraveled >= Config.TOTAL_MILES) {
        GameState.journey.dragonEncountered = true;
    }
}

async function advanceTime() {
    GameState.data.time.day++;
    if (GameState.data.time.day > 30) {
        GameState.data.time.day = 1;
        const monthIndex = Config.MONTHS.indexOf(GameState.data.time.month);
        if (monthIndex >= Config.MONTHS.length - 1) {
            GameState.data.time.month = Config.MONTHS[0];
            GameState.data.time.year++;
        } else {
            GameState.data.time.month = Config.MONTHS[monthIndex + 1];
        }
    }
}

async function advanceDays(days) {
    for (let i = 0; i < days; i++) {
        await advanceTime();
        let foodCost = 1, waterCost = 1;
        if (GameState.data.difficulty === 0) { if (Math.random() < 0.5) foodCost = 0; if (Math.random() < 0.5) waterCost = 0; }
        if (GameState.data.difficulty >= 2 && i > 0 && i % 3 === 0) { foodCost++; if (GameState.data.difficulty === 3) waterCost++; }
        if (GameState.data.skill === 'Sated') { foodCost = Math.max(0, foodCost - 1); waterCost = Math.max(0, waterCost - 1); }
        if (foodCost > 0) Resources.modify('food', -foodCost);
        if (waterCost > 0) Resources.modify('water', -waterCost);
        if (GameState.resources.food <= 0 || GameState.resources.water <= 0) {
            Terminal.println('You have run out of supplies and perished!', 'red');
            await handleGameOver('starvation');
            return;
        }
    }
}

async function checkMiniBossEncounter() {
    if (GameState.journey.totalMilesTraveled >= 500 && !GameState.journey.miniBossDefeated) {
        GameState.journey.miniBossDefeated = true;
        GameState.addJournalEntry('Encountered MisLefrak the Malevolent at mile 500!');
        await handleMiniBossFight();
        await handlePostMinibossMerchant();
    }
}

async function checkCrossroads() {
    const miles = GameState.journey.totalMilesTraveled;
    const crossroads = GameState.journey.crossroadsMet;
    for (const milestone of [250, 500, 750]) {
        if (miles >= milestone && !crossroads[milestone]) {
            crossroads[milestone] = true;
            await handleCrossroads(milestone);
        }
    }
}

async function handleCrossroads(milestone) {
    Terminal.println(`\n*** CROSSROADS AT MILE ${milestone} ***`, 'magenta', true);
    await Terminal.showAsciiArt('crossroads', 'yellow', true);

    if (milestone === 250) {
        Terminal.println('\nThe road splits before you.', 'white');
        Terminal.println('1. Take the High Pass (risky but rewarding)');
        Terminal.println('2. Take the Low Road (safe but slow)');
        const choice = await Terminal.inputNumber('Choose (1-2): ', 1, 2);
        if (choice === 1) {
            const roll = Utils.rollD20() + GameState.player.survival;
            if (roll >= 15) {
                Terminal.println('You navigate the treacherous pass and find hidden treasure!', 'green');
                Resources.modifyGold(Utils.randInt(20, 50));
                Resources.modify('herbs', Utils.randInt(2, 5));
                GameState.addJournalEntry('Took the High Pass at mile 250. Found treasure!');
            } else {
                Terminal.println('A rockslide! You are injured but press on.', 'red');
                Resources.modifyHealth(-15);
                GameState.addJournalEntry('Took the High Pass at mile 250. Injured by a rockslide.');
            }
        } else {
            Terminal.println('The Low Road is calm. You find fresh water and rest.', 'green');
            Resources.modify('water', 16);
            Resources.modifyHealth(10);
            GameState.addJournalEntry('Took the Low Road at mile 250. Found water and rest.');
        }
    } else if (milestone === 500) {
        Terminal.println('\nA wandering seer blocks your path.', 'white');
        Terminal.println('1. Accept her blessing (costs 20 gold, +max HP)');
        Terminal.println('2. Decline and continue');
        const choice = await Terminal.inputNumber('Choose (1-2): ', 1, 2);
        if (choice === 1) {
            if (GameState.resources.gold >= 20) {
                Resources.modifyGold(-20);
                GameState.player.maxHealth += 10;
                GameState.player.health += 10;
                Terminal.println('The seer chants in a dead tongue. You feel stronger.', 'green');
                GameState.addJournalEntry('Accepted the seer\'s blessing at mile 500. Gained +10 max HP.');
            } else {
                Terminal.println('You cannot afford the blessing. The seer vanishes.', 'yellow');
                GameState.addJournalEntry('Met a seer at mile 500 but could not afford her blessing.');
            }
        } else {
            Terminal.println('You walk past. The seer says nothing.', 'cyan');
            GameState.addJournalEntry('Declined the seer\'s offer at mile 500.');
        }
    } else if (milestone === 750) {
        Terminal.println('\nYou find a wounded knight beside a dead beast.', 'white');
        Terminal.println('1. Give him herbs and supplies (+relationship if companion, +karma)');
        Terminal.println('2. Take his enchanted sword and leave him');
        const choice = await Terminal.inputNumber('Choose (1-2): ', 1, 2);
        if (choice === 1) {
            if (GameState.resources.herbs >= 2 && GameState.resources.supplies >= 1) {
                Resources.modify('herbs', -2);
                Resources.modify('supplies', -1);
                Terminal.println('The knight thanks you and gives you his shield.', 'green');
                const shield = new Armor('Knight\'s Shield', 'shield', 3, 8, 0);
                GameState.player.equippedArmor.shield = shield;
                GameState.player.armor.shield = shield;
                GameState.player.acBonus = Object.values(GameState.player.equippedArmor).filter(a => a).reduce((sum, a) => sum + a.acBonus, 0);
                Resources.updateCarryWeight();
                if (GameState.companion) {
                    GameState.companion.modifyRelationship(+15);
                    Terminal.println(`${GameState.companion.name} respects your compassion.`, 'green');
                }
                GameState.addJournalEntry('Saved a wounded knight at mile 750. Received his shield.');
            } else {
                Terminal.println('You have nothing to give. The knight nods sadly.', 'yellow');
                GameState.addJournalEntry('Met a wounded knight at mile 750 but had no supplies to help.');
            }
        } else {
            const cursedSword = new Weapon('Cursed Blade', [20, 35], 5, 0, 4);
            GameState.player.equippedWeapon = cursedSword;
            GameState.player.weapons.push(cursedSword);
            Terminal.println('You take the sword. It hums with dark energy.', 'red');
            Terminal.println('You feel... watched.', 'red');
            GameState.addJournalEntry('Stole a cursed blade from a dying knight at mile 750.');
        }
    }
    await Terminal.pause();
}

async function triggerRandomEncounter(encounterNamesOnDays, day) {
    const roll = Math.random();
    const currentDay = day || GameState.data.time.day;
    if (GameState.data.nemeses.length > 0 && Math.random() < 0.12) {
        const nemesisData = GameState.data.nemeses.shift();
        const nemesis = new Enemy(nemesisData.name, nemesisData.ac, nemesisData.hp, nemesisData.atkModifier, nemesisData.dprRange, nemesisData.xp);
        Terminal.println(`\n*** A wounded enemy ambushes you! ***`, 'red', true);
        Terminal.println(`The ${nemesisData.name} has returned for revenge!`, 'red');
        GameState.addJournalEntry(`Ambushed by a vengeful ${nemesisData.name}!`);
        GameState.data.pendingEnemy = nemesis;
        GameState.data.encounterTriggered = true;
        GameState.data.lastEncounterDay = currentDay;
        return;
    }
    if (roll < GameState.data.encounterChance) {
        GameState.data.encounterChance = 0.01;
        const biome = GameState.journey.currentBiome;
        const types = ['FLORA', 'FAUNA', 'HUMANOID', 'TYPICAL'];
        const encounterType = Utils.choice(types);
        const enemy = getRandomEncounter(biome, encounterType);
        if (enemy) {
            GameState.data.pendingEnemy = enemy;
            GameState.data.encounterTriggered = true;
            GameState.data.lastEncounterDay = currentDay;
        }
    } else {
        GameState.data.encounterChance = Math.min(0.4, GameState.data.encounterChance + 0.02);
    }
}

const FOUND_OBJECTS = [
    { name: 'Cracked Compass', desc: 'It points south no matter which way you face. You shake it, tap it, hold it to your ear, but the needle sleeps. Still, the brass casing is worth something to a collector, and you pocket it with a shrug.', effect: () => { Resources.modifyGold(5); } },
    { name: 'Tattered Map', desc: 'A map to a hidden cache... or a trap. The ink has bled in the rain, leaving smears where landmarks should be. You follow it half in hope, half in dread, and find a rotted crate beneath a lightning-split oak. Inside are supplies wrapped in oiled cloth, still dry.', effect: () => { Resources.modify('supplies', Utils.randInt(2, 4)); } },
    { name: 'Silver Locket', desc: 'Inside is a portrait of someone you do not recognize. A young woman with sad eyes and a crown of daisies. The chain is tarnished but intact, and the silver itself is worth a few coins to the right buyer. You close it gently, feeling strangely guilty.', effect: () => { Resources.modifyGold(10); } },
    { name: 'Old Journal', desc: 'The last entry reads: "Do not trust the seer." The pages before it detail a doomed love affair, a stolen horse, and a recipe for poultices that actually works. You tear out the useful pages and stuff them into your pack, leaving the rest for the wind.', effect: () => { Resources.modify('herbs', 2); } },
    { name: 'Rusty Key', desc: 'Too large for any door you have seen. It is forged from black iron and heavy as a dagger, with teeth that look almost deliberate, almost cruel. You keep it because throwing it away feels like tempting fate.', effect: () => { Resources.modifyGold(3); } },
    { name: 'Dragon Scale', desc: 'Warm to the touch. The beast is near. The scale is the size of your palm, iridescent as oil on water, and it thrums with a rhythm like a second heartbeat. You wrap it in cloth before it burns a brand into your skin.', effect: () => { Resources.modifyHealth(5); } },
    { name: 'Broken Sword', desc: 'The name "Ser Aldric" is etched on the blade. The steel is snapped three inches from the hilt, but the grip is wrapped in good leather and the crossguard is solid silver. You strip it for parts and find two good lengths of seasoned wood beneath the binding.', effect: () => { Resources.modify('wood', 2); } },
    { name: 'Strange Idol', desc: 'Carved from bone. It whispers when no one is near. The whispers are not words but intentions: hunger, longing, warning. You stuff it deep in your pack and try not to dream about it, though you know you will.', effect: () => { Resources.modifyGold(Utils.randInt(5, 15)); } },
    { name: 'Potion Vial', desc: 'It glows faintly green. The glass is thick and cold, and the liquid inside swirls on its own, as if searching for an exit. You cork it carefully and mark it with a strip of red cloth so you do not mistake it for water in the dark.', effect: () => { GameState.combat.potions += 1; } },
    { name: 'Weathered Letter', desc: '"Meet me at mile 750. Bring herbs. -K" The paper is foxed and brittle, the ink faded to the color of dried blood. You wonder if K waited, if they came, if they are still waiting. You fold the letter and keep it like a prayer.', effect: () => { Resources.modify('herbs', 1); } },
    { name: 'Dried Flower Crown', desc: 'Pressed between the pages of a waterlogged book, a crown of dried forget-me-nots crumbles at your touch. The book is blank except for a single line on the last page: "She wore this on the day the dragon came." You close the book and keep both.', effect: () => { Resources.modifyHealth(3); } },
    { name: 'Iron Shoe', desc: 'A horseshoe of cold iron, nailed to a stake driven into the trail itself. The nails are rusted to dust, but the shoe gleams as if freshly forged. Local legend says iron turns aside evil. You pry it free and nail it to your own boot heel.', effect: () => { Resources.modifyGold(8); } },
    { name: 'Child\'s Toy', desc: 'A wooden knight on a wheeled platform, painted in faded gold and blue. The paint is chipped, the sword arm is missing, but the wheels still turn. You find it in a hollow tree, wrapped in a shawl that smells of lavender and smoke. You carry it without knowing why.', effect: () => { Resources.modify('supplies', 1); } },
    { name: 'Merchant\'s Ledger', desc: 'A leather-bound ledger recording thirty years of trades, debts, and betrayals. The final pages are burned, but the earlier entries name three secret caches along the trail and a merchant in the Swamp who pays double for silver dust. You tear out the map and the debts.', effect: () => { Resources.modifyGold(Utils.randInt(10, 20)); } },
    { name: 'Obsidian Arrowhead', desc: 'Black glass knapped to a wicked edge, strung on a cord of human hair. It is too fine for hunting and too dark for ceremony. You wrap it in leather and wear it around your neck, hoping it wards more than it attracts.', effect: () => { Resources.modifyGold(6); } },
    { name: 'Half-Eaten Ration', desc: 'A wax-paper parcel tucked beneath a stone, containing dried meat and hardtack that something nibbled before you arrived. The teeth marks are small, maybe squirrel, maybe not. You eat around the damage because waste is a sin on the trail.', effect: () => { Resources.modify('food', 2); } },
    { name: 'Fishing Hook', desc: 'A bronze hook wrapped in silk thread, found in the pocket of a skeleton wedged between two boulders. The skeleton wears a ring you cannot remove, but the hook is worth more than the ring. You say a few words before you take it.', effect: () => { Resources.modifyGold(4); } },
    { name: 'Singed Feather', desc: 'A feather as long as your forearm, black at the root and gold at the tip, smelling of sulfur and something sweeter. You found it in a crater of cooling glass, as if a phoenix had fought a lightning bolt and lost. It tingles against your palm.', effect: () => { Resources.modify('herbs', 1); } },
    { name: 'Copper Bell', desc: 'No bigger than a walnut, engraved with a script that slides away from your eyes like water off oil. It does not ring when you shake it, but your horse spooks and your companion crosses themselves. You pack it in wool and try to forget the silence it makes.', effect: () => { Resources.modifyGold(7); } },
    { name: 'Stone Dice', desc: 'A pair of dice carved from granite, the pips inlaid with silver. They are too heavy for games, too crude for art. You roll them once and they both show snake eyes. You do not roll them again, but you keep them because throwing them away feels like a dare.', effect: () => { Resources.modifyGold(5); } }
];

const WHISPERS = {
    'Forest': [
        'The wind through the leaves sounds almost like laughter. You cannot find its source.',
        'Something large moves in the canopy above. The branches sway, but no bird takes flight.',
        'You catch the scent of rot beneath the pine. It is too sweet, like fruit left in a closed room.',
        'A crow watches you from a dead branch. It does not blink, and it does not look away when you stare back.',
        'Moss grows thick on the north side of every tree, except one. That one faces south.',
        'You find a footprint in the mud that is not yours, not your companion\'s, and not any animal you know.',
        'The forest is silent in a circle ten paces across. Outside the circle, birds sing. Inside, nothing.',
        'A tree has been struck by lightning and split open. The wood inside is still warm.',
        'You hear drums in the distance, slow and deliberate. They stop when you call out.',
        'A rope swing hangs from a branch over a dry creek. The rope is new. The creek has been dry for years.'
    ],
    'Mountain': [
        'The altitude makes your ears pop. Or was that a voice?',
        'You hear rockfall in the distance. Or footsteps. The echoes play tricks.',
        'The cold seeps through your armor like fingers. It finds the gaps you thought you had sealed.',
        'A goat\'s bell echoes from somewhere you cannot see. You have not seen a goat in days.',
        'The peak ahead is wreathed in cloud. The cloud looks almost like a hand, beckoning.',
        'You find a cairn that has been added to since yesterday. You are certain no one passed you.',
        'The snow here is stained pink. You tell yourself it is only algae.',
        'A pair of eyes glints from a cave mouth. When you raise your torch, they are gone.',
        'Your shadow on the cliff face moves a half-second slower than you do.',
        'The wind carries the smell of woodsmoke from a valley too far below to be possible.'
    ],
    'Swamp': [
        'Bubbles rise from the black water. Then stop. Then start again, closer.',
        'You hear splashing. Nothing is there. The ripples spread outward from a single point.',
        'The mist carries the smell of copper and old flowers. It makes you dizzy.',
        'A will-o-wisp flickers and vanishes. You tell yourself it was only marsh gas.',
        'A tree trunk is covered in fingernail scratches, deep and fresh. They go up as high as a man can reach.',
        'The water is so still it reflects the stars perfectly, even though the sky is overcast.',
        'You find a boot, laces still tied, half-submerged in the peat. There is no foot inside.',
        'Something calls your name from the fog. Your companion swears they heard nothing.',
        'Fireflies drift in patterns that spell words you almost recognize.',
        'A raft of driftwood floats past, and on it sits a wooden doll with no face. It turns its head as it passes.'
    ],
    'Desert': [
        'The sand shifts in patterns that look almost deliberate. You step around them.',
        'You hear your name on the wind. No one is near. The wind does not stop.',
        'The sun seems to lean closer than it should. Your shadow is shorter at noon than it was at dawn.',
        'A skull half-buried in the dune grins at you. The teeth are too white for its age.',
        'You find a trail of water in the sand, as if something heavy and wet had dragged itself along.',
        'The dunes sing a low hum that vibrates in your chest. It sounds almost like a lullaby.',
        'A cactus blooms with flowers the color of fresh meat. The smell attracts flies, not bees.',
        'You see your own footprints ahead of you, as if you had already walked this way tomorrow.',
        'The horizon shimmers, and for a moment you see a city where you know there is only salt flat.',
        'A stone has been placed on top of another stone, and another on top of that, forming a tower no wind could build.'
    ],
    'Plains': [
        'The grass whispers secrets as you pass. You cannot make out the words.',
        'You see smoke from a distant fire. It is gone when you look again, as if someone blew it out.',
        'A single flower grows where nothing else will. Its petals are the color of dried blood.',
        'The horizon shimmers. You hope it is only heat. It looks like a wall of water, rising.',
        'You find a circle of stones, each one placed with care. Inside the circle, the grass is black.',
        'The wind carries the sound of bells from a direction where no church has ever stood.',
        'A hawk circles above you for an hour, never descending, never leaving. You feel like an offering.',
        'You come upon a scarecrow in a field that has no crops. Its face is painted to look like yours.',
        'The stars tonight are too bright, and they form patterns that no astronomer has named.',
        'A well sits in the middle of the plain, its rope coiled, its bucket dry. The water table is a hundred feet down.'
    ],
    'Tundra': [
        'The silence here is so deep it hurts. Your own heartbeat sounds like an intruder.',
        'You find footprints that match your boots exactly. They lead away from camp, not toward it.',
        'Ice cracks beneath your feet, singing a low note. The lake beneath is older than the trail.',
        'The aurora dances, and for a moment you see a face. It smiles. You do not smile back.',
        'A snowdrift has buried a sled, still hitched to two dogs that have become bones and harness.',
        'The cold makes the stars look closer, as if you could reach up and rearrange them.',
        'You hear singing from the ice. It is a woman\'s voice, beautiful and sad, and it does not stop when you cover your ears.',
        'A patch of ground is free of snow, warm to the touch, and smells of sulfur. Nothing grows there.',
        'Your breath freezes in the air and hangs there, shaping itself into letters that melt before you can read them.',
        'A white hare watches you from a drift. Its eyes are not the color of any hare you have seen.'
    ],
    'Jungle': [
        'Something screams in the canopy. Then silence. Then the scream again, closer.',
        'The humidity wraps around you like a wet cloth. You can never get fully dry here.',
        'You find a trail of blood leading into the undergrowth. The leaves close behind it.',
        'A flower opens as you pass. Its pollen smells like ash. You hold your breath and walk faster.',
        'Vines hang in loops that look almost like nooses. You cut them rather than duck through.',
        'The stream you have been following suddenly flows uphill. You check your compass. It spins.',
        'A monkey drops a fruit at your feet. The fruit is split open, and inside is a tooth.',
        'The bark of every tree is carved with tally marks, as if someone has been counting the days since the beginning.',
        'Mosquitoes swarm around you, but they do not land. They hover, tasting the air, then fly away.',
        'You find a clearing where the grass is pressed flat in a spiral, as if something massive had slept there and woken.'
    ],
    'default': [
        'You feel as though you are being watched. When you turn, the watcher turns with you.',
        'A shadow moves at the edge of your vision. It is not your shadow, and it is not your companion\'s.',
        'The air tastes like metal. Like blood that has not been spilled yet.',
        'You hear breathing that is not your own. It slows when you speed up, and speeds up when you slow.',
        'For a moment, the world holds its breath. Then it exhales, and everything is normal again.',
        'A stone has been turned over recently. The dirt beneath it is still damp, still warm.',
        'You smell baking bread from a direction where no hearth has ever burned.',
        'The clouds form a shape that looks almost like a face. It watches you until the wind tears it apart.',
        'Your reflection in the water blinks when you do not.',
        'A ring of mushrooms has grown overnight around your camp. You did not hear them grow. You never do.'
    ]
};

function printWhispers() {
    const biome = GameState.journey.currentBiome;
    const list = WHISPERS[biome] || WHISPERS['default'];
    let whispers = [...list];
    if (GameState.player.health < 30) {
        whispers.push('Your wounds throb in time with a distant drum.');
        whispers.push('You cough blood into your hand. No one sees.');
    }
    if (GameState.companion && GameState.companion.hp <= 0) {
        whispers.push('The space beside you is empty. You still look there.');
    }
    if (GameState.data.time.day > 25) {
        whispers.push('The moon is wrong. You are certain of it.');
    }
    Terminal.println(`\n${Utils.choice(whispers)}`, 'dim');
}

async function checkFoundObject() {
    const foundChances = { 0: 0.12, 1: 0.08, 2: 0.06, 3: 0.04 };
    if (Math.random() < (foundChances[GameState.data.difficulty] || 0.08)) {
        const obj = Utils.choice(FOUND_OBJECTS);
        Terminal.println(`\nYou found something: ${obj.name}`, 'green');
        Terminal.println(obj.desc, 'white');
        GameState.addJournalEntry(`Found ${obj.name}: ${obj.desc}`);
        await obj.effect();
        await Terminal.pause();
    }
}

async function triggerBiomeEventChain() {
    const biome = GameState.journey.currentBiome;
    const chain = BIOME_EVENT_CHAINS[biome];
    if (!chain || Math.random() > 0.15) return;
    for (const event of chain) {
        Terminal.println(`\n${event.name}: ${event.desc}`, 'cyan');
        GameState.addJournalEntry(`Experienced ${event.name} in the ${biome}.`);
        await event.effect();
        await Terminal.pause();
    }
}

async function triggerEnvironmentalEvent() {
    if (Math.random() < 0.23) {
        const event = Utils.choice(ENVIRONMENTAL_EVENTS);
        Terminal.println(`\n${event.name}: ${event.description}`, 'yellow');
        GameState.addJournalEntry(`Experienced ${event.name}: ${event.description}`);
        if (event.type === 'positive' && typeof Audio !== 'undefined') Audio.goodEncounterSound();
        if (event.type === 'negative' && typeof Audio !== 'undefined') Audio.badEncounterSound();
        await event.effect();
        await Terminal.pause();
    }
}

async function triggerScoutingEvent() {
    if (Math.random() < 0.23) {
        const event = Utils.choice(SCOUTING_EVENTS);
        Terminal.println(`\n${event.name}: ${event.description}`, 'yellow');
        await event.effect();
        await Terminal.pause();
    }
}

async function travel() {
    Audio.playMusic('travel');
    Terminal.clear();
    const biomeKey = `biome_${GameState.journey.currentBiome.toLowerCase().replace(/\s+/g, '_')}`;
    if (typeof EXTRA_ASCII_ART !== 'undefined' && EXTRA_ASCII_ART[biomeKey]) {
        await Terminal.showAsciiArt(biomeKey, 'cyan', true);
    } else {
        await Terminal.showAsciiArt('travel', 'cyan', true);
    }

    if (GameState.data.weather.duration <= 0) changeWeather();
    const days = Utils.randInt(Config.MIN_DAYS_PER_TRAVEL, Config.MAX_DAYS_PER_TRAVEL);
    for (let d = 0; d < days; d++) {
        if (GameState.data.weather.duration <= 0) changeWeather();
        GameState.data.weather.duration--;
        let miles = Utils.randInt(Config.MIN_MILES_PER_TRAVEL, Config.MAX_MILES_PER_TRAVEL);
        const weatherOk = applyWeatherEffects();
        if (!weatherOk) miles = Math.floor(miles / 2);
        travelMiles(miles);

        let foodCost = 1, waterCost = 1;
        if (GameState.data.difficulty === 0) { if (Math.random() < 0.5) foodCost = 0; if (Math.random() < 0.5) waterCost = 0; }
        if (GameState.data.difficulty >= 2 && d > 0 && d % 3 === 0) { foodCost++; if (GameState.data.difficulty === 3) waterCost++; }
        if (GameState.data.skill === 'Sated') { foodCost = Math.max(0, foodCost - 1); waterCost = Math.max(0, waterCost - 1); }
        if (foodCost > 0) Resources.modify('food', -foodCost);
        if (waterCost > 0) Resources.modify('water', -waterCost);
        if (GameState.resources.food <= 0 || GameState.resources.water <= 0) {
            Terminal.println('You have run out of supplies and perished!', 'red');
            await handleGameOver('starvation');
            Audio.stopMusic();
            return;
        }

        await advanceTime();

        if (Math.random() < 0.3) {
            const oldBiome = GameState.journey.currentBiome;
            GameState.journey.currentBiome = getNextBiome();
            if (oldBiome !== GameState.journey.currentBiome) {
                GameState.addJournalEntry(`Entered the ${GameState.journey.currentBiome}.`);
            }
        }

        await triggerRandomEncounter(null, GameState.data.time.day);

        Terminal.println(`Day ${GameState.data.time.day}: Traveled ${miles} miles through ${GameState.journey.currentBiome}. Total: ${GameState.journey.totalMilesTraveled}/${Config.TOTAL_MILES}`, 'green');
        if (Math.random() < 0.35) printWhispers();

        await checkLegacyAtCurrentMile();
        await checkCrossroads();
        await triggerBiomeEventChain();
        await checkFoundObject();

        if (GameState.data.encounterTriggered) {
            break;
        }
    }

    await checkMiniBossEncounter();
    await checkCrossroads();

    if (!GameState.data.encounterTriggered && !GameState.data.pendingEnemy) {
        const biomeKey = `biome_${GameState.journey.currentBiome.toLowerCase().replace(/\s+/g, '_')}`;
        if (typeof EXTRA_ASCII_ART !== 'undefined' && EXTRA_ASCII_ART[biomeKey]) {
            await Terminal.showAsciiArt(biomeKey, 'cyan', true);
        } else {
            await Terminal.showAsciiArt('travel', 'cyan', true);
        }
        Terminal.println(`\n${Utils.choice(UNEVENTFUL_TRAVEL_PHRASES)}`, 'green');
    }

    Terminal.println(`\nTravel complete. Total miles: ${GameState.journey.totalMilesTraveled}/${Config.TOTAL_MILES}`);
    await Terminal.pause();
    Audio.stopMusic();
}

async function handleTravel() {
    Audio.playMusic('travel');
    Terminal.clear();
    const miles = Utils.randInt(Config.MIN_MILES_PER_TRAVEL, Config.MAX_MILES_PER_TRAVEL);
    travelMiles(miles);
    Resources.modify('food', -1);
    Resources.modify('water', -1);
    if (GameState.resources.food <= 0 || GameState.resources.water <= 0) {
        Terminal.println('You have run out of supplies and perished!', 'red');
        await handleGameOver();
        Audio.stopMusic();
        return;
    }
    await advanceTime();
    if (Math.random() < 0.3) {
        GameState.journey.currentBiome = getNextBiome();
    }
    await triggerRandomEncounter(null, GameState.data.time.day);
    Terminal.println(`Traveled ${miles} miles. Total: ${GameState.journey.totalMilesTraveled}/${Config.TOTAL_MILES}`, 'green');
    await checkMiniBossEncounter();
    if (!GameState.data.encounterTriggered && !GameState.data.pendingEnemy) {
        const biomeKey = `biome_${GameState.journey.currentBiome.toLowerCase().replace(/\s+/g, '_')}`;
        if (typeof EXTRA_ASCII_ART !== 'undefined' && EXTRA_ASCII_ART[biomeKey]) {
            await Terminal.showAsciiArt(biomeKey, 'cyan', true);
        } else {
            await Terminal.showAsciiArt('travel', 'cyan', true);
        }
        Terminal.println(`\n${Utils.choice(UNEVENTFUL_TRAVEL_PHRASES)}`, 'green');
    }
    await Terminal.pause();
    Audio.stopMusic();
}

async function checkLegacyAtCurrentMile() {
    const mile = GameState.journey.totalMilesTraveled;
    const legacyEntries = GameState.getLegacyAtMile(mile);
    if (legacyEntries.length > 0) {
        GameState.addJournalEntry(`Discovered ${legacyEntries.length} grave marker(s) at mile ${mile}.`);
    }
    for (const entry of legacyEntries) {
        Terminal.println('\n', 'dim');
        Terminal.println(`You come across a weathered grave marker at mile ${mile}...`, 'cyan');
        Terminal.println(`  "Here lies ${entry.name}"`, 'white');
        Terminal.println(`  "${getLegacyEpitaph(entry)}"`, 'dim');
        if (entry.companionName) {
            Terminal.println(`  "Beloved companion: ${entry.companionName}"`, 'dim');
        }
        if (entry.weaponName && Math.random() < 0.5) {
            Terminal.println(`\nYou find their ${entry.weaponName} half-buried in the dirt.`, 'yellow');
            const foundWeapon = GameState.data.items.weapons.find(w => w.name === entry.weaponName);
            if (foundWeapon) {
                GameState.player.weapons.push(foundWeapon);
                Terminal.println(`You recovered the ${entry.weaponName}!`, 'green');
            }
        }
        await Terminal.pause();
    }
}

function getLegacyEpitaph(entry) {
    const epitaphs = {
        'combat': [
            'Slain by beasts that hunted better than they hoped.',
            'Fell in battle with teeth around their throat and fire in their eyes.',
            'Died with sword in hand and curses on their tongue.',
            'Met the monster they sought and found it stronger.',
            'Their shield broke, but their spirit never did.',
            'Blood watered the trail so others might walk it safer.',
            'The last thing they saw was claws. The last thing they felt was pride.'
        ],
        'starvation': [
            'Perished hungry, their belly empty and their heart still full of road.',
            'Taken by the wild one mouthful at a time.',
            'Ran out of road, then ran out of bread, then ran out of time.',
            'The earth fed them at last, though they did not choose the meal.',
            'They walked until their legs forgot how to stop, and then they stopped forever.',
            'A hollow stomach and a hollow wind were their only companions at the end.',
            'The trail promised glory but served only dust.'
        ],
        'unknown': [
            'Gone too soon, with too many miles still ahead.',
            'The trail claims another, and the trail does not mourn.',
            'Rest now, wanderer. The dragon can wait.',
            'No one saw them fall, but the stones remember every footstep.',
            'They were brave, or foolish, or both. The trail does not distinguish.',
            'Here lies someone who wanted more than the world would give.',
            'The wind took their name. The earth took their bones.',
            'They set out seeking legend and became one instead.',
            'Sleep well, stranger. The fire you built still warms the next camp.',
            'Not all who wander are lost, but all who stop are found by something.',
            'Their story ended here. Yours continues. Walk faster.'
        ]
    };
    const list = epitaphs[entry.deathCause] || epitaphs['unknown'];
    return Utils.choice(list);
}

async function handlePostMinibossMerchant() {
    Terminal.println('\nA mysterious merchant approaches after the battle...', 'cyan');
    await handleTrader();
}

async function simulateAttack(encounterType, subtype) {
    const progress = GameState.journey.totalMilesTraveled / Config.TOTAL_MILES;
    const survival = GameState.player.survival;
    let encounter;
    if (encounterType === 'flora') encounter = new FloraEncounter();
    else if (encounterType === 'fauna') encounter = new FaunaEncounter(subtype);
    else if (encounterType === 'humanoid') encounter = new HumanoidEncounter(subtype);
    else return;
    await encounter.simulate(survival, progress);
}
