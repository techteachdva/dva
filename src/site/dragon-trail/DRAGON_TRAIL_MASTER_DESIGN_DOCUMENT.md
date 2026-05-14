# Master Game Design Resource: Dragon Trail
## Synthesis of Will Wright, Sid Meier, Jeff Engelstein, Phil Carroll (DM Zemo), NetHack Legacy, and ASCII Terminal Aesthetics

---

## TABLE OF CONTENTS

1. Core Design Philosophy
2. The DM's Design Ethos (Phil Carroll)
3. Player Psychology (The "Unholy Alliance")
4. Loss Aversion & Framing
5. Difficulty, Progression & Reward Systems
6. Emergence & Possibility Spaces
7. The ASCII Terminal Aesthetic
8. Practical Patterns for Dragon Trail

---

## 1. CORE DESIGN PHILOSOPHY

### 1.1 Games as Possibility Spaces

**Source: Will Wright, "Dynamics for Designers" (GDC)**

> "The player takes our game, goes into this possibility space, and they explore all these branches, all these things, and that's the essence of gameplay."

Wright's central thesis is that games are **possibility spaces** — landscapes of potential outcomes that players navigate. Dragon Trail's possibility space is the 1000-mile journey: every playthrough is a different branching path through biomes, encounters, resource decisions, and combat outcomes.

**Key insight for Dragon Trail:** The journey IS the possibility space. Players don't replay for a different ending — they replay for a different *experience* of the journey. The same 1000 miles can be a desperate scramble for food, a confident march with a full party, or a solo stealth run. The procedural encounter system, randomized shop prices, and companion roster create emergent narrative variation without authored branching dialogue.

### 1.2 Structure vs. Dynamics vs. Models

**Source: Will Wright**

| Term | Definition | Dragon Trail Mapping |
|------|-----------|----------------------|
| **Structure** | Snapshot of a system — constituent parts frozen in time | Starting resources, companion roster, shop inventory, biome connections |
| **Dynamics** | How parts interact through time | Resource depletion (food/water/wood), encounter escalation, companion health tracking, day counter |
| **Models** | Both computer models and mental models players build | Player's internalized understanding of "how many days of food do I need before the next biome?" "Will my companion survive this encounter?" |

Wright emphasizes that humans are constantly modeling the world. **Dragon Trail application:** Players build mental models of survival curves. "If I have 10 food and the next biome is Tundra, I need to hunt before traveling." The game rewards players who internalize these relationships.

### 1.3 Three Topologies

**Source: Will Wright**

Wright organizes game components into three topologies, ordered by flexibility:

1. **Agents** — Flexible relationships that change constantly (companions, random traders, enemy encounters)
2. **Networks** — Persistent but mutable links (biome connections, supply chains, trade routes)
3. **Layers** — Fixed spatial relationships (the 1000-mile linear progression, the 13-biome map)

**Dragon Trail mapping:**
- **Agents** = Companions (alive/dead/changing HP), wandering merchants, random encounters
- **Networks** = Biome adjacency (MARINE → WETLAND → TROPICAL_RAINFOREST), resource interdependencies (food → rest → health → survival)
- **Layers** = The fixed 1000-mile distance, the day/month/year time system, the survival skill cap of 8

---

## 2. THE DM'S DESIGN ETHOS (PHIL CARROLL)

**Source: powerwordskill.com — blog of Phil Carroll ("DM Zemo")**

Phil Carroll is a tabletop RPG designer, dungeon master, and digital game creator whose blog spans homebrew D&D mechanics, NPC design philosophy, procedural generation thinking, and game-system hacking. Dragon Trail is a direct digital translation of his tabletop design ethos: survival is earned, companions matter, and death should feel fair but consequential.

### 2.1 "Listen to Your Players"

> "LISTEN TO YOUR PLAYERS. They will give you countless pieces of information about what they find fun and what they care about in the story. Focus on the fun, feed their hearts with what they desire. And then when you have them hooked, poke them. But not too much."

**Dragon Trail application:**
- The survival skill input (0-8) lets players self-select difficulty — we listen to their preferred challenge level
- Companion choice is emotional investment — players pick the name/stats that resonate
- The "cheat codes" (bubblegum, rowan, smudge, jillybean) are the "poke" — hidden fun for explorers, not required
- If players hoard resources, the game pokes with inventory weight limits and auto-drop

