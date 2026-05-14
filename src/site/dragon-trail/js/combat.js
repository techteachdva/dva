// Dragon Trail Web - Combat System

const PLAYER_ATTACKS = [
    { name: 'melee', damageRange: [1, 3], toHitBonus: 0 },
    { name: 'ranged', damageRange: [10, 25], toHitBonus: 1 },
    { name: 'defend', damageRange: [0, 0], toHitBonus: 0 },
    { name: 'magic', damageRange: [10, 40], toHitBonus: 7 },
    { name: 'stunsplosion', damageRange: [50, 70], toHitBonus: 10 }
];

async function handleCombat(enemy, companion) {
    Terminal.clear();
    Terminal.println(`Encounter Stats:`, 'red');
    Terminal.println(`Name: ${enemy.name}`);
    Terminal.println(`AC: ${enemy.ac}`);
    Terminal.println(`HP: ${enemy.hp}`);
    Terminal.println(`ATK Modifier: ${enemy.atkModifier}`);
    Terminal.println(`DPR Range: [${enemy.dprRange[0]}, ${enemy.dprRange[1]}]`);
    await Terminal.pause();

    let playerHp = GameState.player.health;
    let playerDefended = false;
    let initialEnemyHp = enemy.hp;
    let fled = false;
    let companionHp = companion ? companion.hp : 0;

    while (enemy.hp > 0 && playerHp > 0) {
        Terminal.clear();
        playerDefended = false;
        await printStatus(enemy, playerHp, companion);
        const choice = await getPlayerChoice();
        const result = await handlePlayerTurn(choice, enemy, playerDefended, playerHp, enemy.atkModifier, companion);
        playerHp = result.playerHp;
        enemy.hp = result.enemyHp;
        playerDefended = result.playerDefended;
        if (companion) companion.hp = result.companionHp;
        if (enemy.stunned) {
            Terminal.println(`\nThe ${enemy.name} is stunned and cannot act!`, 'magenta');
            enemy.stunned = false;
            await Terminal.pause();
            continue;
        }

        fled = result.fled;
        if (fled) {
            break;
        }

        // Companion auto-attack
        if (companion && companion.isAlive() && enemy.hp > 0) {
            const companionDmg = companion.attack();
            enemy.hp -= companionDmg;
            Terminal.println(`${companion.name} strikes the ${enemy.name} for ${companionDmg} damage!`, 'cyan');
        }

        // Enemy turn
        if (enemy.hp > 0) {
            await enemyTelegraph(enemy);
            const playerAc = GameState.player.acBonus + getPlayerAc();
            const enemyDamage = enemy.attack(playerAc, playerDefended);
            if (companion && companion.isAlive()) {
                companion.takeDamage(enemyDamage);
                companion.modifyRelationship(+5); // gratitude for taking hits
                Terminal.println(`${companion.name} absorbs ${enemyDamage} damage!`, 'yellow');
                if (companion.hp <= 0) {
                    Terminal.println(`${companion.name} has fallen!`, 'red');
                    companion.modifyRelationship(-30);
                } else if (companion.hp < companion.maxHp * 0.25) {
                    Terminal.println(`${companion.name} is critically wounded!`, 'red');
                    companion.modifyRelationship(-10);
                }
            } else {
                playerHp -= enemyDamage;
                Terminal.println(`The ${enemy.name} attacks you for ${enemyDamage} damage!`, 'red');
                if (enemyDamage > 15) Terminal.shakeScreen();
            }
        }

        // Companion sacrifice check
        if (companion && companion.isAlive() && playerHp <= 0 && companion.relationship >= 80) {
            playerHp = 1;
            companion.hp = 0;
            Terminal.println(`\n${companion.name} throws themselves in front of you!`, 'magenta');
            Terminal.println(`They take the fatal blow. You survive with 1 HP.`, 'red');
            Terminal.println(`${companion.name} dies in your arms.`, 'red');
            await Terminal.pause();
        }

        // Cooldowns
        if (GameState.player.defendCooldown > 0) GameState.player.defendCooldown--;
        if (GameState.player.stunSplosionCooldown > 0) GameState.player.stunSplosionCooldown--;

        await Terminal.pause();
    }

    // Result
    if (fled) {
        Terminal.println('You got away safely.', 'green');
        GameState.addJournalEntry(`Fled from a ${enemy.name} at mile ${GameState.journey.totalMilesTraveled}.`);
        if (Math.random() < 0.4) {
            const nemesisHp = Math.floor(enemy.maxHp * 0.6);
            GameState.data.nemeses.push({
                name: `Wounded ${enemy.name}`,
                ac: enemy.ac,
                hp: nemesisHp,
                maxHp: nemesisHp,
                atkModifier: enemy.atkModifier + 1,
                dprRange: enemy.dprRange,
                xp: Math.floor(enemy.xp * 0.8)
            });
            Terminal.println(`The ${enemy.name} limps away, vengeful...`, 'red');
        }
        await Terminal.pause();
    } else if (enemy.hp <= 0) {
        Terminal.println(`You defeated the ${enemy.name}!`, 'green');
        const xp = Math.floor(4.5 * initialEnemyHp);
        GameState.data.score += xp;
        Terminal.println(`You gained ${xp} XP!`, 'green');
        GameState.addJournalEntry(`Defeated a ${enemy.name} and gained ${xp} XP.`);
        if (companion && companion.isAlive()) {
            companion.modifyRelationship(+10);
            Terminal.println(`${companion.name} looks proud of the victory.`, 'cyan');
        }
        await handleLoot(enemy.loot);
    } else if (playerHp <= 0) {
        Terminal.println(`You were defeated by the ${enemy.name}!`, 'red');
        await handleGameOver('combat');
        return;
    }

    GameState.player.health = playerHp;
}

