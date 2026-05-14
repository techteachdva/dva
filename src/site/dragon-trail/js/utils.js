/**
 * Dragon Trail Web - Utility Functions
 */

const Utils = {
    /**
     * Promise-based delay (replaces Python's time.sleep).
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Roll a d20.
     */
    rollD20() {
        return Math.floor(Math.random() * 20) + 1;
    },

    /**
     * Roll a die with given sides.
     */
    roll(sides) {
        return Math.floor(Math.random() * sides) + 1;
    },

    /**
     * Random integer in range [min, max].
     */
    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Random float in range [min, max).
     */
    randFloat(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * Random choice from array.
     */
    choice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    /**
     * Shuffle array in-place (Fisher-Yates).
     */
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    /**
     * Clamp value between min and max.
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Seed-based random number generator (simple LCG for consistency).
     * Used to match Python's seed behavior.
     */
    seededRandom(seed) {
        // LCG parameters
        const a = 1664525;
        const c = 1013904223;
        const m = 4294967296;
        let state = seed & 0xFFFFFFFF;
        return () => {
            state = (a * state + c) % m;
            return state / m;
        };
    },

    /**
     * Hash a string to an integer (replaces Python's MD5 seed).
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    },

    /**
     * Convert seed string to 9-digit int (matches Python behavior).
     */
    convertSeedToInt(seed) {
        const hash = this.hashString(seed);
        const intVal = parseInt(hash.toString(16).padStart(9, '0').slice(0, 9), 16);
        return intVal;
    },

    /**
     * Format a range tuple as string.
     */
    formatRange(range) {
        if (Array.isArray(range) || range instanceof Tuple) {
            return `(${range[0]}, ${range[1]})`;
        }
        return String(range);
    },

    /**
     * Parse a Python-style tuple string like "(36, 49)" into a JS array.
     */
    parseTuple(str) {
        if (typeof str !== 'string') return str;
        const s = str.trim();
        if (s.startsWith('(') && s.endsWith(')')) {
            const parts = s.slice(1, -1).split(',').map(p => parseInt(p.trim()));
            return parts.length === 1 ? parts[0] : parts;
        }
        return parseInt(s);
    },

    /**
     * Deep clone an object.
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
};

// Tuple helper for range values (HP, DPR)
class Tuple extends Array {
    constructor(a, b) {
        super(2);
        this[0] = a;
        this[1] = b;
    }

    toString() {
        return `(${this[0]}, ${this[1]})`;
    }

    toJSON() {
        return [this[0], this[1]];
    }

    static fromArray(arr) {
        return new Tuple(arr[0], arr[1]);
    }
}
