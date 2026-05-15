// Dragon Trail Web - Main Entry Point & Game Loop

// Section 9: ASCII Art Definitions ---------------------------------------------

const ASCII_ART = {
    game_over: `
GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER
GGGGGGGG    AAAAAAAA    MMM   MMM   EEEEEE     OOOOOOOO  V       V  EEEEEE RRRRRRRR
GG          AA    AA    MM M M MM   E          OO    OO   V     V   E      RR    RR
GG  GGGG    AAAAAAAA    MM  M  MM   EEEE       OO    OO    V   V    EEEE   RRRRRRR
GG    GG    AA    AA    MM     MM   E          OO    OO     V V     E      RR  RR
GGGGGGGG    AA    AA    MM     MM   EEEEEE     OOOOOOOO      V      EEEEEE RR    RR
GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER^GAME_OVER
    `,

    writtenby: `
    DM.ZEMO-DM.ZEMO-DM.ZEMO-DM.ZEMO-DM.ZEMO-DM.ZEMO-DM.ZEMO-DM.ZEMO
      DDDDDD  MMM   MMM    ZZZZZZZZ EEEEEEEE  MMM   MMM   OOOOOOO
      DD   D  M  M M  M         ZZ  EE        M  M M  M   O     O
      DD   D  M   M   M       ZZ    EEEEE     M   M   M   O     O
      DD   D  M       M     ZZ      EE        M       M   O     O
      DDDDDD  M       M [] ZZZZZZZZ EEEEEEEE  M       M   OOOOOOO
    DM.ZEMO-DM.ZEMO-DM.ZEMO-DM.ZEMO-DM.ZEMO-DM.ZEMO-DM.ZEMO-DM.ZEMO
    `,

    title: `
███████████ █████
░█░░░███░░░█░░███
░   ░███  ░  ░███████    ██████
    ░███     ░███░░███  ███░░███
    ░███     ░███ ░███ ░███████
    ░███     ░███ ░███ ░███░░░
    █████    ████ █████░░██████
   ░░░░░    ░░░░ ░░░░░  ░░░░░░



 ██████████
░░███░░░░███
 ░███   ░░███ ████████   ██████    ███████  ██████  ████████
 ░███    ░███░░███░░███ ░░░░░███  ███░░███ ███░░███░░███░░███
 ░███    ░███ ░███ ░░░   ███████ ░███ ░███░███ ░███ ░███ ░███
 ░███    ███  ░███      ███░░███ ░███ ░███░███ ░███ ░███ ░███
 ██████████   █████    ░░████████░░███████░░██████  ████ █████
░░░░░░░░░░   ░░░░░      ░░░░░░░░  ░░░░░███ ░░░░░░  ░░░░ ░░░░░
                                  ███ ░███
                                 ░░██████
                                  ░░░░░░
 ███████████                      ███  ████
░█░░░███░░░█                     ░░░  ░░███
░   ░███  ░  ████████   ██████   ████  ░███
    ░███    ░░███░░███ ░░░░░███ ░░███  ░███
    ░███     ░███ ░░░   ███████  ░███  ░███
    ░███     ░███      ███░░███  ░███  ░███
    █████    █████    ░░████████ █████ █████
   ░░░░░    ░░░░░      ░░░░░░░░ ░░░░░ ░░░░░                  `,

    status: `
     █████████   █████               █████
     ███░░░░░███ ░░███               ░░███
    ░███    ░░░  ███████    ██████   ███████   █████ ████  █████
    ░░█████████ ░░░███░    ░░░░░███ ░░░███░   ░░███ ░███  ███░░
     ░░░░░░░░███  ░███      ███████   ░███     ░███ ░███ ░░█████
     ███    ░███  ░███ ███ ███░░███   ░███ ███ ░███ ░███  ░░░░███
     ░░█████████   ░░█████ ░░████████  ░░█████  ░░████████ ██████
      ░░░░░░░░░     ░░░░░   ░░░░░░░░    ░░░░░    ░░░░░░░░ ░░░░░░  `,

    travel: `
     ███████████                                          ████
    ░█░░░███░░░█                                         ░░███
    ░   ░███  ░  ████████   ██████   █████ █████  ██████  ░███
        ░███    ░░███░░███ ░░░░░███ ░░███ ░░███  ███░░███ ░███
        ░███     ░███ ░░░   ███████  ░███  ░███ ░███████  ░███
        ░███     ░███      ███░░███  ░░███ ███  ░███░░░   ░███
        █████    █████    ░░████████  ░░█████   ░░██████  █████
        ░░░░░    ░░░░░      ░░░░░░░░    ░░░░░     ░░░░░░  ░░░░░ `,

    hourglasses: `
    --------------------------------------------------------------------
      \\°°°°°°°/  \\°°°°°°°/  \\       /  \\       /  \\       /  \\       /
       \\°°°°°/    \\°°°°°/    \\°°°°°/    \\     /    \\     /    \\     /
        \\°°°/      \\°°°/      \\°°°/      \\°°°/      \\   /      \\   /
         \\°/        \\°/        \\°/        \\°/        \\°/        \\ /
          0          0          0          0          0          0
         / \\        / \\        / \\        / \\        / \\        /°\\
        /   \\      /   \\      /   \\      /   \\      /°°°\\      /°°°\\
       /     \\    /     \\    /     \\    /°°°°°\\    /°°°°°\\    /°°°°°\\
      /       \\  /       \\  /°°°°°°°\\  /°°°°°°°\\  /°°°°°°°\\  /°°°°°°°\\
    --------------------------------------------------------------------`,

    hunt: `
    █████   █████                        █████
    ░░███   ░░███                        ░░███
     ░███    ░███  █████ ████ ████████   ███████
     ░███████████ ░░███ ░███ ░░███░░███ ░░░███░
     ░███░░░░░███  ░███ ░███  ░███ ░███   ░███
     ░███    ░███  ░███ ░███  ░███ ░███   ░███ ███
    █████   █████ ░░████████ ████ █████  ░░█████
    ░░░░░   ░░░░░   ░░░░░░░░ ░░░░ ░░░░░    ░░░░░  `,

    small_game: `
     __    __
    / \\..// \
      ( oo )
       \\__/
     _/-  -\_
    (   ()   )
     \\  /\\  /
     /\`|  |\`\\
    You Catch Multiple Rabbits!`,

    med_game: `
        _____
    ^..^     \\9
    (oo)_____/
       WW  WW
    You Catch Multiple Boar!`,

    large_game: `
      __.------~~~-.
    ,'/             \`
    " \\  ,..__ | ,_   \\_,
       \\>/|/   ~~\\||\`(~,~'
       | \`\\     /'|   \\;
       "   "   "  "
    You Catch Multiple Deer!`,

    scout: `
    █████████                                █████
    ███░░░░░███                              ░░███
    ░███    ░░░   ██████   ██████  █████ ████ ███████
    ░░█████████  ███░░███ ███░░███░░███ ░███ ░░░███░
     ░░░░░░░░███░███ ░░░ ░███ ░███ ░███ ░███   ░███
     ███    ░███░███  ███░███ ░███ ░███ ░███   ░███ ███
    ░░█████████ ░░██████ ░░██████  ░░████████  ░░█████
      ░░░░░░░░░   ░░░░░░   ░░░░░░    ░░░░░░░░    ░░░░░  `,

    mount: `
          /\\
         /**\\
        /****\\   /\\
       /      \\ /**\\
      /  /\\    /    \\        /\\    /\\  /\\      /\\            /\\/\\/\\  /\\
     /  /  \\  /      \\      /  \\/\\/  \\/  \\  /\\/  \\/\\  /\\  /\\/ / /  \\/  \\
    /  /    \\/ /\\     \\    /    \\ \\  /    \\/ /   /  \\/  \\/  \\  /    \\   \\
   /  /      \\/  \\/\\   \\  /      \\    /   /    \\
__/___/_______/___/__\\___\\__________________________________________________`,

    rest: `
    ███████████                     █████
    ░░███░░░░░███                   ░░███
     ░███    ░███   ██████   █████  ███████
     ░██████████   ███░░███ ███░░  ░░░███░
     ░███░░░░░███ ░███████ ░░█████   ░███
     ░███    ░███ ░███░░░   ░░░░███  ░███ ███
    █████   █████░░██████  ██████   ░░█████
    ░░░░░   ░░░░░  ░░░░░░  ░░░░░░     ░░░░░  `,

    cook: `
      █████████                    █████
      ███░░░░░███                  ░░███
     ███     ░░░   ██████   ██████  ░███ █████
    ░███          ███░░███ ███░░███ ░███░░███
    ░███         ░███ ░███░███ ░███ ░██████░
    ░░███     ███░███ ░███░███ ░███ ░███░░███
    ░░█████████ ░░██████ ░░██████  ████ █████
     ░░░░░░░░░   ░░░░░░   ░░░░░░  ░░░░ ░░░░░ `,

    dragonart: `
                         _====-_      _-====__
                    _--^^^#####/      \\#####^^^--_
                 _-^##########/ (    ) \\##########^-_
                -############/  |\\^^/|  \\############-
              _/############/   (@::@)   \\############\\_
             -#############(     \\||/     )#############-
            -###############\\    (oo)    /###############-
           -#################\\  / "" \\  /#################-
          -###################\\/((()))\\/###################-
         _#/|##########/\\######\\ (()) /#####/\\##########|\\#_
         |/ |#/#\\#/#\\/\\  \\#/#\\#/ \\ () /\\#/#\\#/  \\/\\#/#\\#/#\\#| \\|
          \\ |/  V  V      V  V   \\VV/  V  V      V  V  \\| /
    `,

    gear_shop: `
    \\\\\\\~///
   \\|/   \\|/  /\`\`\`\`\`\`\`\`\`\`\`\\
    | *,* | <<  Get Yur Gear!|
     \\__0/    \\,,,,,,,,,,,,,,/`,

    main_menu: `
           /│\\
        ▓▓▓▓▓▓▓▓▓
     ▓▓▓░░░░░░░░░▓▓▓
   ▓▓░░░    N    ░░░▓▓
  ▓░░   *   │   *   ░░▓
 ▓░         │         ░▓
<▓░W────────+────────E░▓> WHAT WOULD YOU LIKE TO DO?
 ▓░         │         ░▓
  ▓░░   *   │   *   ░░▓
   ▓▓░░░    S    ░░░▓▓
     ▓▓▓░░░░░░░░░▓▓▓
        ▓▓▓▓▓▓▓▓▓
           \\│/
    `,

    help: `
    H   H  EEEEE  L      PPPP
    H   H  E      L      P   P
    HHHHH  EEEE   L      PPPP
    H   H  E      L      P
    H   H  EEEEE  LLLLL  P
    `,

    credits: `
     CCCC  RRRR   EEEE  DDDD  III  TTTTT  SSSS
    C      R   R  E     D   D  I     T    S
    C      RRRR   EEEE  D   D  I     T     SSS
    C      R  R   E     D   D  I     T        S
     CCCC  R   R  EEEE  DDDD  III    T     SSS
    `
};