### 2.2 "Never Say No"

> "If your players want to do something NEVER just flatly say NO. Ideally, say 'No...but you could...' and build on whatever suggested action they gave you."

**Dragon Trail application:**
- Can't carry more? The game auto-drops the heaviest item and tells you why
- Can't afford a weapon? The trader system lets you barter food for supplies
- Companion died? You can still win solo — it's harder, but never impossible
- Low on potions? Herbs + supplies can be cooked into potions before boss fights

### 2.3 Failure as Drama, Not Punishment

**Source: "Planning to Fail: An Alternate d20 System"**

> "Failure drives both [tragedy and comedy], what is different is a matter of tone and perspective. A character who always gets what they want and nothing bad ever happens to them is both boring and totally unrelatable."

Carroll's card-deck mechanic replaces d20 swinginess with **chosen failure** — players decide when to fail to save resources for important moments.

**Dragon Trail application:**
- Resting consumes food AND wood — players choose when to rest (chosen resource cost)
- Scouting risks nothing but food/health — players decide when the gamble is worth it
- The "StunSplosion" consumes 10 potions — a chosen burst of power, not a random crit
- Death comes from cumulative choices (didn't hunt, didn't rest, pushed too far), not a single bad roll

### 2.4 3D Characters Over 2D Placeholders

**Source: "3D NPCs. Never name them 'The Blacksmith.'"**

> "It is a cardinal Dungeon Master sin to present players with 2D, boring NPCs. If you want your players to not murder everything with a pulse, you need to give them a reason to care."

**Dragon Trail application:**
- Companions have names (Bartholomew, Cinder, Sparky, Whisperwind...) — not "Companion 1"
- Each companion has randomized HP, DPR, and cost — they feel like individuals
- The companion absorbs enemy damage — players feel gratitude and loss when they fall
- The shopkeeper says "Get Yur Gear!" — has personality, not just a menu

**The 4 rapid NPC-deepening questions applied to companions:**
1. What do they want badly? (To survive the journey / To prove themselves / To find treasure)
2. What's a quirk? (Whisperwind is silent but deadly / Sparky is overconfident)
3. What's one thing they want everyone to know? ("I've killed a drake before.")
4. What's one thing they want nobody to know? (They're actually fleeing a debt.)

### 2.5 Permadeath as Meaningful Tension

**Source: "Challenges" (NetHack-inspired post)**

> "Piles of gold are absolutely worthless if death isn't possible and viscerally real. If any fool with a wooden sword can wander down into the dragon's hoard and a merciful DM allows them to survive, well then, what the fuck is the point?"

Carroll admires NetHack's permadeath not because it's cruel, but because it makes every decision meaningful.

**Dragon Trail application:**
- Food/water depletion is a slow permadeath — players see it coming and can act
- Checkpoints don't exist in the wilderness — death means game over, not respawn
- The "Game Over" screen shows final score, miles traveled, and high scores — the run mattered
- Hardcore players can challenge themselves: no companions, survival 0, minimal supplies

### 2.6 Resource Management as Constant Tension

**Source: "NetHack Inspired D&D 5e Hunger Mechanics"**

Carroll's Hunger Die system makes survival a constantly depleting resource. The brilliance is that it only triggers under exertion — combat, low HP, rests — so it's not tedious bookkeeping, it's dramatic punctuation.

**Dragon Trail application:**
- Food/water tick down every travel day — the Hunger Die of the journey
- Wood cords are consumed on rest — dramatic punctuation (can I afford to heal?)
- Supplies are consumed on hunts — the cost of survival
- Herbs are the rarest resource — used for potions, which are the emergency brake

### 2.7 "Nobody Has Any Idea What They're Doing"

**Source: "10 DM Tips I Would Tell My Younger Self"**

> "Nobody has any idea what they're doing in the beginning... New Players won't know or care if you're good or bad so stop judging yourself so harshly."

**Dragon Trail application:**
- The tutorial/help screen is always available (command 7) — permission to be a beginner
- Survival 0 is valid — the game doesn't mock low skill, it adapts (lower AC, harder enemies)
- The first shop visit teaches pricing without punishment — if you buy nothing, that's a valid choice
- Cheat codes exist for players who want to experiment without consequence

