// Dragon Trail Web - Menu System

function calculateCarryWeight() {
    let weight = 0;
    const r = GameState.resources;
    weight += (r.food || 0) * (Config.ITEM_WEIGHTS.food || 1);
    weight += (r.water || 0) * (Config.ITEM_WEIGHTS.water || 1);
    weight += (r.herbs || 0) * (Config.ITEM_WEIGHTS.herbs || 0.1);
    weight += (r.supplies || 0) * (Config.ITEM_WEIGHTS.supplies || 1);
    weight += (r.wood || 0) * (Config.ITEM_WEIGHTS.wood || 1);
    weight += (r.potion || 0) * (Config.ITEM_WEIGHTS.potion || 0.1);
    for (const w of GameState.player.weapons) weight += (w.weight || 0);
    if (GameState.player.equippedWeapon) {
        const eq = GameState.player.equippedWeapon;
        if (!GameState.player.weapons.some(w => w.name === eq.name)) {
            weight += (eq.weight || 0);
        }
    }
    for (const key of ['helmet', 'chest', 'legs', 'shield']) {
        const a = GameState.player.equippedArmor[key];
        if (a) weight += (a.weight || 0);
    }
    return Math.round(weight);
}

function renderBar(current, max, width) {
    const filled = Math.max(0, Math.min(width, Math.floor((current / max) * width)));
    const empty = Math.max(0, width - filled);
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

async function handlePurchase() {
    Audio.playMusic('gear_shop');
    const capacity = Resources.getCarryCapacity();

    while (true) {
        Terminal.clear();
        await Terminal.showAsciiArt('gear_shop', 'yellow', true);
        const gold = GameState.resources.gold;
        const carryWeight = calculateCarryWeight();

        Terminal.println(`\nGold: ${gold} GP`);
        Terminal.println(`Carry Weight: ${carryWeight}/${capacity} lbs`);

        if (gold <= 0) {
            Terminal.println('\nYou are out of gold!', 'red');
            await Terminal.pause();
            break;
        }
        if (carryWeight >= capacity) {
            Terminal.println('\nYou are at carry capacity!', 'red');
            await Terminal.pause();
            break;
        }

        Terminal.println('\n--- Supplies ---');
        const costs = GameState.data.itemCosts;
        Terminal.println(`1. Food (1 lb) - ${costs.food} GP`);
        Terminal.println(`2. Water (1 unit) - ${costs.water} GP`);
        Terminal.println(`3. Herbs - ${costs.herbs} GP`);
        Terminal.println(`4. Supplies - ${costs.supplies} GP`);
        Terminal.println(`5. Wood Cords (${Config.WOOD_CORD_SIZE} wood) - ${costs.wood} GP`);
        Terminal.println(`6. Potion - ${costs.potion || 10} GP`);

        Terminal.println('\n--- Weapons ---');
        const weapons = GameState.data.items.weapons;
        weapons.forEach((w, i) => {
            const owned = GameState.player.weapons.some(pw => pw.name === w.name) || GameState.player.equippedWeapon?.name === w.name;
            const tag = owned ? ' [OWNED]' : '';
            Terminal.println(`${7 + i}. ${w.name} - ${w.cost} GP | DMG: ${w.damageRange} | Weight: ${w.weight} lbs | To Hit: +${w.toHitBonus}${tag}`);
        });

        Terminal.println('\n--- Armor ---');
        const armors = GameState.data.items.armor;
        armors.forEach((a, i) => {
            const owned = Object.values(GameState.player.equippedArmor).some(pa => pa && pa.name === a.name) ||
                          Object.values(GameState.player.armor).some(pa => pa && pa.name === a.name);
            const tag = owned ? ' [OWNED]' : '';
            Terminal.println(`${7 + weapons.length + i}. ${a.name} - ${a.cost} GP | AC: +${a.acBonus} | Weight: ${a.weight} lbs | ${a.armorType}${tag}`);
        });

        Terminal.println('\n0. Leave Shop');

        const maxChoice = 6 + weapons.length + armors.length;
        const choice = await Terminal.inputNumber('Choose: ', 0, maxChoice);
        if (choice === 0) break;

        if (choice >= 1 && choice <= 6) {
            const supplyMap = ['food', 'water', 'herbs', 'supplies', 'wood', 'potion'];
            const itemKey = supplyMap[choice - 1];
            const cost = costs[itemKey] || 10;
            const itemWeight = Config.ITEM_WEIGHTS[itemKey] || 1;
            const maxAfford = Math.floor(gold / cost);
            const maxCarry = Math.floor((capacity - carryWeight) / itemWeight);
            const maxBuy = Math.max(0, Math.min(maxAfford, maxCarry));
            if (maxBuy <= 0) {
                Terminal.println('Cannot afford or carry any more!', 'red');
                await Terminal.pause();
                continue;
            }
            const qty = await Terminal.inputNumber(`How many? (0-${maxBuy}): `, 0, maxBuy);
            if (qty > 0) {
                const totalCost = qty * cost;
                Resources.modifyGold(-totalCost);
                if (itemKey === 'wood') {
                    Resources.modify('wood', qty * Config.WOOD_CORD_SIZE);
                } else if (itemKey === 'potion') {
                    GameState.combat.potions += qty;
                } else {
                    Resources.modify(itemKey, qty);
                }
                Terminal.println(`Bought ${qty} ${itemKey} for ${totalCost} GP.`, 'green');
                await Terminal.pause();
            }
            continue;
        }

        if (choice >= 7 && choice < 7 + weapons.length) {
            const w = weapons[choice - 7];
            const owned = GameState.player.weapons.some(pw => pw.name === w.name) || GameState.player.equippedWeapon?.name === w.name;
            if (owned) {
                Terminal.println('You already own this weapon!', 'red');
                await Terminal.pause();
                continue;
            }
            if (gold < w.cost) {
                Terminal.println('Not enough gold!', 'red');
                await Terminal.pause();
                continue;
            }
            if (carryWeight + w.weight > capacity) {
                Terminal.println('Too heavy!', 'red');
                await Terminal.pause();
                continue;
            }
            Resources.modifyGold(-w.cost);
            GameState.player.weapons.push(w);
            GameState.player.equippedWeapon = w;
            Resources.updateCarryWeight();
            Terminal.println(`You bought and equipped the ${w.name}!`, 'green');
            await Terminal.pause();
            continue;
        }

        if (choice >= 7 + weapons.length) {
            const a = armors[choice - 7 - weapons.length];
            const owned = Object.values(GameState.player.equippedArmor).some(pa => pa && pa.name === a.name) ||
                          Object.values(GameState.player.armor).some(pa => pa && pa.name === a.name);
            if (owned) {
                Terminal.println('You already own this armor!', 'red');
                await Terminal.pause();
                continue;
            }
            if (gold < a.cost) {
                Terminal.println('Not enough gold!', 'red');
                await Terminal.pause();
                continue;
            }
            if (carryWeight + a.weight > capacity) {
                Terminal.println('Too heavy!', 'red');
                await Terminal.pause();
                continue;
            }
            Resources.modifyGold(-a.cost);
            GameState.player.armor[a.armorType] = a;
            GameState.player.equippedArmor[a.armorType] = a;
            GameState.player.acBonus = Object.values(GameState.player.equippedArmor).filter(x => x).reduce((sum, x) => sum + x.acBonus, 0);
            Resources.updateCarryWeight();
            Terminal.println(`You bought and equipped the ${a.name}!`, 'green');
            await Terminal.pause();
            continue;
        }
    }

    if (GameState.data.skill === 'Potion Seller' && GameState.combat.potions > 0) {
        const sellChoice = await Terminal.inputYesNo(`\nYou have ${GameState.combat.potions} potions. Sell some? (3x base price)`);
        if (sellChoice) {
            const maxSell = GameState.combat.potions;
            const qty = await Terminal.inputNumber(`How many? (1-${maxSell}): `, 1, maxSell);
            const pricePer = Math.floor((GameState.data.itemCosts.potion || 10) * 3);
            const total = qty * pricePer;
            GameState.combat.potions -= qty;
            Resources.modifyGold(total);
            Terminal.println(`You sold ${qty} potions for ${total} GP.`, 'green');
        }
    }
    Audio.stopMusic();
}

async function handleTrade(traderType, fair = true) {
    Terminal.println(`\nTrader offers: ${traderType.replace(/_/g, ' ')}`);
    let rate, qty, have, need, giveKey, getKey;
    const smoothMult = GameState.data.skill === 'Smooth-Talker' ? 0.75 : 1.0;

    switch (traderType) {
        case 'food_for_supplies':
            rate = Math.max(1, Math.floor((fair ? 2 : 3) * smoothMult));
            Terminal.println(`Trade ${rate} food for 1 supply.`);
            if (GameState.data.skill === 'Smooth-Talker') Terminal.println('Your smooth talking softens the trader\'s terms.', 'cyan');
            qty = await Terminal.inputNumber('How many supplies to receive? ', 0, 999);
            have = GameState.resources.food;
            need = qty * rate;
            if (have >= need) {
                Resources.modify('food', -need);
                Resources.modify('supplies', qty);
                Terminal.println(`Traded ${need} food for ${qty} supplies.`, 'green');
            } else {
                Terminal.println('Not enough food!', 'red');
            }
            break;
        case 'supplies_for_food':
            rate = Math.max(1, Math.floor((fair ? 1 : 2) * smoothMult));
            Terminal.println(`Trade ${rate} supplies for 1 food.`);
            if (GameState.data.skill === 'Smooth-Talker') Terminal.println('The trader seems unusually generous.', 'cyan');
            qty = await Terminal.inputNumber('How many food to receive? ', 0, 999);
            have = GameState.resources.supplies;
            need = qty * rate;
            if (have >= need) {
                Resources.modify('supplies', -need);
                Resources.modify('food', qty);
                Terminal.println(`Traded ${need} supplies for ${qty} food.`, 'green');
            } else {
                Terminal.println('Not enough supplies!', 'red');
            }
            break;
        case 'gold_for_food':
            rate = Math.max(1, Math.floor((fair ? 2 : 5) * smoothMult));
            Terminal.println(`Buy food at ${rate} GP each.`);
            if (GameState.data.skill === 'Smooth-Talker') Terminal.println('The merchant lowers the price with a smile.', 'cyan');
            qty = await Terminal.inputNumber('How many food? ', 0, 999);
            need = qty * rate;
            if (GameState.resources.gold >= need) {
                Resources.modifyGold(-need);
                Resources.modify('food', qty);
                Terminal.println(`Bought ${qty} food for ${need} gold.`, 'green');
            } else {
                Terminal.println('Not enough gold!', 'red');
            }
            break;
        case 'gold_for_water':
            rate = Math.max(1, Math.floor((fair ? 3 : 6) * smoothMult));
            Terminal.println(`Buy water at ${rate} GP each.`);
            if (GameState.data.skill === 'Smooth-Talker') Terminal.println('Your charm cuts through the merchant\s greed.', 'cyan');
            qty = await Terminal.inputNumber('How many water? ', 0, 999);
            need = qty * rate;
            if (GameState.resources.gold >= need) {
                Resources.modifyGold(-need);
                Resources.modify('water', qty);
                Terminal.println(`Bought ${qty} water for ${need} gold.`, 'green');
            } else {
                Terminal.println('Not enough gold!', 'red');
            }
            break;
        default:
            Terminal.println('Unknown trade type.', 'red');
    }
    await Terminal.pause();
}

async function handleTrader() {
    Terminal.println('\nA friendly trader approaches...', 'green');
    await handleTrade(Utils.choice(['food_for_supplies', 'supplies_for_food', 'gold_for_food', 'gold_for_water']), true);
}

async function handleSteepTrader() {
    Terminal.println('\nA shrewd merchant eyes your coin purse...', 'yellow');
    await handleTrade(Utils.choice(['food_for_supplies', 'supplies_for_food', 'gold_for_food', 'gold_for_water']), false);
}

async function handleHerbalistEncounter() {
    Terminal.println('An herbalist offers herbs for gold.');
    const costPerHerb = GameState.data.itemCosts.herbs || 6;
    const maxHerbs = Math.floor(GameState.resources.gold / costPerHerb);
    if (maxHerbs <= 0) {
        Terminal.println('You cannot afford any herbs.', 'red');
        await Terminal.pause();
        return;
    }
    const amount = await Terminal.inputNumber(`How many herbs? (0-${maxHerbs}): `, 0, maxHerbs);
    if (amount > 0) {
        const cost = amount * costPerHerb;
        Resources.modifyGold(-cost);
        Resources.modify('herbs', amount);
        Terminal.println(`You bought ${amount} herbs for ${cost} gold.`, 'green');
    }
    await Terminal.pause();
}

async function handleWaterMerchant() {
    Terminal.println('A water merchant sells waterskins.');
    const costPerSkin = 5;
    const maxSkins = Math.floor(GameState.resources.gold / costPerSkin);
    if (maxSkins <= 0) {
        Terminal.println('You cannot afford any waterskins.', 'red');
        await Terminal.pause();
        return;
    }
    const amount = await Terminal.inputNumber(`How many waterskins? (0-${maxSkins}): `, 0, maxSkins);
    if (amount > 0) {
        const cost = amount * costPerSkin;
        Resources.modifyGold(-cost);
        Resources.modify('waterskins', amount);
        Terminal.println(`You bought ${amount} waterskins for ${cost} gold.`, 'green');
    }
    await Terminal.pause();
}

async function handleHelp() {
    Terminal.clear();
    await Terminal.showAsciiArt('help', 'cyan', true);
    Terminal.println('\nCommands:');
    Terminal.println('1. Status - View your current status');
    Terminal.println('2. Travel - Move toward the dragon');
    Terminal.println('3. Hunt - Gather food');
    Terminal.println('4. Scout - Explore the area');
    Terminal.println('5. Camp - Rest, cook, talk, and tend wounds');
    Terminal.println('6. Cook - Prepare meals');
    Terminal.println('7. Help - This screen');
    Terminal.println('8. Credits - Game credits');
    Terminal.println('9. Save - Save your game');
    Terminal.println('10. Load - Load a saved game');
    Terminal.println('11. Journal - Read your travel log');
    Terminal.println('12. Quit - Exit to main menu');
    Terminal.println('0. Fight the Dragon - When available');
    Terminal.println('\nTips:');
    Terminal.println('- Keep food and water stocked. Higher difficulties drain them faster.');
    Terminal.println('- Your chosen skill and difficulty shape every system: combat, shopping, camping, and travel.');
    Terminal.println('- Companions fight and carry, but their loyalty changes based on difficulty.');
    Terminal.println('- Better gear means survival. Better tactics mean victory.');
    Terminal.println('- Save often. The trail does not forgive mistakes.');
    if (typeof HighScores !== 'undefined') await HighScores.display();
    await Terminal.pause();
}

async function handleCredits() {
    Terminal.clear();
    await Terminal.showAsciiArt('credits', 'cyan', true);
    Terminal.println('\nDragon Trail v5 - Web Edition', 'yellow');
    Terminal.println('Ported from Python v5');
    Terminal.println('A journey of survival, combat, and dragons.');
    Terminal.println('Thanks for playing!');
    await Terminal.pause();
}

async function handleSaveMenu() {
    Terminal.println('\n--- Save Game ---');
    const saves = GameState.listSaves();
    for (let i = 1; i <= 3; i++) {
        const s = saves.find(x => x.slot === i);
        if (s && s.name) {
            Terminal.println(`${i}. ${s.name} - Day ${s.day}, ${s.miles} miles`);
        } else {
            Terminal.println(`${i}. [Empty]`);
        }
    }
    Terminal.println('0. Back');
    const slot = await Terminal.inputNumber('Choose slot: ', 0, 3);
    if (slot > 0) GameState.save(slot);
    await Terminal.pause();
}

async function handleLoadMenu() {
    Terminal.println('\n--- Load Game ---');
    const saves = GameState.listSaves();
    for (let i = 1; i <= 3; i++) {
        const s = saves.find(x => x.slot === i);
        if (s && s.name) {
            Terminal.println(`${i}. ${s.name} - Day ${s.day}, ${s.miles} miles`);
        } else {
            Terminal.println(`${i}. [Empty]`);
        }
    }
    Terminal.println('0. Back');
    const slot = await Terminal.inputNumber('Choose slot: ', 0, 3);
    if (slot > 0) GameState.load(slot);
    await Terminal.pause();
}

function generateCompanions(count = 3) {
    const names = Utils.shuffle([...Config.COMPANION_NAMES]).slice(0, count);
    return names.map(name => {
        const hp = Utils.randInt(20, 50);
        const dpr = Utils.randInt(3, 8);
        const gpCost = Utils.randInt(10, 30);
        return new Companion(name, hp, dpr, gpCost);
    });
}

function displayCompanionMenu(companions) {
    Terminal.println('\n--- Available Companions ---');
    companions.forEach((c, i) => {
        Terminal.println(`${i + 1}. ${c.name} | HP: ${c.hp} | DPR: ${c.dpr} | Cost: ${c.gpCost} GP | Personality: ${c.personality}`);
    });
    Terminal.println('0. None');
}

async function handleCompanionPurchase(companions) {
    const choice = await Terminal.inputNumber('Choose a companion: ', 0, companions.length);
    if (choice === 0) {
        Terminal.println('You venture alone.', 'yellow');
        await Terminal.pause();
        return;
    }
    const companion = companions[choice - 1];
    if (GameState.resources.gold >= companion.gpCost) {
        Resources.modifyGold(-companion.gpCost);
        const baseRel = GameState.data._startingRel || 50;
        const storytellerBonus = GameState.data.skill === 'Storyteller' ? 10 : 0;
        companion.relationship = baseRel + storytellerBonus;
        GameState.data.companion = companion;
        GameState.addJournalEntry(`Hired ${companion.name} the ${companion.personality} companion for ${companion.gpCost} GP.`);
        Terminal.println(`${companion.name} joins your party!`, 'green');
        Terminal.println(`They seem ${companion.personality.toLowerCase()}.`, 'cyan');
        Terminal.println(`Starting relationship: ${companion.relationship} (${companion.getMood()})`, 'yellow');
        if (companion.personality === 'Greedy') {
            Terminal.println('They keep eyeing your coin purse...', 'yellow');
        } else if (companion.personality === 'Brave') {
            Terminal.println('They stand tall, eager for the road ahead.', 'green');
        } else if (companion.personality === 'Paranoid') {
            Terminal.println('They keep glancing at the shadows.', 'yellow');
        } else if (companion.personality === 'Optimistic') {
            Terminal.println('They smile, confident you will succeed.', 'green');
        }
    } else {
        Terminal.println('Not enough gold!', 'red');
    }
    await Terminal.pause();
}

async function updateGameStatus() {
    Terminal.clear();
    await Terminal.showAsciiArt('status', 'green', true);
    Terminal.println(`\nDate: ${GameState.data.time.day} ${GameState.data.time.month}, Year ${GameState.data.time.year}`);
    Terminal.println(`Weather: ${GameState.data.weather.condition}`);
    Terminal.println(`Biome: ${GameState.journey.currentBiome}`);
    Terminal.println(`Miles: ${GameState.journey.totalMilesTraveled} / ${Config.TOTAL_MILES} (Remaining: ${Config.TOTAL_MILES - GameState.journey.totalMilesTraveled})`);

    Terminal.println('\n--- Resources ---');
    const r = GameState.resources;
    const color = val => val < 5 ? 'red' : (val < 15 ? 'yellow' : 'green');
    Terminal.println(`Food: ${r.food}`, color(r.food));
    Terminal.println(`Water: ${r.water}`, color(r.water));
    Terminal.println(`Herbs: ${r.herbs}`, color(r.herbs));
    Terminal.println(`Supplies: ${r.supplies}`, color(r.supplies));
    Terminal.println(`Wood: ${r.wood}`, color(r.wood));
    Terminal.println(`Waterskins: ${r.waterskins}`);
    Terminal.println(`Potions: ${GameState.combat.potions}`);

    Terminal.println('\n--- Health ---');
    const hpColor = GameState.player.health < 30 ? 'red' : (GameState.player.health < 60 ? 'yellow' : 'green');
    Terminal.println(`HP: ${GameState.player.health} / ${GameState.player.maxHealth}`, hpColor);

    if (GameState.companion) {
        const c = GameState.companion;
        const cColor = c.hp < c.maxHp * 0.3 ? 'red' : 'green';
        Terminal.println(`Companion: ${c.name} | HP: ${c.hp}/${c.maxHp} | DPR: ${c.dpr}`, cColor);
    }

    Terminal.println('\n--- Equipment ---');
    const w = GameState.player.equippedWeapon;
    Terminal.println(`Weapon: ${w ? w.name : 'None'} | DMG: ${w ? w.damageRange : 'N/A'}`);
    const armor = GameState.player.equippedArmor;
    const armorList = Object.values(armor).filter(a => a).map(a => `${a.name} (+${a.acBonus})`).join(', ') || 'None';
    Terminal.println(`Armor: ${armorList}`);
    Terminal.println(`AC Bonus: ${GameState.player.acBonus}`);
    Terminal.println(`Survival: ${GameState.player.survival}`);

    Terminal.println('\n--- Waterskins ---');
    const maxWater = r.waterskins * Config.WATER_SKIN_CAPACITY;
    const waterBar = renderBar(r.water, maxWater, 20);
    Terminal.println(`Water: ${waterBar} ${r.water}/${maxWater}`);

    Terminal.println('\n--- Carrying ---');
    const carryWeight = calculateCarryWeight();
    const capacity = Resources.getCarryCapacity();
    Terminal.println(`Gold: ${r.gold} GP`);
    Terminal.println(`Weight: ${carryWeight}/${capacity} lbs`);
    const weightBar = renderBar(carryWeight, capacity, 20);
    Terminal.println(`Load: ${weightBar}`);

    Terminal.println('\n--- Progress ---');
    const progressPct = Math.floor((GameState.journey.totalMilesTraveled / Config.TOTAL_MILES) * 100);
    const progressBar = renderBar(GameState.journey.totalMilesTraveled, Config.TOTAL_MILES, 30);
    Terminal.println(`${progressBar} ${progressPct}%`);

    await Terminal.pause();
}

async function checkLowResources() {
    const r = GameState.resources;
    const warnings = [];
    if (r.food < 5) warnings.push('Food is critically low!');
    if (r.water < 5) warnings.push('Water is critically low!');
    if (r.herbs < 2) warnings.push('Herbs are running out!');
    if (GameState.player.health < 30) warnings.push('Health is critical!');
    if (warnings.length > 0) {
        Terminal.println('\n' + warnings.join(' '), 'red');
        await Terminal.pause();
    }
}

async function handleGameStart() {
    Terminal.clear();
    await Terminal.showAsciiArt('title', 'yellow', true);

    if (typeof HighScores !== 'undefined') {
        await HighScores.display();
    }

    Audio.playMusic('main_menu');

    Terminal.println('\nThe Dragon Trail is a thousand-mile path of suffering, wonder, and inevitability.', 'cyan');
    Terminal.println('Your goal is simple: walk to the dragon\'s lair and slay the beast before the wilds claim you.', 'cyan');
    Terminal.println('To begin: choose your difficulty, name your wanderer, pick a skill, hire a companion, and then — travel.', 'green');
    await Terminal.pause();

    Terminal.println('\n--- Choose Your Difficulty ---', 'magenta', true);
    Terminal.println('1. I\'m just a baby. Easy please.');
    Terminal.println('   Generous companions, abundant finds, slower mini-games, lighter hunger, +140 carry, +2 combat aim, -20% damage taken.', 'green');
    Terminal.println('2. Thank you sir may I have a shMedium?');
    Terminal.println('   Fair companions, normal finds, standard mini-games, normal hunger, +100 carry, +1 combat aim, normal damage.', 'yellow');
    Terminal.println('3. Don\'t Patronize Me, Bring The Difficult');
    Terminal.println('   Distant companions, rare finds, faster mini-games, extra hunger every 3 days, +70 carry, normal aim, +10% damage.', 'red');
    Terminal.println('4. I\'ve played NetHack. Do your Worst.');
    Terminal.println('   Hostile companions, scarce finds, brutal mini-games, extra hunger daily, +55 carry, -1 combat aim, +25% damage.', 'red');

    const diffChoice = await Terminal.inputNumber('Choose difficulty (1-4): ', 1, 4);
    const difficultyMap = { 1: 0, 2: 1, 3: 2, 4: 3 };
    const survivalMap = { 1: 8, 2: 5, 3: 2, 4: 0 };
    const startRelMap = { 1: 65, 2: 50, 3: 40, 4: 30 };
    GameState.data.difficulty = difficultyMap[diffChoice];
    GameState.player.survival = survivalMap[diffChoice];
    GameState.data._startingRel = startRelMap[diffChoice];

    const diffNames = ['Easy', 'Medium', 'Hard', 'NetHack'];
    Terminal.println(`\nDifficulty set to: ${diffNames[GameState.data.difficulty]}`, 'cyan');
    await Terminal.pause();

    const name = (await Terminal.input('Enter your name: ')).trim();
    GameState.player.name = name || 'Wanderer';

    const seed = Utils.convertSeedToInt(GameState.player.name);
    GameState.data.seed = seed;
    const rng = Utils.seededRandom(seed);

    Terminal.println('\n--- Choose Your Skill ---', 'magenta', true);
    Terminal.println('1. Sated — You need less food and water on the road. Hunger and thirst advance slower.');
    Terminal.println('2. Outdoors Type — You find more wood and water when scouting. The land provides for you.');
    Terminal.println('3. Hunter — Easier hunting mini-games and bonus food from scouting. You read tracks like a book.');
    Terminal.println('4. Storyteller — Campfire conversations deepen bonds faster. Your tales warm hearts as well as hands.');
    Terminal.println('5. Penny-Pincher — Start with +50 GP and enjoy 15% discounts at all shops.');
    Terminal.println('6. Smooth-Talker — Merchants give you better trade rates. Your silver tongue turns copper into gold.');
    Terminal.println('7. Potion Seller — Brew 1d6 free potions once per camp. Sell potions to any merchant for triple price.');

    const skillChoice = await Terminal.inputNumber('Choose skill (1-7): ', 1, 7);
    const skills = ['Sated', 'Outdoors Type', 'Hunter', 'Storyteller', 'Penny-Pincher', 'Smooth-Talker', 'Potion Seller'];
    GameState.data.skill = skills[skillChoice - 1];
    Terminal.println(`\nSkill chosen: ${GameState.data.skill}`, 'cyan');

    const costVariance = 0.7 + rng() * 0.6;
    for (const key in GameState.data.itemCosts) {
        const base = Config.ITEM_COSTS_BASE[key];
        if (base !== undefined) {
            GameState.data.itemCosts[key] = Math.floor(base * costVariance);
        }
    }
    if (GameState.data.skill === 'Smooth-Talker') {
        for (const key in GameState.data.itemCosts) {
            GameState.data.itemCosts[key] = Math.floor(GameState.data.itemCosts[key] * 0.75);
        }
        Terminal.println('Your charm already lowers prices around here...', 'green');
    }
    if (GameState.data.skill === 'Penny-Pincher') {
        for (const key in GameState.data.itemCosts) {
            GameState.data.itemCosts[key] = Math.floor(GameState.data.itemCosts[key] * 0.85);
        }
        Terminal.println('You haggle with invisible merchants before even entering the shop. Prices drop.', 'green');
    }

    let startGold = 50 + Utils.randInt(1, 100);
    if (GameState.data.skill === 'Penny-Pincher') startGold += 50;
    Resources.modifyGold(startGold);
    Terminal.println(`You received ${startGold} starting gold.`, 'green');
    await Terminal.pause();

    Terminal.println('\nYou can spend gold to hire a companion and buy supplies.', 'cyan');
    Terminal.println('Companions fight alongside you and absorb enemy damage.', 'cyan');
    Terminal.println('Supplies include food, water, weapons, and armor.', 'cyan');
    Terminal.println('Stock up now — prices change based on your name!', 'cyan');
    await Terminal.pause();

    const companions = generateCompanions(3);
    displayCompanionMenu(companions);
    await handleCompanionPurchase(companions);

    const rustySword = GameState.data.items.weapons.find(w => w.name === 'Rusty Sword');
    if (rustySword) {
        GameState.player.equippedWeapon = rustySword;
        GameState.player.weapons.push(rustySword);
        Terminal.println('You received a Rusty Sword.', 'green');
    }

    GameState.addJournalEntry(`Began the journey as ${GameState.player.name} on ${diffNames[GameState.data.difficulty]} difficulty with skill ${GameState.data.skill}.`);
    if (GameState.companion) {
        GameState.addJournalEntry(`Hired ${GameState.companion.name} the ${GameState.companion.personality} companion.`);
    }

    await Terminal.pause();
    await handlePurchase();
}

async function handleGame() {
    while (true) {
        Audio.playMusic('travel');
        Terminal.clear();
        await Terminal.showAsciiArt('main_menu', 'yellow', false);
        Terminal.println('\nWhat would you like to do?');
        Terminal.println(' (1) Status    (2) Travel    (3) Hunt');
        Terminal.println(' (4) Scout     (5) Camp      (6) Cook');
        Terminal.println(' (7) Help      (8) Credits   (9) Save');
        Terminal.println(' (10) Load     (11) Journal   (12) Quit');
        if (GameState.journey.dragonEncountered) {
            Terminal.println(' (0) FIGHT THE DRAGON!', 'red', true);
        }

        const command = (await Terminal.input('')).trim().toLowerCase();

        if (Config.CHEAT_CODES.includes(command)) {
            if (typeof handleCheat === 'function') {
                await handleCheat(command);
            }
            continue;
        }

        switch (command) {
            case '1': await updateGameStatus(); break;
            case '2': await travel(); await triggerEnvironmentalEvent(); break;
            case '3': await handleHunt(); break;
            case '4': await handleScout(); await triggerEnvironmentalEvent(); break;
            case '5': await handleCamp(); break;
            case '6': await handleCook(); break;
            case '7': await handleHelp(); break;
            case '8': await handleCredits(); break;
            case '9': await handleSaveMenu(); break;
            case '10': await handleLoadMenu(); break;
            case '11': GameState.displayJournal(); await Terminal.pause(); break;
            case '12': await handleGameOver(); break;
            case '0':
                if (GameState.journey.dragonEncountered) await handleBossFight();
                break;
            default:
                Terminal.println('Invalid command.', 'red');
                await Terminal.pause();
        }

        await checkWinCondition();

        if (GameState.data.encounterTriggered && GameState.data.pendingEnemy) {
            await handleCombat(GameState.data.pendingEnemy, GameState.companion);
            GameState.data.encounterTriggered = false;
            GameState.data.pendingEnemy = null;
        }
    }
}

async function checkWinCondition() {
    if (GameState.player.health <= 0) {
        Terminal.println('\nYou have succumbed to your injuries...', 'red');
        await handleGameOver('combat');
        return;
    }
    if (GameState.journey.totalMilesTraveled >= Config.TOTAL_MILES && !GameState.journey.dragonEncountered) {
        GameState.journey.dragonEncountered = true;
    }
}

async function handleGameOver(cause = 'unknown') {
    GameState.saveLegacy(cause);
    Audio.stopMusic();
    Terminal.clear();
    await Terminal.showAsciiArt('game_over', 'red', true);
    Terminal.println(`\nFinal Score: ${GameState.data.score}`, 'yellow');
    Terminal.println(`Miles Traveled: ${GameState.journey.totalMilesTraveled}`, 'yellow');
    if (typeof HighScores !== 'undefined') {
        HighScores.add(GameState.player.name, GameState.data.score);
        HighScores.display();
    }
    const again = await Terminal.inputYesNo('Play again');
    if (again) {
        resetGame();
        await handleGameStart();
    } else {
        Terminal.println('Goodbye!', 'cyan');
        await Utils.delay(2000);
        window.location.reload();
    }
}

function resetGame() {
    GameState.reset();
}
