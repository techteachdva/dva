/**
 * Tech Trail: The Global Tech Gauntlet
 * Choose Your Own Adventure — digital citizenship & technology as human problem-solving.
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
    guide: { name: "The Host", role: "Global Tech Gauntlet", emoji: "🌐", era: "NOW", research: "Your guide through the gauntlet — part Carmen Sandiego, part Legends of the Hidden Temple." },
  };

  const STORY = {
    start: {
      location: "ACME Tech Division — Briefing Room",
      character: "guide",
      narrative: `Welcome, recruit! You've been selected for the <em>Global Tech Gauntlet</em> — a mission to recover the scattered <strong>Golden Rules of Digital Citizenship</strong>.

Remember: <em>Technology is created to solve problems. Humans make technology. Technology makes us human.</em> Culture solves belonging and identity — it is technology too.

Chief Ada Lovelace appears on the holo-screen. "Every algorithm begins with a question. Where do you begin?"`,
      choices: [
        { label: "Design Lab — learn the design process with Lovelace", next: "design_lab", lesson: "8.3.3.1" },
        { label: "Data Vault — a privacy breach is spreading", next: "data_vault", lesson: "8.2.2.3" },
        { label: "Temple of Passwords — face the Olmec Gate", next: "password_temple" },
        { label: "Code Bay — algorithms echo in the dark", next: "code_bay", lesson: "8.3.3.3" },
        { label: "Network Closet — packets are dropping everywhere", next: "network_closet", lesson: "8.3.2.1" },
      ],
    },

    design_lab: {
      location: "Design Lab · London, 1843 (simulated)",
      character: "lovelace",
      narrative: `"Before any machine helps anyone, we <strong>DEFINE</strong> the problem," Lovelace says. "Who has the problem? What does success look like?"

An alert flashes: a team skipped DEFINE and built something nobody needs.`,
      choices: [
        { label: "Interview users about their actual needs first", next: "define_win", lesson: "8.3.3.1" },
        { label: "Keep building — we'll find users later", next: "define_fail" },
      ],
    },

    define_win: {
      location: "Design Lab — DEFINE Complete",
      character: "lovelace",
      narrative: `"Excellent!" Golden Rule #1: <strong>Design for people, not for gadgets.</strong>

Coach Will Wright appears. "PREPARE comes next — research, brainstorm, plan."`,
      badge: "Design Thinker",
      goldenRule: 1,
      choices: [
        { label: "Continue to PREPARE with Wright", next: "prepare_phase" },
        { label: "Jump to TRY phase — build a quick prototype", next: "try_phase", lesson: "8.3.3.1" },
        { label: "Respond to Data Vault alert", next: "data_vault" },
      ],
    },

    define_fail: {
      location: "Design Lab — Crash",
      character: "lovelace",
      narrative: `The demo fails. "DEFINE exists for a reason," Lovelace says gently. "Technology without human understanding is noise."`,
      choices: [
        { label: "Retry — DEFINE the problem properly", next: "design_lab" },
        { label: "Visit the Code Bay instead", next: "code_bay" },
      ],
    },

    prepare_phase: {
      location: "Simulation Studio · Orinda, CA",
      character: "wright",
      narrative: `Wright spreads SimCity blueprints. "PREPARE means research, brainstorm, and plan before you commit."`,
      typingChallenge: {
        prompt: "Describe a technology that would solve a real problem in your school or neighborhood (2-3 sentences). What problem does it solve?",
        minWords: 20,
        next: "prepare_win",
      },
      choices: [],
    },

    prepare_win: {
      location: "Simulation Studio — PREPARE Complete",
      character: "wright",
      narrative: `"Deliberate design," Wright nods. "Culture is technology — it solves belonging, identity, and connection."

Professor Campbell adds: "Every hero's journey has trials. Yours is ethical technology use."`,
      badge: "Problem Solver",
      choices: [
        { label: "Enter TRY phase — test a prototype", next: "try_phase" },
        { label: "Temple of Passwords", next: "password_temple" },
        { label: "Sources Library — check your facts", next: "sources_library", lesson: "8.1.3.2" },
      ],
    },

    try_phase: {
      location: "Prototype Arena · TRY Phase",
      character: "meier",
      narrative: `Captain Sid Meier tosses you a dice. "TRY means build something testable. My first Civilization prototype was ugly — but playable. Play teaches."

Your prototype has a bug. Users can't log in.`,
      choices: [
        { label: "Watch users struggle and take notes — that's data", next: "try_win", lesson: "8.3.3.1" },
        { label: "Hide the bug and ship it anyway", next: "try_fail" },
        { label: "Call Grace Hopper's Debugging Fleet", next: "debug_scene", lesson: "8.3.3.2" },
      ],
    },

    try_win: {
      location: "Prototype Arena — Useful Data",
      character: "meier",
      narrative: `"Failure in TRY is information for REFLECT," Meier says. "Iterate. That's how Civilization got good."

Golden Rule insight: <strong>Test with real users before you celebrate.</strong>`,
      badge: "Iterative Builder",
      choices: [
        { label: "REFLECT with Crawford on what to change", next: "reflect_phase" },
        { label: "Network Closet — systems emergency", next: "network_closet" },
      ],
    },

    try_fail: {
      location: "Prototype Arena — Angry Users",
      character: "meier",
      narrative: `Users abandon your app. Meier resets the scenario. "Shipping broken tools breaks trust. TRY again — honestly."`,
      choices: [
        { label: "Observe users and collect feedback", next: "try_win" },
        { label: "Learn debugging from Grace Hopper", next: "debug_scene" },
      ],
    },

    debug_scene: {
      location: "Debugging Fleet · USS Hopper",
      character: "hopper",
      narrative: `"The first 'bug' was a literal moth in a computer," Hopper grins. "Debugging is systematic: reproduce, isolate, fix, test."

A loop in your code runs forever. What's your move?`,
      choices: [
        { label: "Trace the logic step by step to find the error", next: "debug_win", lesson: "8.3.3.2" },
        { label: "Delete everything and start over", next: "debug_fail" },
        { label: "Add random code until it stops", next: "debug_fail" },
      ],
    },

    debug_win: {
      location: "Debugging Fleet — Bug Squashed",
      character: "hopper",
      narrative: `"Computational thinking wins again," Hopper salutes. "Decompose, find patterns, design steps, debug."

Director Katherine Johnson waves from the trajectory console. "Precision matters — in space and online."`,
      badge: "Debugger",
      choices: [
        { label: "Visit Trajectory Analytics with Johnson", next: "trajectory_scene", lesson: "8.1.3.3" },
        { label: "Continue to REFLECT phase", next: "reflect_phase" },
      ],
    },

    debug_fail: {
      location: "Debugging Fleet — Still Broken",
      character: "hopper",
      narrative: `"Random changes create new bugs," Hopper warns. "Trace the logic. That's the job."`,
      choices: [
        { label: "Trace through the logic step by step", next: "debug_win" },
      ],
    },

    reflect_phase: {
      location: "Interactive Systems Bureau · REFLECT",
      character: "crawford",
      narrative: `Crawford projects your prototype metrics. "REFLECT honestly: What worked? What didn't? What will you try next?"

Conway's Game of Life patterns swirl behind him — small rule changes, big outcomes.`,
      typingChallenge: {
        prompt: "What did you learn from testing your idea? What would you change in the next version? (2-3 sentences)",
        minWords: 15,
        next: "reflect_win",
      },
      choices: [],
    },

    reflect_win: {
      location: "REFLECT Complete",
      character: "conway",
      narrative: `"Simple rules, complex results," Conway observes. "Online communities work the same way — small choices compound."

Golden Rule insight: <strong>Iterate deliberately — don't guess, improve.</strong>`,
      badge: "Reflector",
      choices: [
        { label: "Collaboration Bridge — team challenge", next: "collaboration_bridge", lesson: "8.3.4.2" },
        { label: "Final Trial", next: "final_trial" },
      ],
    },

    code_bay: {
      location: "Code Bay · Algorithm Dock",
      character: "meier",
      narrative: `Lines of pseudocode glow on the walls. Meier points: "An algorithm is an ordered plan. Loops repeat. Conditionals decide."

A robot needs instructions to cross a grid. Which plan works?`,
      choices: [
        { label: "Step-by-step instructions with IF obstacles THEN turn", next: "code_win", lesson: "8.3.3.3" },
        { label: "Random guesses until it works", next: "code_fail" },
        { label: "Tell the robot to 'figure it out'", next: "code_fail" },
      ],
    },

    code_win: {
      location: "Code Bay — Algorithm Accepted",
      character: "meier",
      narrative: `"Clear sequences, smart decisions, loops for repetition — that's computational thinking," Meier approves.`,
      badge: "Algorithm Architect",
      choices: [
        { label: "Debugging Fleet with Hopper", next: "debug_scene" },
        { label: "Design Lab with Lovelace", next: "design_lab" },
        { label: "Final Trial", next: "final_trial" },
      ],
    },

    code_fail: {
      location: "Code Bay — Robot Confused",
      character: "meier",
      narrative: `"Computers do exactly what you tell them — not what you mean," Meier says. "Write precise steps."`,
      choices: [
        { label: "Write step-by-step instructions with conditionals", next: "code_win" },
      ],
    },

    network_closet: {
      location: "Network Closet · Packet Junction",
      character: "babbage",
      narrative: `Babbage adjusts brass switches. "Devices talk using protocols — agreed rules, like HTTP and HTTPS."

A classmate sends login info over public Wi-Fi. What do you advise?`,
      choices: [
        { label: "Never send passwords on unsecured networks — use HTTPS sites", next: "network_win", lesson: "8.3.2.1" },
        { label: "Public Wi-Fi is always safe if you're quick", next: "network_fail" },
      ],
    },

    network_win: {
      location: "Network Closet — Encrypted",
      character: "babbage",
      narrative: `"HTTPS encrypts your connection. Protocols exist to solve communication problems safely," Babbage explains.`,
      badge: "Network Navigator",
      choices: [
        { label: "Data Vault", next: "data_vault" },
        { label: "IP Chamber — copyright mystery", next: "ip_chamber", lesson: "8.2.2.1" },
      ],
    },

    network_fail: {
      location: "Network Closet — Intercepted",
      character: "babbage",
      narrative: `"Unencrypted traffic can be read by others on the same network. Always check for HTTPS."`,
      choices: [
        { label: "Use HTTPS and avoid sensitive data on public Wi-Fi", next: "network_win" },
      ],
    },

    sources_library: {
      location: "Sources Library · Carmen's Archives",
      character: "johnson",
      narrative: `Johnson stacks research papers with care. "Before you share a claim, check: Who wrote it? What's their evidence? Can you verify?"

A viral post claims "Scientists prove homework causes brain damage." No source cited.`,
      choices: [
        { label: "Find the original study and check if it's real", next: "sources_win", lesson: "8.1.3.2" },
        { label: "Share it — it has a chart", next: "sources_fail" },
        { label: "Believe it because your friend posted it", next: "sources_fail" },
      ],
    },

    sources_win: {
      location: "Sources Library — Verified",
      character: "johnson",
      narrative: `"No original source means no proof," Johnson says. "Credibility and authority matter — ITEM standard 8.1.3.2 in action."`,
      badge: "Fact Finder",
      choices: [
        { label: "Media Decoding Chamber", next: "media_chamber" },
        { label: "Footprint Gallery", next: "footprint_scene" },
      ],
    },

    sources_fail: {
      location: "Sources Library — Misinformation Spreads",
      character: "johnson",
      narrative: `"Charts without sources are decoration, not evidence," Johnson warns.`,
      choices: [
        { label: "Verify the original source first", next: "sources_win" },
      ],
    },

    ip_chamber: {
      location: "IP Chamber · Copyright Vault",
      character: "crawford",
      narrative: `"Creative work belongs to someone," Crawford says. "You can be inspired — but credit and permission matter."

You want a cool song in your video project.`,
      choices: [
        { label: "Use royalty-free music or get permission — credit the artist", next: "ip_win", lesson: "8.2.2.1" },
        { label: "Download any song — if it's online, it's free", next: "ip_fail" },
        { label: "Remove the watermark from someone else's art", next: "ip_fail" },
      ],
    },

    ip_win: {
      location: "IP Chamber — Ethical Creator",
      character: "crawford",
      narrative: `Golden Rule insight: <strong>Create ethically — credit others' work.</strong>`,
      badge: "Ethical Creator",
      choices: [
        { label: "Collaboration Bridge", next: "collaboration_bridge" },
        { label: "Media Chamber", next: "media_chamber" },
      ],
    },

    ip_fail: {
      location: "IP Chamber — Takedown Notice",
      character: "crawford",
      narrative: `"Copyright protects creators. Using work without permission can harm artists and get you in trouble."`,
      choices: [
        { label: "Use licensed or royalty-free content with credit", next: "ip_win" },
      ],
    },

    collaboration_bridge: {
      location: "Collaboration Bridge · Global Guts Obstacle",
      character: "campbell",
      narrative: `"The bridge only holds teams that communicate," Campbell calls. "A group chat turns toxic. Someone is excluded and mocked."

You're in the chat. What do you do?`,
      choices: [
        { label: "Stand up for the excluded person and tell a trusted adult", next: "collab_win", lesson: "8.3.4.2" },
        { label: "Stay silent — not your problem", next: "collab_fail" },
        { label: "Join the mockery for laughs", next: "collab_fail" },
      ],
    },

    collab_win: {
      location: "Collaboration Bridge — Crossed",
      character: "campbell",
      narrative: `"Technology connects us — but humans choose kindness. Collaboration means lifting others up."

Golden Rule insight: <strong>Be the teammate you'd want online.</strong>`,
      badge: "Bridge Builder",
      choices: [
        { label: "Final Trial", next: "final_trial" },
        { label: "Trajectory Analytics", next: "trajectory_scene" },
      ],
    },

    collab_fail: {
      location: "Collaboration Bridge — Collapse",
      character: "campbell",
      narrative: `"Silence and cruelty both have weight. The bridge resets. Choose again with courage."`,
      choices: [
        { label: "Support the excluded person and report the behavior", next: "collab_win" },
      ],
    },

    trajectory_scene: {
      location: "Trajectory Analytics · NASA Sim",
      character: "johnson",
      narrative: `"One wrong decimal can miss the moon," Johnson says. "Online, one wrong share can miss the truth. Accuracy is ethical."

A meme claims a celebrity said something shocking. It's a fake quote.`,
      choices: [
        { label: "Check reliable sources before believing or sharing", next: "trajectory_win", lesson: "8.1.3.3" },
        { label: "Share it immediately — it's trending", next: "trajectory_fail" },
      ],
    },

    trajectory_win: {
      location: "Trajectory Analytics — Verified Path",
      character: "johnson",
      narrative: `"Reliability and accuracy protect everyone," Johnson smiles. "Research your heroes — Lovelace, Turing, Babbage, Hopper, Johnson, Wright, Meier, Campbell, Crawford, Conway."`,
      badge: "Precision Thinker",
      choices: [
        { label: "Final Trial", next: "final_trial" },
        { label: "Explore another path from the start", next: "start" },
      ],
    },

    trajectory_fail: {
      location: "Trajectory Analytics — Wrong Orbit",
      character: "johnson",
      narrative: `"Trending doesn't mean true. Verify before you amplify."`,
      choices: [
        { label: "Check reliable sources first", next: "trajectory_win" },
      ],
    },

    data_vault: {
      location: "Data Vault · ACME Sublevel 3",
      character: "turing",
      narrative: `Agent Turing decrypts: "URGENT — student data exposed on a public forum." Someone posted private info without consent.`,
      choices: [
        { label: "Report to a trusted adult immediately", next: "privacy_win", lesson: "8.2.2.3" },
        { label: "Screenshot and share — everyone needs to know", next: "privacy_fail" },
        { label: "Confront the poster alone online", next: "privacy_fail" },
      ],
    },

    privacy_win: {
      location: "Data Vault — Secured",
      character: "turing",
      narrative: `Golden Rule #2: <strong>Protect data like you protect your friends.</strong>`,
      badge: "Data Guardian",
      goldenRule: 2,
      choices: [
        { label: "Temple of Passwords", next: "password_temple" },
        { label: "Media Decoding Chamber", next: "media_chamber" },
        { label: "Footprint Gallery", next: "footprint_scene" },
      ],
    },

    privacy_fail: {
      location: "Data Vault — Breach Escalates",
      character: "turing",
      narrative: `"Sharing leaked data spreads harm. Report — don't repost."`,
      choices: [
        { label: "Report to a trusted adult", next: "privacy_win" },
        { label: "Footprint Gallery first", next: "footprint_scene" },
      ],
    },

    password_temple: {
      location: "Temple of Passwords · Olmec Gate",
      character: "guide",
      narrative: `"Legends of the Hidden Temple — only the worthy pass!" Dr. Babbage's ghost appears: "Garbage in, garbage out. Guard your digital keys."`,
      choices: [
        { label: "Unique passwords + 2FA for every account", next: "password_win", lesson: "8.2.2.3" },
        { label: "Same easy password everywhere", next: "password_fail" },
        { label: "Share your password with your best friend", next: "password_fail" },
      ],
    },

    password_win: {
      location: "Temple Inner Sanctum",
      character: "babbage",
      narrative: `Golden Rule #3: <strong>Your login is yours alone.</strong>`,
      badge: "Temple Champion",
      goldenRule: 3,
      choices: [
        { label: "Media Decoding Chamber", next: "media_chamber" },
        { label: "Footprint Gallery", next: "footprint_scene" },
        { label: "Final Trial", next: "final_trial" },
      ],
    },

    password_fail: {
      location: "Temple — Guard Awakens",
      character: "guide",
      narrative: `"The Temple Guard claims another victim! Weak passwords get cracked."`,
      choices: [
        { label: "Use unique passwords and 2FA", next: "password_win" },
        { label: "Footprint Gallery", next: "footprint_scene" },
      ],
    },

    footprint_scene: {
      location: "Hall of Mirrors · Digital Footprint Gallery",
      character: "campbell",
      narrative: `"Your digital footprint is permanent ink. Culture is technology that solves belonging — but mob mentality solves nothing."`,
      choices: [
        { label: "Would I want this attached to me in 10 years?", next: "footprint_win", lesson: "8.2.1.1" },
        { label: "Will it get the most likes?", next: "footprint_fail" },
        { label: "Embarrass someone else for laughs", next: "footprint_fail" },
      ],
    },

    footprint_win: {
      location: "Hall of Mirrors — Clear",
      character: "campbell",
      narrative: `Golden Rule #4: <strong>Think before you post.</strong>`,
      badge: "Thoughtful Citizen",
      goldenRule: 4,
      choices: [
        { label: "Media Decoding Chamber", next: "media_chamber" },
        { label: "Final Trial", next: "final_trial" },
      ],
    },

    footprint_fail: {
      location: "Hall of Mirrors — Regret",
      character: "campbell",
      narrative: `"Likes fade. Harm lingers."`,
      choices: [
        { label: "Consider long-term consequences", next: "footprint_win" },
        { label: "Media Chamber", next: "media_chamber" },
      ],
    },

    media_chamber: {
      location: "Media Decoding Chamber · Carmen's Intel Desk",
      character: "crawford",
      narrative: `Three headlines about the same event — one shocking, one balanced, one clickbait. "Decode before you share."`,
      choices: [
        { label: "Compare sources and check evidence", next: "media_win", lesson: "8.2.2.4" },
        { label: "Share the shocking headline", next: "media_fail" },
        { label: "Trust the ALL-CAPS one", next: "media_fail" },
      ],
    },

    media_win: {
      location: "Media Chamber — Truth Recovered",
      character: "crawford",
      narrative: `Golden Rule #5: <strong>Decode media before you spread it.</strong>`,
      badge: "Media Decoder",
      goldenRule: 5,
      choices: [
        { label: "Final Trial", next: "final_trial" },
        { label: "Become a mentor — alternate ending", next: "mentor_ending" },
      ],
    },

    media_fail: {
      location: "Media Chamber — Panic",
      character: "crawford",
      narrative: `"Who made it? What's the evidence? What do other sources say?"`,
      choices: [
        { label: "Compare sources and check evidence", next: "media_win" },
      ],
    },

    final_trial: {
      location: "Gauntlet Arena · Final Round",
      character: "guide",
      narrative: `"FINAL ROUND! Global Guts!" All mentors appear. "Write your Digital Citizenship Oath."`,
      typingChallenge: {
        prompt: "Write your Digital Citizenship Oath (3-5 sentences): How will you use technology to solve problems, help others, and stay safe online?",
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
      narrative: `Lovelace places a mentor badge on your shoulder. "You've recovered the Golden Rules — now teach them. Technology is part of being human. Pass it on."

You become a field operative, helping the next recruit navigate the gauntlet. <em>Research one hero from this mission and present their story to your class.</em>`,
      choices: [
        { label: "Play again — new path", next: "start" },
      ],
    },

    victory: {
      location: "ACME Tech Division — Mission Complete",
      character: "guide",
      ending: true,
      endingType: "champion",
      narrative: `The five Golden Rules glow:

<strong>1.</strong> Design for people. <strong>2.</strong> Protect data. <strong>3.</strong> Guard your login.
<strong>4.</strong> Think before you post. <strong>5.</strong> Decode media.

<strong>TECH TRAIL CHAMPION!</strong> Technology takes many forms — computers, culture, games, stories. Follow a deliberate design process and simple golden rules to build a better world.

<em>Research: Lovelace, Turing, Babbage, Hopper, Johnson, Wright, Meier, Campbell, Crawford, Conway.</em>`,
      choices: [
        { label: "Play again — explore every path", next: "start" },
      ],
    },
  };

  window.TechTrailStory = { STORY, CHARACTERS };
})();