### 2.8 Only Prep What Is Necessary

**Source: "10 DM Tips"**

> "Worldbuilding may be fun but it may also be a colossal waste of time... Every time you sit down to prep ask yourself: Will this come up in the session? Is this vital for them to know?"

**Dragon Trail application:**
- 13 biomes exist but only a subset appear per playthrough — no bloat
- The encounter table is massive but filtered by biome — only relevant enemies appear
- The "how to play" intro is 2 sentences — vital info only
- Save/load system has 3 slots — enough for experimentation, not enough to encourage save-scumming

---

## 3. PLAYER PSYCHOLOGY (THE "UNHOLY ALLIANCE")

### 3.1 Gameplay Is a Psychological Experience

**Source: Sid Meier, "Psychology of Game Design" (GDC Keynote)**

> "When I design a game... the way I would generally approach those topics is: make it realistic, make it true... and what I found in taking that approach was that a lot of what I thought I knew was wrong."

Meier's core revelation: **Player psychology has nothing to do with rational thought.** Players don't behave like mathematicians. They behave like storytellers, egomaniacs, and pattern-seekers.

**Dragon Trail application:** Players don't calculate optimal food/day ratios. They *feel* desperate when food drops below 5, confident when it's above 20. The game reinforces this with color coding (red/yellow/green).

### 3.2 The "Unholy Alliance"

**Source: Sid Meier**

> "The Unholy Alliance is an agreement that the player and the designer make with each other. I'm going to pretend certain things, you're going to pretend certain things, and together we'll have a great experience."

**The designer pretends:**
- The ASCII terminal is a real CRT monitor
- The dragon is a real threat (not just a final HP check)
- The journey is 1000 miles (not a number going from 0 to 1000)
- The companion cares about the player

**The player pretends:**
- To be a wanderer on a desperate quest
- That their choices matter (they do)
- That the ASCII art is beautiful (it is)
- That the game is fair (it is — every death is traceable to a choice)

**Violation examples (what NOT to do):**
1. Random instant death with no warning → breaks the "fair" pretense
2. ASCII art that doesn't render correctly → breaks the "CRT monitor" pretense
3. Companion dies from a single hit → breaks the "companion matters" pretense

**Dragon Trail safeguards:**
- No random insta-kill events — every danger is telegraphed (low resources, low HP)
- The terminal aesthetic is consistent — green phosphor, scanlines, monospace font
- Companions have substantial HP and absorb damage predictably

### 3.3 The Winner Paradox

**Source: Sid Meier**

> "In real life you don't always win... however in the world of games you pretty much always win... I don't get letters saying 'Dear Sid, I won way too much.'"

**Implication for punishment:**
- **Rewards:** Players accept gladly ("You found 5 herbs!" — gain framing)
- **Punishment:** "Your game is broken, the game is cheating" (loss framing)

**Dragon Trail application:**
- Finding resources is always framed positively
- Losing resources is framed as "consumed" or "used," not "taken away"
- The "Game Over" screen celebrates the run (miles traveled, score) rather than mocking failure
- The dragon is beatable — the Winner Paradox demands that victory be achievable

### 3.4 Suspension of Disbelief

**Source: Sid Meier**

> "Part of our job is to help the player to suspend their disbelief... Those of us that are old-time designers have a little bit of an advantage there in that we worked in the good old days of 16-color graphics where we really had to work hard to get the player to believe."

**Tools for maintaining suspension:**
- Consistent style (monospace font, green phosphor, no UI chrome)
- Humor as a bridge (cheat codes, shopkeeper typo "Yur Gear")
- Moral clarity (the dragon is bad, you are the hero, companions are allies)
- No wasted player time (fast-forward through travel, quick menus)

**Dragon Trail application:**
- The CRT monitor bezel, scanlines, and flicker are consistent
- The "writtenby" ASCII art credits the author — maintains the persona
- Every enemy has a name, not just "Enemy" — suspension through specificity
- The terminal clears between scenes, like changing rooms in a dungeon

### 3.5 Moral Clarity

**Source: Sid Meier**

> "It's more satisfying to win against bad, cranky Genghis Khan than it is if there was some kind of moral cloud over the actions you were taking."