if (typeof EXTRA_ASCII_ART !== 'undefined') {
    Object.assign(ASCII_ART, EXTRA_ASCII_ART);
}

// Section 14: Cheat Code Handlers ---------------------------------------------

async function handleCheat(code) {
    switch (code) {
        case 'bubblegum':
            Terminal.println("You're a dirty little cheater aren't you? Here's a dragon to fight!", 'magenta');
            await handleBossFight();
            break;
        case 'rowan':
            Resources.modifyGold(1000);
            Terminal.println("You're a dirty little cheater aren't you? Here's 1000 doge coins!", 'magenta');
            break;
        case 'smudge':
            Resources.modify('supplies', 1000);
            Terminal.println("You're a dirty little cheater aren't you? Here's 1000 pocketses!", 'magenta');
            break;
        case 'jillybean':
            Resources.modify('wood', 500);
            Terminal.println("You're a dirty little cheater aren't you? Here's 500 wood!", 'magenta');
            await checkMiniBossEncounter();
            break;
    }
}

// Section 14b: Action Handlers ------------------------------------------------

async function handleHunt() {
    Audio.playMusic('hunt');

    if (GameState.resources.supplies <= 0) {
        Terminal.println('You do not have enough supplies to hunt! Find supplies or trade to restock.', 'red');
        await Terminal.pause();
        return;
    }

    const wildGameTypes = {
        Small: { weapon: 'Snare', bonus: 1 },
        Medium: { weapon: 'Tripwire', bonus: 2 },
        Large: { weapon: 'Arrow', bonus: 3 }
    };
    const actualGame = Utils.choice(Object.keys(wildGameTypes));

    Terminal.clear();
    await Terminal.showAsciiArt('hunt', 'red');
    Terminal.println('\n<-<-<-<-<-<-<-<->->->->->->->->');
    Terminal.println('..........SPOT.WILDGAME........');
    Terminal.println('...(Choose.the.right.weapon)...');
    Terminal.println('<-<-<-<-<-<-<-<->->->->->->->->');

    // Survival check
    const survivalRoll = Utils.rollD20();
    const totalCheck = survivalRoll + GameState.player.survival;
    Terminal.println(`\nYou rolled a ${survivalRoll} + ${GameState.player.survival} = ${totalCheck}`);

    let gameHint = '';
    if (totalCheck >= 20) {
        Terminal.println(`You find clear signs! You're certain there is ${actualGame} game!`);
        gameHint = actualGame;
    } else if (totalCheck >= 16) {
        if (Math.random() < 0.75) {
            Terminal.println(`You think you see signs of ${actualGame} game...`);
            gameHint = actualGame;
        } else {
            const falseGame = Utils.choice(Object.keys(wildGameTypes).filter(g => g !== actualGame));
            Terminal.println(`You think you see signs of ${falseGame} game...`);
            gameHint = falseGame;
        }
    } else if (totalCheck >= 13) {
        const wrongGame = Utils.choice(Object.keys(wildGameTypes).filter(g => g !== actualGame));
        Terminal.println(`You can tell there definitely isn't any ${wrongGame} game here.`);
    } else {
        Terminal.println('You find no clear signs of game.');
    }

    Terminal.println('\nChoose your hunting method:');
    Terminal.println('1. Snare (for Small game)');
    Terminal.println('2. Tripwire (for Medium game)');
    Terminal.println('3. Arrow (for Large game)');

    const weaponChoices = { '1': 'Snare', '2': 'Tripwire', '3': 'Arrow' };
    let selectedWeapon;
    while (true) {
        const choice = await Terminal.input('Select your weapon (1-3): ');
        if (weaponChoices[choice]) {
            selectedWeapon = weaponChoices[choice];
            break;
        }
        Terminal.println('Please enter 1, 2, or 3.', 'red');
    }

    GameState.resources.supplies -= 1;
    Terminal.println(`Used 1 supply. Supplies remaining: ${GameState.resources.supplies}.`, 'yellow');

    Terminal.println('\nHunting Results:');
    if (selectedWeapon === wildGameTypes[actualGame].weapon) {
        const bonus = await MiniGames.huntMini(wildGameTypes[actualGame].bonus);
        if (bonus > 0) {
            const foodGained = Config.FOOD_PER_HUNT + bonus;
            GameState.resources.food += foodGained;
            Terminal.println(`Success! You caught ${actualGame} game!`);
            Terminal.println(`You gained ${foodGained} lbs of food!`);
            if (actualGame === 'Small') await Terminal.showAsciiArt('small_game', 'white');
            else if (actualGame === 'Medium') await Terminal.showAsciiArt('med_game', 'white');
            else if (actualGame === 'Large') await Terminal.showAsciiArt('large_game', 'white');
        } else {
            Terminal.println('You failed to catch any prey.');
        }
    } else {
        Terminal.println('You chose the wrong weapon and failed to catch any prey.');
    }

    const daysHunting = Utils.randInt(Config.MIN_DAYS_PER_HUNT, Config.MAX_DAYS_PER_HUNT);
    await advanceDays(daysHunting);
    Terminal.println(`\nHunting took ${daysHunting} days.`);
    Terminal.println(`Current food: ${GameState.resources.food} lbs`);
    GameState.addJournalEntry(`Spent ${daysHunting} days hunting in the ${GameState.journey.currentBiome}.`);
    await Terminal.pause();
}

