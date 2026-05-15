// Dragon Trail Web - Mini-games
// Target practice, hunt, scout, rest, travel mini-games

const MiniGames = {
    // Calculate target speed based on survival skill
    calculateSpeed(survival) {
        return Math.max(0.001, 0.001 + survival * 0.015);
    },

    /**
     * Core target practice mini-game.
     * Returns: -1 (miss), 0 (weak hit), 1 (strong hit/bullseye)
     */
    async targetPractice(introText, resultTextSuccess, resultTextFailure) {
        Terminal.println(introText, 'cyan');
        Terminal.println('='.repeat(introText.length), 'cyan');
        await Terminal.pause();

        const barLength = 15;
        const targetCenter = Utils.randInt(1, barLength - 3);
        const speed = this.calculateSpeed(GameState.player.survival);
        let indicatorPos = 0;
        let direction = 1;
        let running = true;
        let result = -1;

        Terminal.hideInput();
        Terminal.clear();

        // Animation loop
        const animate = () => {
            if (!running) return;
            const bar = Array(barLength).fill('-');
            bar[targetCenter] = 'X';
            if (targetCenter > 0) bar[targetCenter - 1] = 'x';
            if (targetCenter < barLength - 1) bar[targetCenter + 1] = 'x';
            bar[indicatorPos] = '^';
            Terminal.clear();
            Terminal.println(`[${bar.join('')}]`, 'white', true);
            Terminal.println('Press SPACE to hit the target!', 'yellow');

            indicatorPos += direction;
            if (indicatorPos >= barLength) {
                indicatorPos = barLength - 1;
                direction = -1;
            } else if (indicatorPos < 0) {
                indicatorPos = 0;
                direction = 1;
            }
        };

        // Spacebar handler
        const handleSpace = (e) => {
            if (e.code === 'Space' && running) {
                e.preventDefault();
                running = false;
                const hitPos = indicatorPos;

                // Show result
                const bar = Array(barLength).fill('-');
                bar[targetCenter] = 'X';
                if (targetCenter > 0) bar[targetCenter - 1] = 'x';
                if (targetCenter < barLength - 1) bar[targetCenter + 1] = 'x';
                bar[hitPos] = 'O';
                Terminal.clear();
                Terminal.println(`[${bar.join('')}]`, 'white', true);
                Terminal.println(`You hit at position ${hitPos + 1}!`);

                if (hitPos >= targetCenter - 1 && hitPos <= targetCenter + 1) {
                    if (hitPos === targetCenter) {
                        Terminal.println(`${resultTextSuccess} (Bullseye!)`, 'green', true);
                        Audio.victorySound();
                        result = 1;
                    } else {
                        Terminal.println(`${resultTextSuccess} (Weak Hit)`, 'yellow');
                        Audio.hitSound();
                        result = 0;
                    }
                } else {
                    Terminal.println(resultTextFailure, 'red');
                    Audio.missSound();
                    result = -1;
                }
            }
        };

        document.addEventListener('keydown', handleSpace);

        // Start animation
        const interval = setInterval(animate, Math.max(20, speed * 1000));

        // Wait for result
        await new Promise(resolve => {
            const check = setInterval(() => {
                if (!running) {
                    clearInterval(check);
                    clearInterval(interval);
                    document.removeEventListener('keydown', handleSpace);
                    Terminal.showInput();
                    resolve();
                }
            }, 50);
        });

        await Utils.delay(1500);
        return result;
    },

    // Hunt mini-game
    async huntMini(gameBonus) {
        let modifier = 0;
        const survival = GameState.player.survival;
        const hunterBonus = GameState.data.skill === 'Hunter' ? 2 : 0;
        const result = await this.targetPractice(
            'HUNTING MINI-GAME',
            'Hit! You catch your prey!',
            'Miss! The prey escapes!'
        );

        if (result === 1) {
            modifier = Math.floor(Utils.randInt(2, 3) * (1 + survival * 0.1)) + gameBonus + hunterBonus;
            Terminal.println(`Mini-game bonus: ${modifier} lbs of food!`, 'green');
        } else if (result === 0) {
            modifier = Math.floor(Utils.randInt(1, 2) * (1 + survival * 0.05)) + gameBonus + hunterBonus;
            Terminal.println(`Mini-game bonus: ${modifier} lbs of food (weak hit).`, 'yellow');
        } else {
            Terminal.println('You failed to catch any prey.', 'red');
        }
        return modifier;
    },

    // Scout mini-game
    async scoutMini(resourceType) {
        let modifier = 0;
        const survival = GameState.player.survival;
        const result = await this.targetPractice(
            `SCOUTING MINI-GAME: ${resourceType.toUpperCase()}`,
            `Hit! You spot the ${resourceType} you need!`,
            `Miss! Your scouting yielded no ${resourceType}.`
        );

        if (result === 1) {
            modifier = Math.floor(Utils.randInt(4, 6) * (1 + survival * 0.1));
            Terminal.println(`You're in the zone! Modifier: ${modifier}`, 'green');
        } else if (result === 0) {
            modifier = Math.floor(Utils.randInt(2, 4) * (1 + survival * 0.05));
            Terminal.println(`You do well enough. Modifier: ${modifier}`, 'yellow');
        } else {
            Terminal.println('Your scouting efforts yielded nothing.', 'red');
        }
        return modifier;
    },

    // Rest mini-game
    async restMini() {
        const survival = GameState.player.survival;
        const result = await this.targetPractice(
            'RESTING MINI-GAME',
            'Hit! You feel well-rested!',
            'Miss! Your rest was restless!'
        );

        if (result === 1) {
            const healthRestored = Math.floor(Utils.randInt(10, 15) * (1 + survival * 0.1));
            const maxHealth = GameState.player.maxHealth;
            GameState.player.health = Math.min(maxHealth, GameState.player.health + healthRestored);
            Terminal.println(`You restored ${healthRestored} health!`, 'green');
        } else if (result === 0) {
            const healthRestored = Math.floor(Utils.randInt(5, 10) * (1 + survival * 0.05));
            const maxHealth = GameState.player.maxHealth;
            GameState.player.health = Math.min(maxHealth, GameState.player.health + healthRestored);
            Terminal.println(`You restored ${healthRestored} health.`, 'yellow');
        } else {
            Resources.modifyHealth(-5, 'Rest Failure: Lost some health');
            Terminal.println('You had trouble resting and lost some health.', 'red');
        }
    },

    // Travel mini-game
    async travelMini() {
        const survival = GameState.player.survival;
        const result = await this.targetPractice(
            'TRAVELING MINI-GAME',
            'Hit! You navigate the terrain perfectly!',
            'Miss! You get lost and waste time.'
        );

        if (result === 1) {
            const miles = Math.floor(Utils.randInt(15, 25) * (1 + survival * 0.1));
            GameState.journey.totalMilesTraveled += miles;
            Terminal.println(`You traveled ${miles} miles!`, 'green');
        } else if (result === 0) {
            const miles = Math.floor(Utils.randInt(10, 15) * (1 + survival * 0.05));
            GameState.journey.totalMilesTraveled += miles;
            Terminal.println(`You traveled ${miles} miles, but could have gone further.`, 'yellow');
        } else {
            Terminal.println('You got lost and wasted time. No miles gained.', 'red');
        }
    }
};