**Dragon Trail application:**
- The dragon is a threat to the realm — no ambiguity
- Bandits attack you — self-defense is justified
- Wild beasts are hungry — nature is neutral, but dangerous
- The player is a hero on a quest — moral clarity is baked into the premise

---

## 4. LOSS AVERSION & FRAMING

### 4.1 The Core Principle

**Source: Jeff Engelstein, "Board Game Design and the Psychology of Loss Aversion" (GDC)**

> "Getting something feels good. Gaining twenty dollars feels good. Losing twenty dollars feels bad. But losing the twenty dollars feels worse than gaining the twenty dollars feels good."

**Kahneman & Tversky (Nobel Prize, 2002):** Losses are felt approximately **2x as intensely** as equivalent gains.

**Dragon Trail application:**
- Finding food: "+5 food" (mildly good)
- Losing food to spoilage: "-5 food" (very bad)
- Solution: Frame consumption as "used" not "lost" — "Rested for 1 day. Consumed 1 food."

### 4.2 Framing

**Source: Engelstein**

Identical outcomes, different phrasing, different choices:

**Dragon Trail examples:**
- "Your waterskins are full!" (gain framing) vs "You can't carry more water." (loss framing)
- "You earned 2450 XP!" (gain) vs "The dragon had 500 HP remaining." (loss)
- "Bought 3 food for 6 GP." (gain) vs "Spent 6 GP." (loss)

### 4.3 Practical Design Rules

**Source: Engelstein**

1. **Better not to give than to give and take away** — Resources are consumed, not confiscated
2. **Reframe penalties as opponent bonuses** — The enemy hit you for 15 damage (not "You lost 15 HP")
3. **Hidden losses are more acceptable than visible losses** — Auto-drop excess weight silently; warn but don't punish
4. **Start with emotion, not mechanic** — "You are desperate for food..." not "Food < 5"

**Dragon Trail application:**
- Food/water are consumed by travel, not taken by random events
- Enemy damage is framed as "The Manticore claws you for 15 damage!" (enemy action)
- Auto-drop triggers a warning message, then handles it — visible but not punitive
- Low resource warnings: "Food is critically low!" (emotional) not "Food = 3" (mechanical)

---

## 5. DIFFICULTY, PROGRESSION & REWARD SYSTEMS

### 5.1 The First 15 Minutes

**Source: Sid Meier**

> "One of our rules of game design is that the first 15 minutes have to be really compelling, really fun — kind of almost a foreshadowing of all the cool stuff that's going to happen later in the game."

**Dragon Trail application:**
- The title ASCII art establishes the tone immediately
- Name input → survival skill → gold → companion → shop → first travel
- Within 2 minutes, the player has made 4 meaningful choices
- The first travel shows the day counter, biome, and miles — foreshadowing the 1000-mile goal

### 5.2 Difficulty Levels

**Source: Sid Meier**

> "A number of years ago I gave a talk on difficulty levels and was very convincingly made the point that four difficulty levels were the perfect number... I was wrong about that. Apparently we need nine difficulty levels."

**Dragon Trail application:**
- Survival skill 0-8 = 9 self-selected difficulty levels
- Survival 0: AC 13, carry 55 lbs, mini-boss AC 23 (harder enemies)
- Survival 8: AC 17, carry 130 lbs, mini-boss AC 15 (easier enemies)
- This is perceived progress — even though the game doesn't explicitly label "Easy/Hard," the player feels the difference

### 5.3 Explaining Setbacks

**Source: Sid Meier**

> "It's important that the player understand why those [bad] things happened and especially how to prevent that from happening the next time."

**Dragon Trail application:**
- Death from starvation: "You have run out of supplies and perished!" → teaches resource management
- Death in combat: Shows enemy stats before fight → teaches preparation
- Failed hunt: "You chose the wrong weapon" → teaches weapon matching
- Every setback is traceable to a choice the player made

### 5.4 Progression Through the Journey

**Dragon Trail's progression curve:**