async function getPlayerChoice() {
    Terminal.println('\nYour Turn:', 'white', true);
    Terminal.println('1. Attack (Sword)');
    Terminal.println('2. Attack (Ranged)');
    const defendStatus = GameState.player.defendCooldown > 0 ? `On Cooldown (${GameState.player.defendCooldown})` : 'Available';
    Terminal.println(`3. Defend (Reflect) - ${defendStatus}`);
    Terminal.println('4. Magic Bolt');
    const stunStatus = GameState.player.stunSplosionCooldown > 0 ? `On Cooldown (${GameState.player.stunSplosionCooldown})` : 'Available';
    Terminal.println(`5. Cast Stun-Splosion (10 Potions) - ${stunStatus}`);
    Terminal.println('6. Use Potion');
    Terminal.println('7. Flee');
    return await Terminal.inputNumber('Choose your action (1-7): ', 1, 7);
}

async function handlePlayerTurn(choice, enemy, playerDefended, playerHp, atkModifier, companion) {
    let enemyHp = enemy.hp;
    let newPlayerHp = playerHp;
    let newPlayerDefended = playerDefended;
    let companionHp = companion ? companion.hp : 0;
    let fled = false;

    switch (choice) {
        case 1: // Melee
            enemyHp -= playerAttack(enemy.ac, 'melee');
            break;
        case 2: // Ranged
            enemyHp -= playerAttack(enemy.ac, 'ranged');
            break;
        case 3: // Defend
            if (GameState.player.defendCooldown > 0) {
                Terminal.println('Defend is on cooldown!', 'red');
            } else {
                GameState.player.defendCooldown = 3;
                newPlayerDefended = true;
                const reflectDamage = playerAttack(enemy.ac, 'defend');
                enemyHp -= reflectDamage;
                if (reflectDamage > 0) {
                    Terminal.println(`You reflect ${reflectDamage} damage!`, 'cyan');
                }
                Terminal.println('You take a defensive stance!', 'cyan');
            }
            break;
        case 4: // Magic
            enemyHp -= playerAttack(enemy.ac, 'magic');
            break;
        case 5: // Stun-Splosion
            if (GameState.player.stunSplosionCooldown > 0) {
                Terminal.println('Stun-Splosion is on cooldown!', 'red');
            } else if (GameState.combat.potions < 10) {
                Terminal.println('Not enough potions! You need 10 potions.', 'red');
            } else {
                GameState.combat.potions -= 10;
                GameState.player.stunSplosionCooldown = 5;
                const stunDamage = playerAttack(enemy.ac, 'stunsplosion');
                enemyHp -= stunDamage;
                if (stunDamage > 0) {
                    enemy.stunned = true;
                    Terminal.println(`The ${enemy.name} reels from the blast! Stunned!`, 'magenta');
                }
            }
            break;
        case 6: // Use Potion
            if (GameState.combat.potions > 0) {
                GameState.combat.potions--;
                const heal = Utils.randInt(33, 66);
                newPlayerHp = Math.min(GameState.player.maxHealth, newPlayerHp + heal);
                Terminal.println(`You drank a potion and restored ${heal} HP!`, 'green');
            } else {
                Terminal.println('You have no potions!', 'red');
            }
            break;
        case 7: // Flee
            fled = await handleFlee(atkModifier);
            break;
    }

    return {
        playerHp: newPlayerHp,
        enemyHp: enemyHp,
        playerDefended: newPlayerDefended,
        companionHp: companionHp,
        fled: fled
    };
}