async function handleScout() {
    Audio.playMusic('scout');
    Terminal.clear();
    await Terminal.showAsciiArt('scout', 'green');
    await Terminal.showAsciiArt('mount', 'green');

    Terminal.println('\nYou are scouting the area. Choose your focus:');
    Terminal.println('1. Wood (Easiest)');
    Terminal.println('2. Water (Medium)');
    Terminal.println('3. Food (Hard)');
    Terminal.println('4. Herbs (Hardest)');
    Terminal.println('0. Return to Main Menu');

    if (GameState.resources.food < 2 || GameState.player.health < 2) {
        Terminal.println('You do not have enough food or health to scout!', 'red');
        await Terminal.pause();
        return;
    }

    Resources.modify('food', -1);

    const thresholds = { 1: 12, 2: 14, 3: 16, 4: 18 };
    Terminal.println('\nYour Scouting Probabilities:');
    for (let i = 1; i <= 4; i++) {
        const threshold = thresholds[i];
        const probability = Math.max(0, (20 - threshold + 1 + GameState.player.survival) / 20);
        Terminal.println(`  ${i}. ${['Wood', 'Water', 'Food', 'Herbs'][i-1]}: At least Minor Success: ${Math.round(probability * 100)}%`);
    }

    const choice = await Terminal.inputNumber('Enter your choice (0-4): ', 0, 4);
    if (choice === 0) return;

    const targetResource = { 1: 'wood', 2: 'water', 3: 'food', 4: 'herbs' }[choice];
    const difficultyModifier = { 1: 0, 2: 2, 3: 4, 4: 6 }[choice];

    Terminal.println(`\nYou focus your search on ${targetResource}.`);
    const d20Roll = Utils.rollD20();
    const modifier = await MiniGames.scoutMini(targetResource);
    const totalRoll = d20Roll + GameState.player.survival + modifier;
    Terminal.println(`\nYou rolled ${d20Roll} + Survival (${GameState.player.survival}) + Modifier (${modifier}) = ${totalRoll}`);

    const successLevels = {
        high: totalRoll >= 20 + difficultyModifier,
        moderate: totalRoll >= 15 + difficultyModifier,
        minor: totalRoll >= 10 + difficultyModifier
    };

    let skillMult = 1.0;
    if (GameState.data.skill === 'Outdoors Type' && (targetResource === 'wood' || targetResource === 'water')) skillMult = 1.5;
    if (GameState.data.skill === 'Hunter' && targetResource === 'food') skillMult = 1.5;
    if (successLevels.high) {
        const amount = Math.floor(Utils.randInt(6, 8) * skillMult);
        Terminal.println(`\nYou found a plentiful supply of ${targetResource}! +${amount}`, 'green');
        collectResource(targetResource, amount);
    } else if (successLevels.moderate) {
        const amount = Math.floor(Utils.randInt(4, 6) * skillMult);
        Terminal.println(`\nYou found some ${targetResource}! +${amount}`, 'green');
        collectResource(targetResource, amount);
    } else if (successLevels.minor) {
        const amount = Math.floor(Utils.randInt(2, 3) * skillMult);
        Terminal.println(`\nYou found a small amount of ${targetResource}! +${amount}`, 'yellow');
        collectResource(targetResource, amount);
    } else {
        Terminal.println('\nYour scouting efforts yielded nothing.', 'red');
        await triggerScoutingEvent();
    }
    GameState.addJournalEntry(`Scouted for ${targetResource} in the ${GameState.journey.currentBiome}.`);
    await Terminal.pause();
}

