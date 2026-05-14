// Dragon Trail Web - Travel System

const ENVIRONMENTAL_EVENTS = [
    { name: 'Storm', description: 'A violent storm disrupts your journey...', effect: async () => { await advanceDays(1); Resources.modifyHealth(-5); } },
    { name: 'Wild Animal Encounter', description: 'You are attacked by a wild animal!', effect: async () => { await simulateAttack('fauna', 'wild_beast'); } },
    { name: 'Pleasant Weather', description: 'The weather is perfect...', effect: async () => { Resources.modifyHealth(5); } },
    { name: 'Bandit Ambush', description: 'Bandits attack and steal supplies!', effect: async () => { Resources.modify('supplies', -1); await simulateAttack('humanoid', 'bandit'); } },
    { name: 'Abandoned Supplies', description: 'You find abandoned supplies.', effect: async () => { Resources.modify('supplies', 3); } },
    { name: 'Shortcut', description: 'You discover a hidden path...', effect: async () => { travelMiles(50); } },
    { name: 'Gold Discovery', description: 'You stumble upon gold!', effect: async () => { Resources.modifyGold(Utils.randInt(5, 15)); } },
    { name: 'Slain Bandits', description: 'Drunk bandits flee, leaving gold.', effect: async () => { Resources.modifyGold(Utils.randInt(10, 50)); } },
    { name: 'Herbalist Encounter', description: 'An herbalist sells herbs!', effect: async () => { await handleHerbalistEncounter(); } },
    { name: 'Random Trader', description: 'A trader offers goods.', effect: async () => { await handleTrade(Utils.choice(['food_for_supplies', 'supplies_for_food', 'gold_for_food', 'gold_for_water'])); } },
    { name: 'Waterfall', description: 'Freshwater waterfall!', effect: async () => { Resources.modify('water', 32); } },
    { name: 'Water Merchant', description: 'A water merchant sells waterskins.', effect: async () => { await handleWaterMerchant(); } },
    { name: 'Empty Waterskin', description: 'You find an empty waterskin.', effect: async () => { Resources.modify('waterskins', Utils.randInt(2, 3)); } },
    { name: 'Stumbled Upon Wood', description: 'You find a pile of wood!', effect: async () => { Resources.modify('wood', Utils.randInt(3, 9)); } },
    { name: 'Lost Trail', description: 'You lose the trail...', effect: async () => { await advanceDays(1); } },
    { name: 'Hidden Cache', description: 'A hidden cache of supplies!', effect: async () => { Resources.modify('supplies', Utils.randInt(2, 5)); } },
    { name: 'River Crossing', description: 'You find a river.', effect: async () => { await advanceDays(1); Resources.modify('water', 32); } },
    { name: 'Ancient Ruins', description: 'Ancient ruins with trinkets.', effect: async () => { Resources.modifyGold(Utils.randInt(15, 30)); } },
    { name: 'Wild Berries', description: 'Wild berries supplement food.', effect: async () => { Resources.modify('food', Utils.randInt(3, 7)); } },
    { name: 'Expensive Merchant', description: 'Steep prices.', effect: async () => { await handleTrade(Utils.choice(['food_for_supplies', 'supplies_for_food', 'gold_for_food', 'gold_for_water']), false); } }
];