function playerAttack(enemyAc, attackType) {
    const weapon = GameState.player.equippedWeapon;
    const baseDamage = weapon ? weapon.damageRange : [1, 3];
    const toHit = weapon ? weapon.toHitBonus : 0;
    const roll = Utils.rollD20();
    const weatherMod = typeof getWeatherCombatMod === 'function' ? getWeatherCombatMod() : 0;
    const total = roll + GameState.player.survival + toHit + weatherMod;
    const isCrit = roll === 20;
    Terminal.println(`Player attack roll: ${roll} + Survival: ${GameState.player.survival} + To Hit: ${toHit} + Weather: ${weatherMod} = ${total}`);
    if (isCrit || total >= enemyAc) {
        let damage;
        if (attackType === 'melee') damage = isCrit ? baseDamage[1] + 5 : Utils.randInt(...baseDamage);
        else if (attackType === 'ranged') damage = isCrit ? 35 : Utils.randInt(10, 25);
        else if (attackType === 'magic') damage = isCrit ? 55 : Utils.randInt(10, 40);
        else if (attackType === 'stunsplosion') damage = isCrit ? 90 : Utils.randInt(50, 70);
        else if (attackType === 'defend') damage = isCrit ? 30 : Utils.randInt(10, 20);
        const label = isCrit ? 'CRITICAL HIT!' : 'Hit!';
        Terminal.println(`${label} Dealt ${damage} damage.`, isCrit ? 'magenta' : 'green');
        if (isCrit) Terminal.shakeScreen();
        return damage;
    } else {
        Terminal.println('Miss!', 'yellow');
        return 0;
    }
}

async function handleFlee(atkModifier) {
    if (GameState.companion && !GameState.companion.isAlive()) {
        Terminal.println('Your companion has fallen. You escape!', 'green');
        return true;
    }
    const fleeChance = 1 - (atkModifier / 10);
    const fleeRoll = Math.random();
    Terminal.println(`Flee chance: ${fleeChance.toFixed(2)}, Roll: ${fleeRoll.toFixed(2)}`);
    if (fleeRoll < fleeChance) {
        Terminal.println('You successfully flee!', 'green');
        return true;
    } else {
        Terminal.println('You failed to flee!', 'red');
        return false;
    }
}

