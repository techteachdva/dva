/**
 * Dragon Trail Web - Configuration Constants
 * Ported from Python v5.
 */

const Config = {
    // Time
    MONTHS: [
        "O'drahn 1 (June)", "O'drahn 2 (July)", "O'drahn 3 (August)", "O'drahn 4 (September)",
        "Remiscus 1 (October)", "Remiscus 2 (November)", "Remiscus 3 (December)", "Remiscus 4 (January)",
        "Demiscus 1 (February)", "Demiscus 2 (March)", "Demiscus 3 (April)", "Demiscus 4 (May)"
    ],

    // Biomes
    BIOMES: [
        "MARINE", "GLACIER", "TUNDRA", "TAIGA", "COLD_DESERT", "HOT_DESERT",
        "TROPICAL_RAINFOREST", "WETLAND", "TROPICAL_SEASONAL_FOREST", "SAVANNA",
        "GRASSLAND", "TEMPERATE_DECIDUOUS_FOREST", "TEMPERATE_RAINFOREST"
    ],

    BIOME_CONNECTIONS: {
        "MARINE": ["MARINE", "WETLAND", "TROPICAL_RAINFOREST", "GLACIER", "TEMPERATE_RAINFOREST"],
        "GLACIER": ["TUNDRA", "COLD_DESERT"],
        "TUNDRA": ["GLACIER", "TAIGA", "COLD_DESERT"],
        "TAIGA": ["TUNDRA", "TEMPERATE_DECIDUOUS_FOREST", "GRASSLAND"],
        "COLD_DESERT": ["TUNDRA", "GLACIER"],
        "HOT_DESERT": ["SAVANNA", "GRASSLAND"],
        "TROPICAL_RAINFOREST": ["TROPICAL_SEASONAL_FOREST", "WETLAND"],
        "WETLAND": ["TROPICAL_RAINFOREST", "TROPICAL_SEASONAL_FOREST", "GRASSLAND"],
        "TROPICAL_SEASONAL_FOREST": ["TROPICAL_RAINFOREST", "SAVANNA"],
        "SAVANNA": ["HOT_DESERT", "TROPICAL_SEASONAL_FOREST", "GRASSLAND"],
        "GRASSLAND": ["SAVANNA", "TEMPERATE_DECIDUOUS_FOREST", "TAIGA"],
        "TEMPERATE_DECIDUOUS_FOREST": ["GRASSLAND", "TAIGA"],
        "TEMPERATE_RAINFOREST": ["TEMPERATE_DECIDUOUS_FOREST", "TROPICAL_RAINFOREST"]
    },

    // Travel
    MIN_MILES_PER_TRAVEL: 18,
    MAX_MILES_PER_TRAVEL: 30,
    MIN_DAYS_PER_TRAVEL: 1,
    MAX_DAYS_PER_TRAVEL: 2,
    TOTAL_MILES: 1000,

    // Combat
    MAX_HEALTH_LEVEL: 100,
    PLAYER_AC_BASE: 16,
    DRAGON_AC: 20,
    MINI_BOSS_AC_BASE: 15,

    // Resources
    MIN_DAYS_PER_REST: 1,
    MAX_DAYS_PER_REST: 3,
    FOOD_PER_HUNT: 5,
    MIN_DAYS_PER_HUNT: 1,
    MAX_DAYS_PER_HUNT: 4,
    WATER_SKIN_CAPACITY: 8,
    WATER_DRINK_AMOUNT: 1,
    WOOD_CORD_SIZE: 3,
    MAX_CARRY_CAPACITY_BASE: 150,
    MAX_WATER_CAPACITY: 80,

    // XP
    XP_MULTIPLIER: 4.5,

    // Companion names
    COMPANION_NAMES: [
        "Bartholomew", "Cinder", "Sparky", "Whisperwind", "Stormbreaker", "Ironhide", "Shadowclaw", "Swiftfoot",
        "Ember", "Frostbite", "Rockjaw", "Skydancer", "Grimblade", "Nightsong", "Stoneheart", "Windrunner",
        "Blaze", "Glacier", "Boulder", "Cloud", "Razor", "Moonbeam", "Ironclad", "Silversong",
        "Dominick", "David", "Tristan", "Grace"
    ],

    // Cheat codes
    CHEAT_CODES: ['bubblegum', 'rowan', 'smudge', 'jillybean'],

    // Item costs (default, randomized by seed)
    ITEM_COSTS_BASE: {
        food: 2,
        water: 4,
        herbs: 6,
        supplies: 5,
        wood: 3,
        potion: 10
    },

    ITEM_WEIGHTS: {
        food: 1,
        water: 1,
        herbs: 0.1,
        supplies: 1,
        wood: 1,
        potion: 0.1
    }
};
