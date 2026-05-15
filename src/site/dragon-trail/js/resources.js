// Dragon Trail Web - Resource Management System

const Resources = {
    // Carry capacity based on difficulty
    getCarryCapacity() {
        const difficulty = GameState.data.difficulty;
        const capacities = { 0: 140, 1: 100, 2: 70, 3: 55 };
        return capacities[difficulty] || 100;
    },

    // Player AC based on survival skill
    getPlayerAc() {
        const survival = GameState.player.survival;
        const acTable = { 8: 17, 7: 17, 6: 16, 5: 16, 4: 15, 3: 15, 2: 14, 1: 14, 0: 13 };
        return acTable[survival] || 13;
    },

    // Mini-boss AC based on survival skill
    getMiniBossAc() {
        const survival = GameState.player.survival;
        const acTable = { 8: 15, 7: 16, 6: 17, 5: 18, 4: 19, 3: 20, 2: 21, 1: 22, 0: 23 };
        return acTable[survival] || 23;
    },

    // Modify a resource amount
    modify(resourceType, amount) {
        const res = GameState.resources;
        if (!(resourceType in res)) {
            Terminal.println(`Invalid resource type: ${resourceType}`, 'red');
            return;
        }
        const after = res[resourceType] + amount;
        if (after < 0 && amount < 0) {
            Terminal.println(`Not enough ${resourceType}!`, 'red');
            return;
        }
        res[resourceType] = Math.max(0, after);
        this.updateCarryWeight();
    },

    // Modify gold
    modifyGold(amount) {
        GameState.resources.gold += amount;
        const color = amount >= 0 ? 'yellow' : 'red';
        Terminal.println(`Gold ${amount >= 0 ? '+' : ''}${amount}. Current: ${GameState.resources.gold}`, color);
    },

    // Modify health
    modifyHealth(amount, eventDescription) {
        GameState.player.health = Math.min(Config.MAX_HEALTH_LEVEL, GameState.player.health + amount);
        if (GameState.player.health <= 0) {
            // Game over will be handled by caller
            return;
        }
        if (eventDescription) {
            Terminal.println(`Event: ${eventDescription}`, 'cyan');
        }
    },

    // Collect water (respects capacity)
    collectWater(amount) {
        const current = GameState.resources.water;
        const space = Config.MAX_WATER_CAPACITY - current;
        if (space <= 0) {
            Terminal.println('Waterskins are full!', 'red');
            return;
        }
        const toCollect = Math.min(amount, space);
        this.modify('water', toCollect);
    },

    // Collect wood (updates cords)
    collectWood(amount) {
        this.modify('wood', amount);
        GameState.resources.woodCords = Math.floor(GameState.resources.wood / Config.WOOD_CORD_SIZE);
    },

    // Update carry weight
    updateCarryWeight() {
        const res = GameState.resources;
        const weights = Config.ITEM_WEIGHTS;
        let total = 0;
        total += (res.food || 0) * (weights.food || 1);
        total += (res.herbs || 0) * (weights.herbs || 0.1);
        total += (res.supplies || 0) * (weights.supplies || 1);
        total += (res.water || 0) * (weights.water || 1);
        total += (res.waterskins || 0) * 0.5;
        total += (res.wood || 0) * (weights.wood || 1);
        // Add all owned weapons weight
        for (const w of GameState.player.weapons) {
            if (w) total += w.weight || 0;
        }
        // Add equipped armor weight
        for (const armor of Object.values(GameState.player.equippedArmor)) {
            if (armor) total += armor.weight;
        }
        GameState.player.carryWeight = Math.round(total * 10) / 10;

        if (GameState.player.carryWeight > this.getCarryCapacity()) {
            Terminal.println(`Warning: Over capacity! (${GameState.player.carryWeight} / ${this.getCarryCapacity()})`, 'red');
            this.autoDropExcess();
        }
    },

    // Auto-drop items when over capacity
    autoDropExcess() {
        const res = GameState.resources;
        const weights = Config.ITEM_WEIGHTS;
        while (GameState.player.carryWeight > this.getCarryCapacity()) {
            // Find heaviest resource to drop
            const candidates = [
                { type: 'food', weight: weights.food, val: res.food },
                { type: 'water', weight: weights.water, val: res.water },
                { type: 'supplies', weight: weights.supplies, val: res.supplies },
                { type: 'wood', weight: weights.wood, val: res.wood }
            ].filter(c => c.val > 0).sort((a, b) => b.weight - a.weight);

            if (candidates.length === 0) break;
            const toDrop = candidates[0];
            this.modify(toDrop.type, -1);
            Terminal.println(`Dropped 1 ${toDrop.type} to meet capacity.`, 'yellow');
        }
    },

    // Create potions from herbs and supplies
    createPotions() {
        const res = GameState.resources;
        const potions = res.herbs + Math.floor(res.food / 8) + Math.floor(res.supplies / 8);
        GameState.combat.potions = potions;
        return potions;
    },

    // Set item costs based on seed
    randomizeItemCosts(seed) {
        const rng = Utils.seededRandom(seed);
        const costs = {
            food: Math.floor(rng() * 4) + 1,
            water: Math.floor(rng() * 5) + 2,
            herbs: Math.floor(rng() * 7) + 3,
            supplies: Math.floor(rng() * 7) + 2,
            wood: Math.floor(rng() * 5) + 1,
            potion: Math.floor(rng() * 5) + 8
        };
        GameState.data.itemCosts = costs;
        return costs;
    },

    // Convert wood to cords
    convertWoodToCords(woodWeight) {
        const fullCords = Math.floor(woodWeight / Config.WOOD_CORD_SIZE);
        const remaining = woodWeight % Config.WOOD_CORD_SIZE;
        return [fullCords, remaining];
    },

    // Drink water
    drinkWater() {
        if (GameState.resources.water < Config.WATER_DRINK_AMOUNT) {
            Terminal.println("You don't have enough water to drink!", 'red');
            return;
        }
        this.modify('water', -Config.WATER_DRINK_AMOUNT);
        this.modifyHealth(1);
    },

    // Check for low resources
    checkLowResources() {
        const res = GameState.resources;
        const alerts = [];
        const thresholds = { food: 3, water: 3, woodCords: 1, herbs: 1, supplies: 1 };
        for (const [resource, threshold] of Object.entries(thresholds)) {
            if (res[resource] <= threshold) {
                alerts.push(`You are down to ${res[resource]} ${resource}!`);
            }
        }
        if (alerts.length > 0) {
            Terminal.println('\nLOW RESOURCES ALERT:', 'red');
            for (const alert of alerts) {
                Terminal.println(alert, 'red');
            }
            Terminal.println('Consider gathering more resources before proceeding.', 'red');
        }
    }
};

// High Scores System
const HighScores = {
    scores: [],

    load() {
        try {
            const raw = localStorage.getItem('dt_highscores');
            if (raw) {
                this.scores = JSON.parse(raw);
            }
        } catch (e) {
            this.scores = [];
        }
    },

    save() {
        localStorage.setItem('dt_highscores', JSON.stringify(this.scores.slice(0, 10)));
    },

    add(name, score) {
        this.scores.push({ name, score, date: new Date().toISOString() });
        this.scores.sort((a, b) => b.score - a.score);
        this.scores = this.scores.slice(0, 10);
        this.save();
    },

    display() {
        Terminal.println('\nHigh Scores:', 'magenta', true);
        if (this.scores.length === 0) {
            Terminal.println('No high scores yet!');
            return;
        }
        for (let i = 0; i < this.scores.length; i++) {
            const s = this.scores[i];
            Terminal.println(`${i + 1}. ${s.name}: ${s.score}`);
        }
    }
};

HighScores.load();
