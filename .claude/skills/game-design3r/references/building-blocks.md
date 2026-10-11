# Building Blocks of Tabletop Game Design: working notes

Geoffrey Engelstein & Isaac Shalev, *Building Blocks of Tabletop Game Design: An Encyclopedia of Mechanisms*, CRC Press, 2020. The PDF is at `research/building-blocks-of-tabletop-of-mechanisms.pdf`. Read entries with `scripts/bb_lookup.py` (see SKILL.md). Each entry has a **Description** (what it is), a **Discussion** (how it plays, variants, pitfalls) and **Sample Games**.

The authors frame the book as a catalog of ingredients, not a recipe book. A code tells you which shelf to read. The Discussion tells you how that ingredient behaves. Always read the entry before resting advice on it. The notes below are paraphrased orientation, not a substitute.

## Contents
1. Full code index
2. Cross-cutting lessons (paraphrased)
3. Terminology traps
4. Mapping a system to codes

---

## 1. Full code index

**STR (Game Structure):** STR-01 Competitive Games · STR-02 Cooperative Games · STR-03 Team-Based Games · STR-04 Solo Games · STR-05 Semi-Cooperative Games · STR-06 Single Loser Games · STR-07 Traitor Games · STR-08 Scenario/Mission/Campaign Games · STR-09 Score-and-Reset Games · STR-10 Legacy Games

**TRN (Turn Order and Structure):** TRN-01 Fixed Turn Order · TRN-02 Stat Turn Order · TRN-03 Bid Turn Order · TRN-04 Progressive Turn Order · TRN-05 Claim Turn Order · TRN-06 Pass Order · TRN-07 Real-Time · TRN-08 Punctuated Real-Time · TRN-09 Simultaneous Action Selection · TRN-10 Role Order · TRN-11 Random Turn Order · TRN-12 Action Timer · TRN-13 Time Track · TRN-14 Passed Action Token · TRN-15 Interleaved vs. Sequential Phases · TRN-16 Lose a Turn · TRN-17 Interrupts

**ACT (Actions):** ACT-01 Action Points · ACT-02 Action Drafting · ACT-03 Action Retrieval · ACT-04 Action/Event · ACT-05 Command Cards · ACT-06 Action Queue · ACT-07 Shared Action Queue · ACT-08 Follow · ACT-09 Order Counters · ACT-10 Rondel · ACT-11 Action Selection Restrictions · ACT-12 Variable Player Powers · ACT-13 Once-Per-Game Abilities · ACT-14 Advantage Token · ACT-15 Gating and Unlocking · ACT-16 Tech Trees/Tech Tracks/Track Bonuses · ACT-17 Events · ACT-18 Narrative Choice

**RES (Resolution):** RES-01 High Number · RES-02 Stat Check · RES-03 Critical Hits and Failures · RES-04 Ratio/Combat Results Table · RES-05 Die Icons · RES-06 Card Play · RES-07 Rock, Paper, Scissors · RES-08 Prisoner's Dilemma · RES-09 Alternate Removal · RES-10 Physical Action · RES-11 Static Capture · RES-12 Enclosure · RES-13 Minimap · RES-14 Force Commitment · RES-15 Voting · RES-16 Player Judge · RES-17 Targeted Clues · RES-18 Tie-Breakers · RES-19 Dice Selection · RES-20 Action Speed · RES-21 Rerolling and Locking · RES-22 Kill Steal

**VIC (Game End and Victory):** VIC-01 Victory Points from Game State · VIC-02 Victory Points from Player Actions · VIC-03 Temporary and Permanent Victory Points · VIC-04 Victory Points as a Resource · VIC-05 Hidden and Exposed Victory Points · VIC-06 End-Game Bonuses · VIC-07 Race · VIC-08 Player Elimination · VIC-09 Fixed Number of Rounds · VIC-10 Exhausting Resources · VIC-11 Completing Targets · VIC-12 Fixed Number of Events · VIC-13 Elapsed Real Time · VIC-14 Connections · VIC-15 Circuit Breaker/Sudden Death · VIC-16 Finale · VIC-17 King of the Hill · VIC-18 Catch the Leader · VIC-19 Tug of War · VIC-20 Highest Lowest

