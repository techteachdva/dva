/**
 * Dragon Trail Web - Game State & Save/Load
 * Singleton game state with localStorage persistence.
 */

const GameState = {
    data: null,

    // Default starting state (matches Python v5)
    getDefaultState() {
        return {
            time: { day: 1, month: Config.MONTHS[0], year: 0 },
            resources: {
                food: 10, water: 8, waterskins: 1, herbs: 1, supplies: 10,
                wood: 3, woodCords: 1, gold: 0
            },
            journey: {
                totalMilesTraveled: 0,
                dragonEncountered: false,
                currentBiome: Utils.choice(Config.BIOMES),
                miniBossDefeated: false
            },
            player: {
                name: '',
                health: 100,
                maxHealth: 100,
                survival: 0,
                carryWeight: 0,
                defendCooldown: 0,
                stunSplosionCooldown: 0,
                stunned: false,
                weapons: [],
                armor: { helmet: null, chest: null, legs: null, shield: null },
                equippedWeapon: null,
                equippedArmor: { helmet: null, chest: null, legs: null, shield: null },
                acBonus: 0,
                atkBonus: 0
            },
            combat: { potions: 0 },
            seed: 0,
            lastEncounterDay: 0,
            encounterChance: 0.01,
            score: 0,
            companion: null,
            encounterTriggered: false,
            items: {
                weapons: [
                    new Weapon('Rusty Sword', [5, 10], 5, 10),
                    new Weapon('Short Bow', [3, 8], 2, 15, 1),
                    new Weapon('Fine Sword', [8, 15], 7, 50, 2),
                    new Weapon('Long Bow', [6, 12], 4, 75, 3),
                    new Weapon('Legendary Sword', [15, 30], 10, 200, 5)
                ],
                armor: [
                    new Armor('Leather Helmet', 'helmet', 1, 1, 5),
                    new Armor('Chainmail', 'chest', 3, 15, 30),
                    new Armor('Leather Armor', 'chest', 2, 10, 15),
                    new Armor('Steel Shield', 'shield', 2, 10, 20),
                    new Armor('Dragon Scale Armor', 'chest', 5, 25, 150)
                ]
            },
            itemCosts: { ...Config.ITEM_COSTS_BASE }
        };
    },

    init() {
        this.data = this.getDefaultState();
    },

    reset() {
        this.data = this.getDefaultState();
    },

    // Serialization -----------------------------------------------------------

    serialize(obj) {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj;

        if (obj instanceof Weapon) return obj.toDict();
        if (obj instanceof Armor) return obj.toDict();
        if (obj instanceof Companion) return obj.toDict();

        if (Array.isArray(obj)) {
            return obj.map(item => this.serialize(item));
        }

        const result = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                result[key] = this.serialize(obj[key]);
            }
        }
        return result;
    },

    deserialize(obj) {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            return obj.map(item => this.deserialize(item));
        }

        if (obj.__type__ === 'Weapon') return Weapon.fromDict(obj);
        if (obj.__type__ === 'Armor') return Armor.fromDict(obj);
        if (obj.__type__ === 'Companion') return Companion.fromDict(obj);

        const result = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                result[key] = this.deserialize(obj[key]);
            }
        }
        return result;
    },

    // Save/Load -----------------------------------------------------------------

    save(slot = 1) {
        try {
            const payload = this.serialize(this.data);
            payload._timestamp = Date.now();
            localStorage.setItem(`dt_save_${slot}`, JSON.stringify(payload));
            Terminal.println(`Game saved to slot ${slot}.`, 'green');
            return true;
        } catch (e) {
            Terminal.println(`Save failed: ${e.message}`, 'red');
            return false;
        }
    },

    load(slot = 1) {
        try {
            const raw = localStorage.getItem(`dt_save_${slot}`);
            if (!raw) {
                Terminal.println(`No save found in slot ${slot}.`, 'red');
                return false;
            }
            const payload = JSON.parse(raw);
            this.data = this.deserialize(payload);
            Terminal.println(`Game loaded from slot ${slot}.`, 'green');
            return true;
        } catch (e) {
            Terminal.println(`Load failed: ${e.message}`, 'red');
            return false;
        }
    },

    listSaves() {
        const saves = [];
        for (let i = 1; i <= 3; i++) {
            const raw = localStorage.getItem(`dt_save_${i}`);
            if (raw) {
                try {
                    const data = JSON.parse(raw);
                    const date = new Date(data._timestamp || Date.now());
                    saves.push({
                        slot: i,
                        name: data.player?.name || 'Unknown',
                        day: data.time?.day || 0,
                        miles: data.journey?.totalMilesTraveled || 0,
                        score: data.score || 0,
                        timestamp: date
                    });
                } catch (e) {
                    saves.push({ slot: i, name: 'Corrupted', timestamp: null });
                }
            } else {
                saves.push({ slot: i, name: null, timestamp: null });
            }
        }
        return saves;
    },

    autoSave() {
        this.save(0);
    },

    // Utility getters ----------------------------------------------------------

    get player() { return this.data.player; },
    get resources() { return this.data.resources; },
    get journey() { return this.data.journey; },
    get time() { return this.data.time; },
    get combat() { return this.data.combat; },
    get companion() { return this.data.companion; }
};

// Convenience aliases for global access
const G = GameState;