| Miles | Phase | Difficulty | Encounters |
|-------|-------|-----------|------------|
| 0-250 | Early Game | Low | Flora, easy fauna, traders |
| 250-500 | Mid Game | Medium | Harder fauna, bandits, environmental events |
| 500 | Mini-Boss Gate | Spike | MisLefrak the Malevolent — requires preparation |
| 500-750 | Late Game | High | Humanoids, dragons, scarce resources |
| 750-1000 | End Game | Very High | Dragon encounter unlocked, toughest enemies |
| 1000 | Final Boss | Climax | Dragon fight — potion prep, companion critical |

**Design principle:** The mini-boss at 500 miles is a skill check. Players who haven't learned resource management or combat will die here. Players who have will feel powerful.

---

## 6. EMERGENCE & POSSIBILITY SPACES

### 6.1 Engineering Larger Spaces with Simpler Components

**Source: Will Wright**

> "Our typical approach to building larger, more dynamic spaces has been to enlist legions of developers creating them, and I think they can only carry us so far... This talk is about how we use emergence to engineer larger possibility spaces with simpler components."

**Emergence** = complex, interesting behavior arising from simple rules interacting.

**Dragon Trail application:**
- Simple rules: Travel consumes food/water. Rest consumes food/wood. Hunt consumes supplies.
- Emergent behavior: "I can't rest because I have no wood → I can't heal → I'll die in the next combat → I need to scout for wood → but scouting consumes food → I'm trapped."
- This is a **death spiral** — emergent from simple rules, not scripted
- Conversely: "I have extra herbs → I can cook potions → I'll survive the dragon → I should save herbs instead of selling them." — **emergent strategy**

### 6.2 Dynamics Applied to Dragon Trail

| Dynamic | Example |
|---------|---------|
| **Growth** | Survival skill doesn't increase, but player *understanding* grows — they learn to hoard, scout, and prepare |
| **Propagation** | A single bad travel day (no food found) propagates through the system: can't rest → can't heal → lose next combat |
| **Grouping** | Companions and players form a party — resources are shared, damage is distributed |
| **Decay** | Food, water, and health are constantly decaying resources — the core tension of the game |

### 6.3 The Light Cone

**Source: Will Wright**

A player's "light cone" shows what they can affect from their current position into the future.

**Dragon Trail application:**
- Low food/water: Light cone shrinks — player can only see a few safe days ahead
- High resources + companion: Light cone expands — player feels confident taking risks
- The shop at the start is a light cone expander: "If I buy enough supplies, I can go further."
- The mini-boss at 500 miles is a light cone boundary: players must prepare before crossing it

### 6.4 Tipping Points & Phase Transitions

**Source: Will Wright**

**Dragon Trail application:**
- **Resource tipping point:** Above 15 food = safe. Below 5 = critical. The transition feels sudden because loss aversion kicks in.
- **Combat tipping point:** Above 60% HP = aggressive play. Below 30% = defensive. Players switch strategies abruptly.
- **Journey tipping point:** At 500 miles, the mini-boss triggers. Before 500 = exploration. After 500 = survival mode.

---

## 7. THE ASCII TERMINAL AESTHETIC

### 7.1 The Aesthetic as Gameplay

The ASCII terminal is not just visual style — it IS the interface. Every piece of information is delivered through text. This creates:

1. **Pacing control** — The designer controls exactly how fast information appears
2. **Imagination activation** — Players fill in visuals with their minds (the "book vs. movie" effect)
3. **Retro authenticity** — The CRT monitor frame, scanlines, and phosphor glow sell the fantasy
4. **Focus on systems** — Without 3D graphics, players focus on numbers, choices, and consequences

### 7.2 Terminal Design Principles

**Clarity over authenticity:**
- Text must be readable — the phosphor glow should accent, not obscure
- Font size should be comfortable (18px minimum)
- ASCII art should be large enough to read (14px minimum)
- Color coding should be consistent (red = danger, green = good, yellow = warning, cyan = info)

**Animation pacing:**
- ASCII art should scan in line-by-line, not character-by-character (too slow for large art)
- Regular text should type at ~3ms/char (fast but visible)
- Pause prompts ("Press Enter to continue") give players control over pacing

### 7.3 The CRT Monitor as Character

The monitor bezel, power LED, and scanlines are not decoration — they are the game's **setting**. The player is sitting at a terminal, receiving transmissions from a wanderer on a quest. This meta-frame:
- Explains the text-only interface
- Justifies the ASCII art as "transmitted images"
- Makes the game feel like a discovered artifact

