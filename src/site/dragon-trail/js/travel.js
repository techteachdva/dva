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
        await handleMiniBossFight();
        await handlePostMinibossMerchant();
    }
}

async function triggerRandomEncounter(encounterNamesOnDays, day) {
    const roll = Math.random();
    const currentDay = day || GameState.data.time.day;
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

async function triggerEnvironmentalEvent() {
    if (Math.random() < 0.23) {
        const event = Utils.choice(ENVIRONMENTAL_EVENTS);
        Terminal.println(`\n${event.name}: ${event.description}`, 'yellow');
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
    await Terminal.showAsciiArt('travel', 'cyan', true);

    const days = Utils.randInt(Config.MIN_DAYS_PER_TRAVEL, Config.MAX_DAYS_PER_TRAVEL);
    for (let d = 0; d < days; d++) {
        const miles = Utils.randInt(Config.MIN_MILES_PER_TRAVEL, Config.MAX_MILES_PER_TRAVEL);
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
            GameState.journey.currentBiome = getNextBiome();
        }

        await triggerRandomEncounter(null, GameState.data.time.day);

        Terminal.println(`Day ${GameState.data.time.day}: Traveled ${miles} miles through ${GameState.journey.currentBiome}. Total: ${GameState.journey.totalMilesTraveled}/${Config.TOTAL_MILES}`, 'green');

        await checkLegacyAtCurrentMile();

        if (GameState.data.encounterTriggered) {
            break;
        }
    }

    await checkMiniBossEncounter();
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
