/**
 * Dragon Trail Web - Game Classes
 * Weapon, Armor, Enemy, Companion, Encounter hierarchy.
 */

// Section 4: Item Classes ------------------------------------------------------

class Weapon {
    constructor(name, damageRange, weight, cost, toHitBonus = 0) {
        this.name = name;
        this.damageRange = damageRange; // [min, max]
        this.weight = weight;
        this.cost = cost;
        this.toHitBonus = toHitBonus;
    }

    toDict() {
        return {
            __type__: 'Weapon',
            name: this.name,
            damageRange: this.damageRange,
            weight: this.weight,
            cost: this.cost,
            toHitBonus: this.toHitBonus
        };
    }

    static fromDict(d) {
        return new Weapon(d.name, d.damageRange, d.weight, d.cost, d.toHitBonus || 0);
    }
}

class Armor {
    constructor(name, armorType, acBonus, weight, cost) {
        this.name = name;
        this.armorType = armorType; // 'helmet', 'chest', 'legs', 'shield'
        this.acBonus = acBonus;
        this.weight = weight;
        this.cost = cost;
    }

    toDict() {
        return {
            __type__: 'Armor',
            name: this.name,
            armorType: this.armorType,
            acBonus: this.acBonus,
            weight: this.weight,
            cost: this.cost
        };
    }

    static fromDict(d) {
        return new Armor(d.name, d.armorType, d.acBonus, d.weight, d.cost);
    }
}

// Section 5: Entity Classes ----------------------------------------------------

class Companion {
    constructor(name, hp, dpr, gpCost) {
        this.name = name;
        this.hp = hp;
        this.maxHp = hp;
        this.dpr = dpr;
        this.gpCost = gpCost;
    }

    attack() {
        return this.dpr;
    }

    takeDamage(damage) {
        this.hp = Math.max(0, this.hp - damage);
    }

    isAlive() {
        return this.hp > 0;
    }

    heal() {
        this.hp = this.maxHp;
    }

    toDict() {
        return {
            __type__: 'Companion',
            name: this.name,
            hp: this.hp,
            maxHp: this.maxHp,
            dpr: this.dpr,
            gpCost: this.gpCost
        };
    }

    static fromDict(d) {
        const c = new Companion(d.name, d.hp, d.dpr, d.gpCost);
        c.maxHp = d.maxHp || d.hp;
        return c;
    }
}

class Enemy {
    constructor(name, ac, hp, atkModifier, dprRange, xp) {
        this.name = name;
        this.ac = ac;
        this.hp = hp;
        this.maxHp = hp;
        this.atkModifier = atkModifier;
        this.dprRange = dprRange; // [min, max]
        this.minDamage = dprRange[0];
        this.maxDamage = dprRange[1];
        this.xp = xp;
        this.loot = this.generateLoot(xp);
    }

    generateLoot(xp) {
        const loot = [];
        const numItems = 1 + Math.floor(xp / 100);
        const weapons = GameState.data.items.weapons;
        const armors = GameState.data.items.armor;

        for (let i = 0; i < numItems; i++) {
            if (Math.random() < 0.6) {
                loot.push(Utils.choice(weapons));
            } else if (Math.random() < 0.4) {
                loot.push(Utils.choice(armors));
            }
        }
        return loot;
    }

    regularAttack(playerAc) {
        const hit = Utils.rollD20() + this.atkModifier * 2;
        return hit >= playerAc ? this.minDamage : 0;
    }

    mediumAttack(playerAc) {
        const hit = Utils.rollD20() + this.atkModifier;
        if (hit >= playerAc) {
            return Utils.randInt(this.minDamage, this.maxDamage);
        }
        return 0;
    }

    bigAttack(playerAc) {
        const hit = Utils.rollD20() + Math.floor(this.atkModifier / 2);
        return hit >= playerAc ? this.maxDamage : 0;
    }

    attack(playerAc, playerDefending) {
        const attackChoice = Utils.choice(['regularAttack', 'mediumAttack', 'bigAttack']);
        const damage = this[attackChoice](playerAc);
        return damage;
    }
}

// Section 5b: Encounter Classes -------------------------------------------------

class Encounter {
    constructor(encounterType, difficultyMod = 0) {
        this.encounterType = encounterType;
        this.difficultyMod = difficultyMod;
    }

    async simulate(survival, progress) {
        let baseDifficulty;
        if (progress <= 0.25) baseDifficulty = 5;
        else if (progress <= 0.50) baseDifficulty = 10;
        else if (progress <= 0.75) baseDifficulty = 15;
        else if (progress <= 0.90) baseDifficulty = 20;
        else baseDifficulty = 25;

        const difficulty = baseDifficulty + this.difficultyMod;
        const d20Roll = Utils.rollD20();
        const totalRoll = d20Roll + survival;

        Terminal.println(`You roll a d20: ${d20Roll} + Survival Skill (${survival}) = ${totalRoll}`, 'yellow');
        Terminal.println(`The difficulty of the ${this.encounterType} encounter is ${difficulty}.`, 'yellow');

        if (totalRoll >= difficulty) {
            await this.onSuccess();
        } else {
            await this.onFailure();
        }
    }

    async onSuccess() {
        throw new Error('Must be implemented by subclass');
    }

    async onFailure() {
        throw new Error('Must be implemented by subclass');
    }
}

class FloraEncounter extends Encounter {
    constructor() {
        super('Flora', 0);
    }

    async onSuccess() {
        const herbsFound = Utils.randInt(5, 10);
        Terminal.println(`You successfully forage the area and find ${herbsFound} herbs!`, 'green');
        Resources.modify('herbs', herbsFound);
    }

    async onFailure() {
        Terminal.println('You fail to find any useful plants and waste precious time.', 'red');
        Resources.modifyHealth(-5);
    }
}

class FaunaEncounter extends Encounter {
    constructor(subtype) {
        super(`Fauna (${subtype})`, 0);
        this.subtype = subtype;
    }

    async onSuccess() {
        if (this.subtype === 'wild_beast') {
            const foodGained = Utils.randInt(10, 20);
            Terminal.println(`You defeat the wild beast and gain ${foodGained} lbs of food!`, 'green');
            Resources.modify('food', foodGained);
        }
    }

    async onFailure() {
        Terminal.println('The wild beast wounds you before escaping!', 'red');
        Resources.modifyHealth(-10);
    }
}

class HumanoidEncounter extends Encounter {
    constructor(subtype) {
        super(`Humanoid (${subtype})`, 0);
        this.subtype = subtype;
    }

    async onSuccess() {
        if (this.subtype === 'bandit') {
            const suppliesGained = Utils.randInt(1, 3);
            const goldGained = Utils.randInt(10, 30);
            Terminal.println(`You defeat the bandit and gain ${suppliesGained} supplies and ${goldGained} gold!`, 'green');
            Resources.modify('supplies', suppliesGained);
            Resources.modifyGold(goldGained);
        }
    }

    async onFailure() {
        Terminal.println('The bandit overpowers you and steals some of your resources!', 'red');
        Resources.modify('supplies', -2);
        Resources.modifyGold(-10);
        Resources.modifyHealth(-15);
    }
}