---

## 8. PRACTICAL PATTERNS FOR DRAGON TRAIL

### 8.1 The First 15 Minutes (Title → First Travel)

**Sources: Sid Meier (First 15 min) + Will Wright (Possibility Space) + Engelstein (Start with Emotion)**

**Design goal:** Within 15 minutes, the player should:
1. Understand the possibility space ("I travel, manage resources, fight, and rest")
2. Feel competent ("I bought supplies and hired a companion")
3. Be emotionally invested ("I named my character and picked a companion")
4. Know what the game promises ("1000 miles, a dragon at the end, and survival matters")

**Intro sequence:**
```
[Title ASCII art] → "Enter your name" → 
"Survival skill (0-8)" → 
"Welcome to Dragon Trail, [name]!" → 
"Your birth name determines your starting fortune..." → 
"You received [gold] starting gold." → 
"You can spend gold to hire a companion..." → 
[Companion menu] → [Shop] → [First travel]
```

### 8.2 World Progression as Curriculum

**Sources: Engelstein (Start with Emotion) + Meier (Explain Setbacks)**

| Phase | Miles | New Mechanic | Teaching Moment |
|-------|-------|-------------|-----------------|
| Early | 0-250 | Basic travel, hunting, scouting | "Travel consumes food. Hunt to restock." |
| Mid | 250-500 | Environmental events, traders | "A storm delays you. A trader offers goods." |
| Gate | 500 | Mini-boss | "MisLefrak blocks the path. Prepare for combat." |
| Late | 500-750 | Harder enemies, resource scarcity | "Food is harder to find. Choose wisely." |
| End | 750-1000 | Dragon encounter | "You sense the dragon's presence..." |
| Climax | 1000 | Final boss | "The dragon's lair. Use everything you've learned." |

### 8.3 Combat Design Patterns

**Current system analysis:**
- Turn-based menu: Melee / Ranged / Defend / Magic / StunSplosion / Potion / Flee
- Roll d20 + survival + weapon toHit vs enemy AC
- Enemy attacks automatically; companion absorbs damage if alive

**Improvement roadmap:**

