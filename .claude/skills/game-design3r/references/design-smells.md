# Design smells in working games

A smell is a symptom worth investigating, not a verdict. Each entry gives what you'd see, a quick test, the usual fixes (smallest first), and where to read more. Confirm with evidence from the actual game before reporting one.

## Contents
- A. Decisions: 1 false choice · 2 duplicate verbs · 3 lose-a-turn in disguise · 4 analysis paralysis
- B. Structure: 5 dead-end rule · 6 exception creep · 7 two games fighting · 8 clock you can rewind
- C. Feedback: 9 invisible cause · 10 punishing output randomness · 11 rules/engine drift · 12 stale evidence
- D. Arc and balance: 13 death spiral · 14 runaway leader · 15 bricked setup · 16 flat first 15 minutes · 17 anticlimax
- E. Table dynamics: 18 quarterbacking · 19 downtime · 20 hoarding with no poke · 21 theme–mechanic mismatch

---

## A. Decisions

### 1. False choice
**You see:** players take the same option nearly every time, or a button is always correct when available.
**Test:** name the situation in which each alternative is right. If one option has no such situation, it's a false choice. Check the bot or sim logs for pick rates.
**Fixes:** give the dominant option a cost or restriction (ACT-11). Make the losing option better in a specific situation. Or cut the losing option. A forced single option is better than a fake menu.
**Read:** Meier (interesting decisions), ACT-11, ACT-01.

### 2. Duplicate verbs
**You see:** two cards, tiles or actions that do the same thing under different names. Or one verb spread across components that don't share a suit, color or icon, so players can't predict it.
**Test:** list every action by its verb, not its name, and group them. Any group spanning unrelated families is a smell.
**Fixes:** merge, or give each family one verb set so the component's identity predicts its behavior (the Somnia "three suits, three verb families" pillar is an example).
**Read:** Crawford (verbs), Millers (the world teaches), `research/somnia-tightening-plan.md`.

### 3. Lose-a-turn in disguise
**You see:** a skipped phase, a forced no-op, a greyed-out button where the only legal move is a penalty, or a budget that can expire unused.
**Test:** at that moment, does the player have a choice that changes the outcome? If every legal option is "lose something," it's TRN-16 in costume, unless the player chose the risk that led there.
**Fixes:** convert the dead moment into a small decision (leftover → draw), or let the player opt into the risk earlier. Or cut the effect.
**Read:** TRN-16, ACT-01, Meier (the player has the fun).

### 4. Analysis paralysis
**You see:** long silent turns. Players ask to undo. A turn takes longer than the action is worth.
**Test:** count the legal actions × targets at a typical decision point. Compare with how much is at stake.
**Fixes:** restrict selection (ACT-11), shrink the budget (ACT-01 pace), surface the best few options in the UI, or add a timer (TRN-12) if the tone allows.
**Read:** ACT-01, ACT-11, TRN-12.

## B. Structure

### 5. Dead-end rule
**You see:** a rule, resource or zone that never touches the win, the loss, or the clock. Players forget it, and the tutorial skips it.
**Test:** trace it forward. Does any path from this rule change who wins, when it ends, or what a player can do next? If not, it's fluff.
**Fixes:** cut it, or wire it to the win or clock (e.g. Return now replays a Dream; a finished set now Acquires). Prefer cutting.
**Read:** `research/somnia-dead-ends-audit.md` (the method), Crawford (process over data).

