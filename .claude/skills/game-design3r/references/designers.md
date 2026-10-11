# The five design lenses

Each lens is a set of questions to put to a system. Use the two or three that bite on the problem in front of you. Ideas are paraphrased unless in quotation marks. Only quote what is listed here as verified, or what you have just read in a source. Never invent a quotation.

## Contents
1. Chris Crawford: interactivity, verbs, process
2. Sid Meier: interesting decisions and player psychology
3. Will Wright: possibility spaces, models, emergence
4. Robyn & Rand Miller: the world explains itself
5. Geoffrey Engelstein & Isaac Shalev: mechanisms and the mind
6. Picking lenses fast

---

## 1. Chris Crawford: interactivity, verbs, process

**Who.** Early computer-game designer (Eastern Front 1941, Balance of Power) and founder of what became GDC. Key texts: *The Art of Computer Game Design* (1984), *The Art of Interactive Design* (2002), *Chris Crawford on Game Design* (2003), and essays on process intensity.

**Core ideas**
- **Four elements of a game** (1984): *representation* (a closed formal system that subjectively models some part of reality), *interaction* (the game responds to the player), *conflict* (something actively opposes the player's goal), and *safety* (the conflict carries no real-world harm).
- **Interactivity is a conversation.** Verified wording: interaction is "a cyclic process in which two actors alternately listen, think, and speak" (2002). Interactivity is a matter of degree. A step where the game doesn't really listen to the player, or the player can't really answer, is a weak link in the conversation.
- **Verbs are the unit of design.** Ask what the player can *do*. A rich game gives meaningful verbs, and every verb should be able to change the outcome. A long list of nouns (content, cards, art) with few verbs is a shallow game.
- **Process intensity.** Prefer rules that *compute* situations over content that is merely *stored*. A small rule set that generates many distinct situations beats a big pile of hand-authored one-offs. (Relevant to card-heavy games: 100 bespoke Event texts are data. One Event rule that interacts with the board is process.)
- **Taxonomy** (2003): with no goal, a thing is a *toy*. A goal with no opponent makes a *puzzle*. Opponents who can't interfere with each other make a *competition*. Opponents who can interfere make a *game*. This is useful for asking "is this subsystem actually a puzzle bolted onto a game?"
- From the 1984 book: a **smooth learning curve**, the **illusion of winnability** (the player should always believe that a little more skill would have won), and **triangularity** (offering a safe low-reward option beside a risky high-reward one).

**Questions this lens asks**
- What are the verbs here? Does each one change the outcome? Are two verbs secretly the same verb?
- Does the game *listen*? Does it respond to what the player chose, or does it just roll and announce?
- Where is the opposition? Does the conflict come from a system that reacts, or from a static obstacle?
- Is this content (data) doing a job a rule (process) could do better?

**Reach for it when** a system feels passive, players feel like they're watching rather than playing, or there's a lot of content and little decision.

---

## 2. Sid Meier: interesting decisions and player psychology

**Who.** Designer of Civilization, Pirates!, Railroad Tycoon, Covert Action and Gettysburg, and co-founder of MicroProse and Firaxis. Key sources: GDC talks "The Psychology of Game Design (Everything You Know Is Wrong)" (2010) and "Interesting Decisions" (2012), and *Sid Meier's Memoir!* (2020).

**Core ideas**
- **"A game is a series of interesting decisions."** He said this at GDC in 1989 and unpacked it in 2012. A decision is interesting when no option is clearly best, the tradeoffs depend on the situation, the consequences persist, and the player has enough information to reason about it. If the right answer is obvious, or unknowable, it isn't a decision.
- **Find the fun, fast.** Prototype early and iterate many times. Make the change and test it rather than debating it.
- **Double it or cut it in half.** When tuning, make big moves. A 5% nudge teaches you nothing. Doubling tells you whether the knob even matters. (The original Civilization got faster by halving the map.)
- **The Covert Action rule.** Two good games inside one game fight each other. When a minigame or subsystem pulls attention away from the main loop, players lose the thread. One strong game is better.
- **Player psychology beats math** (2010). Players are not rational calculators. They feel 3:1 odds as a sure thing and resent losing them. They credit wins to their own skill and blame losses on the game. So: shade randomness toward perceived fairness, and **explain every setback**, meaning the player should see why it happened and how to avoid it next time.
- **The "unholy alliance."** Designer and player agree to pretend together. The player is the hero, and the game's job is to make the player feel smart and powerful, not to show off the designer's or the AI's cleverness. The *player* should be the one having the fun.
- **The first 15 minutes** must be compelling and should foreshadow the cool stuff later.
- **"One more turn."** Overlapping goals on different time scales mean there's always something about to pay off.
- **Lean on what players already know.** Familiar themes and history let players arrive with a mental model for free.

**Questions this lens asks**
- Is this an interesting decision? Name the competing options and say when each one is right. If you can't, it's a false choice.
- Would the player understand why they lost, and what to do differently?
- Is this tuning change big enough to learn from?
- Is a subsystem stealing focus from the core loop?
- Who's having the fun here: the player, or the system?

**Reach for it when** something is "balanced on paper" but feels bad, a choice has a dominant answer, losses feel unfair, or you're stuck tuning numbers.

---

## 3. Will Wright: possibility spaces, models, emergence

**Who.** Designer of SimCity, SimEarth, SimAnt, The Sims and Spore, and co-founder of Maxis. Key sources: GDC "Dynamics for Designers" (2003), keynotes, and his MasterClass. He describes himself as a toymaker as much as a game designer.

**Core ideas**
- **Possibility space.** Gameplay is the player exploring a space of possible states and actions. Good design widens the space that's *meaningful* to explore, not just its size.
- **Systems, not branching trees.** Past a certain size, a space can't be mapped by hand. So build simple elements that interact, and let them generate the possibilities.
- **Emergence from simple rules.** Complexity should come from interaction, not from rule count. SimCity is simple parts following simple rules that add up to something complex.
- **Mental models.** Players are constantly building a model of how the system works. They form a theory, act on it, and read the feedback. The game is a tool for model-building, so feedback must be *legible* enough for the model to converge. Hidden or delayed causality breaks this.
- **Structure / dynamics / models** and three topologies (*agents*, *networks*, *layers*), plus the **light cone** (what the player can affect from where they stand) and **tipping points** (where the system flips state). The Dragon Trail design doc applies all of these in detail.
- **Toys before games.** A system that's fun to poke with no goal is a strong foundation. Goals layered on a good toy feel natural.
- **Leave room for imagination.** Abstraction invites the player to fill in detail. Wright's own line is that the best games are the ones you keep playing in your head after you walk away.
- **Failure is content.** Disasters, collapses and death spirals that players can *read* become stories they tell.

**Questions this lens asks**
- What model of this system will a player build after three plays? Is it correct? What feedback would correct it?
- Where are the tipping points? Can the player see one coming, and act before crossing it?
- Is this complexity coming from interactions or from exceptions?
- Is there a death spiral, and is it legible and escapable, or silent and inevitable?
- What does the light cone look like at the moment of this decision?

**Reach for it when** a system is opaque, players can't predict outcomes, the game feels scripted rather than alive, or there are many special cases.

---

## 4. Robyn & Rand Miller: the world explains itself

**Who.** Brothers who founded Cyan and made The Manhole (1988), Cosmic Osmo, Myst (1993) and Riven (1997). Sources: Cyan's own history and interviews with Rand Miller (e.g. 25th-anniversary interviews).

**Core ideas**
- **A place, not a game.** Myst set out to feel more like a world you visit than a game you play. Cyan says the game would have no dying, no shooting, no starting over, and almost no inventory. Verified: Robyn Miller said "No one dies in Myst."
- **World first, then story, then puzzles, each feeding the others.** They started with an island (a natural boundary). As each place was drawn the story grew, the story suggested puzzles, and the puzzles fed back into the environment. Puzzles belong to the world. The machines make sense as machines.
- **Diegetic information.** Clues live in the world: journals, books, notes, sounds and the machinery itself. There's almost no HUD, and the cursor is a hand. The interface gets out of the way.
- **Curiosity is the engine.** The Manhole began with a single drawing that implied a world beneath it. The player's wish to see what's past the next door is the motivation, with no score needed.
- **Deliberate under the organic feel.** Every location and puzzle was mapped and documented. Freedom for the player comes from rigor in the design.
- **The cost.** Some puzzles were obtuse, and many players never finished. In-world clues must be *reachable* and *sufficient*. Fairness is the price of removing hand-holding.

**Questions this lens asks**
- Can a player learn this rule by looking at the board or card, without the rulebook?
- Does this element belong to the world and theme, or is it a mechanic wearing a costume?
- Is there a fail state that only punishes, with no story and nothing learned? Could it be cut?
- Is the information the player needs inside the game, in reach, at the moment they need it?
- What makes the player *curious* here?

**Reach for it when** reviewing tutorials, onboarding, iconography, theme–mechanic fit, exploration or reveal systems, and any "players don't understand X" report.

---

## 5. Geoffrey Engelstein & Isaac Shalev: mechanisms and the mind

**Who.** Engelstein designed The Ares Project, the Space Cadets series and The Expanse board game, hosts the Ludology podcast, and teaches board-game design at NYU. He also wrote *GameTek* (2018) and *Achievement Relocked: Loss Aversion and Game Design* (MIT Press, 2020). Shalev co-designed Seikatsu, co-hosts On Board Games, and writes on design patterns at kindfortress.com. Together they wrote *Building Blocks of Tabletop Game Design: An Encyclopedia of Mechanisms* (CRC Press, 2020), which is in the repo. See `building-blocks.md` and the lookup script.

**Core ideas**
- **Mechanisms are ingredients, not recipes.** Naming the mechanism precisely (e.g. ACT-01 Action Points plus TRN-14 Passed Action Token) lets you look up how it's known to behave and where it's known to fail.
- **Each mechanism creates a player experience and has known pitfalls.** The book's Discussion sections are where the pitfalls live. Read the entry before advising.
- **Psychology of loss** (Engelstein): losses loom larger than equal gains, so framing changes choices. "Lose 2" and "fail to gain 2" are different experiences with identical math. The endowment effect, anchoring and sunk cost all show up at the table. Use framing deliberately.
- **Randomness has a placement.** Randomness before a decision (input) gives the player something to plan around. Randomness after a decision (output) can override the plan. Neither is wrong. Know which one you're using and what it does to agency. (See RES and UNC entries, and the RES-03 discussion of crits.)
- **Obscured probability keeps choices fresh.** When expected value is trivially computable, push-your-luck goes stale (UNC-02).

**Questions this lens asks**
- What exactly are the mechanisms here, by code? What does the book say goes wrong with each?
- Is a loss being framed as a loss when it could be framed as a forgone gain, or the other way round? Which serves the experience?
- Where does the randomness sit relative to the decision?
- Is there a well-known variant of this mechanism that solves the observed problem?

**Reach for it when** you need precise vocabulary, a known fix for a known failure, or the psychology of risk and loss.

---

## 6. Picking lenses fast

| Symptom | Start with |
| --- | --- |
| "It's boring / I'm not doing anything" | Crawford (verbs), Meier (interesting decisions) |
| "That loss felt unfair" | Meier (psychology, explain setbacks), Engelstein (loss framing, randomness placement) |
| "I don't understand what happened / why" | Wright (mental models, feedback), Millers (diegetic info) |
| "Too many rules / exceptions" | Wright (emergence), Crawford (process), Building Blocks ACT-12 |
| "One player runs the table" | Building Blocks STR-02, UNC-06, TRN-12 |
| "The new player bounced off" | Meier (first 15 minutes), Millers (world teaches) |
| "This minigame / subsystem feels bolted on" | Meier (Covert Action rule), Millers (belongs to the world) |
| "Death spiral / runaway leader" | Wright (tipping points), Building Blocks VIC-18 |
| "Tuning isn't converging" | Meier (double or halve), and check whether the sim models the current game |