async function handleCamp() {
    Audio.playMusic('rest');
    Terminal.clear();
    await Terminal.showAsciiArt('interaction_campfire', 'yellow', true);

    if (GameState.resources.food <= 0) {
        Terminal.println('You do not have enough food to make camp! Hunt or cook to gather more food.', 'red');
        await Terminal.pause();
        return;
    }
    if (GameState.resources.woodCords <= 0) {
        Terminal.println('You do not have enough wood to make camp! Find wood or trade to restock.', 'red');
        await Terminal.pause();
        return;
    }

    GameState.data.skillData.potionSellerUsedThisCamp = false;
    let camping = true;
    while (camping) {
        Terminal.clear();
        await Terminal.showAsciiArt('interaction_campfire', 'yellow', true);
        Terminal.println(`\n--- Camp ---`);
        Terminal.println(`Food: ${GameState.resources.food} | Wood: ${GameState.resources.woodCords} | Herbs: ${GameState.resources.herbs}`);
        Terminal.println(`Health: ${GameState.player.health}/${GameState.player.maxHealth}`);
        if (GameState.companion) {
            Terminal.println(`${GameState.companion.name}: ${GameState.companion.hp}/${GameState.companion.maxHp} | Mood: ${GameState.companion.getMood()}`);
        }
        Terminal.println('\n1. Rest (Heal + sleep)');
        Terminal.println('2. Cook (Herbs -> food / potions)');
        Terminal.println('3. Talk (Speak with companion)');
        Terminal.println('4. Tend Wounds (Use herbs to heal)');
        Terminal.println('5. Guard Duty (Less rest, watch for danger)');
        Terminal.println('0. Break Camp');

        const choice = await Terminal.inputNumber('Choose: ', 0, 5);
        switch (choice) {
            case 1: {
                if (GameState.player.health >= GameState.player.maxHealth && (!GameState.companion || GameState.companion.hp >= GameState.companion.maxHp)) {
                    Terminal.println('Everyone is already at full health.', 'yellow');
                    await Terminal.pause();
                    break;
                }
                GameState.resources.food -= 1;
                GameState.resources.woodCords -= 1;
                await MiniGames.restMini();
                if (GameState.companion) {
                    GameState.companion.heal();
                    Terminal.println(`${GameState.companion.name} rests by the fire, fully healed.`, 'green');
                }
                await advanceDays(1);
                Terminal.println(`You rested for the night. Health: ${GameState.player.health}`, 'green');
                GameState.addJournalEntry(`Rested at camp for the night.`);
                camping = false;
                break;
            }
            case 2: {
                await handleCook();
                break;
            }
            case 3: {
                await handleCampTalk();
                break;
            }
            case 4: {
                await handleTendWounds();
                break;
            }
            case 5: {
                await handleGuardDuty();
                camping = false;
                break;
            }
            case 0: {
                Terminal.println('You pack up camp and continue your journey.', 'cyan');
                camping = false;
                break;
            }
        }
    }
    await Terminal.pause();
}