| Priority | Improvement | Rationale |
|----------|-------------|-----------|
| **Immediate** | StunSplosion should actually stun (skip enemy's next turn) | The name promises it; delivers only damage |
| **Immediate** | Add critical hits (natural 20 = 2x damage) | Adds excitement and "story moments" |
| **Immediate** | Companion auto-attacks each turn | Companion feels useful, not just a sponge |
| **Short-term** | Enemy telegraph messages before attacks | "The Manticore rears back!" creates tension |
| **Short-term** | Screen shake on big hits | Visual feedback for damage |
| **Medium-term** | Give attacks identity (melee = reliable, ranged = safe, magic = high variance) | Meaningful choices, not just different numbers |
| **Medium-term** | Companion command menu (attack/defend/heal) | Player agency over companion |
| **Long-term** | Combo system (melee → ranged = bonus damage) | Rewards tactical thinking |
| **Long-term** | Enemy rage mode (< 25% HP = +2 attack, flashes red) | Makes low-HP enemies scary |

### 8.4 Resource Loop Design

**The core loop:**
```
Travel → Consumes food/water → 
  Hunt → Consumes supplies, gains food → 
    Scout → Consumes food/health, gains resources → 
      Rest → Consumes food/wood, restores health → 
        [Repeat until 1000 miles or death]
```

**Tension points:**
- Every travel day is a resource tax
- Every rest is a resource investment for health
- Every hunt is a gamble (wrong weapon = wasted supplies)
- Every scout is a risk (low food/health = can't scout)

**Design principle:** No action is free. Every choice has a cost. This creates the "resource management as drama" that Carroll advocates.

### 8.5 The Shop as Emotional Beat

**Source: Minecraft (UGC pipeline) + Engelstein (Loss Aversion)**

The shop appears:
1. At the start (with starting gold)
2. After the mini-boss (mysterious merchant)
3. Randomly via traders during travel

**Emotional function:**
- The shop is a safe space — no enemies, no resource drain
- Buying feels good (gain framing)
- Not buying creates tension ("Should I have bought that sword?")
- Prices vary by seed — each playthrough has different economic pressure

### 8.6 Save/Load Design

**Source: Sid Meier (Explain Setbacks)**

- 3 save slots — enough for experimentation, not enough for save-scumming
- Auto-save on quit — respects player time
- Save data includes: name, day, miles, score — the run's identity

**Design principle:** Save states are a promise. The player trusts that their progress is safe. Breaking that trust breaks the Unholy Alliance.

### 8.7 High Score as Legacy

**Source: NetHack (permadeath legacy)**

- Top 10 scores persist across playthroughs
- Each entry: name, score, date
- The score is a story: "Bartholomew, 12,450 XP, Day 47" — what happened?

**Emotional function:**
- High scores make permadeath meaningful — the run lives on
- Beating your previous score is intrinsic motivation
- Seeing a friend's name creates social pressure (in a good way)

---

## APPENDIX A: CROSS-REFERENCE INDEX

| Concept | Sources | Dragon Trail Implementation |
|---------|---------|----------------------------|
| Possibility Space | Will Wright | 1000-mile journey with procedural encounters |
| Listen to Your Players | Phil Carroll | Survival skill self-selection, companion choice |
| Never Say No | Phil Carroll | Auto-drop, barter system, solo viability |
| Failure as Drama | Phil Carroll | Traceable deaths, chosen failure (rest costs) |
| 3D Characters | Phil Carroll | Named companions with randomized stats |
| Permadeath as Tension | Phil Carroll | Food/water depletion, game over screen |
| Resource Management | Phil Carroll | Food/wood/herbs/supplies as depleting resources |
| Permission to Be Imperfect | Phil Carroll | Help screen always available, cheat codes |
| Only Prep What Is Necessary | Phil Carroll | Biome subset per run, 3 save slots |
| Unholy Alliance | Sid Meier | Fair combat, telegraphed dangers, consistent aesthetic |
| Loss Aversion | Engelstein | "Consumed" not "lost," gain-framed rewards |
| Winner Paradox | Sid Meier | Dragon is beatable, score celebrates effort |
| First 15 Minutes | Sid Meier | Title → name → skill → gold → companion → shop → travel |
| Emergence | Will Wright | Resource death spirals, emergent strategies |
| ASCII Aesthetic | Terminal tradition | CRT monitor, scanlines, phosphor glow |
| Difficulty Levels | Sid Meier | Survival 0-8 = 9 self-selected tiers |
| Explaining Setbacks | Sid Meier | Death messages traceable to choices |
| Framing | Engelstein | "Earned XP" not "enemy had HP left" |
| Moral Clarity | Sid Meier | Dragon = bad, player = hero, companions = allies |
| Suspension of Disbelief | Sid Meier | Consistent terminal aesthetic, named enemies |

---

## APPENDIX B: QUOTABLE DESIGN PRINCIPLES

> "The player is the star of the game. Their experience is what's key." — Sid Meier

> "People will take a sure gain, but people will gamble to avoid a loss." — Jeff Engelstein

> "Better not to give than to give and take away." — Jeff Engelstein

> "Our typical approach to building larger spaces has been to enlist legions of developers... I think we're hitting those limits." — Will Wright

> "Gameplay is a psychological experience. Everything you know is wrong." — Sid Meier

> "Start with an experience or emotion you want to give the players." — Jeff Engelstein

> "LISTEN TO YOUR PLAYERS. They will give you countless pieces of information about what they find fun. Focus on the fun, feed their hearts with what they desire. And then when you have them hooked, poke them. But not too much." — Phil Carroll

> "A character who always gets what they want and nothing bad ever happens to them is both boring and totally unrelatable." — Phil Carroll

> "If your players want to do something NEVER just flatly say NO. Ideally, say 'No...but you could...' and build on whatever suggested action they gave you." — Phil Carroll

> "Piles of gold are absolutely worthless if death isn't possible and viscerally real." — Phil Carroll

> "Nobody has any idea what they're doing in the beginning... stop judging yourself so harshly." — Phil Carroll

> "Worldbuilding may be fun but it may also be a colossal waste of time... Only prep what is necessary." — Phil Carroll

---

*Document modeled after the Physix Master Design Document, adapted for Dragon Trail's ASCII terminal survival RPG design.*
*Last updated: 2026-05-14*
