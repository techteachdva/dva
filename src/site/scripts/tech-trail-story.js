/**
 * Global Tech Gauntlet — branching digital citizenship adventure.
 */
(() => {
  "use strict";

  const CHARACTERS = {
    lovelace: { name: "Chief Ada Lovelace", role: "Field Operative · First Programmer", emoji: "👑", era: "1843", research: "Ada Lovelace wrote the first computer program and saw that machines could do more than calculate numbers." },
    turing: { name: "Agent Alan Turing", role: "Cryptography Division", emoji: "🔐", era: "1940s", research: "Alan Turing helped break enemy codes in WWII and founded modern computer science." },
    babbage: { name: "Dr. Charles Babbage", role: "Mechanical Systems Architect", emoji: "⚙️", era: "1837", research: "Charles Babbage designed the Analytical Engine — the first general-purpose computer concept." },
    wright: { name: "Coach Will Wright", role: "Simulation Design Lab", emoji: "🌍", era: "1989", research: "Will Wright created SimCity and The Sims — games that simulate real human systems." },
    meier: { name: "Captain Sid Meier", role: "Strategy & Iteration Corps", emoji: "♟️", era: "1991", research: "Sid Meier designed Civilization — proving that iteration and fun can teach history and strategy." },
    campbell: { name: "Professor Joseph Campbell", role: "Narrative & Culture Division", emoji: "📜", era: "1949", research: "Joseph Campbell studied myths worldwide — culture is technology that solves belonging and identity." },
    crawford: { name: "Chris Crawford", role: "Interactive Systems Bureau", emoji: "🎮", era: "1984", research: "Chris Crawford pioneered interactive storytelling — choices in games mirror choices online." },
    conway: { name: "John Conway", role: "Emergent Systems Observatory", emoji: "🔬", era: "1970", research: "John Conway's Game of Life showed how simple rules create complex patterns — like rumors online." },
    hopper: { name: "Admiral Grace Hopper", role: "Debugging Fleet", emoji: "🐛", era: "1947", research: "Grace Hopper coined 'debugging' and invented the first compiler — making code human-readable." },
    johnson: { name: "Director Katherine Johnson", role: "Trajectory Analytics", emoji: "🚀", era: "1962", research: "Katherine Johnson calculated NASA flight paths by hand — precision and persistence solve impossible problems." },
    guide: { name: "The Host", role: "Global Tech Gauntlet", emoji: "🌐", era: "NOW", research: "Your mission host at ACME Tech Division — briefing you through each challenge." },
  };

  /** All possible first missions — app shuffles and shows 3–4 per run. */
  const START_MISSIONS = [
    { label: "Report to the Design Lab — a team built the wrong thing", next: "design_lab" },
    { label: "Respond to an alert from the Data Vault", next: "data_vault" },
    { label: "Head for the Password Vault — security gate is locked", next: "password_temple" },
    { label: "Investigate strange output in the Code Bay", next: "code_bay" },
    { label: "Help stabilize the Network Closet", next: "network_closet" },
    { label: "Visit the AI Ethics Lab — a classifier is flagging the wrong people", next: "ai_ethics" },
    { label: "Tour the Hardware Graveyard — old devices are leaking data", next: "hardware_graveyard" },
    { label: "Browse the Open Source Bazaar — a team forked without credit", next: "open_source" },
    { label: "Report to the Bias Detection Unit — an app treats users differently", next: "bias_unit" },
    { label: "Enter the Data Detective Agency — someone's trail doesn't add up", next: "data_detective" },
  ];

  const STORY = {
    start: {
      location: "ACME Tech Division — Briefing Room",
      character: "guide",
      narrative: `The briefing room hums. Five holo-screens show live incidents across the network — but you can only respond to one right now.

The Host leans in. "Somewhere out there, the <strong>Golden Rules of Digital Citizenship</strong> got scattered. Recover them by making good calls under pressure. No single path covers everything — you'll need to think, not memorize."

Ada Lovelace flickers onto the main screen. "Every mission starts with a question worth asking. Pick your first move."`,
      dynamicChoices: "start",
      choices: [],
    },

    design_lab: {
      location: "Design Lab · London, 1843 (simulated)",
      character: "lovelace",
      narrative: `Lovelace gestures at a half-finished app on the wall. "They asked users what they wanted, but never asked what problem they were actually solving."

The project lead is impatient. "We can polish the interface later — ship it Friday."`,
      choices: [
        { label: "Interview potential users before building more", next: "define_win", integrity: 5, reputation: 5 },
        { label: "Ship a lean prototype fast and gather feedback live", next: "define_recovery_1", integrity: -5, reputation: 10 },
      ],
    },

    define_win: {
      location: "Design Lab — Problem Defined",
      character: "lovelace",
      lesson: "8.3.3.1",
      narrative: `Lovelace smiles. "There — now you're designing for people, not for the demo."

A side door opens onto Will Wright's simulation studio. Someone mentions a prototype ready for testing.`,
      badge: "Design Thinker",
      goldenRule: 1,
      choices: [
        { label: "Visit the simulation studio to plan the next step", next: "prepare_phase" },
        { label: "Skip ahead — test a rough prototype now", next: "try_phase" },
        { label: "Check the Data Vault alert you saw in briefing", next: "data_vault" },
        { label: "Ask Lovelace about her deep-dive module", next: "lovelace_deep" },
      ],
    },

    define_recovery_1: {
      location: "Design Lab — Launch Day",
      character: "lovelace",
      narrative: `Launch day arrives. Three people open the app, frown, and leave. The lead checks analytics in silence.

Lovelace doesn't scold you — she studies the bounce rate. "Speed teaches too, but it teaches in public. You shipped something half-understood."`,
      choices: [
        { label: "Pivot based on feedback and re-engage users", next: "define_win", integrity: 5, reputation: 0 },
        { label: "Double down on features to win back the leavers", next: "define_recovery_2", integrity: -10, reputation: -5 },
      ],
    },

    define_recovery_2: {
      location: "Design Lab — Deadline Pressure",
      character: "lovelace",
      narrative: `Feature bloat makes the app slower. The lead wants one more sprint. Lovelace taps the whiteboard: "You're solving your own anxiety, not their problem."

Your integrity takes a hit from the public misstep.`,
      choices: [
        { label: "Pause and run user interviews before anything else ships", next: "define_win", integrity: 0, reputation: 0 },
      ],
    },

    prepare_phase: {
      location: "Simulation Studio · Orinda, CA",
      character: "wright",
      narrative: `Wright clears a table of crumpled sketches. "Before you build, tell me what you're actually trying to fix — in plain language."`,
      typingChallenge: {
        prompt: "In 2–3 sentences: What real problem would you solve with technology at your school or in your neighborhood? Who benefits?",
        minWords: 20,
        next: "prepare_win",
      },
      choices: [],
    },

    prepare_win: {
      location: "Simulation Studio — Plan Set",
      character: "wright",
      lesson: "8.3.3.1",
      narrative: `"Good," Wright says. "That's a problem worth a prototype — not just a feature list."

Down the hall, you hear keyboard clicks and someone muttering about a login bug.`,
      badge: "Problem Solver",
      choices: [
        { label: "See what's happening in the prototype arena", next: "try_phase" },
        { label: "Detour to the Password Vault", next: "password_temple" },
        { label: "Visit the Sources Library — a rumor is spreading", next: "sources_library" },
      ],
    },

    try_phase: {
      location: "Prototype Arena",
      character: "meier",
      narrative: `Meier rolls a die across the table — it clatters to a stop. "Test early, test honest. Right now your build has a login bug, and real users are waiting."

You could watch them struggle openly, or patch quietly and monitor logs.`,
      rngBadge: { chance: 0.28, badge: "Lucky Roll", message: "The die lands on your number — Meier grins. \"Fortune favors the prepared.\"" },
      choices: [
        { label: "Sit with users, watch where they get stuck, take notes", next: "try_win", integrity: 5, reputation: 5 },
        { label: "Patch quietly and push a hotfix without announcing the bug", next: "try_recovery_1", integrity: -5, reputation: 10 },
        { label: "Call Grace Hopper's debugging team", next: "debug_scene", integrity: 0, reputation: 0 },
      ],
    },

    try_win: {
      location: "Prototype Arena — Notes Taken",
      character: "meier",
      lesson: "8.3.3.1",
      narrative: `"Painful to watch, useful to know," Meier says. "That's data — not failure."

Chris Crawford is reviewing your metrics in the next room.`,
      badge: "Iterative Builder",
      choices: [
        { label: "Review what to change with Crawford", next: "reflect_phase" },
        { label: "Follow the network outage to the closet", next: "network_closet" },
      ],
    },

    try_recovery_1: {
      location: "Prototype Arena — Support Queue",
      character: "meier",
      narrative: `Support tickets pile up. One user writes: "I liked the idea. I couldn't get in." Another notices the silent patch and questions your transparency.

Meier resets the sim. "You fixed the code but chipped your credibility. Same prototype. Different choice?"`,
      choices: [
        { label: "Watch users and document what breaks", next: "try_win", integrity: 5, reputation: 0 },
        { label: "Keep patching quietly and monitor from behind the scenes", next: "try_recovery_2", integrity: -10, reputation: -5 },
      ],
    },

    try_recovery_2: {
      location: "Prototype Arena — Trust Erosion",
      character: "meier",
      narrative: `A forum thread accuses the team of hiding bugs. Meier taps the table. "Silent fixes feel safe — until they don't."

Your integrity takes another hit from the credibility gap.`,
      choices: [
        { label: "Own the bug publicly and observe users fixing it", next: "try_win", integrity: 0, reputation: 0 },
      ],
    },

    debug_scene: {
      location: "Debugging Fleet · USS Hopper",
      character: "hopper",
      narrative: `Hopper taps the screen. "Infinite loop. Classic. You can guess, you can rewrite everything, or you can trace it line by step."

She's already pulled up the log.`,
      choices: [
        { label: "Walk through the logic step by step", next: "debug_win", integrity: 5, reputation: 5 },
        { label: "Rewrite the module cleanly from scratch tonight", next: "debug_recovery_1", integrity: -5, reputation: 0 },
        { label: "Change random lines until the error message changes", next: "debug_recovery_2", integrity: -15, reputation: -10 },
      ],
    },

    debug_win: {
      location: "Debugging Fleet — Loop Broken",
      character: "hopper",
      lesson: "8.3.3.2",
      narrative: `"There it is — one condition flipped," Hopper says. "Computers don't get tired. They do exactly what you wrote."

Katherine Johnson waves you toward the trajectory console. A fake quote is trending upstairs.`,
      badge: "Debugger",
      choices: [
        { label: "Check the trending quote with Johnson", next: "trajectory_scene" },
        { label: "Reflect on the prototype with Crawford", next: "reflect_phase" },
        { label: "Ask Hopper about her deep-dive module", next: "hopper_deep" },
      ],
    },

    debug_recovery_1: {
      location: "Debugging Fleet — Scope Creep",
      character: "hopper",
      narrative: `The rewrite introduces three new bugs where one existed. Hopper studies the diff. "Fresh code smells better, but it isn't smarter."

"You replaced a known problem with unknown ones."`,
      choices: [
        { label: "Trace the original logic carefully", next: "debug_win", integrity: 5, reputation: 0 },
        { label: "Keep rewriting — you'll catch them eventually", next: "debug_recovery_2", integrity: -5, reputation: -5 },
      ],
    },

    debug_recovery_2: {
      location: "Debugging Fleet — Still Spinning",
      character: "hopper",
      narrative: `"That made two bugs where there was one," Hopper says mildly. "Try the boring way — it works."

Your integrity takes a hit from preferring motion over method.`,
      choices: [
        { label: "Trace the logic carefully", next: "debug_win", integrity: 0, reputation: 0 },
      ],
    },

    reflect_phase: {
      location: "Interactive Systems Bureau",
      character: "crawford",
      narrative: `Crawford pulls up a simple chart: what worked, what didn't, what surprised you. "No spin. What would version two fix?"`,
      typingChallenge: {
        prompt: "In 2–3 sentences: What did testing teach you? What would you change before sharing this with more people?",
        minWords: 15,
        next: "reflect_win",
      },
      choices: [],
    },

    reflect_win: {
      location: "Systems Bureau — Debrief",
      character: "conway",
      lesson: "8.3.3.1",
      narrative: `Conway's Game of Life patterns ripple on the wall behind you. "Small rule changes, big outcomes. Same online."

Campbell calls from the Collaboration Bridge — a group chat is going sideways.`,
      badge: "Reflector",
      choices: [
        { label: "Head to the Collaboration Bridge", next: "collaboration_bridge" },
        { label: "You're close — enter the Final Trial", next: "final_trial" },
      ],
    },

    code_bay: {
      location: "Code Bay · Algorithm Dock",
      character: "meier",
      narrative: `A delivery robot waits at the edge of a grid. Meier hands you a marker. "It needs instructions — not vibes."

Two teammates argue. One wrote three clear steps with turns. The other wrote "go to the goal somehow."`,
      choices: [
        { label: "Use ordered steps with clear if/then decisions", next: "code_win", integrity: 5, reputation: 5 },
        { label: "Write a simpler heuristic and test iteratively", next: "code_recovery_1", integrity: 0, reputation: 0 },
        { label: "Let it run random moves until something works", next: "code_recovery_2", integrity: -10, reputation: -5 },
      ],
    },

    code_win: {
      location: "Code Bay — Path Found",
      character: "meier",
      lesson: "8.3.3.3",
      narrative: `"Boring, precise, done," Meier says. "That's an algorithm."

The robot beeps acknowledgment and rolls toward the next bay.`,
      badge: "Algorithm Architect",
      choices: [
        { label: "Visit Hopper's debugging fleet", next: "debug_scene" },
        { label: "Return to the Design Lab", next: "design_lab" },
        { label: "Proceed to the Final Trial", next: "final_trial" },
      ],
    },

    code_recovery_1: {
      location: "Code Bay — Partial Path",
      character: "meier",
      narrative: `The heuristic gets the robot halfway — then loops in a corner. Meier studies the trace. "Heuristics are fine for games, not guarantees."

"Want to tighten it into something provable?"`,
      choices: [
        { label: "Rewrite as ordered step-by-step instructions", next: "code_win", integrity: 5, reputation: 0 },
        { label: "Add more heuristics and hope one sticks", next: "code_recovery_2", integrity: -5, reputation: -5 },
      ],
    },

    code_recovery_2: {
      location: "Code Bay — Gridlock",
      character: "meier",
      narrative: `The robot spins, backs into a wall, stops. Meier caps the marker. "Precision beats luck with machines."

Your integrity takes a hit from refusing to think systematically.`,
      choices: [
        { label: "Write clear step-by-step instructions", next: "code_win", integrity: 0, reputation: 0 },
      ],
    },

    network_closet: {
      location: "Network Closet · Packet Junction",
      character: "babbage",
      narrative: `Babbage adjusts a brass switch. "Your classmate just typed their password into a school project site — on café Wi‑Fi. No padlock icon in the browser."

They're asking you if it's fine because they'll only be a minute.`,
      choices: [
        { label: "Suggest waiting until they're on a trusted network", next: "network_win", integrity: 5, reputation: 5 },
        { label: "Offer your phone hotspot — faster than arguing", next: "network_recovery_1", integrity: -5, reputation: 0 },
      ],
    },

    network_win: {
      location: "Network Closet — Connection Secured",
      character: "babbage",
      lesson: "8.3.2.1",
      narrative: `"HTTPS and timing both matter," Babbage says. "Public air is shared air."

A copyright question waits in the IP Chamber down the hall.`,
      badge: "Network Navigator",
      choices: [
        { label: "Follow up at the Data Vault", next: "data_vault" },
        { label: "Handle the IP Chamber question", next: "ip_chamber" },
      ],
    },

    network_recovery_1: {
      location: "Network Closet — Packet Sniff",
      character: "babbage",
      narrative: `A training sim shows what an attacker on the same network can see. Unencrypted logins aren't private — even for a minute. Your hotspot didn't have the padlock either.

Babbage adjusts the switch. "Good intentions don't encrypt packets."`,
      choices: [
        { label: "Recommend a secure connection instead", next: "network_win", integrity: 5, reputation: 0 },
      ],
    },

    sources_library: {
      location: "Sources Library · Research Archives",
      character: "johnson",
      narrative: `Johnson slides a tablet across the desk. A viral post claims homework destroys brain cells — slick chart, no author, no link to the study.

Your friend already reposted it.`,
      choices: [
        { label: "Look for the original study before reacting", next: "sources_win", integrity: 5, reputation: 5 },
        { label: "Reply with a skeptical comment but keep the post up", next: "sources_recovery_1", integrity: -5, reputation: 0 },
        { label: "Repost it — the chart looks official", next: "sources_recovery_2", integrity: -10, reputation: -10 },
      ],
    },

    sources_win: {
      location: "Sources Library — Source Checked",
      character: "johnson",
      lesson: "8.1.3.2",
      narrative: `"The chart was recycled from an old blog post — no study behind it," Johnson says. "You just saved your friend a bad take."

The Media Decoding Chamber is lit down the corridor.`,
      badge: "Fact Finder",
      choices: [
        { label: "Compare headlines in the Media Chamber", next: "media_chamber" },
        { label: "Walk through the Footprint Gallery", next: "footprint_scene" },
        { label: "Ask Johnson about her deep-dive module", next: "johnson_deep" },
      ],
    },

    sources_recovery_1: {
      location: "Sources Library — Skepticism Backfires",
      character: "johnson",
      narrative: `Your skeptical comment gets ratioed. People quote you as "even the doubters agree it's basically true." Johnson pulls up the original thread.

"Sitting on the fence still broadcasts the post. Want to run the check you skipped?"`,
      choices: [
        { label: "Find the original source first", next: "sources_win", integrity: 5, reputation: 0 },
        { label: "Delete your comment and stay quiet", next: "sources_recovery_2", integrity: -5, reputation: -5 },
      ],
    },

    sources_recovery_2: {
      location: "Sources Library — Correction Thread",
      character: "johnson",
      narrative: `Johnson pulls up the original thread. The claim unraveled in the comments — but not before it spread. Your name is still in the share chain.

"Want to run the check you skipped?"`,
      choices: [
        { label: "Find the original source first", next: "sources_win", integrity: 0, reputation: 0 },
      ],
    },

    ip_chamber: {
      location: "IP Chamber · Copyright Vault",
      character: "crawford",
      narrative: `You're editing a video for class. The perfect song is on a random upload site — no license info, no credit line.

Your partner says, "Everyone uses it. We'll cut that part out if anyone complains."`,
      choices: [
        { label: "Find royalty-free music or get proper permission", next: "ip_win", integrity: 10, reputation: 5 },
        { label: "Use a short clip and credit the artist informally", next: "ip_recovery_1", integrity: -5, reputation: 0 },
        { label: "Use it — nobody will notice a school project", next: "ip_recovery_2", integrity: -15, reputation: -10 },
      ],
    },

    ip_win: {
      location: "IP Chamber — Cleared to Publish",
      character: "crawford",
      lesson: "8.2.2.1",
      narrative: `"Creators deserve credit — and permission," Crawford says. "You can be inspired without taking."

The Collaboration Bridge is crowded ahead.`,
      badge: "Ethical Creator",
      choices: [
        { label: "Cross the Collaboration Bridge", next: "collaboration_bridge" },
        { label: "Visit the Media Decoding Chamber", next: "media_chamber" },
      ],
    },

    ip_recovery_1: {
      location: "IP Chamber — Informal Credit",
      character: "crawford",
      narrative: `The informal credit doesn't satisfy the platform's Content ID system. The video gets flagged anyway. Crawford holds up the takedown notice.

"Good intentions don't replace licenses."`,
      choices: [
        { label: "Replace it with properly licensed work", next: "ip_win", integrity: 5, reputation: 0 },
        { label: "Re-edit to make the clip shorter and harder to detect", next: "ip_recovery_2", integrity: -10, reputation: -5 },
      ],
    },

    ip_recovery_2: {
      location: "IP Chamber — Takedown Notice",
      character: "crawford",
      narrative: `A takedown notice hits the project folder. "Copyright isn't about getting caught," Crawford says. "It's about respect."

Your integrity takes a hit from treating evasion as strategy.`,
      choices: [
        { label: "Replace it with licensed or royalty-free work", next: "ip_win", integrity: 0, reputation: 0 },
      ],
    },

    collaboration_bridge: {
      location: "Collaboration Bridge",
      character: "campbell",
      narrative: `Campbell points at a group chat on the railing display. Someone is being left out of a shared doc — then mocked when they ask why.

You're in the thread. Others are watching to see what you do.`,
      choices: [
        { label: "Back them up publicly and loop in a trusted adult", next: "collab_win", integrity: 10, reputation: 5 },
        { label: "Message them privately to check in", next: "collab_recovery_1", integrity: 0, reputation: 0 },
        { label: "Add a joke so you fit in", next: "collab_recovery_2", integrity: -15, reputation: -10 },
      ],
    },

    collab_win: {
      location: "Collaboration Bridge — Crossed",
      character: "campbell",
      lesson: "8.3.4.2",
      narrative: `"Tools connect us," Campbell says. "People choose whether that connection helps."

The bridge holds. Ahead, the arena lights dim up for the final round.`,
      badge: "Bridge Builder",
      rngBadge: { chance: 0.22, badge: "Steady Hands", message: "A gust rocks the bridge — you steady a teammate. Campbell nods." },
      choices: [
        { label: "Enter the Final Trial", next: "final_trial" },
        { label: "Verify a trending quote with Johnson first", next: "trajectory_scene" },
      ],
    },

    collab_recovery_1: {
      location: "Collaboration Bridge — Private Check-In",
      character: "campbell",
      narrative: `You DM the excluded person. They appreciate it — but the mockery in the group chat continues without correction. Others assume silence means agreement.

Campbell watches the thread. "Kindness in private matters. But the public norm still shifted toward cruelty."`,
      choices: [
        { label: "Speak up in the thread now and escalate to an adult", next: "collab_win", integrity: 5, reputation: -5 },
        { label: "Stay out of it — you've done what you could", next: "collab_recovery_2", integrity: -5, reputation: -5 },
      ],
    },

    collab_recovery_2: {
      location: "Collaboration Bridge — Reset",
      character: "campbell",
      narrative: `The chat keeps going. The excluded person stops typing. Campbell rewinds the scene quietly. "Same bridge. Different you?"

Your integrity takes a hit from watching harm happen and choosing comfort.`,
      choices: [
        { label: "Speak up and get an adult involved", next: "collab_win", integrity: 0, reputation: 0 },
      ],
    },

    trajectory_scene: {
      location: "Trajectory Analytics · NASA Sim",
      character: "johnson",
      narrative: `Johnson zooms in on a viral meme — bold quote, famous face, no source. It's already racking up shares.

"Accuracy is a habit," she says. "What do you do first?"`,
      choices: [
        { label: "Check whether the quote appears in reliable sources", next: "trajectory_win", integrity: 5, reputation: 5 },
        { label: "Share it with a disclaimer that you're not sure", next: "trajectory_recovery_1", integrity: -5, reputation: 0 },
      ],
    },

    trajectory_win: {
      location: "Trajectory Analytics — Verified",
      character: "johnson",
      lesson: "8.1.3.3",
      narrative: `"Misattributed," Johnson says. "Close one. Trending and true aren't the same word."

You could loop back for more missions — or head to the finale.`,
      badge: "Precision Thinker",
      choices: [
        { label: "Enter the Final Trial", next: "final_trial" },
        { label: "Return to briefing — pick another mission", next: "start" },
      ],
    },

    trajectory_recovery_1: {
      location: "Trajectory Analytics — Vague Spread",
      character: "johnson",
      narrative: `Your disclaimer gets cropped out in reshares. People quote you as "the one who found it first." Johnson replays the fork.

"Uncertainty doesn't travel as fast as certainty."`,
      choices: [
        { label: "Delete the post and verify before sharing next time", next: "trajectory_win", integrity: 5, reputation: -5 },
        { label: "Leave it up — at least you said you weren't sure", next: "trajectory_recovery_2", integrity: -5, reputation: -5 },
      ],
    },

    trajectory_recovery_2: {
      location: "Trajectory Analytics — Correction Orbit",
      character: "johnson",
      narrative: `The quote spreads for an hour before fact-checkers catch it. Johnson replays the fork in the path.

Your integrity takes a hit from privileging speed over truth.`,
      choices: [
        { label: "Verify before sharing next time", next: "trajectory_win", integrity: 0, reputation: 0 },
      ],
    },

    data_vault: {
      location: "Data Vault · ACME Sublevel 3",
      character: "turing",
      narrative: `Turing pulls up a forum thread. Someone posted a classmate's phone number and schedule "as a joke." It's climbing fast.

You have a screenshot. So does everyone else.`,
      choices: [
        { label: "Report it to a trusted adult — don't repost", next: "privacy_win", integrity: 10, reputation: 5 },
        { label: "DM the poster asking them to remove it quietly", next: "privacy_recovery_1", integrity: -5, reputation: 0 },
        { label: "Share the screenshot so people know to avoid them", next: "privacy_recovery_2", integrity: -15, reputation: -10 },
      ],
    },

    privacy_win: {
      location: "Data Vault — Contained",
      character: "turing",
      lesson: "8.2.2.3",
      narrative: `"Reporting beats amplifying," Turing says. "Private data isn't yours to broadcast — even when you're trying to help."

Two more locks glow on the vault map: passwords and footprints.`,
      badge: "Data Guardian",
      goldenRule: 2,
      choices: [
        { label: "Secure the Password Vault", next: "password_temple" },
        { label: "Decode conflicting headlines", next: "media_chamber" },
        { label: "Visit the Footprint Gallery", next: "footprint_scene" },
        { label: "Ask Turing about his deep-dive module", next: "turing_deep" },
      ],
    },

    privacy_recovery_1: {
      location: "Data Vault — Poster Responds",
      character: "turing",
      narrative: `The poster deletes the thread — but not before screenshotting your DM and framing you as "the snitch." The victim's info is still in group chats you can't see.

Turing studies the ripple. "Direct action feels brave, but it exposed you and didn't contain the leak."`,
      choices: [
        { label: "Escalate to an adult now that the situation is worse", next: "privacy_win", integrity: 5, reputation: -5 },
        { label: "Back off and let the group sort it out", next: "privacy_recovery_2", integrity: -10, reputation: -5 },
      ],
    },

    privacy_recovery_2: {
      location: "Data Vault — Spread Accelerates",
      character: "turing",
      narrative: `Each share widens the leak. The screenshot of your DM is now part of the drama. Turing freezes the sim.

"Harm scales fast online. You tried personal — now try institutional."`,
      choices: [
        { label: "Report to a trusted adult and accept the reputation cost", next: "privacy_win", integrity: 0, reputation: 0 },
        { label: "Visit the Footprint Gallery to reflect", next: "footprint_scene", integrity: 0, reputation: 0 },
      ],
    },

    password_temple: {
      location: "Vault of Passwords · Security Gate",
      character: "guide",
      narrative: `The gate scans your habits, not your courage. A ghostly Babbage mutters: "Garbage in, garbage out."

A recruit ahead used one password everywhere — including their school email and a game account.`,
      choices: [
        { label: "Use unique passwords and turn on two-factor auth", next: "password_win", integrity: 10, reputation: 5 },
        { label: "Use a password manager — one master, many unique", next: "password_recovery_1", integrity: 0, reputation: 0 },
        { label: "Keep one strong password — easier to remember", next: "password_recovery_2", integrity: -10, reputation: -5 },
      ],
    },

    password_win: {
      location: "Vault Inner Sanctum",
      character: "babbage",
      lesson: "8.2.2.3",
      narrative: `The gate opens. Babbage nods once. "Your login is yours alone — even from friends with good intentions."`,
      badge: "Gate Champion",
      goldenRule: 3,
      choices: [
        { label: "Compare headlines in the Media Chamber", next: "media_chamber" },
        { label: "Walk the Footprint Gallery", next: "footprint_scene" },
        { label: "Enter the Final Trial", next: "final_trial" },
      ],
    },

    password_recovery_1: {
      location: "Vault — Gate Ajar",
      character: "guide",
      narrative: `The gate opens halfway. Babbage appears. "A manager is only as strong as its master password. Lose that, lose everything."

It's defensible — but still a single point of failure.`,
      choices: [
        { label: "Add two-factor auth to the manager as well", next: "password_win", integrity: 5, reputation: 0 },
        { label: "Stick with the manager and move on", next: "password_recovery_2", integrity: -5, reputation: 0 },
      ],
    },

    password_recovery_2: {
      location: "Vault — Gate Closed",
      character: "guide",
      narrative: `The gate flickers red. A training clip shows how one cracked password unlocks three accounts. "Try again?"

Your integrity takes a hit from relying on convenience over defense.`,
      choices: [
        { label: "Set unique passwords with two-factor auth", next: "password_win", integrity: 0, reputation: 0 },
        { label: "Visit the Footprint Gallery", next: "footprint_scene", integrity: 0, reputation: 0 },
      ],
    },

    footprint_scene: {
      location: "Hall of Mirrors · Digital Footprint Gallery",
      character: "campbell",
      narrative: `Campbell holds up two drafts of the same post. One is a thoughtful reply. One tags someone for embarrassment — "just a joke."

"Which version still represents you in ten years?"`,
      choices: [
        { label: "Post the version you'd stand behind later", next: "footprint_win", integrity: 10, reputation: 5 },
        { label: "Don't post either — stay silent and avoid the drama", next: "footprint_recovery_1", integrity: 0, reputation: -5 },
        { label: "Join the pile-on — everyone else is", next: "footprint_recovery_2", integrity: -15, reputation: -15 },
      ],
    },

    footprint_win: {
      location: "Hall of Mirrors — Clear Reflection",
      character: "campbell",
      lesson: "8.2.1.1",
      narrative: `"The internet remembers slowly — but it remembers," Campbell says. "You chose the long view."`,
      badge: "Thoughtful Citizen",
      goldenRule: 4,
      choices: [
        { label: "Compare headlines in the Media Chamber", next: "media_chamber" },
        { label: "Enter the Final Trial", next: "final_trial" },
      ],
    },

    footprint_recovery_1: {
      location: "Hall of Mirrors — Missed Chance",
      character: "campbell",
      narrative: `Silence keeps you safe, but the tag stays up. The victim notices nobody defended them. Campbell lowers the drafts.

"Not harming is baseline. Digital citizenship sometimes means showing up."`,
      choices: [
        { label: "Speak up after the fact and support them privately", next: "footprint_win", integrity: 5, reputation: 0 },
        { label: "Keep your head down and move on", next: "footprint_recovery_2", integrity: -5, reputation: -5 },
      ],
    },

    footprint_recovery_2: {
      location: "Hall of Mirrors — Aftermath",
      character: "campbell",
      narrative: `"Likes fade," Campbell says. "Screenshots don't." He offers the draft again.

Your integrity takes a hit from letting the harm spread.`,
      choices: [
        { label: "Choose the post you'd stand behind", next: "footprint_win", integrity: 0, reputation: 0 },
        { label: "Head to the Media Chamber", next: "media_chamber", integrity: 0, reputation: 0 },
      ],
    },

    media_chamber: {
      location: "Media Decoding Chamber",
      character: "crawford",
      narrative: `Three headlines blink side by side about the same event — one breathless, one dry and sourced, one ALL CAPS with a question mark.

Your group chat is picking sides.`,
      choices: [
        { label: "Compare sources and evidence before picking one", next: "media_win", integrity: 10, reputation: 5 },
        { label: "Wait for more outlets to cover it before reacting", next: "media_recovery_1", integrity: 0, reputation: -5 },
        { label: "Share the most shocking headline — it's moving fast", next: "media_recovery_2", integrity: -10, reputation: -10 },
      ],
    },

    media_win: {
      location: "Media Chamber — Picture Clears",
      character: "crawford",
      lesson: "8.2.2.4",
      narrative: `"Same event, three stories," Crawford says. "You looked past the packaging. That's the job."

All five Golden Rules pulse on the wall — if you've found them. The arena waits.`,
      badge: "Media Decoder",
      goldenRule: 5,
      choices: [
        { label: "Enter the Final Trial", next: "final_trial" },
        { label: "Take the mentor path — teach what you learned", next: "mentor_ending" },
      ],
    },

    media_recovery_1: {
      location: "Media Chamber — Missed Window",
      character: "crawford",
      narrative: `You waited. By the time you check back, the story has morphed — half your group chat believes a detail that was never in the original article.

"Caution is wise," Crawford says. "But silence in a group chat can look like agreement."`,
      choices: [
        { label: "Compare sources now and correct the record", next: "media_win", integrity: 5, reputation: 0 },
        { label: "Let it pass — the conversation moved on", next: "media_recovery_2", integrity: -5, reputation: -5 },
      ],
    },

    media_recovery_2: {
      location: "Media Chamber — Noise Floor",
      character: "crawford",
      narrative: `"Who made it? What's the evidence? Who else covered it?" Crawford asks. "Run the checklist."

Your integrity takes a hit from amplifying noise.`,
      choices: [
        { label: "Compare sources before sharing", next: "media_win", integrity: 0, reputation: 0 },
      ],
    },

    ai_ethics: {
      location: "AI Ethics Lab · Cambridge, MA",
      character: "turing",
      narrative: `Turing pulls up a face-recognition demo. "It works great on people like the engineers. It fails on everyone else. The team says accuracy is 'good enough for launch.'"

The question is whether to ship, delay, or demand a fix.`,
      choices: [
        { label: "Insist the team tests on diverse faces before launch", next: "ai_ethics_win", integrity: 10, reputation: 5 },
        { label: "Delay launch and run an internal bias audit first", next: "ai_ethics_recovery_1", integrity: 0, reputation: -5 },
        { label: "Ship it — you can patch fairness later", next: "ai_ethics_recovery_2", integrity: -15, reputation: -10 },
      ],
    },

    ai_ethics_win: {
      location: "AI Ethics Lab — Fix Approved",
      character: "turing",
      lesson: "8.3.3.1",
      narrative: `"Machines learn what we show them," Turing says. "If the data is narrow, the machine is narrow."

A bulletin from the Bias Detection Unit lights up on the board.`,
      badge: "Fairness Advocate",
      choices: [
        { label: "Head to the Bias Detection Unit", next: "bias_unit" },
        { label: "Cross the Collaboration Bridge", next: "collaboration_bridge" },
        { label: "Enter the Final Trial", next: "final_trial" },
      ],
    },

    ai_ethics_recovery_1: {
      location: "AI Ethics Lab — Internal Audit",
      character: "turing",
      narrative: `The audit finds bias — but the report stays internal. Leadership suppresses it to avoid liability. Turing taps the screen.

"Delay without transparency just hides the problem."`,
      choices: [
        { label: "Leak the audit and demand public diverse testing", next: "ai_ethics_win", integrity: 5, reputation: -5 },
        { label: "Accept the suppression and move on", next: "ai_ethics_recovery_2", integrity: -10, reputation: -5 },
      ],
    },

    ai_ethics_recovery_2: {
      location: "AI Ethics Lab — Launch Day",
      character: "turing",
      narrative: `Headlines hit the feed by noon: "App can't recognize half its users." Turing rewinds the tape.

"Want to make the call you skipped?"

Your integrity takes a hit from shipping known harm.`,
      choices: [
        { label: "Demand diverse testing before anything ships", next: "ai_ethics_win", integrity: 0, reputation: 0 },
      ],
    },

    hardware_graveyard: {
      location: "Hardware Graveyard · Old ACME Storage",
      character: "babbage",
      narrative: `Babbage picks up a discarded phone. "Still powers on. Still has photos, messages, and location history. Someone threw it in the e-waste pile without wiping it."

You could warn the team, ignore it, or grab it yourself.`,
      choices: [
        { label: "Report it and follow secure disposal protocol", next: "hardware_win", integrity: 10, reputation: 5 },
        { label: "Wipe it yourself before telling anyone", next: "hardware_recovery_1", integrity: -5, reputation: 0 },
        { label: "It's not your problem — someone else will deal with it", next: "hardware_recovery_2", integrity: -10, reputation: -5 },
      ],
    },

    hardware_win: {
      location: "Hardware Graveyard — Secured",
      character: "babbage",
      lesson: "8.2.2.3",
      narrative: `"Data outlives the device," Babbage says. "Erase before you discard."

A trail of old posts leads toward the Footprint Gallery.`,
      badge: "Data Destroyer",
      goldenRule: 2,
      choices: [
        { label: "Walk the Footprint Gallery", next: "footprint_scene" },
        { label: "Visit the Password Vault", next: "password_temple" },
      ],
    },

    hardware_recovery_1: {
      location: "Hardware Graveyard — Solo Wipe",
      character: "babbage",
      narrative: `You wipe the phone — but doing it alone means the e-waste pile still has other un-wiped devices. Babbage holds up the next one.

"One hero doesn't scale. Systems scale."`,
      choices: [
        { label: "Report the systemic issue and follow protocol", next: "hardware_win", integrity: 5, reputation: 0 },
        { label: "Move on — you fixed the one in front of you", next: "hardware_recovery_2", integrity: -5, reputation: -5 },
      ],
    },

    hardware_recovery_2: {
      location: "Hardware Graveyard — Still Active",
      character: "babbage",
      narrative: `The phone buzzes with a notification. Someone already found it in the resale pile. Babbage holds up a factory-wipe guide. "Try again?"

Your integrity takes a hit from ignoring data that isn't yours to leave exposed.`,
      choices: [
        { label: "Follow secure disposal protocol", next: "hardware_win", integrity: 0, reputation: 0 },
      ],
    },

    open_source: {
      location: "Open Source Bazaar · Fork Alley",
      character: "hopper",
      narrative: `Hopper points at two versions of the same tool. "One team forked the other, removed the credits, and called it original. The creator is asking questions."

You could call it out, stay silent, or add your own name to the fork.`,
      choices: [
        { label: "Credit the original creators and follow the license", next: "open_source_win", integrity: 10, reputation: 5 },
        { label: "Stay quiet — it's not your project", next: "open_source_recovery_1", integrity: -5, reputation: -5 },
        { label: "Add your name to the fork too", next: "open_source_recovery_2", integrity: -15, reputation: -15 },
      ],
    },

    open_source_win: {
      location: "Open Source Bazaar — Credits Restored",
      character: "hopper",
      lesson: "8.2.2.1",
      narrative: `"Credit isn't optional — it's how open source lives," Hopper says. "You build on shoulders, you name the shoulders."

Down the alley, Crawford is reviewing a video with a suspicious soundtrack.`,
      badge: "License Scholar",
      choices: [
        { label: "Visit the IP Chamber", next: "ip_chamber" },
        { label: "Head to the Code Bay", next: "code_bay" },
      ],
    },

    open_source_recovery_1: {
      location: "Open Source Bazaar — Complicit Silence",
      character: "hopper",
      narrative: `The creator calls out the fork publicly. Because you stayed silent, your team's name is in the credits of the stolen version. Hopper rewinds the scene.

" neutrality isn't neutral when you benefit from the wrong."`,
      choices: [
        { label: "Restore credits and follow the license", next: "open_source_win", integrity: 5, reputation: -5 },
        { label: "Apologize privately but keep the fork live", next: "open_source_recovery_2", integrity: -5, reputation: -5 },
      ],
    },

    open_source_recovery_2: {
      location: "Open Source Bazaar — Flame Thread",
      character: "hopper",
      narrative: `The original creator posts receipts. Comments turn hostile. Hopper rewinds the scene. "Same fork. Different you?"

Your integrity takes a hit from taking credit you didn't earn.`,
      choices: [
        { label: "Restore credits and follow the license", next: "open_source_win", integrity: 0, reputation: 0 },
      ],
    },

    bias_unit: {
      location: "Bias Detection Unit · Algorithm Watch",
      character: "johnson",
      narrative: `Johnson zooms in on two loan-application screens. Same income, same history — different approval rates. The model won't explain why.

The team wants to keep it running because "the numbers look good overall."`,
      choices: [
        { label: "Demand explainability and audit for group fairness", next: "bias_win", integrity: 10, reputation: 5 },
        { label: "Request a narrower audit on the flagged group only", next: "bias_recovery_1", integrity: -5, reputation: 0 },
        { label: "It's working — don't fix what isn't obviously broken", next: "bias_recovery_2", integrity: -15, reputation: -10 },
      ],
    },

    bias_win: {
      location: "Bias Detection Unit — Audit Ordered",
      character: "johnson",
      lesson: "8.1.3.2",
      narrative: `"Precision without fairness isn't precision," Johnson says. "It's a mirror of what you already fed it."

The Sources Library has a new tip about a viral headline.`,
      badge: "Bias Spotter",
      choices: [
        { label: "Check the Sources Library", next: "sources_library" },
        { label: "Compare headlines in the Media Chamber", next: "media_chamber" },
      ],
    },

    bias_recovery_1: {
      location: "Bias Detection Unit — Narrow Audit",
      character: "johnson",
      narrative: `The narrow audit confirms bias for that group — but the same pattern repeats in other demographics you didn't check. Johnson replays the fork.

"A partial mirror still distorts the face."`,
      choices: [
        { label: "Expand the audit to full explainability and fairness", next: "bias_win", integrity: 5, reputation: 0 },
        { label: "Patch the one group and move on", next: "bias_recovery_2", integrity: -5, reputation: -5 },
      ],
    },

    bias_recovery_2: {
      location: "Bias Detection Unit — Pattern Confirmed",
      character: "johnson",
      narrative: `A journalist runs the numbers independently. The gap is real and documented. Johnson replays the fork. "Same data. Different you?"

Your integrity takes a hit from defending a harmful system.`,
      choices: [
        { label: "Order the audit", next: "bias_win", integrity: 0, reputation: 0 },
      ],
    },

    data_detective: {
      location: "Data Detective Agency · Trail Analytics",
      character: "conway",
      narrative: `Conway lays out three profiles side by side. "Same person. Three apps. Each one guessed something different about them — and sold the guess."

Your friend says, "I have nothing to hide, so why care?"`,
      choices: [
        { label: "Explain that small data points build a detailed profile", next: "detective_win", integrity: 5, reputation: 5 },
        { label: "Agree — if you're not doing anything wrong, privacy doesn't matter", next: "detective_recovery_1", integrity: -10, reputation: -5 },
      ],
    },

    detective_win: {
      location: "Data Detective Agency — Pattern Broken",
      character: "conway",
      lesson: "8.2.2.3",
      narrative: `"Nothing to hide" misses the point," Conway says. "Privacy is about control, not secrets."

The vault map shows two more locations: passwords and footprints.`,
      badge: "Trail Tracker",
      goldenRule: 2,
      choices: [
        { label: "Visit the Password Vault", next: "password_temple" },
        { label: "Walk the Footprint Gallery", next: "footprint_scene" },
      ],
    },

    detective_recovery_1: {
      location: "Data Detective Agency — Profile Complete",
      character: "conway",
      narrative: `Conway assembles the puzzle from public posts alone. Address, schedule, habits — all visible. "Still nothing to hide?" he asks.

Your integrity takes a hit from normalizing surveillance.`,
      choices: [
        { label: "Limit what's shared and review app permissions", next: "detective_win", integrity: 0, reputation: 0 },
      ],
    },

    lovelace_deep: {
      location: "Design Lab — Deep Archive",
      character: "lovelace",
      narrative: `Lovelace unlocks a cabinet of punched cards. "Most people know I wrote the first program. Fewer know I predicted machines could compose music and paint pictures — a century before it happened."

She slides a card across the desk. "In your own words: what did I see that Babbage didn't?"`,
      typingChallenge: {
        prompt: "In 2–3 sentences: What did Ada Lovelace understand about computing that went beyond pure calculation?",
        minWords: 15,
        next: "lovelace_deep_win",
      },
      choices: [],
    },

    lovelace_deep_win: {
      location: "Design Lab — Archive Sealed",
      character: "lovelace",
      narrative: `"Poetry and analysis aren't opposites," Lovelace says. "They're the same engine running different software."`,
      badge: "Lovelace Scholar",
      choices: [
        { label: "Return to briefing", next: "start" },
        { label: "Enter the Final Trial", next: "final_trial" },
      ],
    },

    turing_deep: {
      location: "Data Vault — Cryptography Archive",
      character: "turing",
      narrative: `Turing opens a file marked "Enigma." "Breaking codes was the job. The deeper work was asking whether machines could think — and designing a test that still has no final answer."

He turns to you. "What made the Turing Test revolutionary — not just clever?"`,
      typingChallenge: {
        prompt: "In 2–3 sentences: Why was the Turing Test a philosophical breakthrough and not just a technical trick?",
        minWords: 15,
        next: "turing_deep_win",
      },
      choices: [],
    },

    turing_deep_win: {
      location: "Data Vault — Archive Sealed",
      character: "turing",
      narrative: `"You get it," Turing says. "The question isn't 'Can machines think?' It's 'What do we mean by think?'"`,
      badge: "Turing Scholar",
      choices: [
        { label: "Return to briefing", next: "start" },
        { label: "Enter the Final Trial", next: "final_trial" },
      ],
    },

    hopper_deep: {
      location: "Debugging Fleet — Compiler Museum",
      character: "hopper",
      narrative: `Hopper points at a wall of old programming manuals. "Before me, everyone wrote in machine code — ones and zeros. I built the first compiler so humans could write in something that looked like English."

She taps the glass. "Why does that matter beyond convenience?"`,
      typingChallenge: {
        prompt: "In 2–3 sentences: Why was Grace Hopper's compiler more than just a time-saver — what did it change about who could program?",
        minWords: 15,
        next: "hopper_deep_win",
      },
      choices: [],
    },

    hopper_deep_win: {
      location: "Debugging Fleet — Museum Sealed",
      character: "hopper",
      narrative: `"Exactly," Hopper says. "Code in English means ideas can come from anyone who has them — not just the ones who memorized the machine."`,
      badge: "Hopper Scholar",
      choices: [
        { label: "Return to briefing", next: "start" },
        { label: "Enter the Final Trial", next: "final_trial" },
      ],
    },

    johnson_deep: {
      location: "Sources Library — Orbital Mechanics Wing",
      character: "johnson",
      narrative: `Johnson spreads out hand-written trajectory tables. "No computers. Just pencil, paper, and confidence. One wrong decimal and the capsule misses the ocean by miles."

She looks up. "What does precision mean when the stakes are lives?"`,
      typingChallenge: {
        prompt: "In 2–3 sentences: What did Katherine Johnson's work teach us about the relationship between human judgment and machine calculation?",
        minWords: 15,
        next: "johnson_deep_win",
      },
      choices: [],
    },

    johnson_deep_win: {
      location: "Sources Library — Wing Sealed",
      character: "johnson",
      narrative: `"Machines calculate," Johnson says. "Humans decide what the calculation is for. Never confuse the two."`,
      badge: "Johnson Scholar",
      choices: [
        { label: "Return to briefing", next: "start" },
        { label: "Enter the Final Trial", next: "final_trial" },
      ],
    },

    final_trial: {
      location: "Gauntlet Arena · Final Round",
      character: "guide",
      narrative: `The floor rises. Mentors you've met appear in the holo-ring — not to quiz you, but to listen.

The Host's voice carries. "In your own words: what will you actually do online when it counts?"`,
      typingChallenge: {
        prompt: "Write a short Digital Citizenship Oath (3–5 sentences): How will you use technology to solve problems, help others, and stay safe?",
        minWords: 30,
        next: "victory",
      },
      choices: [],
    },

    mentor_ending: {
      location: "ACME Mentor Hall",
      character: "lovelace",
      ending: true,
      endingType: "mentor",
      narrative: `Lovelace pins a mentor badge to your jacket. "You recovered the Golden Rules — now someone else needs a guide."

You'll help the next recruit through their first fork in the path. The mission log stays open.`,
      choices: [
        { label: "Start a new run", next: "start" },
      ],
    },

    victory: {
      location: "ACME Tech Division — Mission Complete",
      character: "guide",
      ending: true,
      endingType: "champion",
      narrative: `The five Golden Rules line up on the main screen:

<strong>Design for people.</strong> <strong>Protect data.</strong> <strong>Guard your login.</strong>
<strong>Think before you post.</strong> <strong>Decode media.</strong>

The Host extends a hand. "Gauntlet champion. You didn't just pick the 'right' button — you thought like a citizen."

Play again to scramble the missions and meet every mentor.`,
      choices: [
        { label: "Play again", next: "start" },
      ],
    },
  };

  window.TechTrailStory = { STORY, CHARACTERS, START_MISSIONS };
})();