async function handleCampTalk() {
    const companion = GameState.companion;
    if (!companion) {
        Terminal.println('You sit alone by the fire, talking to yourself.', 'dim');
        await Terminal.pause();
        return;
    }
    const dialogues = {
        'Optimistic': [
            'The stars are beautiful tonight. We are going to make it, I know it!',
            'I have a good feeling about tomorrow. The dragon does not stand a chance!',
            'Remember: every step forward is a victory. Do not give up!'
        ],
        'Greedy': [
            'So... when we slay the dragon, what is the treasure split again?',
            'I saw some shiny rocks earlier. Probably worthless, but still...',
            'If we find gold on the road, I call dibs on the first pick.'
        ],
        'Brave': [
            'I will take first watch. Nothing gets past me.',
            'Let the beasts come. I fear no claw nor fang.',
            'When we face the dragon, I will be right beside you.'
        ],
        'Paranoid': [
            'Did you hear that? No? Good. Means they are being stealthy.',
            'We should move camp. This spot feels... exposed.',
            'Trust no one. Especially not smiling merchants.'
        ],
        'Loyal': [
            'No matter what happens, I will not leave your side.',
            'You have my spear and my life. Both are yours to command.',
            'I followed you this far. I will follow you to the end.'
        ],
        'Cynical': [
            'So we are just... walking toward a dragon. Sure. Great plan.',
            'The fire is warm. Enjoy it. Probably the last warmth we will feel.',
            'Optimism is just denial with better branding.'
        ]
    };
    const lines = dialogues[companion.personality] || dialogues['Optimistic'];
    Terminal.println(`\n${companion.name} looks at you across the fire.`, 'cyan');
    Terminal.println(`"${Utils.choice(lines)}"`, 'white');
    const talkBonus = GameState.data.skill === 'Storyteller' ? 10 : 5;
    companion.modifyRelationship(talkBonus);
    Terminal.println(`Your bond with ${companion.name} deepens. (+${talkBonus})`, 'green');
    GameState.addJournalEntry(`Spoke with ${companion.name} by the campfire.`);
    await Terminal.pause();
}

