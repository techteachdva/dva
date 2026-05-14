/**
 * Dragon Trail Web - Terminal Engine
 * Async terminal emulator with color support, cursor, and input handling.
 * Simulates Python's print() and input() in a browser environment.
 */

class TerminalEngine {
    constructor() {
        this.output = document.getElementById('terminal-output');
        this.inputLine = document.getElementById('terminal-input-line');
        this.inputEl = document.getElementById('terminal-input');
        this.promptEl = document.getElementById('terminal-prompt');
        this.cursorEl = document.getElementById('terminal-cursor');
        this.screen = document.querySelector('.crt-screen');
        this.combatOverlay = document.getElementById('combat-overlay');
        this.minigameOverlay = document.getElementById('minigame-overlay');

        this.inputQueue = [];
        this.isWaitingForInput = false;
        this.currentResolve = null;
        this.currentPrompt = '';
        this.typingSpeed = 3; // ms per character
        this.scrollOnPrint = true;

        this.setupInputListener();
    }

    setupInputListener() {
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = this.inputEl.value;
                this.inputEl.value = '';
                this.appendToOutput(this.currentPrompt + ' ' + value + '\n');
                if (this.currentResolve) {
                    this.currentResolve(value);
                    this.currentResolve = null;
                }
                this.isWaitingForInput = false;
                this.inputLine.classList.add('hidden');
            }
        });

        // Focus input on any click
        document.addEventListener('click', () => {
            if (this.isWaitingForInput) {
                this.inputEl.focus();
            }
        });
    }

    /**
     * Print text to the terminal with optional color and styling.
     * Supports color names matching Python colorama: red, green, yellow, blue, cyan, magenta, white, amber
     */
    print(text, color = null, bright = false, animate = false) {
        if (animate) {
            return this.typewrite(text, color, bright);
        }
        this.appendToOutput(this.formatText(text, color, bright));
        this.scrollToBottom();
    }

    /**
     * Print a line with automatic newline.
     */
    println(text, color = null, bright = false, animate = false) {
        return this.print(text + '\n', color, bright, animate);
    }

    /**
     * Typewriter effect - characters appear one by one.
     */
    async typewrite(text, color = null, bright = false) {
        const span = document.createElement('span');
        if (color) span.className = `color-${color}`;
        if (bright) span.classList.add('bright');
        this.output.appendChild(span);

        for (let i = 0; i < text.length; i++) {
            span.textContent += text[i];
            this.scrollToBottom();
            await Utils.delay(this.typingSpeed);
        }
    }

    /**
     * Format text with ANSI-like color classes.
     */
    formatText(text, color, bright) {
        if (!color && !bright) return text;

        // Handle multiline - wrap each line in a span
        const lines = text.split('\n');
        const classNames = [];
        if (color) classNames.push(`color-${color}`);
        if (bright) classNames.push('bright');

        return lines.map(line => {
            if (line === '') return '';
            return `<span class="${classNames.join(' ')}">${this.escapeHtml(line)}</span>`;
        }).join('\n');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    appendToOutput(html) {
        // If html is plain text (no tags), convert newlines to <br>
        if (!html.includes('<')) {
            html = html.replace(/\n/g, '<br>');
        }
        this.output.insertAdjacentHTML('beforeend', html);
    }

    scrollToBottom() {
        if (this.scrollOnPrint) {
            this.output.scrollTop = this.output.scrollHeight;
        }
    }

    /**
     * Blocking input - returns a Promise that resolves when user presses Enter.
     * Simulates Python's input() function.
     */
    async input(promptText = '') {
        this.currentPrompt = promptText;
        this.promptEl.textContent = promptText || '>>>';
        this.inputLine.classList.remove('hidden');
        this.inputEl.value = '';
        this.inputEl.focus();
        this.isWaitingForInput = true;

        return new Promise((resolve) => {
            this.currentResolve = resolve;
        });
    }

    /**
     * Get a number input with validation.
     */
    async inputNumber(promptText, min = null, max = null) {
        while (true) {
            const value = await this.input(promptText);
            const num = parseInt(value);
            if (isNaN(num)) {
                this.println('Invalid input. Please enter a number.', 'red');
                continue;
            }
            if (min !== null && num < min) {
                this.println(`Please enter a number >= ${min}.`, 'red');
                continue;
            }
            if (max !== null && num > max) {
                this.println(`Please enter a number <= ${max}.`, 'red');
                continue;
            }
            return num;
        }
    }

    /**
     * Get a yes/no input.
     */
    async inputYesNo(promptText) {
        while (true) {
            const value = (await this.input(promptText + ' (y/n): ')).toLowerCase().trim();
            if (value === 'y' || value === 'yes') return true;
            if (value === 'n' || value === 'no') return false;
            this.println('Please enter y or n.', 'red');
        }
    }

    /**
     * Clear the terminal screen.
     */
    clear() {
        this.output.innerHTML = '';
    }

    /**
     * Wait for user to press Enter (continue prompt).
     */
    async pause(message = 'Press Enter to continue...') {
        await this.input(message);
    }

    /**
     * Display ASCII art with color and animation.
     */
    async showAsciiArt(artKey, color = 'white', animate = false) {
        const art = ASCII_ART[artKey];
        if (!art) return;

        const pre = document.createElement('pre');
        pre.className = 'ascii-art';
        if (color) pre.classList.add(`color-${color}`);
        pre.classList.add('bright');
        this.output.appendChild(pre);

        if (animate) {
            const lines = art.split('\n');
            for (const line of lines) {
                pre.textContent += line + '\n';
                this.scrollToBottom();
                await Utils.delay(this.typingSpeed * 2);
            }
        } else {
            pre.textContent = art;
            this.scrollToBottom();
        }
    }

    /**
     * Screen effects.
     */
    shakeScreen() {
        this.screen.classList.add('screen-shake');
        setTimeout(() => this.screen.classList.remove('screen-shake'), 300);
    }

    flashRed() {
        this.screen.classList.add('flash-red');
        setTimeout(() => this.screen.classList.remove('flash-red'), 300);
    }

    flashGreen() {
        this.screen.classList.add('flash-green');
        setTimeout(() => this.screen.classList.remove('flash-green'), 300);
    }

    showCombatOverlay() {
        this.combatOverlay.classList.remove('hidden');
    }

    hideCombatOverlay() {
        this.combatOverlay.classList.add('hidden');
    }

    showMinigameOverlay() {
        this.minigameOverlay.classList.remove('hidden');
    }

    hideMinigameOverlay() {
        this.minigameOverlay.classList.add('hidden');
    }

    /**
     * Hide the input line (for mini-games).
     */
    hideInput() {
        this.inputLine.classList.add('hidden');
    }

    /**
     * Show the input line.
     */
    showInput() {
        this.inputLine.classList.remove('hidden');
    }

    /**
     * Set typing speed (ms per character). 0 = instant.
     */
    setTypingSpeed(speed) {
        this.typingSpeed = speed;
    }
}

// Global terminal instance
const Terminal = new TerminalEngine();