**UNC (Uncertainty):** UNC-01 Betting and Bluffing · UNC-02 Push-Your-Luck · UNC-03 Memory · UNC-04 Hidden Roles · UNC-05 Roles with Asymmetric Information · UNC-06 Communication Limits · UNC-07 Unknown Information · UNC-08 Hidden Information · UNC-09 Probability Management · UNC-10 Variable Setup · UNC-11 Hidden Control

**ECO (Economics):** ECO-01 Exchanging · ECO-02 Trading · ECO-03 Market · ECO-04 Delayed Purchase · ECO-05 Income · ECO-06 Automatic Resource Growth · ECO-07 Loans · ECO-08 Always Available Purchases · ECO-09 I Cut, You Choose · ECO-10 Discounts · ECO-11 Upgrades · ECO-12 Random Production · ECO-13 Investment · ECO-14 Ownership · ECO-15 Contracts · ECO-16 Bribery · ECO-17 Increase Value of Unchosen Resources · ECO-18 Negotiation · ECO-19 Alliances

**AUC (Auctions):** AUC-01 Open Auction · AUC-02 English Auction · AUC-03 Turn Order Until Pass Auction · AUC-04 Sealed-Bid Auction · AUC-05 Sealed Bid with Cancellation · AUC-06 Constrained Bidding · AUC-07 Once-Around Auction · AUC-08 Dutch Auction · AUC-09 Second-Bid Auction · AUC-10 Selection Order Bid · AUC-11 Multiple-Lot Auction · AUC-12 Closed-Economy Auction · AUC-13 Reverse Auction · AUC-14 Dexterity Auction · AUC-15 Fixed-Placement Auction · AUC-16 Dutch Priority Auction

**WPL (Worker Placement):** WPL-01 Standard Worker Placement · WPL-02 Workers of Differing Types · WPL-03 Acquiring and Losing Workers · WPL-04 Workers-As-Dice · WPL-05 Adding and Blocking Buildings · WPL-06 Single Workers · WPL-07 Building Actions and Rewards · WPL-08 Turn Order and Resolution Order

**MOV (Movement):** MOV-01 Tessellation · MOV-02 Roll and Move · MOV-03 Pattern Movement · MOV-04 Movement Points · MOV-05 Resource to Move · MOV-06 Measurement · MOV-07 Different Dice · MOV-08 Drift · MOV-09 Impulse · MOV-10 Programmed Movement · MOV-11 Relative Position · MOV-12 Mancala · MOV-13 Chaining · MOV-14 Bias · MOV-15 Moving Multiple Units · MOV-16 Map Addition · MOV-17 Map Reduction · MOV-18 Map Deformation · MOV-19 Move Through Deck · MOV-20 Movement Template · MOV-21 Pieces as Map · MOV-22 Multiple Maps · MOV-23 Shortcuts · MOV-24 Hidden Movement

**ARC (Area Control):** ARC-01 Absolute Control · ARC-02 Area Majority/Influence · ARC-03 Troop Types · ARC-04 Territories and Regions · ARC-05 Area Parameters · ARC-06 Force Projection · ARC-07 Zone of Control · ARC-08 Line of Sight

**SET (Set Collection):** SET-01 Set Valuation · SET-02 Tile-Laying · SET-03 Grid Coverage · SET-04 Network Building · SET-05 Combo Abilities

**CAR (Card Mechanisms):** CAR-01 Trick Taking · CAR-02 Ladder Climbing · CAR-03 Melding and Splaying · CAR-04 Card Draw, Limits and Deck Exhaustion · CAR-05 Deck Building · CAR-06 Drafting

---

## 2. Cross-cutting lessons (paraphrased)

These recur across the book's discussions. Each names the entries that develop it. Read those before citing.