async function handleTendWounds() {
    if (GameState.resources.herbs <= 0) {
        Terminal.println('You have no herbs to tend wounds.', 'red');
        await Terminal.pause();
        return;
    }
    const maxHerbs = GameState.resources.herbs;
    const herbs = await Terminal.inputNumber(`How many herbs to use? (1-${maxHerbs}): `, 1, maxHerbs);
    const heal = herbs * Utils.randInt(8, 15);
    const oldHp = GameState.player.health;
    GameState.player.health = Math.min(GameState.player.maxHealth, GameState.player.health + heal);
    Resources.modify('herbs', -herbs);
    const actualHeal = GameState.player.health - oldHp;
    Terminal.println(`You apply a poultice and restore ${actualHeal} HP.`, 'green');
    if (GameState.companion && GameState.companion.hp < GameState.companion.maxHp) {
        const cheal = Math.floor(heal / 2);
        GameState.companion.hp = Math.min(GameState.companion.maxHp, GameState.companion.hp + cheal);
        Terminal.println(`${GameState.companion.name} benefits from the treatment too. (+${cheal} HP)`, 'green');
    }
    GameState.addJournalEntry(`Tended wounds at camp, using ${herbs} herbs.`);
    await Terminal.pause();
}

async function handleGuardDuty() {
    GameState.resources.food -= 1;
    GameState.resources.woodCords -= 1;
    const oldHp = GameState.player.health;
    const heal = Utils.randInt(10, 25);
    GameState.player.health = Math.min(GameState.player.maxHealth, GameState.player.health + heal);
    Terminal.println('You sleep lightly, one hand on your weapon.', 'yellow');
    Terminal.println(`Recovered ${GameState.player.health - oldHp} HP.`, 'green');
    if (GameState.companion) {
        const cheal = Utils.randInt(5, 15);
        GameState.companion.hp = Math.min(GameState.companion.maxHp, GameState.companion.hp + cheal);
        Terminal.println(`${GameState.companion.name} keeps watch. (+${cheal} HP)`, 'green');
    }
    if (Math.random() < 0.3) {
        const found = Utils.choice(['supplies', 'food', 'herbs', 'gold']);
        const amt = found === 'gold' ? Utils.randInt(5, 15) : Utils.randInt(1, 3);
        if (found === 'gold') Resources.modifyGold(amt);
        else Resources.modify(found, amt);
        Terminal.println(`During your watch you spot ${found === 'gold' ? `${amt} gold` : `${amt} ${found}`} nearby!`, 'green');
    } else {
        Terminal.println('The night passes without incident.', 'cyan');
    }
    GameState.addJournalEntry(`Kept guard duty at camp.`);
    await advanceDays(1);
}