async function handleBossFight() {
    Audio.playMusic('boss_fight');
    const currentBiome = GameState.journey.currentBiome;
    const dragonResult = getRandomDragon(currentBiome);
    if (!dragonResult) {
        Terminal.println('No dragons found in this biome! You win by default! +1000 XP', 'green');
        GameState.data.score += 1000;
        return;
    }
    const [enemyName, dragonStats] = dragonResult;
    // Parse stats (handle tuples)
    let enemyAc = dragonStats.ac;
    let enemyHp = Array.isArray(dragonStats.hp) ? Utils.randInt(...dragonStats.hp) : dragonStats.hp;
    let atkMod = dragonStats.atk;
    let dprRange = Array.isArray(dragonStats.dpr) ? dragonStats.dpr : [dragonStats.dpr, dragonStats.dpr];

    Terminal.println('\nYOU HAVE ARRIVED AT THE DRAGON\'S LAIR!', 'red', true);
    await Terminal.showAsciiArt('dragonart', 'red');
    Terminal.println(`\nYou face the ${enemyName}!`);

    // Potion creation dialog (BEFORE combat)
    await handlePreCombatPotions();

    const enemy = new Enemy(enemyName, enemyAc, enemyHp, atkMod, dprRange, Math.floor(4.5 * enemyHp));
    await handleCombat(enemy, GameState.companion);
    if (enemy.hp <= 0) {
        await concludeBattle(enemy.maxHp);
        await handleGameOver();
    }
}

async function handleMiniBossFight() {
    Audio.playMusic('mini_boss_fight');
    Terminal.println('\nYOU HAVE ENCOUNTERED A MINI-BOSS!', 'red', true);

    const enemyName = "MisLefrak the Malevolent";
    const enemyAc = getMiniBossAc();
    const enemyHp = 100;
    const atkMod = 5;
    const dprRange = [10, 20];

    await handlePreCombatPotions();

    const enemy = new Enemy(enemyName, enemyAc, enemyHp, atkMod, dprRange, Math.floor(4.5 * enemyHp));
    await handleCombat(enemy, GameState.companion);
}

async function concludeBattle(dragonMaxHealth) {
    Terminal.println('\nYOU HAVE DEFEATED THE DRAGON! YOU WIN!!!', 'green', true);
    const xp = Math.floor(4.5 * dragonMaxHealth);
    GameState.data.score += xp;
    Terminal.println(`You gained ${xp} XP!`, 'green');
    Terminal.println('\nVictory!');
    await Utils.delay(2000);
}

async function handlePreCombatPotions() {
    const herbs = GameState.resources.herbs;
    const supplies = GameState.resources.supplies;
    if (herbs > 0 || supplies > 0) {
        Terminal.println('\nYou have a chance to prepare before the fight:');
        const choice = await Terminal.inputYesNo(`You have ${herbs} herbs and ${supplies} supplies. Create potions?`);
        if (choice) {
            const herbsUsed = Utils.clamp(
                await Terminal.inputNumber(`How many herbs? (0-${herbs}): `, 0, herbs),
                0, herbs
            );
            const suppliesUsed = Utils.clamp(
                await Terminal.inputNumber(`How many supplies? (0-${supplies}): `, 0, supplies),
                0, supplies
            );
            const potionsCreated = herbsUsed * (suppliesUsed > 0 ? 2 : 1) + suppliesUsed * (herbsUsed > 0 ? 3 : 2);
            GameState.resources.herbs -= herbsUsed;
            GameState.resources.supplies -= suppliesUsed;
            GameState.combat.potions += potionsCreated;
            Terminal.println(`You created ${potionsCreated} potions!`, 'green');
        }
    }
}

function getRandomDragon(biome) {
    const candidates = ENCOUNTER_DATA.filter(row =>
        row.biome.toUpperCase() === biome.toUpperCase() &&
        row.name.toLowerCase().includes('dragon') &&
        !row.name.toLowerCase().includes('dragonborn')
    );
    if (candidates.length === 0) return null;
    const data = Utils.choice(candidates);
    return [data.name, {
        ac: data.ac,
        hp: data.hp,
        atk: data.atk,
        dpr: data.dpr
    }];
}

function getRandomEncounter(biome, encounterType) {
    const candidates = ENCOUNTER_DATA.filter(row =>
        row.biome.toUpperCase() === biome.toUpperCase() &&
        row.type.toUpperCase() === encounterType.toUpperCase()
    );
    if (candidates.length === 0) return null;
    const data = Utils.choice(candidates);
    const enemyHp = Array.isArray(data.hp) ? Utils.randInt(...data.hp) : data.hp;
    const dprRange = Array.isArray(data.dpr) ? data.dpr : [data.dpr, data.dpr];
    const xp = Math.floor(4.5 * enemyHp);
    return new Enemy(data.name, data.ac, enemyHp, data.atk, dprRange, xp);
}

