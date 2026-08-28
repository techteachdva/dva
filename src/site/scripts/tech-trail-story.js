/**
 * Global Tech Gauntlet — branching digital citizenship adventure.
 * Punchy grades 6–8 voice. Predictable Golden Rule spine + scrambled side missions.
 */
(() => {
  "use strict";

  const CHARACTERS = {
    lovelace: {
      name: "Chief Ada Lovelace",
      role: "Field Operative · First Programmer",
      emoji: "👑",
      era: "1843",
      research: "Ada Lovelace wrote the first computer program — and guessed machines might one day make music and art, not just math.",
    },
    turing: {
      name: "Agent Alan Turing",
      role: "Cryptography Division",
      emoji: "🔐",
      era: "1940s",
      research: "Alan Turing helped crack WWII codes and asked a wild question that still matters: can a machine think?",
    },
    babbage: {
      name: "Dr. Charles Babbage",
      role: "Mechanical Systems Architect",
      emoji: "⚙️",
      era: "1837",
      research: "Charles Babbage designed the Analytical Engine — basically the first idea of a general-purpose computer.",
    },
    wright: {
      name: "Coach Will Wright",
      role: "Simulation Design Lab",
      emoji: "🌍",
      era: "1989",
      research: "Will Wright built SimCity and The Sims — games that let you test ideas about real life before you mess up the real thing.",
    },
    meier: {
      name: "Captain Sid Meier",
      role: "Strategy & Iteration Corps",
      emoji: "♟️",
      era: "1991",
      research: "Sid Meier designed Civilization. His rule: if a choice isn't fun and fair to test, it isn't ready.",
    },
    campbell: {
      name: "Professor Joseph Campbell",
      role: "Narrative & Culture Division",
      emoji: "📜",
      era: "1949",
      research: "Joseph Campbell studied hero stories worldwide. Online, you're in a story too — and you pick who you become.",
    },
    crawford: {
      name: "Chris Crawford",
      role: "Interactive Systems Bureau",
      emoji: "🎮",
      era: "1984",
      research: "Chris Crawford pioneered games where your choices matter. Same energy as the internet: every click is a vote.",
    },
    conway: {
      name: "John Conway",
      role: "Emergent Systems Observatory",
      emoji: "🔬",
      era: "1970",
      research: "John Conway's Game of Life showed how tiny rules explode into huge patterns — like a rumor in a group chat.",
    },
    hopper: {
      name: "Admiral Grace Hopper",
      role: "Debugging Fleet",
      emoji: "🐛",
      era: "1947",
      research: "Grace Hopper coined “debugging” and built the first compiler so humans could write code in words, not just 1s and 0s.",
    },
    johnson: {
      name: "Director Katherine Johnson",
      role: "Trajectory Analytics",
      emoji: "🚀",
      era: "1962",
      research: "Katherine Johnson calculated NASA flight paths by hand. One wrong decimal, and a capsule misses the ocean.",
    },
    guide: {
      name: "Mr. Phil",
      role: "Mission Host · ACME Tech Division",
      emoji: "👓",
      era: "NOW",
      research: "Your teacher and mission host. He built the Gauntlet so you can practice digital citizenship under pressure — and he still reads the oath.",
    },
  };

  /** Golden Rule spine — always offered as the “main quest.” Side missions scramble around it. */
  const GOLDEN_SPINE = [
    { rule: 1, next: "design_lab", typeText: "Design Lab", label: "Sprint to the Design Lab — they built the wrong thing" },
    { rule: 2, next: "data_vault", typeText: "Data Vault", label: "Answer the Data Vault alert — private info is leaking" },
    { rule: 3, next: "password_temple", typeText: "Password Vault", label: "Lock the Password Vault before someone walks in" },
    { rule: 4, next: "footprint_scene", typeText: "Footprint Gallery", label: "Cut through the Footprint Gallery — a post is about to blow up" },
    { rule: 5, next: "media_chamber", typeText: "Media Chamber", label: "Decode the Media Chamber — three headlines, one event" },
  ];

  /** Side missions shuffled onto the briefing board each run. */
  const START_MISSIONS = [
    { label: "Sprint to the Design Lab — they built the wrong thing", next: "design_lab", typeText: "Design Lab" },
    { label: "Answer the Data Vault alert — private info is leaking", next: "data_vault", typeText: "Data Vault" },
    { label: "Lock the Password Vault before someone walks in", next: "password_temple", typeText: "Password Vault" },
    { label: "Investigate weird output in the Code Bay", next: "code_bay", typeText: "Code Bay" },
    { label: "Stabilize the Network Closet — café Wi‑Fi drama", next: "network_closet", typeText: "Network Closet" },
    { label: "Hit the AI Ethics Lab — a scanner is failing faces", next: "ai_ethics", typeText: "AI Ethics Lab" },
    { label: "Tour the Hardware Graveyard — old phones still remember", next: "hardware_graveyard", typeText: "Hardware Graveyard" },
    { label: "Browse the Open Source Bazaar — someone stole the credits", next: "open_source", typeText: "Open Source Bazaar" },
    { label: "Report to Bias Detection — the app treats people differently", next: "bias_unit", typeText: "Bias Detection Unit" },
    { label: "Enter Data Detective Agency — three apps, one person", next: "data_detective", typeText: "Data Detective Agency" },
  ];

  const STORY = {
    start: {
      location: "ACME Tech Division — Briefing Room",
      character: "guide",
      enter: "Doors hiss. Coffee. Hot metal. Five alarms at once.",
      narrative: `Alarms strobe across five holo-screens. A locker leak. A viral lie. An app that ships Friday whether it works or not.

Mr. Phil snaps a badge onto your jacket. "Welcome to the Gauntlet. The <strong>Golden Rules of Digital Citizenship</strong> didn't vanish — people stopped using them. Recover all five."

Ada Lovelace flickers onto the main screen. "Don't wait for the perfect mission. Pick a door. Think on your feet. Wrong turns rewind — they don't end the run."`,
      choicePrefix: "I sprint to the",
      dynamicChoices: "start",
      choices: [],
    },

    design_lab: {
      location: "Design Lab · London, 1843 (simulated)",
      character: "lovelace",
      enter: "Whiteboards. Heat lamps. A half-built app blinking on the wall.",
      narrative: `You step out of the briefing tunnel into Ada Lovelace's lab. She's already pointing at a half-finished app.

"They asked kids what they <em>wanted</em>," she says. "They never asked what problem they were actually solving."

The project lead taps a countdown. "We can polish later. Ship it Friday."`,
      choicePrefix: "I will",
      choices: [
        { label: "Interview real users before building more", next: "define_win", integrity: 5, reputation: 5, typeText: "interview users" },
        { label: "Ship a rough prototype Friday and hope for feedback", next: "define_recovery_1", integrity: -5, reputation: 10, typeText: "ship fast" },
      ],
    },

    define_win: {
      location: "Design Lab — Problem Defined",
      character: "lovelace",
      lesson: "8.3.3.1",
      enter: "The countdown clock stops. The wall redraws around a real problem.",
      narrative: `Lovelace grins. "There. Now you're designing for people — not for the demo."

<strong>Golden Rule 1 unlocked: Design for people.</strong> Fancy buttons don't matter if nobody needed the app.

A side door irises open. Will Wright's simulation studio hums next door. Down the hall, a Data Vault alert still blinks from briefing.`,
      badge: "Design Thinker",
      goldenRule: 1,
      choicePrefix: "Next I head to the",
      choices: [
        { label: "Visit Wright's simulation studio to plan the next step", next: "prepare_phase", typeText: "Simulation Studio" },
        { label: "Skip ahead and test a rough prototype now", next: "try_phase", typeText: "Prototype Arena" },
        { label: "Check that Data Vault alert from briefing", next: "data_vault", typeText: "Data Vault" },
        { label: "Ask Lovelace about her deep-dive archive", next: "lovelace_deep", typeText: "Lovelace Deep Dive" },
      ],
    },

    define_recovery_1: {
      location: "Design Lab — Launch Day",
      character: "lovelace",
      enter: "Confetti cannons. Three users. Then silence.",
      narrative: `Friday hits. Three people open the app, frown, and bounce. Analytics flatline.

Lovelace doesn't yell. She zooms the bounce-rate chart. "Speed teaches too — but it teaches in public. You shipped a guess."`,
      choicePrefix: "I will",
      choices: [
        { label: "Pivot from the feedback and actually talk to users", next: "define_win", integrity: 5, reputation: 0, typeText: "pivot and interview" },
        { label: "Cram in more features to win the leavers back", next: "define_recovery_2", integrity: -10, reputation: -5, typeText: "add more features" },
      ],
    },

    define_recovery_2: {
      location: "Design Lab — Deadline Pressure",
      character: "lovelace",
      narrative: `The app gets slower. The lead wants “one more sprint.” Lovelace taps the whiteboard until the marker squeaks.

"You're solving your own panic, not their problem." Mr. Phil's voice crackles: <em>Rewind available. Same lab. Smarter you.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Pause and interview users before anything else ships", next: "define_win", integrity: 0, reputation: 0, typeText: "pause and interview" },
      ],
    },

    prepare_phase: {
      location: "Simulation Studio · Orinda, CA",
      character: "wright",
      enter: "Crumpled sketches. Tiny cities. Wright clears a table with one sweep.",
      narrative: `The lab door dumps you into Will Wright's studio. Mini cities glow under glass.

"Before you build," Wright says, "tell me what you're actually trying to fix — in plain language. No buzzwords. No 'make an app.'"`,
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
      narrative: `"Good," Wright says. "That's a problem worth a prototype — not a feature shopping list."

Down the hall you hear keyboard clicks and Sid Meier muttering about a login bug. Mr. Phil radios: "Prototype Arena is live. Password Vault is still blinking red if you want the security track."`,
      badge: "Problem Solver",
      choicePrefix: "I head to the",
      choices: [
        { label: "See the login bug in the Prototype Arena", next: "try_phase", typeText: "Prototype Arena" },
        { label: "Detour to lock the Password Vault", next: "password_temple", typeText: "Password Vault" },
        { label: "Hit the Sources Library — a rumor is spreading", next: "sources_library", typeText: "Sources Library" },
      ],
    },

    try_phase: {
      location: "Prototype Arena",
      character: "meier",
      enter: "A die clatters across steel. Real users wait behind glass.",
      narrative: `You follow the keyboard noise into Sid Meier's arena. He rolls a die. It clatters to a stop.

"Test early. Test honest. Your build has a login bug, and real people are waiting."

You could sit with them and watch the pain — or patch quietly and pretend nothing happened.`,
      rngBadge: { chance: 0.28, badge: "Lucky Roll", message: "The die lands on your number. Meier grins. \"Fortune favors the prepared.\"" },
      choicePrefix: "I will",
      choices: [
        { label: "Sit with users, watch where they get stuck, take notes", next: "try_win", integrity: 5, reputation: 5, typeText: "watch users" },
        { label: "Patch quietly and don't announce the bug", next: "try_recovery_1", integrity: -5, reputation: 10, typeText: "patch quietly" },
        { label: "Call Grace Hopper's debugging fleet", next: "debug_scene", integrity: 0, reputation: 0, typeText: "call Hopper" },
      ],
    },

    try_win: {
      location: "Prototype Arena — Notes Taken",
      character: "meier",
      lesson: "8.3.3.1",
      narrative: `"Painful to watch. Useful to know," Meier says. "That's data — not failure."

Chris Crawford is already pulling your metrics in the next room. Mr. Phil adds, "Network Closet is sparking if you want a detour."`,
      badge: "Iterative Builder",
      choicePrefix: "I head to",
      choices: [
        { label: "Review what to change with Crawford", next: "reflect_phase", typeText: "Crawford's Bureau" },
        { label: "Follow the outage to the Network Closet", next: "network_closet", typeText: "Network Closet" },
      ],
    },

    try_recovery_1: {
      location: "Prototype Arena — Support Queue",
      character: "meier",
      narrative: `Tickets pile up. One user writes: "I liked the idea. I couldn't get in." Another notices the silent patch and posts, "They're hiding bugs."

Meier resets the sim. "You fixed the code and chipped your credibility. Same prototype. Different call?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Watch users and write down what actually breaks", next: "try_win", integrity: 5, reputation: 0, typeText: "watch users" },
        { label: "Keep patching quietly from behind the glass", next: "try_recovery_2", integrity: -10, reputation: -5, typeText: "keep hiding it" },
      ],
    },

    try_recovery_2: {
      location: "Prototype Arena — Trust Erosion",
      character: "meier",
      narrative: `A forum thread accuses the team of hiding bugs. Meier taps the table.

"Silent fixes feel safe — until they don't." <em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Own the bug publicly and watch users try again", next: "try_win", integrity: 0, reputation: 0, typeText: "own the bug" },
      ],
    },

    debug_scene: {
      location: "Debugging Fleet · USS Hopper",
      character: "hopper",
      enter: "Brass rails. Green terminals. Hopper already has the log open.",
      narrative: `You radio Hopper and the floor drops you onto her ship. She taps the screen.

"Infinite loop. Classic. You can guess, you can rewrite everything tonight, or you can walk it line by line."

She's already scrolled to the suspicious <code>if</code>.`,
      choicePrefix: "I will",
      choices: [
        { label: "Walk through the logic step by step", next: "debug_win", integrity: 5, reputation: 5, typeText: "trace the logic" },
        { label: "Rewrite the whole module from scratch tonight", next: "debug_recovery_1", integrity: -5, reputation: 0, typeText: "rewrite everything" },
        { label: "Change random lines until the error message changes", next: "debug_recovery_2", integrity: -15, reputation: -10, typeText: "mash random lines" },
      ],
    },

    debug_win: {
      location: "Debugging Fleet — Loop Broken",
      character: "hopper",
      lesson: "8.3.3.2",
      narrative: `"There. One condition flipped," Hopper says. "Computers don't get tired. They do exactly what you wrote — even the silly part."

Katherine Johnson waves from a NASA sim upstairs. A fake quote is already trending. Hopper jerks a thumb at her compiler museum if you want extra credit.`,
      badge: "Debugger",
      choicePrefix: "I head to",
      choices: [
        { label: "Check the trending quote with Johnson", next: "trajectory_scene", typeText: "Johnson's Console" },
        { label: "Debrief the prototype with Crawford", next: "reflect_phase", typeText: "Crawford's Bureau" },
        { label: "Ask Hopper about her compiler museum", next: "hopper_deep", typeText: "Hopper Deep Dive" },
      ],
    },

    debug_recovery_1: {
      location: "Debugging Fleet — Scope Creep",
      character: "hopper",
      narrative: `The rewrite births three new bugs where one lived. Hopper studies the diff.

"Fresh code smells nicer. It isn't smarter. You swapped a known problem for mystery meat."`,
      choicePrefix: "I will",
      choices: [
        { label: "Trace the original logic carefully", next: "debug_win", integrity: 5, reputation: 0, typeText: "trace the logic" },
        { label: "Keep rewriting — you'll catch them eventually", next: "debug_recovery_2", integrity: -5, reputation: -5, typeText: "keep rewriting" },
      ],
    },

    debug_recovery_2: {
      location: "Debugging Fleet — Still Spinning",
      character: "hopper",
      narrative: `"That made two bugs where there was one," Hopper says, almost kindly. "Try the boring way. It works."

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Trace the logic carefully", next: "debug_win", integrity: 0, reputation: 0, typeText: "trace the logic" },
      ],
    },

    reflect_phase: {
      location: "Interactive Systems Bureau",
      character: "crawford",
      enter: "Charts. No spin. Crawford waits with a blank “version two” column.",
      narrative: `Meier's notes follow you into Chris Crawford's bureau. He pulls up a simple chart: what worked, what flopped, what surprised you.

"No PR voice. What would version two actually fix?"`,
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
      enter: "Conway's Game of Life ripples across the wall — tiny rules, huge messes.",
      narrative: `John Conway leans in as patterns bloom behind you. "Small rule changes, giant outcomes. Same as a group chat."

Campbell's voice hits the intercom from the Collaboration Bridge: someone is getting iced out of a shared doc. Mr. Phil adds, "If you've got enough Rules, the Arena will take you. If not — keep hunting."`,
      badge: "Reflector",
      choicePrefix: "I head to the",
      choices: [
        { label: "Cross the Collaboration Bridge", next: "collaboration_bridge", typeText: "Collaboration Bridge" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    code_bay: {
      location: "Code Bay · Algorithm Dock",
      character: "meier",
      enter: "A delivery robot idles on a grid. Two teammates argue over a marker.",
      narrative: `You peel off the briefing into Code Bay. Sid Meier slaps a marker in your hand. A delivery robot waits at the edge of a grid.

One teammate wrote three clear steps with turns. The other wrote, "go to the goal somehow."

"It needs instructions," Meier says. "Not vibes."`,
      choicePrefix: "I will",
      choices: [
        { label: "Write ordered steps with clear if/then decisions", next: "code_win", integrity: 5, reputation: 5, typeText: "write clear steps" },
        { label: "Try a simpler guess-and-check heuristic", next: "code_recovery_1", integrity: 0, reputation: 0, typeText: "try a heuristic" },
        { label: "Let it wander randomly until something works", next: "code_recovery_2", integrity: -10, reputation: -5, typeText: "let it wander" },
      ],
    },

    code_win: {
      location: "Code Bay — Path Found",
      character: "meier",
      lesson: "8.3.3.3",
      narrative: `"Boring. Precise. Done," Meier says. "That's an algorithm."

The robot beeps and rolls toward Hopper's bay. Mr. Phil radios the Design Lab pulse from briefing — still on the board if you haven't been.`,
      badge: "Algorithm Architect",
      choicePrefix: "I head to",
      choices: [
        { label: "Visit Hopper's debugging fleet", next: "debug_scene", typeText: "Hopper's Fleet" },
        { label: "Cut back to the Design Lab", next: "design_lab", typeText: "Design Lab" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    code_recovery_1: {
      location: "Code Bay — Partial Path",
      character: "meier",
      narrative: `The heuristic gets the robot halfway — then it loops in a corner forever. Meier studies the trace.

"Heuristics are fine for games. Not for guarantees. Want to tighten it into something you can prove?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Rewrite it as ordered step-by-step instructions", next: "code_win", integrity: 5, reputation: 0, typeText: "write clear steps" },
        { label: "Stack more heuristics and hope one sticks", next: "code_recovery_2", integrity: -5, reputation: -5, typeText: "add more guesses" },
      ],
    },

    code_recovery_2: {
      location: "Code Bay — Gridlock",
      character: "meier",
      narrative: `The robot spins, kisses a wall, and dies. Meier caps the marker.

"Precision beats luck with machines." <em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Write clear step-by-step instructions", next: "code_win", integrity: 0, reputation: 0, typeText: "write clear steps" },
      ],
    },

    network_closet: {
      location: "Network Closet · Packet Junction",
      character: "babbage",
      enter: "Brass switches. Blinking LEDs. Café Wi‑Fi hissing in the speakers.",
      narrative: `You squeeze into Babbage's closet. He flicks a brass switch.

"Your classmate just typed a password into a school project site — on café Wi‑Fi. No padlock in the browser."

They're asking if it's fine. 'I'll only be a minute.'`,
      choicePrefix: "I will",
      choices: [
        { label: "Tell them to wait for a trusted network", next: "network_win", integrity: 5, reputation: 5, typeText: "wait for trusted wifi" },
        { label: "Offer your phone hotspot so they can hurry", next: "network_recovery_1", integrity: -5, reputation: 0, typeText: "offer a hotspot" },
      ],
    },

    network_win: {
      location: "Network Closet — Connection Secured",
      character: "babbage",
      lesson: "8.3.2.1",
      narrative: `"HTTPS and timing both matter," Babbage says. "Public air is shared air. A minute is plenty of time to steal a login."

Mr. Phil pings two follow-ups: Data Vault (private info) and the IP Chamber (a video with a stolen song).`,
      badge: "Network Navigator",
      choicePrefix: "I head to the",
      choices: [
        { label: "Follow up at the Data Vault", next: "data_vault", typeText: "Data Vault" },
        { label: "Handle the IP Chamber copyright mess", next: "ip_chamber", typeText: "IP Chamber" },
      ],
    },

    network_recovery_1: {
      location: "Network Closet — Packet Sniff",
      character: "babbage",
      narrative: `A training sim shows what an attacker on the same network can read. Unencrypted logins aren't private — even for a minute. Your hotspot didn't have the padlock either.

Babbage adjusts the switch. "Good intentions don't encrypt packets."`,
      choicePrefix: "I will",
      choices: [
        { label: "Recommend a secure connection instead", next: "network_win", integrity: 5, reputation: 0, typeText: "use a secure connection" },
      ],
    },

    sources_library: {
      location: "Sources Library · Research Archives",
      character: "johnson",
      enter: "Quiet stacks. A viral chart glowing on Johnson's tablet.",
      narrative: `Katherine Johnson slides a tablet across the desk. A viral post claims homework destroys brain cells — slick chart, no author, no link to a study.

Your friend already reposted it.`,
      choicePrefix: "I will",
      choices: [
        { label: "Hunt the original study before reacting", next: "sources_win", integrity: 5, reputation: 5, typeText: "find the original study" },
        { label: "Leave a skeptical comment but keep the post up", next: "sources_recovery_1", integrity: -5, reputation: 0, typeText: "comment but leave it" },
        { label: "Repost it — the chart looks official", next: "sources_recovery_2", integrity: -10, reputation: -10, typeText: "repost the chart" },
      ],
    },

    sources_win: {
      location: "Sources Library — Source Checked",
      character: "johnson",
      lesson: "8.1.3.2",
      narrative: `"The chart was recycled from an old blog — no study behind it," Johnson says. "You just saved your friend a bad take."

Lights kick on down the corridor: Media Chamber for headline decoding, Footprint Gallery if a post is about to go mean. Johnson also keeps a quiet archive of her NASA tables.`,
      badge: "Fact Finder",
      choicePrefix: "I head to the",
      choices: [
        { label: "Compare headlines in the Media Chamber", next: "media_chamber", typeText: "Media Chamber" },
        { label: "Walk the Footprint Gallery", next: "footprint_scene", typeText: "Footprint Gallery" },
        { label: "Ask Johnson about her NASA archive", next: "johnson_deep", typeText: "Johnson Deep Dive" },
      ],
    },

    sources_recovery_1: {
      location: "Sources Library — Skepticism Backfires",
      character: "johnson",
      narrative: `Your skeptical comment gets ratioed. People quote you as “even the doubters agree.” Johnson pulls the original thread.

"Sitting on the fence still broadcasts the post. Want to run the check you skipped?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Find the original source first", next: "sources_win", integrity: 5, reputation: 0, typeText: "find the original study" },
        { label: "Delete your comment and stay quiet", next: "sources_recovery_2", integrity: -5, reputation: -5, typeText: "delete and hide" },
      ],
    },

    sources_recovery_2: {
      location: "Sources Library — Correction Thread",
      character: "johnson",
      narrative: `The claim unravels in the comments — after it already spread. Your name is still in the share chain.

"Want to run the check you skipped?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Find the original source first", next: "sources_win", integrity: 0, reputation: 0, typeText: "find the original study" },
      ],
    },

    ip_chamber: {
      location: "IP Chamber · Copyright Vault",
      character: "crawford",
      enter: "A video timeline. A perfect song. Zero license info.",
      narrative: `You're editing a class video. The perfect song sits on a random upload site — no license, no credit.

Your partner shrugs. "Everyone uses it. We'll cut it if anyone complains."`,
      choicePrefix: "I will",
      choices: [
        { label: "Find royalty-free music or get real permission", next: "ip_win", integrity: 10, reputation: 5, typeText: "get real permission" },
        { label: "Use a short clip and credit the artist informally", next: "ip_recovery_1", integrity: -5, reputation: 0, typeText: "use a short clip" },
        { label: "Use it — nobody watches school projects", next: "ip_recovery_2", integrity: -15, reputation: -10, typeText: "just use it" },
      ],
    },

    ip_win: {
      location: "IP Chamber — Cleared to Publish",
      character: "crawford",
      lesson: "8.2.2.1",
      narrative: `"Creators deserve credit — and permission," Crawford says. "You can be inspired without taking."

The Collaboration Bridge is packed ahead. Media Chamber is still decoding three headlines if you haven't cracked Rule 5.`,
      badge: "Ethical Creator",
      choicePrefix: "I head to the",
      choices: [
        { label: "Cross the Collaboration Bridge", next: "collaboration_bridge", typeText: "Collaboration Bridge" },
        { label: "Visit the Media Decoding Chamber", next: "media_chamber", typeText: "Media Chamber" },
      ],
    },

    ip_recovery_1: {
      location: "IP Chamber — Informal Credit",
      character: "crawford",
      narrative: `Your “credit in the description” doesn't satisfy Content ID. The video gets flagged anyway. Crawford holds up the takedown.

"Good intentions don't replace licenses."`,
      choicePrefix: "I will",
      choices: [
        { label: "Replace it with properly licensed work", next: "ip_win", integrity: 5, reputation: 0, typeText: "use licensed music" },
        { label: "Trim the clip shorter so it's harder to detect", next: "ip_recovery_2", integrity: -10, reputation: -5, typeText: "hide the clip" },
      ],
    },

    ip_recovery_2: {
      location: "IP Chamber — Takedown Notice",
      character: "crawford",
      narrative: `A takedown slams the project folder. "Copyright isn't about getting caught," Crawford says. "It's about respect."

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Replace it with licensed or royalty-free work", next: "ip_win", integrity: 0, reputation: 0, typeText: "use licensed music" },
      ],
    },

    collaboration_bridge: {
      location: "Collaboration Bridge",
      character: "campbell",
      enter: "Wind on the span. A group chat glowing on the railing.",
      narrative: `Joseph Campbell points at a group chat on the railing display. Someone's locked out of a shared doc — then roasted when they ask why.

You're in the thread. Everyone's watching to see what you do.`,
      choicePrefix: "I will",
      choices: [
        { label: "Back them up in the chat and tell a trusted adult", next: "collab_win", integrity: 10, reputation: 5, typeText: "back them up publicly" },
        { label: "Message them privately to check in", next: "collab_recovery_1", integrity: 0, reputation: 0, typeText: "check in privately" },
        { label: "Add a joke so you don't get targeted too", next: "collab_recovery_2", integrity: -15, reputation: -10, typeText: "join the joke" },
      ],
    },

    collab_win: {
      location: "Collaboration Bridge — Crossed",
      character: "campbell",
      lesson: "8.3.4.2",
      narrative: `"Tools connect us," Campbell says. "People choose whether that connection helps."

The bridge holds. Arena lights dim up ahead — but Johnson still has a fake quote on her console if you want one more accuracy check.`,
      badge: "Bridge Builder",
      rngBadge: { chance: 0.22, badge: "Steady Hands", message: "A gust rocks the bridge — you steady a teammate. Campbell nods." },
      choicePrefix: "I head to the",
      choices: [
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Verify the trending quote with Johnson first", next: "trajectory_scene", typeText: "Johnson's Console" },
      ],
    },

    collab_recovery_1: {
      location: "Collaboration Bridge — Private Check-In",
      character: "campbell",
      narrative: `You DM the excluded person. They appreciate it — but the roast keeps going in the group chat. Silence starts looking like agreement.

Campbell watches the thread. "Kindness in private matters. The public norm still slid toward cruel."`,
      choicePrefix: "I will",
      choices: [
        { label: "Speak up in the thread now and loop in an adult", next: "collab_win", integrity: 5, reputation: -5, typeText: "speak up now" },
        { label: "Stay out of it — you already DMed", next: "collab_recovery_2", integrity: -5, reputation: -5, typeText: "stay out of it" },
      ],
    },

    collab_recovery_2: {
      location: "Collaboration Bridge — Reset",
      character: "campbell",
      narrative: `The excluded person stops typing. Campbell rewinds the wind.

"Same bridge. Different you?" <em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Speak up and get an adult involved", next: "collab_win", integrity: 0, reputation: 0, typeText: "speak up now" },
      ],
    },

    trajectory_scene: {
      location: "Trajectory Analytics · NASA Sim",
      character: "johnson",
      enter: "Earth in the window. A meme with a famous face and zero source.",
      narrative: `Johnson zooms a viral meme — bold quote, famous face, no source. Shares are climbing.

"Accuracy is a habit," she says. "What do you do first?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Check if the quote shows up in reliable sources", next: "trajectory_win", integrity: 5, reputation: 5, typeText: "check reliable sources" },
        { label: "Share it with a 'not sure if true' disclaimer", next: "trajectory_recovery_1", integrity: -5, reputation: 0, typeText: "share with a disclaimer" },
      ],
    },

    trajectory_win: {
      location: "Trajectory Analytics — Verified",
      character: "johnson",
      lesson: "8.1.3.3",
      narrative: `"Misattributed," Johnson says. "Close one. Trending and true are not the same word."

You can loop to briefing for a fresh mission — or take the Arena if you've earned enough Rules.`,
      badge: "Precision Thinker",
      choicePrefix: "I will",
      choices: [
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Return to briefing for another mission", next: "start", typeText: "Briefing Room" },
      ],
    },

    trajectory_recovery_1: {
      location: "Trajectory Analytics — Vague Spread",
      character: "johnson",
      narrative: `Your disclaimer gets cropped in reshares. People call you “the one who found it first.”

"Uncertainty doesn't travel as fast as certainty," Johnson says.`,
      choicePrefix: "I will",
      choices: [
        { label: "Delete it and verify before sharing next time", next: "trajectory_win", integrity: 5, reputation: -5, typeText: "delete and verify" },
        { label: "Leave it up — at least you said you weren't sure", next: "trajectory_recovery_2", integrity: -5, reputation: -5, typeText: "leave it up" },
      ],
    },

    trajectory_recovery_2: {
      location: "Trajectory Analytics — Correction Orbit",
      character: "johnson",
      narrative: `The quote spreads for an hour before fact-checkers catch it. Johnson replays the fork.

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Verify before sharing next time", next: "trajectory_win", integrity: 0, reputation: 0, typeText: "verify first" },
      ],
    },

    data_vault: {
      location: "Data Vault · ACME Sublevel 3",
      character: "turing",
      enter: "Cold air. Lockers of light. Turing already has the thread open.",
      narrative: `You drop into Turing's vault. A forum post shows a classmate's phone number and schedule “as a joke.” It's climbing.

You have a screenshot. So does everyone else.`,
      choicePrefix: "I will",
      choices: [
        { label: "Report it to a trusted adult — don't repost", next: "privacy_win", integrity: 10, reputation: 5, typeText: "report don't repost" },
        { label: "DM the poster to take it down quietly", next: "privacy_recovery_1", integrity: -5, reputation: 0, typeText: "DM the poster" },
        { label: "Share the screenshot so people 'know to avoid them'", next: "privacy_recovery_2", integrity: -15, reputation: -10, typeText: "share the screenshot" },
      ],
    },

    privacy_win: {
      location: "Data Vault — Contained",
      character: "turing",
      lesson: "8.2.2.3",
      enter: "The leak graph freezes. Two more locks glow on the map.",
      narrative: `"Reporting beats amplifying," Turing says. "Private data isn't yours to broadcast — even when you think you're helping."

<strong>Golden Rule 2 unlocked: Protect data.</strong>

Two more locks light up: Password Vault and Footprint Gallery. Turing also keeps a cryptography archive if you want the deep cut.`,
      badge: "Data Guardian",
      goldenRule: 2,
      choicePrefix: "I head to the",
      choices: [
        { label: "Secure the Password Vault", next: "password_temple", typeText: "Password Vault" },
        { label: "Decode conflicting headlines", next: "media_chamber", typeText: "Media Chamber" },
        { label: "Visit the Footprint Gallery", next: "footprint_scene", typeText: "Footprint Gallery" },
        { label: "Ask Turing about his cryptography archive", next: "turing_deep", typeText: "Turing Deep Dive" },
      ],
    },

    privacy_recovery_1: {
      location: "Data Vault — Poster Responds",
      character: "turing",
      narrative: `The poster deletes the thread — after screenshotting your DM and calling you “the snitch.” The victim's info is still in chats you can't see.

Turing studies the ripple. "Brave. Also leaky. You exposed yourself and didn't contain it."`,
      choicePrefix: "I will",
      choices: [
        { label: "Escalate to an adult now that it's worse", next: "privacy_win", integrity: 5, reputation: -5, typeText: "tell an adult now" },
        { label: "Back off and let the group sort it out", next: "privacy_recovery_2", integrity: -10, reputation: -5, typeText: "back off" },
      ],
    },

    privacy_recovery_2: {
      location: "Data Vault — Spread Accelerates",
      character: "turing",
      narrative: `Each share widens the leak. Your DM screenshot is now part of the drama. Turing freezes the sim.

"Harm scales fast online. You tried personal. Try institutional."`,
      choicePrefix: "I will",
      choices: [
        { label: "Report to a trusted adult anyway", next: "privacy_win", integrity: 0, reputation: 0, typeText: "tell an adult now" },
        { label: "Walk the Footprint Gallery to reset", next: "footprint_scene", integrity: 0, reputation: 0, typeText: "Footprint Gallery" },
      ],
    },

    password_temple: {
      location: "Vault of Passwords · Security Gate",
      character: "guide",
      enter: "A gate that scans habits, not courage. Babbage mutters in the static.",
      narrative: `Mr. Phil meets you at the security gate. A ghostly Babbage mutters, "Garbage in, garbage out."

A recruit ahead used one password everywhere — school email, a game account, the works.`,
      choicePrefix: "I will",
      choices: [
        { label: "Use unique passwords plus two-factor auth", next: "password_win", integrity: 10, reputation: 5, typeText: "unique passwords and 2FA" },
        { label: "Use a password manager with one strong master", next: "password_recovery_1", integrity: 0, reputation: 0, typeText: "use a password manager" },
        { label: "Keep one strong password so I won't forget", next: "password_recovery_2", integrity: -10, reputation: -5, typeText: "one password everywhere" },
      ],
    },

    password_win: {
      location: "Vault Inner Sanctum",
      character: "babbage",
      lesson: "8.2.2.3",
      enter: "The gate opens like a lock clicking in a quiet room.",
      narrative: `The gate opens. Babbage nods once. "Your login is yours alone — even from friends with 'good reasons.'"

<strong>Golden Rule 3 unlocked: Guard your login.</strong>

Media Chamber and Footprint Gallery still sit on the map. Arena lights if you're ready.`,
      badge: "Gate Champion",
      goldenRule: 3,
      choicePrefix: "I head to the",
      choices: [
        { label: "Compare headlines in the Media Chamber", next: "media_chamber", typeText: "Media Chamber" },
        { label: "Walk the Footprint Gallery", next: "footprint_scene", typeText: "Footprint Gallery" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    password_recovery_1: {
      location: "Vault — Gate Ajar",
      character: "guide",
      narrative: `The gate opens halfway. Babbage appears. "A manager is only as strong as its master password. Lose that, lose everything."

Defensible. Still a single point of failure.`,
      choicePrefix: "I will",
      choices: [
        { label: "Add two-factor auth to the manager too", next: "password_win", integrity: 5, reputation: 0, typeText: "add 2FA too" },
        { label: "Stick with the manager and move on", next: "password_recovery_2", integrity: -5, reputation: 0, typeText: "skip 2FA" },
      ],
    },

    password_recovery_2: {
      location: "Vault — Gate Closed",
      character: "guide",
      narrative: `The gate flickers red. A clip shows one cracked password unlocking three accounts.

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Set unique passwords with two-factor auth", next: "password_win", integrity: 0, reputation: 0, typeText: "unique passwords and 2FA" },
        { label: "Visit the Footprint Gallery", next: "footprint_scene", integrity: 0, reputation: 0, typeText: "Footprint Gallery" },
      ],
    },

    footprint_scene: {
      location: "Hall of Mirrors · Digital Footprint Gallery",
      character: "campbell",
      enter: "Two drafts of the same post. One kind. One 'just a joke.'",
      narrative: `Campbell holds up two versions of the same post. One is a thoughtful reply. One tags someone for embarrassment — “just a joke.”

"Which version still represents you in ten years?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Post the version I'd stand behind later", next: "footprint_win", integrity: 10, reputation: 5, typeText: "post the kind version" },
        { label: "Post nothing and stay out of the drama", next: "footprint_recovery_1", integrity: 0, reputation: -5, typeText: "post nothing" },
        { label: "Join the pile-on — everyone else is", next: "footprint_recovery_2", integrity: -15, reputation: -15, typeText: "join the pile-on" },
      ],
    },

    footprint_win: {
      location: "Hall of Mirrors — Clear Reflection",
      character: "campbell",
      lesson: "8.2.1.1",
      enter: "The mean draft dissolves. Your reflection stays.",
      narrative: `"The internet remembers slowly — but it remembers," Campbell says. "You chose the long view."

<strong>Golden Rule 4 unlocked: Think before you post.</strong>

Media Chamber is the last Rule for a lot of cadets. Then the Arena.`,
      badge: "Thoughtful Citizen",
      goldenRule: 4,
      choicePrefix: "I head to the",
      choices: [
        { label: "Compare headlines in the Media Chamber", next: "media_chamber", typeText: "Media Chamber" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    footprint_recovery_1: {
      location: "Hall of Mirrors — Missed Chance",
      character: "campbell",
      narrative: `Silence keeps you safe. The tag stays up. The target notices nobody defended them.

"Not harming is baseline," Campbell says. "Digital citizenship sometimes means showing up."`,
      choicePrefix: "I will",
      choices: [
        { label: "Speak up now and support them privately too", next: "footprint_win", integrity: 5, reputation: 0, typeText: "speak up now" },
        { label: "Keep my head down and move on", next: "footprint_recovery_2", integrity: -5, reputation: -5, typeText: "keep my head down" },
      ],
    },

    footprint_recovery_2: {
      location: "Hall of Mirrors — Aftermath",
      character: "campbell",
      narrative: `"Likes fade. Screenshots don't." Campbell offers the draft again.

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Choose the post I'd stand behind", next: "footprint_win", integrity: 0, reputation: 0, typeText: "post the kind version" },
        { label: "Head to the Media Chamber", next: "media_chamber", integrity: 0, reputation: 0, typeText: "Media Chamber" },
      ],
    },

    media_chamber: {
      location: "Media Decoding Chamber",
      character: "crawford",
      enter: "Three headlines. Same event. Three totally different stories.",
      narrative: `Three headlines blink about the same event — one breathless, one dry and sourced, one ALL CAPS with a question mark.

Your group chat is already picking sides.`,
      choicePrefix: "I will",
      choices: [
        { label: "Compare sources and evidence before picking a side", next: "media_win", integrity: 10, reputation: 5, typeText: "compare the sources" },
        { label: "Wait for more outlets before I say anything", next: "media_recovery_1", integrity: 0, reputation: -5, typeText: "wait and stay quiet" },
        { label: "Share the most shocking headline — it's moving fast", next: "media_recovery_2", integrity: -10, reputation: -10, typeText: "share the shocking one" },
      ],
    },

    media_win: {
      location: "Media Chamber — Picture Clears",
      character: "crawford",
      lesson: "8.2.2.4",
      enter: "The ALL CAPS headline peels away. The sourced one stays.",
      narrative: `"Same event, three stories," Crawford says. "You looked past the packaging. That's the job."

<strong>Golden Rule 5 unlocked: Decode media.</strong>

If you've got the set, the Arena is calling. Lovelace also offers a mentor path — teach the next cadet.`,
      badge: "Media Decoder",
      goldenRule: 5,
      choicePrefix: "I will",
      choices: [
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Take the mentor path — teach what I learned", next: "mentor_ending", typeText: "Mentor Hall" },
      ],
    },

    media_recovery_1: {
      location: "Media Chamber — Missed Window",
      character: "crawford",
      narrative: `You waited. By the time you check back, the story mutated. Half the group chat believes a detail that was never in the original article.

"Caution is wise," Crawford says. "Silence in a group chat can look like agreement."`,
      choicePrefix: "I will",
      choices: [
        { label: "Compare sources now and correct the record", next: "media_win", integrity: 5, reputation: 0, typeText: "compare the sources" },
        { label: "Let it pass — the conversation moved on", next: "media_recovery_2", integrity: -5, reputation: -5, typeText: "let it pass" },
      ],
    },

    media_recovery_2: {
      location: "Media Chamber — Noise Floor",
      character: "crawford",
      narrative: `"Who made it? What's the evidence? Who else covered it?" Crawford asks. "Run the checklist."

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Compare sources before sharing", next: "media_win", integrity: 0, reputation: 0, typeText: "compare the sources" },
      ],
    },

    ai_ethics: {
      location: "AI Ethics Lab · Cambridge, MA",
      character: "turing",
      enter: "A face-scanner demo. It works — on some faces.",
      narrative: `Turing pulls up a face-recognition demo. "Great on people who look like the engineers. Fails on everyone else. The team says accuracy is 'good enough for launch.'"

Ship, delay, or demand a real fix?`,
      choicePrefix: "I will",
      choices: [
        { label: "Insist they test on diverse faces before launch", next: "ai_ethics_win", integrity: 10, reputation: 5, typeText: "test diverse faces first" },
        { label: "Delay launch for an internal bias audit", next: "ai_ethics_recovery_1", integrity: 0, reputation: -5, typeText: "delay for an audit" },
        { label: "Ship it — we can patch fairness later", next: "ai_ethics_recovery_2", integrity: -15, reputation: -10, typeText: "ship it anyway" },
      ],
    },

    ai_ethics_win: {
      location: "AI Ethics Lab — Fix Approved",
      character: "turing",
      lesson: "8.3.3.1",
      narrative: `"Machines learn what we show them," Turing says. "Narrow data, narrow machine."

A bulletin from Bias Detection lights the board. The Bridge is crowded if you want a people problem instead of a model problem.`,
      badge: "Fairness Advocate",
      choicePrefix: "I head to the",
      choices: [
        { label: "Head to the Bias Detection Unit", next: "bias_unit", typeText: "Bias Detection Unit" },
        { label: "Cross the Collaboration Bridge", next: "collaboration_bridge", typeText: "Collaboration Bridge" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    ai_ethics_recovery_1: {
      location: "AI Ethics Lab — Internal Audit",
      character: "turing",
      narrative: `The audit finds bias — then leadership buries the report. Turing taps the screen.

"Delay without sunlight just hides the problem."`,
      choicePrefix: "I will",
      choices: [
        { label: "Push the audit public and demand diverse testing", next: "ai_ethics_win", integrity: 5, reputation: -5, typeText: "make the audit public" },
        { label: "Accept the cover-up and move on", next: "ai_ethics_recovery_2", integrity: -10, reputation: -5, typeText: "stay quiet" },
      ],
    },

    ai_ethics_recovery_2: {
      location: "AI Ethics Lab — Launch Day",
      character: "turing",
      narrative: `Noon headline: "App can't recognize half its users." Turing rewinds the tape.

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Demand diverse testing before anything ships", next: "ai_ethics_win", integrity: 0, reputation: 0, typeText: "test diverse faces first" },
      ],
    },

    hardware_graveyard: {
      location: "Hardware Graveyard · Old ACME Storage",
      character: "babbage",
      enter: "Dust. Dead screens. One phone that still buzzes.",
      narrative: `Babbage picks up a discarded phone. "Still powers on. Photos. Messages. Location history. Someone tossed it in e-waste without wiping it."

Warn the team, DIY-wipe it, or walk away?`,
      choicePrefix: "I will",
      choices: [
        { label: "Report it and follow secure disposal protocol", next: "hardware_win", integrity: 10, reputation: 5, typeText: "report and wipe properly" },
        { label: "Wipe it myself before telling anyone", next: "hardware_recovery_1", integrity: -5, reputation: 0, typeText: "wipe it myself" },
        { label: "Leave it — not my problem", next: "hardware_recovery_2", integrity: -10, reputation: -5, typeText: "leave it" },
      ],
    },

    hardware_win: {
      location: "Hardware Graveyard — Secured",
      character: "babbage",
      lesson: "8.2.2.3",
      narrative: `"Data outlives the device," Babbage says. "Erase before you discard."

A trail of old posts leads toward the Footprint Gallery. Password Vault is the other lock on this track.`,
      badge: "Data Destroyer",
      goldenRule: 2,
      choicePrefix: "I head to the",
      choices: [
        { label: "Walk the Footprint Gallery", next: "footprint_scene", typeText: "Footprint Gallery" },
        { label: "Visit the Password Vault", next: "password_temple", typeText: "Password Vault" },
      ],
    },

    hardware_recovery_1: {
      location: "Hardware Graveyard — Solo Wipe",
      character: "babbage",
      narrative: `You wipe the phone. The rest of the pile is still live. Babbage holds up the next one.

"One hero doesn't scale. Systems scale."`,
      choicePrefix: "I will",
      choices: [
        { label: "Report the whole pile and follow protocol", next: "hardware_win", integrity: 5, reputation: 0, typeText: "report the whole pile" },
        { label: "Move on — I fixed the one in front of me", next: "hardware_recovery_2", integrity: -5, reputation: -5, typeText: "move on" },
      ],
    },

    hardware_recovery_2: {
      location: "Hardware Graveyard — Still Active",
      character: "babbage",
      narrative: `The phone buzzes. Someone already found it in a resale bin.

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Follow secure disposal protocol", next: "hardware_win", integrity: 0, reputation: 0, typeText: "report and wipe properly" },
      ],
    },

    open_source: {
      location: "Open Source Bazaar · Fork Alley",
      character: "hopper",
      enter: "Two copies of the same tool. One is missing the credits.",
      narrative: `Hopper points at two versions of the same tool. "One team forked the other, deleted the credits, and called it original. The creator is asking questions."

Call it out, stay quiet, or slap your name on it too?`,
      choicePrefix: "I will",
      choices: [
        { label: "Credit the original creators and follow the license", next: "open_source_win", integrity: 10, reputation: 5, typeText: "restore the credits" },
        { label: "Stay quiet — not my project", next: "open_source_recovery_1", integrity: -5, reputation: -5, typeText: "stay quiet" },
        { label: "Add my name to the fork too", next: "open_source_recovery_2", integrity: -15, reputation: -15, typeText: "add my name too" },
      ],
    },

    open_source_win: {
      location: "Open Source Bazaar — Credits Restored",
      character: "hopper",
      lesson: "8.2.2.1",
      narrative: `"Credit isn't optional — it's how open source lives," Hopper says. "You build on shoulders. You name the shoulders."

Down the alley, Crawford is reviewing a video with a suspicious soundtrack. Code Bay still needs a robot programmed if you want the algorithm track.`,
      badge: "License Scholar",
      choicePrefix: "I head to the",
      choices: [
        { label: "Visit the IP Chamber", next: "ip_chamber", typeText: "IP Chamber" },
        { label: "Head to the Code Bay", next: "code_bay", typeText: "Code Bay" },
      ],
    },

    open_source_recovery_1: {
      location: "Open Source Bazaar — Complicit Silence",
      character: "hopper",
      narrative: `The creator calls out the fork. Because you stayed silent, your team's name is on the stolen version.

"Neutrality isn't neutral when you benefit from the wrong," Hopper says.`,
      choicePrefix: "I will",
      choices: [
        { label: "Restore credits and follow the license", next: "open_source_win", integrity: 5, reputation: -5, typeText: "restore the credits" },
        { label: "Apologize privately but keep the fork live", next: "open_source_recovery_2", integrity: -5, reputation: -5, typeText: "keep the fork" },
      ],
    },

    open_source_recovery_2: {
      location: "Open Source Bazaar — Flame Thread",
      character: "hopper",
      narrative: `The original creator posts receipts. Comments go nuclear. Hopper rewinds.

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Restore credits and follow the license", next: "open_source_win", integrity: 0, reputation: 0, typeText: "restore the credits" },
      ],
    },

    bias_unit: {
      location: "Bias Detection Unit · Algorithm Watch",
      character: "johnson",
      enter: "Two loan screens. Same numbers. Different yes/no.",
      narrative: `Johnson zooms two loan-application screens. Same income, same history — different approval rates. The model won't explain why.

The team wants to keep it running because “the numbers look good overall.”`,
      choicePrefix: "I will",
      choices: [
        { label: "Demand explainability and a fairness audit", next: "bias_win", integrity: 10, reputation: 5, typeText: "demand a fairness audit" },
        { label: "Audit only the one flagged group", next: "bias_recovery_1", integrity: -5, reputation: 0, typeText: "audit one group only" },
        { label: "Leave it — overall numbers look fine", next: "bias_recovery_2", integrity: -15, reputation: -10, typeText: "leave it running" },
      ],
    },

    bias_win: {
      location: "Bias Detection Unit — Audit Ordered",
      character: "johnson",
      lesson: "8.1.3.2",
      narrative: `"Precision without fairness isn't precision," Johnson says. "It's a mirror of what you already fed it."

The Sources Library just got a tip about a viral homework headline. Media Chamber if you want the Rule 5 track.`,
      badge: "Bias Spotter",
      choicePrefix: "I head to the",
      choices: [
        { label: "Check the Sources Library", next: "sources_library", typeText: "Sources Library" },
        { label: "Compare headlines in the Media Chamber", next: "media_chamber", typeText: "Media Chamber" },
      ],
    },

    bias_recovery_1: {
      location: "Bias Detection Unit — Narrow Audit",
      character: "johnson",
      narrative: `The narrow audit confirms bias for that group — then the same pattern shows up in groups you didn't check.

"A partial mirror still distorts the face," Johnson says.`,
      choicePrefix: "I will",
      choices: [
        { label: "Expand the audit to full fairness and explainability", next: "bias_win", integrity: 5, reputation: 0, typeText: "expand the audit" },
        { label: "Patch the one group and move on", next: "bias_recovery_2", integrity: -5, reputation: -5, typeText: "patch one group" },
      ],
    },

    bias_recovery_2: {
      location: "Bias Detection Unit — Pattern Confirmed",
      character: "johnson",
      narrative: `A journalist runs the numbers independently. The gap is real.

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Order the audit", next: "bias_win", integrity: 0, reputation: 0, typeText: "demand a fairness audit" },
      ],
    },

    data_detective: {
      location: "Data Detective Agency · Trail Analytics",
      character: "conway",
      enter: "Three app profiles. One person. Way too much detail.",
      narrative: `Conway lays out three profiles. "Same person. Three apps. Each guessed something different — and sold the guess."

Your friend shrugs. "I have nothing to hide, so why care?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Explain how tiny data points build a detailed profile", next: "detective_win", integrity: 5, reputation: 5, typeText: "explain the profile" },
        { label: "Agree — if you're not doing anything wrong, privacy is extra", next: "detective_recovery_1", integrity: -10, reputation: -5, typeText: "say privacy doesn't matter" },
      ],
    },

    detective_win: {
      location: "Data Detective Agency — Pattern Broken",
      character: "conway",
      lesson: "8.2.2.3",
      narrative: `"Nothing to hide misses the point," Conway says. "Privacy is control, not secrets."

<strong>Golden Rule 2 is in reach on this track.</strong> Password Vault and Footprint Gallery complete the set.`,
      badge: "Trail Tracker",
      goldenRule: 2,
      choicePrefix: "I head to the",
      choices: [
        { label: "Visit the Password Vault", next: "password_temple", typeText: "Password Vault" },
        { label: "Walk the Footprint Gallery", next: "footprint_scene", typeText: "Footprint Gallery" },
      ],
    },

    detective_recovery_1: {
      location: "Data Detective Agency — Profile Complete",
      character: "conway",
      narrative: `Conway builds the puzzle from public posts alone. Address, schedule, habits — all visible.

"Still nothing to hide?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Limit what's shared and review app permissions", next: "detective_win", integrity: 0, reputation: 0, typeText: "lock down permissions" },
      ],
    },

    lovelace_deep: {
      location: "Design Lab — Deep Archive",
      character: "lovelace",
      enter: "A cabinet of punched cards. Dust that smells like ink.",
      narrative: `Lovelace unlocks a cabinet of punched cards. "Most people know I wrote the first program. Fewer know I predicted machines could compose music — a century early."

She slides a card across. "In your own words: what did I see that Babbage didn't?"`,
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
      narrative: `"Poetry and analysis aren't opposites," Lovelace says. "They're the same engine running different software."

Back to briefing — or the Arena if you've earned it.`,
      badge: "Lovelace Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    turing_deep: {
      location: "Data Vault — Cryptography Archive",
      character: "turing",
      enter: "A file marked ENIGMA. Turing doesn't rush you.",
      narrative: `Turing opens a file marked “Enigma.” "Breaking codes was the job. The deeper work was asking whether machines could think — and designing a test that still has no final answer."

"What made the Turing Test revolutionary — not just clever?"`,
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
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    hopper_deep: {
      location: "Debugging Fleet — Compiler Museum",
      character: "hopper",
      enter: "Walls of old manuals. English where there used to be only 1s and 0s.",
      narrative: `Hopper points at a wall of manuals. "Before me, everyone wrote in machine code — ones and zeros. I built the first compiler so humans could write something that looked like English."

"Why does that matter beyond convenience?"`,
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
      narrative: `"Exactly," Hopper says. "Code in English means ideas can come from anyone who has them — not just the people who memorized the machine."`,
      badge: "Hopper Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    johnson_deep: {
      location: "Sources Library — Orbital Mechanics Wing",
      character: "johnson",
      enter: "Hand-written trajectory tables. No computer in sight.",
      narrative: `Johnson spreads hand-written trajectory tables. "No computers. Pencil, paper, confidence. One wrong decimal and the capsule misses the ocean by miles."

"What does precision mean when the stakes are lives?"`,
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
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    final_trial: {
      location: "Gauntlet Arena · Final Round",
      character: "guide",
      enter: "The floor rises. Mentors you met appear in the holo-ring.",
      narrative: `Mr. Phil's voice fills the Arena. Mentors you've met don't quiz you. They listen.

"In your own words: what will you actually do online when it counts — not when it's easy?"`,
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
      enter: "A quieter hall. Lovelace waits with a smaller badge.",
      narrative: `Lovelace pins a mentor badge to your jacket. "You recovered the Golden Rules. Now someone else needs a guide."

You'll help the next recruit through their first fork. The mission log stays open.`,
      choices: [
        { label: "Start a new run", next: "start", typeText: "new run" },
      ],
    },

    victory: {
      location: "ACME Tech Division — Mission Complete",
      character: "guide",
      ending: true,
      endingType: "champion",
      enter: "The five Rules line up. The alarms finally go quiet.",
      narrative: `The five Golden Rules lock onto the main screen:

<strong>Design for people.</strong> <strong>Protect data.</strong> <strong>Guard your login.</strong>
<strong>Think before you post.</strong> <strong>Decode media.</strong>

Mr. Phil grins. "Gauntlet champion. You didn't mash the 'right' button — you thought like a citizen."

Play again. The side missions scramble. The Rules don't.`,
      choices: [
        { label: "Play again", next: "start", typeText: "play again" },
      ],
    },
  };

  window.TechTrailStory = { STORY, CHARACTERS, START_MISSIONS, GOLDEN_SPINE };
})();