async function handleCook() {
    Audio.playMusic('cook');
    Terminal.clear();
    await Terminal.showAsciiArt('cook', 'yellow');

    if (GameState.resources.herbs <= 0) {
        Terminal.println('You do not have enough herbs to cook! Find herbs or trade to restock.', 'red');
        await Terminal.pause();
        return;
    }

    Terminal.println(`You have ${GameState.resources.herbs} herbs and ${GameState.resources.supplies} supplies.`);
    Terminal.println('1. Cook herbs for food');
    Terminal.println('2. Cook herbs and supplies for potions');
    if (GameState.data.skill === 'Potion Seller' && !GameState.data.skillData.potionSellerUsedThisCamp) {
        Terminal.println('3. Brew free potions (Potion Seller skill, once per camp)');
    }
    Terminal.println('0. Cancel');

    const maxCookChoice = (GameState.data.skill === 'Potion Seller' && !GameState.data.skillData.potionSellerUsedThisCamp) ? 3 : 2;
    const choice = await Terminal.inputNumber('What would you like to cook? (0-' + maxCookChoice + '): ', 0, maxCookChoice);
    if (choice === 0) return;

    if (choice === 1) {
        const maxHerbs = GameState.resources.herbs;
        const herbsToCook = await Terminal.inputNumber(`How many herbs? (1-${maxHerbs}): `, 1, maxHerbs);
        const survival = GameState.player.survival;
        const foodGained = herbsToCook * (Utils.randInt(1, 4) + Math.floor(survival / 2));
        Resources.modify('herbs', -herbsToCook);
        Resources.modify('food', foodGained);
        Terminal.println(`Used ${herbsToCook} herbs. Gained ${foodGained} food.`, 'green');
    } else if (choice === 2) {
        if (GameState.resources.supplies <= 0) {
            Terminal.println('You do not have enough supplies to cook potions!', 'red');
            await Terminal.pause();
            return;
        }
        const maxHerbs = GameState.resources.herbs;
        const maxSupplies = GameState.resources.supplies;
        const herbsToCook = await Terminal.inputNumber(`How many herbs? (1-${maxHerbs}): `, 1, maxHerbs);
        const suppliesToCook = await Terminal.inputNumber(`How many supplies? (1-${maxSupplies}): `, 1, maxSupplies);
        const potionsGained = herbsToCook + suppliesToCook;
        Resources.modify('herbs', -herbsToCook);
        Resources.modify('supplies', -suppliesToCook);
        GameState.combat.potions += potionsGained;
        Terminal.println(`Used ${herbsToCook} herbs and ${suppliesToCook} supplies. Gained ${potionsGained} potions.`, 'green');
    } else if (choice === 3) {
        const freePotions = Utils.randInt(1, 6);
        GameState.combat.potions += freePotions;
        GameState.data.skillData.potionSellerUsedThisCamp = true;
        Terminal.println(`You brew a batch from memory and instinct. ${freePotions} potions bubble to life!`, 'magenta');
        Terminal.println('The cauldron steams with arcane fragrance. Your trade secret remains safe.', 'cyan');
    }
    GameState.addJournalEntry(`Cooked at camp.`);
    await Terminal.pause();
}