function getPlayerAc() {
    // AC based on survival skill (same as v5)
    const survival = GameState.player.survival;
    const acTable = { 8: 17, 7: 17, 6: 16, 5: 16, 4: 15, 3: 15, 2: 14, 1: 14, 0: 13 };
    return acTable[survival] || 13;
}

function getMiniBossAc() {
    const survival = GameState.player.survival;
    const acTable = { 8: 15, 7: 16, 6: 17, 5: 18, 4: 19, 3: 20, 2: 21, 1: 22, 0: 23 };
    return acTable[survival] || 23;
}

async function enemyTelegraph(enemy) {
    const attackType = Utils.choice(['regularAttack', 'mediumAttack', 'bigAttack']);
    enemy._nextAttack = attackType;
    const typeLabels = {
        regularAttack: 'quick jab',
        mediumAttack: 'balanced strike',
        bigAttack: 'heavy swing'
    };
    const telegraphs = {
        regularAttack: [
            `The ${enemy.name} feints left and darts in for a quick jab!`,
            `The ${enemy.name} snaps forward with a rapid strike!`
        ],
        mediumAttack: [
            `The ${enemy.name} winds up for a balanced strike!`,
            `The ${enemy.name} shifts its weight, preparing a solid blow!`
        ],
        bigAttack: [
            `The ${enemy.name} raises its weapon high for a devastating swing!`,
            `The ${enemy.name} roars and commits to a heavy overhead blow!`
        ]
    };
    Terminal.println(`\n${Utils.choice(telegraphs[attackType])}`, 'red');
    Terminal.println(`[Telegraph: ${typeLabels[attackType]}]`, 'yellow');
    await Utils.delay(400);
}

async function handleLoot(loot) {
    if (loot.length === 0) return;
    Terminal.println('\nLoot obtained:', 'green');
    for (const item of loot) {
        if (item instanceof Weapon) {
            GameState.player.equippedWeapon = item;
            GameState.player.weapons.push(item);
            Terminal.println(`- Equipped: ${item.name} (Damage: ${item.damageRange})`, 'green');
        } else if (item instanceof Armor) {
            GameState.player.equippedArmor[item.armorType] = item;
            GameState.player.armor[item.armorType] = item;
            Terminal.println(`- Equipped: ${item.name} (AC +${item.acBonus})`, 'green');
        }
    }
    // Recalculate total AC bonus from equipped armor
    GameState.player.acBonus = Object.values(GameState.player.equippedArmor).filter(a => a).reduce((sum, a) => sum + a.acBonus, 0);
    Resources.updateCarryWeight();
}

async function printStatus(enemy, playerHp, companion) {
    Terminal.println(`\n${enemy.name} HP: ${enemy.hp}`, 'red');
    Terminal.println(`Your HP: ${playerHp}`, 'green');
    Terminal.println(`Potions: ${GameState.combat.potions}`);
    if (companion && companion.isAlive()) {
        Terminal.println(`${companion.name} HP: ${companion.hp}/${companion.maxHp} | ${companion.personality} | Mood: ${companion.getMood()}`, 'yellow');
    }
    Terminal.println('\nEquipped:');
    const weapon = GameState.player.equippedWeapon;
    Terminal.println(`Weapon: ${weapon ? weapon.name : 'None'}`);
    const armor = GameState.player.equippedArmor;
    const armorList = Object.values(armor).filter(a => a).map(a => a.name).join(', ') || 'None';
    Terminal.println(`Armor: ${armorList}`);
    const acBonus = Object.values(armor).filter(a => a).reduce((sum, a) => sum + a.acBonus, 0);
    Terminal.println(`AC Bonus: ${acBonus}`);
}