const BIOME_EVENT_CHAINS = {
    'Forest': [
        { name: 'Whispering Woods', desc: 'The trees seem to speak your name.', effect: async () => { Resources.modifyHealth(-3); } },
        { name: 'Forest Shrine', desc: 'An ancient shrine hums with power.', effect: async () => { Resources.modifyHealth(10); Resources.modify('herbs', 2); } },
        { name: 'Deep Grove', desc: 'You find a grove untouched by time.', effect: async () => { Resources.modifyGold(Utils.randInt(10, 20)); } }
    ],
    'Mountain': [
        { name: 'Avalanche Warning', desc: 'Rocks tumble down the slope!', effect: async () => { Resources.modifyHealth(-10); } },
        { name: 'Ice Cave', desc: 'A frozen cave glitters in the moonlight.', effect: async () => { Resources.modify('water', 16); Resources.modify('supplies', 2); } },
        { name: 'Peak Shrine', desc: 'At the summit, you find offerings left by climbers.', effect: async () => { Resources.modifyGold(Utils.randInt(15, 30)); } }
    ],
    'Swamp': [
        { name: 'Misty Path', desc: 'Fog coils around your ankles.', effect: async () => { Resources.modifyHealth(-5); } },
        { name: 'Swamp Witch', desc: 'A hag offers a deal in exchange for herbs.', effect: async () => { Resources.modify('herbs', -2); GameState.player.maxHealth += 5; GameState.player.health += 5; } },
        { name: 'Sunken Relic', desc: 'You pull a rusted chest from the muck.', effect: async () => { Resources.modifyGold(Utils.randInt(20, 40)); } }
    ],
    'Desert': [
        { name: 'Sandstorm', desc: 'Grit fills your eyes and lungs.', effect: async () => { Resources.modifyHealth(-8); Resources.modify('water', -2); } },
        { name: 'Oasis', desc: 'Palm trees shade a hidden pool.', effect: async () => { Resources.modify('water', 32); Resources.modify('food', 5); } },
        { name: 'Ruined Caravan', desc: 'A merchant\'s bones and his wares.', effect: async () => { Resources.modifyGold(Utils.randInt(10, 25)); Resources.modify('supplies', 2); } }
    ],
    'Plains': [
        { name: 'Prairie Fire', desc: 'Smoke on the horizon approaches fast.', effect: async () => { Resources.modifyHealth(-5); advanceDays(1); } },
        { name: 'Nomad Camp', desc: 'Travelers share stories and stew.', effect: async () => { Resources.modify('food', 5); Resources.modifyHealth(5); } },
        { name: 'Standing Stones', desc: 'Monoliths older than memory.', effect: async () => { Resources.modify('herbs', 3); } }
    ],
    'Tundra': [
        { name: 'Blizzard', desc: 'Whiteout conditions blind you.', effect: async () => { Resources.modifyHealth(-10); Resources.modify('wood', 2); } },
        { name: 'Frozen Lake', desc: 'Fish flash beneath the ice.', effect: async () => { Resources.modify('food', 8); } },
        { name: 'Icebound Ship', desc: 'A vessel locked in the frost.', effect: async () => { Resources.modifyGold(Utils.randInt(20, 50)); } }
    ],
    'Jungle': [
        { name: 'Canopy Trap', desc: 'A vine snare catches your ankle.', effect: async () => { Resources.modifyHealth(-7); } },
        { name: 'Monkey Troop', desc: 'Curious primates lead you to fruit.', effect: async () => { Resources.modify('food', 6); } },
        { name: 'Overgrown Temple', desc: 'Vines part to reveal gold eyes.', effect: async () => { Resources.modifyGold(Utils.randInt(15, 35)); Resources.modify('herbs', 2); } }
    ]
};

const WEATHER_TYPES = [
    { name: 'Clear', effect: 'none', desc: 'The skies are clear.' },
    { name: 'Rain', effect: 'slow', desc: 'Rain soaks the ground, slowing travel.' },
    { name: 'Storm', effect: 'danger', desc: 'Lightning splits the sky. Travel is perilous.' },
    { name: 'Heat Wave', effect: 'thirst', desc: 'The heat is oppressive. Water consumption doubles.' },
    { name: 'Fog', effect: 'hidden', desc: 'Thick fog limits visibility.' },
    { name: 'Snow', effect: 'slow', desc: 'Snowdrifts make the path treacherous.' }
];