// Helper for scouting events
async function triggerScoutingEvent() {
    if (Math.random() < 0.23) {
        const events = [
            { name: 'Gentle Rain', description: 'Mild rain grants clean water.', effect: () => Resources.modify('water', 8) },
            { name: 'Wild Animal', description: 'Attacked by wild animal!', effect: async () => { await simulateAttack('fauna', 'wild_beast'); } },
            { name: 'Pleasant Weather', description: 'Weather is perfect.', effect: () => Resources.modifyHealth(5) },
            { name: 'Abandoned Supplies', description: 'Abandoned campsite found.', effect: () => Resources.modify('supplies', Utils.randInt(1, 3)) },
            { name: 'Gold Discovery', description: 'Small pouch of gold!', effect: () => Resources.modifyGold(Utils.randInt(10, 20)) },
            { name: 'Empty Waterskins', description: 'You find empty waterskins.', effect: () => Resources.modify('waterskins', Utils.randInt(2, 3)) },
            { name: 'Mushroom Grove', description: 'Edible mushrooms found.', effect: () => Resources.modify('food', Utils.randInt(4, 6)) },
            { name: 'Abandoned Camp', description: 'Camp yields useful items.', effect: () => { Resources.modify('supplies', Utils.randInt(1, 3)); Resources.modifyGold(Utils.randInt(5, 15)); } },
            { name: 'Bird Flock', description: 'Birds alert you to water.', effect: () => Resources.modify('water', 16) },
            { name: 'Herbal Trove', description: 'Rare herbs for potions.', effect: () => Resources.modify('herbs', Utils.randInt(2, 5)) },
            { name: 'Natural Trap', description: 'You stumble into a trap.', effect: () => { Resources.modifyHealth(-10); advanceDays(1); } },
            { name: 'Stray Animal', description: 'A stray animal leads you to food.', effect: () => Resources.modify('food', Utils.randInt(3, 6)) }
        ];
        const event = Utils.choice(events);
        Terminal.println(`\nEvent: ${event.name}`, 'cyan');
        Terminal.println(event.description);
        await event.effect();
    }
}

// Helper: collect resource with capacity check
async function collectResource(resourceType, amount) {
    if (resourceType === 'water') {
        Resources.collectWater(amount);
    } else if (resourceType === 'wood') {
        Resources.collectWood(amount);
    } else {
        Resources.modify(resourceType, amount);
    }
}

// Section 15: Entry Point ------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // Resume audio context on first interaction
    document.addEventListener('click', () => Audio.resume(), { once: true });
    document.addEventListener('keydown', () => Audio.resume(), { once: true });

    // Control buttons
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                document.body.classList.add('is-fullscreen');
            }).catch(() => {});
        } else {
            document.exitFullscreen().then(() => {
                document.body.classList.remove('is-fullscreen');
            }).catch(() => {});
        }
    });
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('is-fullscreen');
        }
    });

    document.getElementById('btn-audio').addEventListener('click', () => {
        Audio.toggleMusic();
        Audio.toggleSfx();
    });

    document.getElementById('btn-scanlines').addEventListener('click', (e) => {
        const scanlines = document.querySelector('.scanlines');
        scanlines.style.display = scanlines.style.display === 'none' ? 'block' : 'none';
        e.currentTarget.classList.toggle('active');
    });

    // Start the game
    GameState.init();
    try {
        await handleGameStart();
        await handleGame();
    } catch (e) {
        console.error('Game error:', e);
        Terminal.println(`\nAn unexpected error occurred: ${e.message}`, 'red');
    }
});