- **Prototype fast, play widely.** The book's introduction calls a quick physical prototype the best first advice for a designer, and playing many games the second best.
- **Cooperative games split into partnership and collaborative play** (STR-02). In a partnership, each player keeps agency over their own resources and choices. In collaborative play, the table seeks consensus on everything. Co-ops drift toward collaborative play, and toward the alpha-player ("quarterbacking") problem, unless the rules substantially impede it through limits on communication, time or information (UNC-06, TRN-12, UNC-08). Co-ops also split into games with an AI opponent (a deck or algorithm drives the enemy) and puzzle co-ops with no villain.
- **Co-op difficulty is tightly coupled to the card economy** (CAR-04). Hand limits and draw rates are the difficulty dial in co-ops. Loosening a hand limit can make the game substantially easier.
- **Lose a Turn is an anti-pattern, and so are its disguises** (TRN-16). Any turn where the player technically acts but can't do anything meaningful feels the same, e.g. needing an exact roll to finish. The book's line is that players want to play, and losing a turn means not playing.
- **Player elimination is usually an anti-pattern** (VIC-08), except in short, quick-replay games, when it's thematically satisfying (a final retaliation), or when eliminated players still care because their team can win.
- **Variable Player Powers want a simple framework** (ACT-12). The best power-heavy games keep the base system tiny so powers have room to differ. Powers raise cognitive load. Spreading them across cards eases teaching but makes a first play with a character weaker. Strong powers can create one "correct" strategy per character.
- **Catch the Leader vs. snowball** (VIC-18, VIC-04). If catch-up is too strong, players sandbag. Watch for the opposite: when the victory measure is also the growth resource, the leader snowballs. Splitting the working currency from the victory currency forces a conversion decision.
- **Events are better when they change the state for a while, and when players can see them coming** (ACT-17). Random, negative, immediate events feel punishing. Telegraphed or delayed events (revealed now, resolved at round end) give players something to plan around.
- **Push-your-luck needs obscured odds and shifting stakes** (UNC-02). If the expected value is trivially computable, the choice goes stale. Stakes that rise near the end (nothing left to lose) make players bolder.
- **Crits lengthen the tail** (RES-03). They add jackpot excitement and make long shots possible, at the cost of variance. Converting excess successes into a spendable currency gives players tactical choices instead of pure luck.
- **Interleaved phases reduce downtime** (TRN-15). In modern design, all players doing phase 1, then all doing phase 2, is generally preferred over one player doing every phase before passing. Sequential structures are kept when big swings are the point.
- **Variable setup is not the same as replayability, and it can break balance** (UNC-10). Constrain the randomizer, or let players respond to the setup (e.g. a snake draft). Give player aids when players need to know the whole possibility pool.
- **A Finale can cheapen the main game** (VIC-16). If the closing mini-game can override a dominant performance, the earlier hours feel meaningless. It suits light games best, and it costs extra rules to teach.
- **Action Points set the pace** (ACT-01). Small budgets give quick turns. Larger budgets lengthen turns but open room for combos. Variable action costs widen the decision space and add weight. The book notes both variants for leftovers (carry over, or spend-or-lose) without ruling between them. The argument that wasted points feel like a lost turn comes from combining ACT-01 with TRN-16, so cite it that way.
- **Restricting action selection is a design space** (ACT-11). Forcing players off the optimal action (drafting, rondels, retrieval, house selection, grids) is where much modern innovation lives. A repeatable action with no restriction tends to become the default.

---

## 3. Terminology traps

- **TRN-15 direction.** In the book, *Interleaved* means every player does phase 1, then every player does phase 2. *Sequential* means each player does all phases before the next player starts. A whole-table "Reveal, then Explore, then Meet" round is **Interleaved** by the book's definition. (`research/building-blocks-somnia-mapping.md` labels Somnia's round "Sequential Phases". Flag the mismatch when it matters rather than repeating it.)
- **ACT-01 and leftovers.** The Somnia mapping doc credits ACT-01 with an "unused points should do something" note. The entry itself only lists carryover and spend-or-lose as variants. The stronger argument is TRN-16 (a wasted budget plays like a lost turn).
- **Meta-mechanisms.** Several entries (TRN-16, ACT-12, VIC-18) are meta-mechanisms that modify other systems. Cite them together with the base mechanism.
- **"Events"** means two things: ACT-17 Events (effects outside player control) and ACT-04 Action/Event (a card usable as either an action or an event). Check which one is meant.

---

## 4. Mapping a system to codes

When asked for a mechanism mapping, or when diagnosing:

1. Walk the round from setup to game end: structure (STR), turn order (TRN), what players do (ACT), how outcomes resolve (RES), how it ends and who wins (VIC), where the hidden or random information is (UNC), and then any ECO/AUC/WPL/MOV/ARC/SET/CAR systems present.
2. For each mechanism found, run `bb_lookup.py CODE` and read the Discussion for the pitfall that matches the observed problem.
3. Use `--search` for symptoms ("downtime", "kingmaker", "sandbag", "snowball", "quarterback", "anti-pattern") to find entries you didn't think of.
4. Cite as `CODE Name` in the write-up, and say what the book's discussion implies for *this* game, not just what the mechanism is.