const SCOUTING_EVENTS = [
    { name: 'Herb Patch', description: 'You discover a patch of medicinal herbs.', effect: async () => { Resources.modify('herbs', Utils.randInt(3, 6)); } },
    { name: 'Fresh Water', description: 'You find a clear stream.', effect: async () => { Resources.modify('water', Utils.randInt(8, 16)); } },
    { name: 'Animal Tracks', description: 'You spot tracks leading to a hunting ground.', effect: async () => { Resources.modify('food', Utils.randInt(5, 10)); } },
    { name: 'Bandit Camp', description: 'You scout a bandit camp from afar.', effect: async () => { Terminal.println('You avoid the bandits and move on.', 'yellow'); } },
    { name: 'Hidden Path', description: 'A shortcut reveals itself.', effect: async () => { travelMiles(Utils.randInt(10, 25)); } },
    { name: 'Old Shrine', description: 'An old shrine restores your spirit.', effect: async () => { Resources.modifyHealth(Utils.randInt(5, 15)); } },
    { name: 'Treasure Cache', description: 'You find hidden treasure.', effect: async () => { Resources.modifyGold(Utils.randInt(10, 25)); } },
    { name: 'Broken Cart', description: 'A broken cart has scattered supplies.', effect: async () => { Resources.modify('supplies', Utils.randInt(1, 3)); } },
    { name: 'Wildfire Smoke', description: 'Smoke in the distance delays you.', effect: async () => { await advanceDays(1); } },
    { name: 'Friendly Wanderer', description: 'A wanderer shares food.', effect: async () => { Resources.modify('food', Utils.randInt(2, 5)); } },
    { name: 'Dangerous Terrain', description: 'Rough terrain injures you.', effect: async () => { Resources.modifyHealth(-10); } },
    { name: "Scout's Luck", description: 'Nothing of note today.', effect: async () => { Terminal.println('The area is quiet.', 'cyan'); } }
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
    switch (weather.condition) {
        case 'Storm':
            Resources.modifyHealth(-5);
            Terminal.println('The storm lashes you. -5 HP.', 'red');
            break;
        case 'Heat Wave':
            Resources.modify('water', -1);
            Terminal.println('The heat drains you. -1 water.', 'yellow');
            break;
        case 'Fog':
            if (Math.random() < 0.15) {
                Terminal.println('You stumble in the fog and lose time.', 'yellow');
                return false; // signals reduced miles
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
        Resources.modify('food', -1);
        Resources.modify('water', -1);
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
    { name: 'Cracked Compass', desc: 'It points south no matter which way you face.', effect: () => { Resources.modifyGold(5); } },
    { name: 'Tattered Map', desc: 'A map to a hidden cache... or a trap.', effect: () => { Resources.modify('supplies', Utils.randInt(2, 4)); } },
    { name: 'Silver Locket', desc: 'Inside is a portrait of someone you do not recognize.', effect: () => { Resources.modifyGold(10); } },
    { name: 'Old Journal', desc: 'The last entry reads: "Do not trust the seer."', effect: () => { Resources.modify('herbs', 2); } },
    { name: 'Rusty Key', desc: 'Too large for any door you have seen.', effect: () => { Resources.modifyGold(3); } },
    { name: 'Dragon Scale', desc: 'Warm to the touch. The beast is near.', effect: () => { Resources.modifyHealth(5); } },
    { name: 'Broken Sword', desc: 'The name "Ser Aldric" is etched on the blade.', effect: () => { Resources.modify('wood', 2); } },
    { name: 'Strange Idol', desc: 'Carved from bone. It whispers when no one is near.', effect: () => { Resources.modifyGold(Utils.randInt(5, 15)); } },
    { name: 'Potion Vial', desc: 'It glows faintly green.', effect: () => { GameState.combat.potions += 1; } },
    { name: 'Weathered Letter', desc: '"Meet me at mile 750. Bring herbs. -K"', effect: () => { Resources.modify('herbs', 1); } }
];

const WHISPERS = {
    'Forest': [
        'The wind through the leaves sounds almost like laughter.',
        'Something large moves in the canopy above.',
        'You catch the scent of rot beneath the pine.',
        'A crow watches you from a dead branch. It does not blink.'
    ],
    'Mountain': [
        'The altitude makes your ears pop. Or was that a voice?',
        'You hear rockfall in the distance. Or footsteps.',
        'The cold seeps through your armor like fingers.',
        'A goat\'s bell echoes from somewhere you cannot see.'
    ],
    'Swamp': [
        'Bubbles rise from the black water. Then stop.',
        'You hear splashing. Nothing is there.',
        'The mist carries the smell of copper and old flowers.',
        'A will-o-wisp flickers and vanishes.'
    ],
    'Desert': [
        'The sand shifts in patterns that look almost deliberate.',
        'You hear your name on the wind. No one is near.',
        'The sun seems to lean closer than it should.',
        'A skull half-buried in the dune grins at you.'
    ],
    'Plains': [
        'The grass whispers secrets as you pass.',
        'You see smoke from a distant fire. It is gone when you look again.',
        'A single flower grows where nothing else will.',
        'The horizon shimmers. You hope it is only heat.'
    ],
    'Tundra': [
        'The silence here is so deep it hurts.',
        'You find footprints that match your boots exactly.',
        'Ice cracks beneath your feet, singing a low note.',
        'The aurora dances, and for a moment you see a face.'
    ],
    'Jungle': [
        'Something screams in the canopy. Then silence.',
        'The humidity wraps around you like a wet cloth.',
        'You find a trail of blood leading into the undergrowth.',
        'A flower opens as you pass. Its pollen smells like ash.'
    ],
    'default': [
        'You feel as though you are being watched.',
        'A shadow moves at the edge of your vision.',
        'The air tastes like metal.',
        'You hear breathing that is not your own.',
        'For a moment, the world holds its breath.'
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
    if (Math.random() < 0.08) {
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

        Resources.modify('food', -1);
        Resources.modify('water', -1);
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
        'combat': ['Slain by beasts', 'Fell in battle', 'Died with sword in hand'],
        'starvation': ['Perished hungry', 'Taken by the wild', 'Ran out of road'],
        'unknown': ['Gone too soon', 'The trail claims another', 'Rest now, wanderer']
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