### 6. Exception creep
**You see:** many one-off rules (boss shapes, special combat cases, per-card timing). The rules doc grows faster than the game gets better.
**Test:** count the exceptions a new player must learn before their first full round. Count the code paths that exist only for one card.
**Fixes:** fold exceptions into a few templates. Keep the base framework tiny so variety lives on the cards (ACT-12's Cosmic Encounter lesson).
**Read:** ACT-12, Wright (emergence from simple rules).

### 7. Two games fighting
**You see:** a minigame or subsystem with its own rules, pace and goals that pulls focus. Players forget the main thread while inside it.
**Test:** after the subsystem resolves, do players remember what they were trying to do?
**Fixes:** shrink it to a single decision inside the main loop, or cut it.
**Read:** Meier (Covert Action rule), VIC-16 (a Finale can cheapen the main game).

### 8. A clock you can rewind
**You see:** the end-of-game timer (deck, track, rounds) has more than one way to undo, reshuffle or skip it.
**Test:** list every effect that changes the clock's remaining length. More than one rewind dilutes the tension the clock exists to create.
**Fixes:** make the clock untouchable except for one rare, costly lever. Interacting with it can be a reward, but rarely.
**Read:** VIC-09, VIC-10, VIC-12, `research/somnia-dead-ends-audit.md` §2.

## C. Feedback

### 9. Invisible cause
**You see:** "Why did that happen?" A penalty that fires for some cards and not others with no visible difference. Hidden state that changes outcomes.
**Test:** from what's on screen or table alone, could a player predict this outcome before it happened? Could they explain it afterwards?
**Fixes:** print the condition on the component, show it in the UI at the moment it matters, or make all similar cards behave the same.
**Read:** Meier (explain setbacks), Wright (mental models), Millers (diegetic information).

### 10. Punishing output randomness
**You see:** a good plan undone by one roll or draw, and players feeling robbed.
**Test:** does the randomness land *after* the commitment, with no way to mitigate it? How often does the worst case occur? Compute it.
**Fixes:** move the randomness before the decision (reveal first, then choose), add mitigation (rerolls, RES-21; dice selection, RES-19), cap the downside, or telegraph it (ACT-17 delayed events).
**Read:** RES-03, RES-19, RES-21, ACT-17, Engelstein (loss aversion).

### 11. Rules and engine drift
**You see:** the tutorial, rules text, guide or card text says one thing and the code does another.
**Test:** for each rule touched by the review, read the engine function and the guide sentence side by side.
**Fixes:** decide which one is right, then change the other in the same commit. Treat drift as a design bug, because the person learning hits a dead end.
**Read:** `research/somnia-rules-delivery-plan.md`.

### 12. Stale evidence
**You see:** win-rate numbers, bot behavior or a sim that models a retired version of the game.
**Test:** does the sim import the current modules and encode the current rules? When was it last run?
**Fixes:** label old numbers as old. Don't balance against them. Recommend updating the sim before tuning.
**Read:** `research/somnia-dead-ends-audit.md` §10.

## D. Arc and balance

### 13. Death spiral
**You see:** one setback makes the next more likely until loss is certain, long before the game ends.
**Test:** find the tipping point (Wright). Can the player see it coming, and is there a path back that costs something but works?
**Fixes:** give a legible warning before the tip, a costly escape valve, or end the game sooner once it's decided.
**Read:** Wright (tipping points, light cone), VIC-18, VIC-15.

### 14. Runaway leader / snowball
**You see:** the early leader wins far more than chance. The victory resource is also the growth resource.
**Test:** correlate position at the midpoint with the final result.
**Fixes:** split the working currency from the victory currency (VIC-04), add gentle catch-up (VIC-18, but watch for sandbagging), or hide scores (VIC-05).
**Read:** VIC-04, VIC-05, VIC-18.

### 15. Bricked setup
**You see:** some random setups are unwinnable or trivial, e.g. a quest that names a tile that can be destroyed or never appear.
**Test:** enumerate or simulate the setups. What fraction break a goal?
**Fixes:** constrain the randomizer, add a fallback ("any tile of that suit"), or let players respond to the setup.
**Read:** UNC-10.

### 16. Flat first 15 minutes
**You see:** the opening is setup and bookkeeping, and the first interesting decision comes late.
**Test:** time it. When is the first decision with a real tradeoff? When does the game first show its signature moment?
**Fixes:** front-load one signature moment, cut opening steps, or teach by playing (tutorial as the first round).
**Read:** Meier (first 15 minutes), Millers (curiosity).

### 17. Anticlimax
**You see:** the game ends on bookkeeping, or the outcome was obvious many turns before the end.
**Test:** when did the table know the result?
**Fixes:** a finale that matters but doesn't overrule the game (VIC-16), sudden-death triggers (VIC-15), or hidden progress (VIC-05).
**Read:** VIC-15, VIC-16, VIC-05.

## E. Table dynamics

### 18. Quarterbacking (co-op)
**You see:** one player plays every seat. Full information plus shared budgets.
**Test:** could a single expert play this co-op solo with no loss of information?
**Fixes:** give each player private information or agency (partnership over collaboration), communication limits (UNC-06), timers (TRN-12), or hidden hands (UNC-08). Decide whether the table *wants* collaboration, because some groups do.
**Read:** STR-02, UNC-06, UNC-08, TRN-12, TRN-14.

### 19. Downtime
**You see:** players disengaged during others' turns.
**Test:** what fraction of the game is a given player making no decisions and having no stake?
**Fixes:** interleave phases (TRN-15), add simultaneous selection (TRN-09), add reactions or interrupts (TRN-17), or give players a stake in others' turns.
**Read:** TRN-09, TRN-15, TRN-17.

### 20. Hoarding with no poke
**You see:** the optimal play is to stockpile and wait. The economy has income and no sink.
**Test:** chart a resource over a game. Does it only go up?
**Fixes:** add a hand or storage limit (CAR-04), decay, or a reason to spend now (rising costs, expiring offers). Phil's ethos: feed players what they love, then poke them a little.
**Read:** CAR-04, ECO-06, `house-style.md`.

### 21. Theme–mechanic mismatch
**You see:** an action's name or art suggests one thing and the rule does another, e.g. a Sight tile that moves people.
**Test:** could a new player guess the rule from the name or art?
**Fixes:** rename, re-art, or move the effect to a component whose theme predicts it.
**Read:** Millers (belongs to the world), Crawford (representation).
