/**
 * Global Tech Gauntlet. Branching digital citizenship adventure.
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
      research: "Ada Lovelace wrote the first computer program so a machine could follow a plan. And guessed it might one day make music, not just math.",
    },
    turing: {
      name: "Agent Alan Turing",
      role: "Cryptography Division",
      emoji: "🔐",
      era: "1940s",
      research: "Alan Turing designed machines to break secret wartime codes. And later a test for asking, fairly, whether a machine can think.",
    },
    babbage: {
      name: "Dr. Charles Babbage",
      role: "Mechanical Systems Architect",
      emoji: "⚙️",
      era: "1837",
      research: "Charles Babbage designed a gear-and-lever computer so people would stop wrecking ships on math tables copied by tired hands.",
    },
    wright: {
      name: "Coach Will Wright",
      role: "Simulation Design Lab",
      emoji: "🌍",
      era: "1989",
      research: "Will Wright built SimCity so you can practice running a city. And fail safely. Before anyone gets flooded in real life.",
    },
    meier: {
      name: "Captain Sid Meier",
      role: "Strategy & Iteration Corps",
      emoji: "♟️",
      era: "1991",
      research: "Sid Meier designed Civilization so people could practice history’s hard choices. And his rule was that a choice has to be fun and fair to test.",
    },
    campbell: {
      name: "Professor Joseph Campbell",
      role: "Narrative & Culture Division",
      emoji: "📜",
      era: "1949",
      research: "Joseph Campbell mapped the Hero’s Journey in The Hero with a Thousand Faces. A new way to look at stories, and at who you become in them.",
    },
    crawford: {
      name: "Chris Crawford",
      role: "Interactive Systems Bureau",
      emoji: "🎮",
      era: "1984",
      research: "Chris Crawford designed games where your choices change the story. Practice for real decisions, because every click is a vote.",
    },
    conway: {
      name: "John Conway",
      role: "Emergent Systems Observatory",
      emoji: "🔬",
      era: "1970",
      research: "John Conway’s Game of Life showed that tiny rules can explode into huge patterns. The same way a rumor takes over a group chat.",
    },
    hopper: {
      name: "Admiral Grace Hopper",
      role: "Debugging Fleet",
      emoji: "🐛",
      era: "1947",
      research: "Grace Hopper coined “debugging” and built a compiler so humans could give computers instructions in words, not just 1s and 0s.",
    },
    johnson: {
      name: "Director Katherine Johnson",
      role: "Trajectory Analytics",
      emoji: "🚀",
      era: "1962",
      research: "Katherine Johnson calculated NASA flight paths by hand so astronauts came home. One wrong decimal, and a capsule misses the ocean.",
    },
    lamarr: {
      name: "Commander Hedy Lamarr",
      role: "Shared-Air Division",
      emoji: "📡",
      era: "1942",
      research: "Hedy Lamarr co-invented frequency hopping so a radio signal could dodge jamming. A building block of Wi-Fi and Bluetooth. Public air is shared air.",
    },
    hamilton: {
      name: "Lead Margaret Hamilton",
      role: "Flight Software Deck",
      emoji: "🌙",
      era: "1969",
      research: "Margaret Hamilton led the Apollo flight software. Her team’s code helped astronauts land. And helped invent software engineering as a job that keeps people alive.",
    },
    perlman: {
      name: "Architect Radia Perlman",
      role: "Internet Spine",
      emoji: "🌳",
      era: "1985",
      research: "Radia Perlman designed the spanning-tree protocol so networks don’t loop forever and melt. She is often called a mother of the internet.",
    },
    sweeney: {
      name: "Detective Latanya Sweeney",
      role: "Data Identity Lab",
      emoji: "🧩",
      era: "1997",
      research: "Latanya Sweeney showed that “anonymous” data often isn’t: ZIP code + birth date + gender identified the governor. Privacy is a design problem.",
    },
    buolamwini: {
      name: "Dr. Joy Buolamwini",
      role: "Algorithmic Justice Lab",
      emoji: "🪞",
      era: "2018",
      research: "Joy Buolamwini proved many face scanners fail on darker skin. Then founded the Algorithmic Justice League so people, not just models, get a say.",
    },
    west: {
      name: "Dr. Gladys West",
      role: "Earth Model Bureau",
      emoji: "🛰️",
      era: "1979",
      research: "Gladys West modeled the shape of the Earth so GPS could work. Your phone’s map is her math. And location data is personal.",
    },
    noble: {
      name: "Dr. Safiya U. Noble",
      role: "Media Decode Bureau",
      emoji: "🔎",
      era: "2018",
      research: "Safiya U. Noble, Ph.D. Wrote Algorithms of Oppression to show that search results and headlines are designed. Not a neutral mirror of the world.",
    },
    guide: {
      name: "Mr. Phil",
      role: "Mission Host · DaVinci Dragons",
      emoji: "👓",
      era: "NOW",
      research: "Mr. Phil teaches at DaVinci Dragons. He built the Gauntlet so students practice digital citizenship the way pilots practice in a simulator — wrong choices in a safe room before wrong choices in a real feed.",
    },
  };

  /** Minimum Golden Rules to reach Final Trial on the speed-run path (after Crawford debrief). */
  const MIN_GOLDEN_FOR_SPEEDRUN = 3;

  /** Golden Rule spine. Always offered as the “main quest.” Side missions scramble around it. */
  const GOLDEN_SPINE = [
    { rule: 1, next: "design_lab", typeText: "Design Lab", label: "Sprint to the Design Lab. They built the wrong thing" },
    { rule: 2, next: "data_vault", typeText: "Data Vault", label: "Answer the Data Vault alert. Private info is leaking" },
    { rule: 3, next: "password_temple", typeText: "Password Vault", label: "Lock the Password Vault before someone walks in" },
    { rule: 4, next: "footprint_scene", typeText: "Footprint Gallery", label: "Cut through the Footprint Gallery. A post is about to blow up" },
    { rule: 5, next: "media_chamber", typeText: "Media Chamber", label: "Decode the Media Chamber. Three headlines, one event" },
  ];

  /** Five paths on the briefing board. One per Golden Rule screen. */
  const START_MISSIONS = [
    { label: "Screen 1: Sprint to the Design Lab. They built the wrong thing", next: "design_lab", typeText: "Design Lab" },
    { label: "Screen 2: Answer the Data Vault alert. Private info is leaking", next: "data_vault", typeText: "Data Vault" },
    { label: "Screen 3: Lock the Password Vault before someone walks in", next: "password_temple", typeText: "Password Vault" },
    { label: "Screen 4: Cut through the Footprint Gallery. A post is about to blow up", next: "footprint_scene", typeText: "Footprint Gallery" },
    { label: "Screen 5: Decode the Media Chamber. Three headlines, one event", next: "media_chamber", typeText: "Media Chamber" },
  ];

  const STORY = {
    start: {
      location: "DaVinci Dragons. Briefing Room",
      character: "guide",
      enter: "Doors hiss. Coffee. Hot metal. Five alarms at once.",
      job: "Pick a room. Recover all five Golden Rules of digital citizenship.",
      conflict: { graphic: "alarms", title: "Five alarms at once", situation: "Five screens line the wall. A locker leak. A viral lie. An app shipping Friday whether it works. Five screens, five alarms, five paths. Each one guards a Golden Rule.", question: "Which door do you take first?" },
      narrative: `Mr. Phil snaps a badge onto your jacket. The hologram over the table is a campus map. Same one you can open anytime with <strong>Z</strong>. Type a room name with <strong>T</strong> to fast-travel once it's on your circuit.

"Welcome to the Gauntlet. The <strong>Golden Rules of Digital Citizenship</strong> didn't vanish. People stopped using them. Each room has a mentor, a live conflict on the hologram, and a solution you type."

"Five doors branch from this Briefing Room. Pick <strong>one path first</strong>. Clear a room and the campus circuit links to its neighbors. Branch out, connect the map, then find Crawford's Bureau to wire the Arena."

Ada Lovelace flickers onto the main screen. "Wrong turns cost you. Three strikes and you're pulled off the mission. Pick a door. Think on your feet."`,
      choicePrefix: "I sprint to the",
      dynamicChoices: "start",
      choices: [],
    },

    design_lab: {
      location: "Design Lab · London, 1843 (simulated)",
      character: "lovelace",
      typeChoices: true,
      enter: "Whiteboards. Heat lamps. A half-built app blinking on the wall.",
      job: "Stop this team from shipping an app nobody asked for.",
      conflict: { graphic: "app", title: "Ship-it Friday", situation: "Kids were asked what they wanted. Nobody asked what problem they were solving. The countdown still says Friday.", question: "Interview real users, or ship a guess?" },
      narrative: `Ada Lovelace. The person who wrote the first computer program in 1843. Is already pointing at the hologram.

"Look. That's the conflict. They built a toy, not a tool. Fancy buttons don't matter if nobody needed the app."

The project lead taps the countdown. "We can polish later. Ship it Friday." Lovelace looks at you. "Pick a solution. Type it."`,
      choicePrefix: "I will",
      choices: [
        { label: "Interview real users before building more", next: "define_win", integrity: 5, reputation: 5, typeText: "interview users" },
        { label: "Ship a rough prototype Friday and hope for feedback", next: "define_recovery_1", integrity: -5, reputation: 10, typeText: "ship fast" },
      ],
    },

    define_win: {
      location: "Design Lab. Problem Defined",
      character: "lovelace",
      lesson: "8.3.3.1",
      enter: "The countdown clock stops. The wall redraws around a real problem.",
      narrative: `Lovelace grins. "There. Now you're designing for people. Not for the demo."

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
        { label: "Detour to the AI Ethics Lab", next: "ai_ethics", typeText: "AI Ethics Lab" },
      ],
    },

    define_recovery_1: {
      location: "Design Lab. Launch Day",
      character: "lovelace",
      enter: "Confetti cannons. Three users. Then silence.",
      narrative: `Friday hits. Three people open the app, frown, and bounce. Analytics flatline.

Lovelace doesn't yell. She zooms the bounce-rate chart. "Speed teaches too. But it teaches in public. You shipped a guess."`,
      choicePrefix: "I will",
      choices: [
        { label: "Pivot from the feedback and actually talk to users", next: "define_win", integrity: 5, reputation: 0, typeText: "pivot and interview" },
        { label: "Cram in more features to win the leavers back", next: "define_recovery_2", integrity: -10, reputation: -5, typeText: "add more features" },
      ],
    },

    define_recovery_2: {
      location: "Design Lab. Deadline Pressure",
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
      job: "Name the real problem in plain language before you build.",
      conflict: { graphic: "cities", title: "No buzzwords", situation: "A blank sim city waits. Wright wants the problem in plain language. Not 'make an app.'", question: "Who is this actually for?" },
      narrative: `Will Wright. The designer of SimCity and The Sims. Dumps you at a table of tiny glowing cities.

"Before you build, tell me what you're actually trying to fix. No buzzwords. The hologram stays empty until the problem is real."`,
      typingChallenge: {
        mode: "composition",
        prompt: "In 2–3 sentences: What real problem would you solve with technology at your school or in your neighborhood? Who benefits?",
        minWords: 20,
        next: "prepare_win",
      },
      choices: [],
    },

    prepare_win: {
      location: "Simulation Studio. Plan Set",
      character: "wright",
      lesson: "8.3.3.1",
      narrative: `"Good," Wright says. "That's a problem worth a prototype. Not a feature shopping list."

Down the hall you hear keyboard clicks and Sid Meier muttering about a login bug. Mr. Phil radios: "Prototype Arena is live. Password Vault is still blinking red if you want the security track."`,
      badge: "Problem Solver",
      choicePrefix: "I head to the",
      choices: [
        { label: "See the login bug in the Prototype Arena", next: "try_phase", typeText: "Prototype Arena" },
        { label: "Detour to lock the Password Vault", next: "password_temple", typeText: "Password Vault" },
        { label: "Hit the Sources Library. A rumor is spreading", next: "sources_library", typeText: "Sources Library" },
        { label: "Ask Wright how he invented practice-cities", next: "wright_deep", typeText: "Wright Deep Dive" },
      ],
    },

    try_phase: {
      location: "Prototype Arena",
      character: "meier",
      enter: "A die clatters across steel. Real users wait behind glass.",
      job: "Test the login bug honestly. Don't hide it.",
      conflict: { graphic: "dice", title: "Login bug, live users", situation: "Real people are waiting behind the glass. Login is broken. You could watch where they get stuck. Or patch quietly and pretend nothing happened.", question: "Watch users, or hide the bug?" },
      narrative: `Sid Meier. The designer of Civilization. Rolls a die. It clatters to a stop in front of the hologram.

"Test early. Test honest. Your build has a login bug, and those are real people. Pick a solution."`,
      rngBadge: { chance: 0.28, badge: "Lucky Roll", message: "The die lands on your number. Meier grins. \"Fortune favors the prepared.\"" },
      choicePrefix: "I will",
      choices: [
        { label: "Sit with users, watch where they get stuck, take notes", next: "try_win", integrity: 5, reputation: 5, typeText: "watch users" },
        { label: "Patch quietly and don't announce the bug", next: "try_recovery_1", integrity: -5, reputation: 10, typeText: "patch quietly" },
        { label: "Call Grace Hopper's debugging fleet", next: "debug_scene", integrity: 0, reputation: 0, typeText: "call Hopper" },
      ],
    },

    try_win: {
      location: "Prototype Arena. Notes Taken",
      character: "meier",
      lesson: "8.3.3.1",
      narrative: `"Painful to watch. Useful to know," Meier says. "That's data. Not failure."

Chris Crawford is already pulling your metrics in the next room. Mr. Phil adds, "Network Closet is sparking if you want a detour."`,
      badge: "Iterative Builder",
      choicePrefix: "I head to",
      choices: [
        { label: "Review what to change with Crawford", next: "reflect_phase", typeText: "Crawford's Bureau" },
        { label: "Follow the outage to the Network Closet", next: "network_closet", typeText: "Network Closet" },
        { label: "Ask Meier how he made history playable", next: "meier_deep", typeText: "Meier Deep Dive" },
      ],
    },

    try_recovery_1: {
      location: "Prototype Arena. Support Queue",
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
      location: "Prototype Arena. Trust Erosion",
      character: "meier",
      narrative: `A forum thread accuses the team of hiding bugs. Meier taps the table.

"Silent fixes feel safe. Until they don't." <em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Own the bug publicly and watch users try again", next: "try_win", integrity: 0, reputation: 0, typeText: "own the bug" },
      ],
    },

    debug_scene: {
      location: "Debugging Fleet · USS Hopper",
      character: "hopper",
      enter: "Brass rails. Green terminals. Hopper already has the log open.",
      job: "Find the real bug. Don't guess.",
      conflict: { graphic: "loop", title: "Infinite loop", situation: "The program never stops. You can guess, rewrite everything tonight, or walk it line by line.", question: "Trace the logic, or mash random lines?" },
      narrative: `Admiral Grace Hopper. She coined “debugging” and built the first compiler so humans could write code in words. Already has the hologram on the suspicious <code>if</code>.

"Infinite loop. Classic. Computers do exactly what you wrote, even the silly part. Pick how we hunt it."`,
      choicePrefix: "I will",
      choices: [
        { label: "Walk through the logic step by step", next: "debug_win", integrity: 5, reputation: 5, typeText: "trace the logic" },
        { label: "Rewrite the whole module from scratch tonight", next: "debug_recovery_1", integrity: -5, reputation: 0, typeText: "rewrite everything" },
        { label: "Change random lines until the error message changes", next: "debug_recovery_2", integrity: -15, reputation: -10, typeText: "mash random lines" },
      ],
    },

    debug_win: {
      location: "Debugging Fleet. Loop Broken",
      character: "hopper",
      lesson: "8.3.3.2",
      narrative: `"There. One condition flipped," Hopper says. "Computers don't get tired. They do exactly what you wrote. Even the silly part."

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
      location: "Debugging Fleet. Scope Creep",
      character: "hopper",
      narrative: `The rewrite births three new bugs where one lived. Hopper studies the diff.

"Fresh code smells nicer. It isn't smarter. You swapped a known problem for mystery meat."`,
      choicePrefix: "I will",
      choices: [
        { label: "Trace the original logic carefully", next: "debug_win", integrity: 5, reputation: 0, typeText: "trace the logic" },
        { label: "Keep rewriting. You'll catch them eventually", next: "debug_recovery_2", integrity: -5, reputation: -5, typeText: "keep rewriting" },
      ],
    },

    debug_recovery_2: {
      location: "Debugging Fleet. Still Spinning",
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
      job: "Say what version two should actually fix. No PR spin.",
      conflict: { graphic: "notes", title: "No PR voice", situation: "A chart: what worked, what flopped, what surprised you. The version-two column is empty.", question: "What would you change before more people see this?" },
      narrative: `Chris Crawford. A pioneer of games where your choices actually matter. Pulls the hologram: what worked, what flopped, what surprised you.

"No PR voice. The conflict is simple: what would version two actually fix?"`,
      typingChallenge: {
        mode: "composition",
        prompt: "In 2–3 sentences: What did testing teach you? What would you change before sharing this with more people?",
        minWords: 15,
        next: "reflect_win",
      },
      choices: [],
    },

    reflect_win: {
      location: "Systems Bureau. Debrief",
      character: "conway",
      lesson: "8.3.3.1",
      enter: "Conway's Game of Life ripples across the wall. Tiny rules, huge messes.",
      narrative: `John Conway leans in as patterns bloom behind you. "Small rule changes, giant outcomes. Same as a group chat."

A circuit trace lights on the wall — Crawford's Bureau now links straight to the <strong>Final Trial Arena</strong>. Completing this debrief wired the last hop.

Campbell's voice hits the intercom from the Collaboration Bridge: someone is getting iced out of a shared doc. Mr. Phil adds, "The Arena is live once you've recovered at least three Golden Rules and finished this debrief. Or keep branching — link every room before you swear the oath."`,
      badge: "Reflector",
      choicePrefix: "I head to the",
      choices: [
        { label: "Report to the Collaboration Bridge", next: "collaboration_bridge", typeText: "Collaboration Bridge" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Ask Conway about the Game of Life", next: "conway_deep", typeText: "Conway Deep Dive" },
      ],
    },

    code_bay: {
      location: "Code Bay · Algorithm Dock",
      character: "meier",
      enter: "A delivery robot idles on a grid. Two teammates argue over a marker.",
      job: "Give the robot real instructions. Not vibes.",
      conflict: { graphic: "robot", title: "Vibes vs steps", situation: "One teammate wrote three clear turns. The other wrote 'go to the goal somehow.' The robot is waiting.", question: "Clear if/then steps, or let it wander?" },
      narrative: `Sid Meier slaps a marker in your hand and nods at the hologram.

"That robot needs an algorithm: boring, precise steps. Vibes don't move machines. Pick a solution."`,
      choicePrefix: "I will",
      choices: [
        { label: "Write ordered steps with clear if/then decisions", next: "code_win", integrity: 5, reputation: 5, typeText: "write clear steps" },
        { label: "Try a simpler guess-and-check heuristic", next: "code_recovery_1", integrity: 0, reputation: 0, typeText: "try a heuristic" },
        { label: "Let it wander randomly until something works", next: "code_recovery_2", integrity: -10, reputation: -5, typeText: "let it wander" },
      ],
    },

    code_win: {
      location: "Code Bay. Path Found",
      character: "meier",
      lesson: "8.3.3.3",
      narrative: `"Boring. Precise. Done," Meier says. "That's an algorithm."

The robot beeps and rolls toward Hopper's bay. Mr. Phil radios the Design Lab pulse from briefing. Still on the board if you haven't been. Margaret Hamilton also keeps her Apollo printouts here if you want the story of software that had to land a ship.`,
      badge: "Algorithm Architect",
      choicePrefix: "I head to",
      choices: [
        { label: "Visit Hopper's debugging fleet", next: "debug_scene", typeText: "Hopper's Fleet" },
        { label: "Cut back to the Design Lab", next: "design_lab", typeText: "Design Lab" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Ask Hamilton about the software that landed Apollo", next: "hamilton_deep", typeText: "Hamilton Deep Dive" },
      ],
    },

    code_recovery_1: {
      location: "Code Bay. Partial Path",
      character: "meier",
      narrative: `The heuristic gets the robot halfway. Then it loops in a corner forever. Meier studies the trace.

"Heuristics are fine for games. Not for guarantees. Want to tighten it into something you can prove?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Rewrite it as ordered step-by-step instructions", next: "code_win", integrity: 5, reputation: 0, typeText: "write clear steps" },
        { label: "Stack more heuristics and hope one sticks", next: "code_recovery_2", integrity: -5, reputation: -5, typeText: "add more guesses" },
      ],
    },

    code_recovery_2: {
      location: "Code Bay. Gridlock",
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
      character: "lamarr",
      enter: "Brass switches. Blinking LEDs. Café Wi‑Fi hissing in the speakers.",
      job: "Keep a password off café Wi-Fi.",
      conflict: { graphic: "wifi", title: "No padlock", situation: "A classmate is about to type a school password on café Wi-Fi. No HTTPS lock in the browser. They say they'll only be a minute.", question: "Wait for trusted Wi-Fi, or let them hurry?" },
      narrative: `Hedy Lamarr. She co-invented frequency hopping, a building block of Wi-Fi. Flicks a switch. The hologram shows an unlocked padlock over a café.

"I designed a way for a signal to jump so enemies couldn't jam it. That doesn't make café Wi-Fi private. Public air is shared air. A minute is plenty of time to steal a login. What's your call?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Tell them to wait for a trusted network", next: "network_win", integrity: 5, reputation: 5, typeText: "wait for trusted wifi" },
        { label: "Offer your phone hotspot so they can hurry", next: "network_recovery_1", integrity: -5, reputation: 0, typeText: "offer a hotspot" },
      ],
    },

    network_win: {
      location: "Network Closet. Connection Secured",
      character: "lamarr",
      lesson: "8.3.2.1",
      narrative: `"HTTPS and timing both matter," Lamarr says. "I taught signals to hop. I didn't make the café a vault. Public air is shared air."

Mr. Phil pings Data Vault and the IP Chamber. Lamarr also keeps her hopping archive. And she wants you to meet Radia Perlman, who taught the internet not to melt.`,
      badge: "Network Navigator",
      choicePrefix: "I head to the",
      choices: [
        { label: "Follow up at the Data Vault", next: "data_vault", typeText: "Data Vault" },
        { label: "Handle the IP Chamber copyright mess", next: "ip_chamber", typeText: "IP Chamber" },
        { label: "Ask Lamarr how she invented hopping signals", next: "lamarr_deep", typeText: "Lamarr Deep Dive" },
        { label: "Ask Perlman why the internet doesn't melt", next: "perlman_deep", typeText: "Perlman Deep Dive" },
        { label: "Ask Babbage how he designed a thinking engine", next: "babbage_deep", typeText: "Babbage Deep Dive" },
      ],
    },

    network_recovery_1: {
      location: "Network Closet. Packet Sniff",
      character: "lamarr",
      narrative: `A training sim shows what an attacker on the same network can read. Unencrypted logins aren't private. Even for a minute. Your hotspot didn't have the padlock either.

Lamarr adjusts the switch. "Hopping hid a torpedo. It doesn't hide a password on open Wi-Fi."`,
      choicePrefix: "I will",
      choices: [
        { label: "Recommend a secure connection instead", next: "network_win", integrity: 5, reputation: 0, typeText: "use a secure connection" },
      ],
    },

    sources_library: {
      location: "Sources Library · Research Archives",
      character: "johnson",
      enter: "Quiet stacks. A viral chart glowing on Johnson's tablet.",
      job: "Hunt the original study before anyone else shares it.",
      conflict: { graphic: "chart", title: "Viral chart, no author", situation: "A slick chart claims homework destroys brain cells. No study. No author. Your friend already reposted it.", question: "Find the source, or keep the post up?" },
      narrative: `Katherine Johnson. She calculated NASA flight paths by hand, where one wrong decimal missed the ocean. Slides the hologram across the desk.

"A chart isn't evidence. Your friend already hit share. What's your move?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Hunt the original study before reacting", next: "sources_win", integrity: 5, reputation: 5, typeText: "find the original study" },
        { label: "Leave a skeptical comment but keep the post up", next: "sources_recovery_1", integrity: -5, reputation: 0, typeText: "comment but leave it" },
        { label: "Repost it. The chart looks official", next: "sources_recovery_2", integrity: -10, reputation: -10, typeText: "repost the chart" },
      ],
    },

    sources_win: {
      location: "Sources Library. Source Checked",
      character: "johnson",
      lesson: "8.1.3.2",
      narrative: `"The chart was recycled from an old blog. No study behind it," Johnson says. "You just saved your friend a bad take."

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
      location: "Sources Library. Skepticism Backfires",
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
      location: "Sources Library. Correction Thread",
      character: "johnson",
      narrative: `The claim unravels in the comments. After it already spread. Your name is still in the share chain.

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
      job: "Use music you actually have permission for.",
      conflict: { graphic: "music", title: "Perfect song, zero license", situation: "The class video sounds great with a random upload. No license. No credit. Partner says you'll cut it if anyone complains.", question: "Get permission, or just use it?" },
      narrative: `Chris Crawford points at the hologram waveform. "Everyone uses it" is not a license.

"Creators deserve credit and permission. You can be inspired without taking. Pick a solution."`,
      choicePrefix: "I will",
      choices: [
        { label: "Find royalty-free music or get real permission", next: "ip_win", integrity: 10, reputation: 5, typeText: "get real permission" },
        { label: "Use a short clip and credit the artist informally", next: "ip_recovery_1", integrity: -5, reputation: 0, typeText: "use a short clip" },
        { label: "Use it. Nobody watches school projects", next: "ip_recovery_2", integrity: -15, reputation: -10, typeText: "just use it" },
      ],
    },

    ip_win: {
      location: "IP Chamber. Cleared to Publish",
      character: "crawford",
      lesson: "8.2.2.1",
      narrative: `"Creators deserve credit. And permission," Crawford says. "You can be inspired without taking."

The Collaboration Bridge is packed ahead. Media Chamber is still decoding three headlines if you haven't cracked Rule 5.`,
      badge: "Ethical Creator",
      choicePrefix: "I head to the",
      choices: [
        { label: "Report to the Collaboration Bridge", next: "collaboration_bridge", typeText: "Collaboration Bridge" },
        { label: "Visit the Media Decoding Chamber", next: "media_chamber", typeText: "Media Chamber" },
        { label: "Ask Crawford how he made choices matter", next: "crawford_deep", typeText: "Crawford Deep Dive" },
      ],
    },

    ip_recovery_1: {
      location: "IP Chamber. Informal Credit",
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
      location: "IP Chamber. Takedown Notice",
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
      typeChoices: true,
      chatMission: "going_afk",
      enter: "Captain's chair. Stars on the viewer. A group chat glowing on the main screen.",
      job: "Back someone up when the group chat turns mean.",
      conflict: { graphic: "chat", title: "Locked out, then roasted", situation: "A classmate is locked out of a shared doc. Then roasted for asking why. You're in the thread. Everyone is watching.", question: "Speak up in public, or join the joke?" },
      narrative: `Joseph Campbell. He studied hero stories worldwide. Points at the hologram chat.

"Online, you're in a story too. You pick who you become. Kindness in a DM is real. The public thread still needs a voice. What's your solution?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Back them up in the chat and tell a trusted adult", next: "collab_win", integrity: 10, reputation: 5, typeText: "back them up publicly" },
        { label: "Message them privately to check in", next: "collab_recovery_1", integrity: 0, reputation: 0, typeText: "check in privately" },
        { label: "Add a joke so you don't get targeted too", next: "collab_recovery_2", integrity: -15, reputation: -10, typeText: "join the joke" },
      ],
    },

    collab_win: {
      location: "Collaboration Bridge. Channel Clear",
      character: "campbell",
      lesson: "8.3.4.2",
      narrative: `"Tools connect us," Campbell says. "People choose whether that connection helps."

The crew holds. Arena lights dim up ahead. But Johnson still has a fake quote on her console if you want one more accuracy check.`,
      badge: "Bridge Builder",
      rngBadge: { chance: 0.22, badge: "Steady Hands", message: "A surge hits the comms. You steady a teammate. Campbell nods." },
      choicePrefix: "I head to the",
      choices: [
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Verify the trending quote with Johnson first", next: "trajectory_scene", typeText: "Johnson's Console" },
        { label: "Ask Campbell about the Hero's Journey", next: "campbell_deep", typeText: "Campbell Deep Dive" },
      ],
    },

    collab_recovery_1: {
      location: "Collaboration Bridge. Private Check-In",
      character: "campbell",
      narrative: `<strong>What just happened:</strong> Checking in privately was kind. But staying quiet in the group chat looked like you agreed with the roast.

You DM the excluded person. They appreciate it. But the roast keeps going. Campbell watches the thread. "Kindness in private matters. The public norm still slid toward cruel."`,
      choicePrefix: "I will",
      choices: [
        { label: "Speak up in the thread now and loop in an adult", next: "collab_win", integrity: 5, reputation: -5, typeText: "speak up now" },
        { label: "Stay out of it. You already DMed", next: "collab_recovery_2", integrity: -5, reputation: -5, typeText: "stay out of it" },
      ],
    },

    collab_recovery_2: {
      location: "Collaboration Bridge. Reset",
      character: "campbell",
      narrative: `The excluded person stops typing. Campbell rewinds the feed.

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
      job: "Check if a viral quote is even real before it spreads.",
      conflict: { graphic: "meme", title: "Famous face, no source", situation: "A meme puts a bold quote on a famous face. Shares are climbing. No citation anywhere.", question: "Verify first, or share with a disclaimer?" },
      narrative: `Johnson zooms the hologram. "Accuracy is a habit. Trending and true are not the same word. What do you do first?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Check if the quote shows up in reliable sources", next: "trajectory_win", integrity: 5, reputation: 5, typeText: "check reliable sources" },
        { label: "Share it with a 'not sure if true' disclaimer", next: "trajectory_recovery_1", integrity: -5, reputation: 0, typeText: "share with a disclaimer" },
      ],
    },

    trajectory_win: {
      location: "Trajectory Analytics. Verified",
      character: "johnson",
      lesson: "8.1.3.3",
      narrative: `"Misattributed," Johnson says. "Close one. Trending and true are not the same word."

You can loop to briefing for a fresh mission. Or take the Arena if you've recovered at least three Golden Rules and finished Crawford's debrief.`,
      badge: "Precision Thinker",
      choicePrefix: "I will",
      choices: [
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Return to briefing for another mission", next: "start", typeText: "Briefing Room" },
      ],
    },

    trajectory_recovery_1: {
      location: "Trajectory Analytics. Vague Spread",
      character: "johnson",
      narrative: `Your disclaimer gets cropped in reshares. People call you “the one who found it first.”

"Uncertainty doesn't travel as fast as certainty," Johnson says.`,
      choicePrefix: "I will",
      choices: [
        { label: "Delete it and verify before sharing next time", next: "trajectory_win", integrity: 5, reputation: -5, typeText: "delete and verify" },
        { label: "Leave it up. At least you said you weren't sure", next: "trajectory_recovery_2", integrity: -5, reputation: -5, typeText: "leave it up" },
      ],
    },

    trajectory_recovery_2: {
      location: "Trajectory Analytics. Correction Orbit",
      character: "johnson",
      narrative: `The quote spreads for an hour before fact-checkers catch it. Johnson replays the fork.

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Verify before sharing next time", next: "trajectory_win", integrity: 0, reputation: 0, typeText: "verify first" },
      ],
    },

    data_vault: {
      location: "Data Vault · Dragons Sublevel 3",
      character: "turing",
      typeChoices: true,
      chatMission: "privacy_dm",
      enter: "Cold air. Lockers of light. Turing already has the thread open.",
      job: "Stop a privacy leak without spreading it further.",
      conflict: { graphic: "leak", title: "The locker leak", situation: "A classmate's phone number and schedule are in a public thread 'as a joke.' Screenshots are already flying.", question: "Report it. Don't repost. Or pass it along?" },
      narrative: `Agent Alan Turing. He helped crack WWII codes and asked whether a machine can think. Already has the hologram thread open.

"Private data isn't yours to broadcast, even as a joke, even if you think you're warning people. Reporting beats amplifying. Pick a solution."`,
      choicePrefix: "I will",
      choices: [
        { label: "Report it to a trusted adult. Don't repost", next: "privacy_win", integrity: 10, reputation: 5, typeText: "report don't repost" },
        { label: "DM the poster to take it down quietly", next: "privacy_recovery_1", integrity: -5, reputation: 0, typeText: "DM the poster" },
        { label: "Share the screenshot so people 'know to avoid them'", next: "privacy_recovery_2", integrity: -15, reputation: -10, typeText: "share the screenshot" },
      ],
    },

    privacy_win: {
      location: "Data Vault. Contained",
      character: "turing",
      lesson: "8.2.2.3",
      enter: "The leak graph freezes. Two more locks glow on the map.",
      narrative: `"Reporting beats amplifying," Turing says. "Private data isn't yours to broadcast. Even when you think you're helping."

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
        { label: "Check the Data Detective Agency", next: "data_detective", typeText: "Data Detective Agency" },
      ],
    },

    privacy_recovery_1: {
      location: "Data Vault. Poster Responds",
      character: "turing",
      narrative: `<strong>What just happened:</strong> You DMed instead of reporting. The leak kept spreading. And now your message is in the screenshots too.

The poster deletes the thread. After calling you “the snitch.” The victim's info is still in chats you can't see. Turing studies the ripple. "Brave. Also leaky. You didn't contain it."`,
      choicePrefix: "I will",
      choices: [
        { label: "Escalate to an adult now that it's worse", next: "privacy_win", integrity: 5, reputation: -5, typeText: "tell an adult now" },
        { label: "Back off and let the group sort it out", next: "privacy_recovery_2", integrity: -10, reputation: -5, typeText: "back off" },
      ],
    },

    privacy_recovery_2: {
      location: "Data Vault. Spread Accelerates",
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
      typeChoices: true,
      chatMission: "punctuation_tone",
      enter: "A gate that scans habits, not courage. Babbage mutters in the static.",
      job: "Lock accounts the new way: unique passwords plus 2FA.",
      conflict: { graphic: "keys", title: "One password, three doors", situation: "A recruit used the same password for school email, a game, and a second account. One crack opens all three.", question: "Unique passwords and 2FA, or one 'strong' password everywhere?" },
      narrative: `Mr. Phil meets you at the gate. Ghostly Babbage mutters, "Garbage in, garbage out." The hologram shows one key opening three locks.

"You already know not to <em>share</em> a password. The trap here is reusing the same one. Unique plus two-factor. That's the new move. Pick a solution."`,
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
      narrative: `The gate opens. Babbage nods once. "You already knew don't-share. The new move is unique passwords plus two-factor auth. Even from friends with 'good reasons.'"

<strong>Golden Rule 3 unlocked: Guard your login.</strong>

Media Chamber and Footprint Gallery still sit on the map. Arena lights if you're ready.`,
      badge: "Gate Champion",
      goldenRule: 3,
      choicePrefix: "I head to the",
      choices: [
        { label: "Compare headlines in the Media Chamber", next: "media_chamber", typeText: "Media Chamber" },
        { label: "Walk the Footprint Gallery", next: "footprint_scene", typeText: "Footprint Gallery" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Tour the Hardware Graveyard", next: "hardware_graveyard", typeText: "Hardware Graveyard" },
      ],
    },

    password_recovery_1: {
      location: "Vault. Gate Ajar",
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
      location: "Vault. Gate Closed",
      character: "guide",
      narrative: `<strong>What just happened:</strong> One cracked password opened school email, a game, and a second account. Strong is not the same as unique.

The gate flickers red. <em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Set unique passwords with two-factor auth", next: "password_win", integrity: 0, reputation: 0, typeText: "unique passwords and 2FA" },
        { label: "Visit the Footprint Gallery", next: "footprint_scene", integrity: 0, reputation: 0, typeText: "Footprint Gallery" },
      ],
    },

    footprint_scene: {
      location: "Hall of Mirrors · Digital Footprint Gallery",
      character: "campbell",
      typeChoices: true,
      chatMission: "misunderstood_tone",
      enter: "Two drafts of the same post. One kind. One 'just a joke.'",
      job: "Choose the post you'd still stand behind in ten years.",
      conflict: { graphic: "post", title: "Two drafts", situation: "Same moment. One reply is kind. One tags someone to embarrass them. 'just a joke.'", question: "Which version still represents you later?" },
      narrative: `Campbell holds the hologram: two drafts. "The internet remembers slowly. But it remembers. Digital citizenship isn't only avoiding harm. Sometimes it means showing up. Which draft do you post?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Post the version I'd stand behind later", next: "footprint_win", integrity: 10, reputation: 5, typeText: "post the kind version" },
        { label: "Post nothing and stay out of the drama", next: "footprint_recovery_1", integrity: 0, reputation: -5, typeText: "post nothing" },
        { label: "Join the pile-on. Everyone else is", next: "footprint_recovery_2", integrity: -15, reputation: -15, typeText: "join the pile-on" },
      ],
    },

    footprint_win: {
      location: "Hall of Mirrors. Clear Reflection",
      character: "campbell",
      lesson: "8.2.1.1",
      enter: "The mean draft dissolves. Your reflection stays.",
      narrative: `"The internet remembers slowly. But it remembers," Campbell says. "You chose the long view."

<strong>Golden Rule 4 unlocked: Think before you post.</strong>

Media Chamber is the last Rule for a lot of cadets. Then the Arena.`,
      badge: "Thoughtful Citizen",
      goldenRule: 4,
      choicePrefix: "I head to the",
      choices: [
        { label: "Compare headlines in the Media Chamber", next: "media_chamber", typeText: "Media Chamber" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Browse the Open Source Bazaar", next: "open_source", typeText: "Open Source Bazaar" },
      ],
    },

    footprint_recovery_1: {
      location: "Hall of Mirrors. Missed Chance",
      character: "campbell",
      narrative: `<strong>What just happened:</strong> Sitting it out didn't make you the bully. And it didn't help. The mean post is still up, and they noticed nobody spoke up.

"Not harming is baseline," Campbell says. "Digital citizenship sometimes means showing up."`,
      choicePrefix: "I will",
      choices: [
        { label: "Speak up now and support them privately too", next: "footprint_win", integrity: 5, reputation: 0, typeText: "speak up now" },
        { label: "Keep my head down and move on", next: "footprint_recovery_2", integrity: -5, reputation: -5, typeText: "keep my head down" },
      ],
    },

    footprint_recovery_2: {
      location: "Hall of Mirrors. Aftermath",
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
      character: "noble",
      enter: "Three headlines. Same event. Three totally different stories.",
      job: "Decode three headlines before you pick a side.",
      conflict: { graphic: "headlines", title: "Same event, three stories", situation: "One headline is sourced. One is breathless. One is ALL CAPS with a question mark. The group chat is already picking sides.", question: "Compare sources, or share the loudest one?" },
      narrative: `Dr. Safiya U. Noble. She proved search and headlines are designed, not a neutral mirror. Taps three hologram cards.

"Who made it? Who profits if you believe it? What's the evidence? Search ranks a story. That rank is a choice. Pick a solution before the chat fills in fake details."`,
      choicePrefix: "I will",
      choices: [
        { label: "Compare sources and evidence before picking a side", next: "media_win", integrity: 10, reputation: 5, typeText: "compare the sources" },
        { label: "Wait for more outlets before I say anything", next: "media_recovery_1", integrity: 0, reputation: -5, typeText: "wait and stay quiet" },
        { label: "Share the most shocking headline. It's moving fast", next: "media_recovery_2", integrity: -10, reputation: -10, typeText: "share the shocking one" },
      ],
    },

    media_win: {
      location: "Media Chamber. Picture Clears",
      character: "noble",
      lesson: "8.2.2.4",
      enter: "The ALL CAPS headline peels away. The sourced one stays.",
      narrative: `"Same event, three stories," Noble says. "You looked past the packaging. The loudest result is not the truest one."

<strong>Golden Rule 5 unlocked: Decode media.</strong>

If you've got the set, the Arena is calling. Lovelace also offers a mentor path. Teach the next cadet. Noble keeps her search archive if you want the full story.`,
      badge: "Media Decoder",
      goldenRule: 5,
      choicePrefix: "I will",
      choices: [
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Take the mentor path. Teach what I learned", next: "mentor_ending", typeText: "Mentor Hall" },
        { label: "Ask Noble why search isn't a mirror", next: "noble_deep", typeText: "Noble Deep Dive" },
      ],
    },

    media_recovery_1: {
      location: "Media Chamber. Missed Window",
      character: "noble",
      narrative: `<strong>What just happened:</strong> Waiting felt careful. While you waited, the group chat filled in the blanks. Including details that were never true.

"Caution is wise," Noble says. "Silence in a group chat can look like agreement. And the algorithm will fill the quiet with whatever gets clicks."`,
      choicePrefix: "I will",
      choices: [
        { label: "Compare sources now and correct the record", next: "media_win", integrity: 5, reputation: 0, typeText: "compare the sources" },
        { label: "Let it pass. The conversation moved on", next: "media_recovery_2", integrity: -5, reputation: -5, typeText: "let it pass" },
      ],
    },

    media_recovery_2: {
      location: "Media Chamber. Noise Floor",
      character: "noble",
      narrative: `"Who made it? What's the evidence? Who else covered it?" Noble asks. "Run the checklist. Rank is not truth."

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Compare sources before sharing", next: "media_win", integrity: 0, reputation: 0, typeText: "compare the sources" },
      ],
    },

    ai_ethics: {
      location: "AI Ethics Lab · Cambridge, MA",
      character: "buolamwini",
      enter: "A face-scanner demo. It works. On some faces.",
      job: "Don't ship a scanner that only works on some faces.",
      conflict: { graphic: "faces", title: "Good enough?", situation: "Face unlock works on people who look like the engineers. Fails on everyone else. The team says accuracy is good enough for launch.", question: "Test diverse faces first, or ship and patch later?" },
      narrative: `Joy Buolamwini. She proved many face scanners fail on darker skin. Pulls the hologram scanner.

"I wore a white mask in a lab so a camera would see me. That's not a joke. That's a design failure. Machines learn what we show them. Narrow data, narrow machine. Ship, delay, or demand a real fix?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Insist they test on diverse faces before launch", next: "ai_ethics_win", integrity: 10, reputation: 5, typeText: "test diverse faces first" },
        { label: "Delay launch for an internal bias audit", next: "ai_ethics_recovery_1", integrity: 0, reputation: -5, typeText: "delay for an audit" },
        { label: "Ship it. We can patch fairness later", next: "ai_ethics_recovery_2", integrity: -15, reputation: -10, typeText: "ship it anyway" },
      ],
    },

    ai_ethics_win: {
      location: "AI Ethics Lab. Fix Approved",
      character: "buolamwini",
      lesson: "8.3.3.1",
      narrative: `"Coded gaze," Joy says. "If the training set is a club, the model is a bouncer. You just made them test the whole room."

A bulletin from Bias Detection lights the board. Joy also keeps her Gender Shades archive if you want the full story.`,
      badge: "Fairness Advocate",
      choicePrefix: "I head to the",
      choices: [
        { label: "Head to the Bias Detection Unit", next: "bias_unit", typeText: "Bias Detection Unit" },
        { label: "Report to the Collaboration Bridge", next: "collaboration_bridge", typeText: "Collaboration Bridge" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
        { label: "Ask Joy about Gender Shades", next: "buolamwini_deep", typeText: "Buolamwini Deep Dive" },
      ],
    },

    ai_ethics_recovery_1: {
      location: "AI Ethics Lab. Internal Audit",
      character: "buolamwini",
      narrative: `The audit finds bias. Then leadership buries the report. Joy taps the screen.

"Delay without sunlight just hides the problem. I published. That's why people heard me."`,
      choicePrefix: "I will",
      choices: [
        { label: "Push the audit public and demand diverse testing", next: "ai_ethics_win", integrity: 5, reputation: -5, typeText: "make the audit public" },
        { label: "Accept the cover-up and move on", next: "ai_ethics_recovery_2", integrity: -10, reputation: -5, typeText: "stay quiet" },
      ],
    },

    ai_ethics_recovery_2: {
      location: "AI Ethics Lab. Launch Day",
      character: "buolamwini",
      narrative: `Noon headline: "App can't recognize half its users." Joy rewinds the tape.

<em>Rewind available.</em>`,
      choicePrefix: "I will",
      choices: [
        { label: "Demand diverse testing before anything ships", next: "ai_ethics_win", integrity: 0, reputation: 0, typeText: "test diverse faces first" },
      ],
    },

    hardware_graveyard: {
      location: "Hardware Graveyard · Old Dragons Storage",
      character: "babbage",
      enter: "Dust. Dead screens. One phone that still buzzes.",
      job: "Wipe devices the right way before they leave the building.",
      conflict: { graphic: "phones", title: "Still buzzing", situation: "A discarded phone still has photos, messages, and location history. It was tossed in e-waste without a wipe.", question: "Report and wipe properly, or walk away?" },
      narrative: `Babbage picks up the buzzing hologram-phone. "Data outlives hardware. Someone tossed this without erasing it. Warn the team, DIY-wipe it, or walk away?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Report it and follow secure disposal protocol", next: "hardware_win", integrity: 10, reputation: 5, typeText: "report and wipe properly" },
        { label: "Wipe it myself before telling anyone", next: "hardware_recovery_1", integrity: -5, reputation: 0, typeText: "wipe it myself" },
        { label: "Leave it. Not my problem", next: "hardware_recovery_2", integrity: -10, reputation: -5, typeText: "leave it" },
      ],
    },

    hardware_win: {
      location: "Hardware Graveyard. Secured",
      character: "babbage",
      lesson: "8.2.2.3",
      narrative: `"Data outlives the device," Babbage says. "Erase before you discard."

A trail of old posts leads toward the Footprint Gallery. Password Vault is the other lock on this track. Gladys West also keeps her Earth-model archive here. GPS starts with her math, and location is personal.`,
      badge: "Data Destroyer",
      goldenRule: 2,
      choicePrefix: "I head to the",
      choices: [
        { label: "Walk the Footprint Gallery", next: "footprint_scene", typeText: "Footprint Gallery" },
        { label: "Visit the Password Vault", next: "password_temple", typeText: "Password Vault" },
        { label: "Ask Gladys West how GPS learned the Earth", next: "west_deep", typeText: "West Deep Dive" },
      ],
    },

    hardware_recovery_1: {
      location: "Hardware Graveyard. Solo Wipe",
      character: "babbage",
      narrative: `You wipe the phone. The rest of the pile is still live. Babbage holds up the next one.

"One hero doesn't scale. Systems scale."`,
      choicePrefix: "I will",
      choices: [
        { label: "Report the whole pile and follow protocol", next: "hardware_win", integrity: 5, reputation: 0, typeText: "report the whole pile" },
        { label: "Move on. I fixed the one in front of me", next: "hardware_recovery_2", integrity: -5, reputation: -5, typeText: "move on" },
      ],
    },

    hardware_recovery_2: {
      location: "Hardware Graveyard. Still Active",
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
      job: "Put the credits back where they belong.",
      conflict: { graphic: "credits", title: "Deleted credits", situation: "Two copies of the same tool. One fork deleted the original names and called it new. The creator is asking questions.", question: "Restore credit, or stay quiet?" },
      narrative: `Hopper points at the hologram: two versions, one missing names. "Open source lives on named shoulders. Call it out, stay quiet, or slap your name on it too?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Credit the original creators and follow the license", next: "open_source_win", integrity: 10, reputation: 5, typeText: "restore the credits" },
        { label: "Stay quiet. Not my project", next: "open_source_recovery_1", integrity: -5, reputation: -5, typeText: "stay quiet" },
        { label: "Add my name to the fork too", next: "open_source_recovery_2", integrity: -15, reputation: -15, typeText: "add my name too" },
      ],
    },

    open_source_win: {
      location: "Open Source Bazaar. Credits Restored",
      character: "hopper",
      lesson: "8.2.2.1",
      narrative: `"Credit isn't optional. It's how open source lives," Hopper says. "You build on shoulders. You name the shoulders."

Down the alley, Crawford is reviewing a video with a suspicious soundtrack. Code Bay still needs a robot programmed if you want the algorithm track.`,
      badge: "License Scholar",
      choicePrefix: "I head to the",
      choices: [
        { label: "Visit the IP Chamber", next: "ip_chamber", typeText: "IP Chamber" },
        { label: "Head to the Code Bay", next: "code_bay", typeText: "Code Bay" },
      ],
    },

    open_source_recovery_1: {
      location: "Open Source Bazaar. Complicit Silence",
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
      location: "Open Source Bazaar. Flame Thread",
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
      job: "Catch a model that treats people differently.",
      conflict: { graphic: "split", title: "Same numbers, different yes", situation: "Two loan screens. Same income, same history. Different approval. The team says overall numbers look fine.", question: "Demand a fairness audit, or leave it running?" },
      narrative: `Johnson zooms the split hologram. "Precision without fairness isn't precision. It's a mirror of what you already fed it. The model won't explain why. What's your solution?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Demand explainability and a fairness audit", next: "bias_win", integrity: 10, reputation: 5, typeText: "demand a fairness audit" },
        { label: "Audit only the one flagged group", next: "bias_recovery_1", integrity: -5, reputation: 0, typeText: "audit one group only" },
        { label: "Leave it. Overall numbers look fine", next: "bias_recovery_2", integrity: -15, reputation: -10, typeText: "leave it running" },
      ],
    },

    bias_win: {
      location: "Bias Detection Unit. Audit Ordered",
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
      location: "Bias Detection Unit. Narrow Audit",
      character: "johnson",
      narrative: `The narrow audit confirms bias for that group. Then the same pattern shows up in groups you didn't check.

"A partial mirror still distorts the face," Johnson says.`,
      choicePrefix: "I will",
      choices: [
        { label: "Expand the audit to full fairness and explainability", next: "bias_win", integrity: 5, reputation: 0, typeText: "expand the audit" },
        { label: "Patch the one group and move on", next: "bias_recovery_2", integrity: -5, reputation: -5, typeText: "patch one group" },
      ],
    },

    bias_recovery_2: {
      location: "Bias Detection Unit. Pattern Confirmed",
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
      character: "sweeney",
      enter: "Three app profiles. One person. Way too much detail.",
      job: "Show how tiny data points build a detailed profile.",
      conflict: { graphic: "profiles", title: "Three apps, one person", situation: "Three apps each guessed something different about the same kid. And sold the guess. A friend shrugs: nothing to hide.", question: "Explain the trail, or say privacy doesn't matter?" },
      narrative: `Latanya Sweeney. She proved “anonymous” data can still name you. Lays three hologram profiles on the table.

"ZIP code. Birth date. Gender. That's all I needed to find a governor in a public health file. Tiny crumbs, giant picture. Your friend thinks privacy is extra. What's your solution?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Explain how tiny data points build a detailed profile", next: "detective_win", integrity: 5, reputation: 5, typeText: "explain the profile" },
        { label: "Agree. If you're not doing anything wrong, privacy is extra", next: "detective_recovery_1", integrity: -10, reputation: -5, typeText: "say privacy doesn't matter" },
      ],
    },

    detective_win: {
      location: "Data Detective Agency. Pattern Broken",
      character: "sweeney",
      lesson: "8.2.2.3",
      narrative: `"Nothing to hide misses the point," Sweeney says. "Privacy is control, not secrets. If the crumbs exist, someone can rebuild you."

<strong>Golden Rule 2 is in reach on this track.</strong> Password Vault and Footprint Gallery complete the set. Sweeney also keeps her re-identification archive.`,
      badge: "Trail Tracker",
      goldenRule: 2,
      choicePrefix: "I head to the",
      choices: [
        { label: "Visit the Password Vault", next: "password_temple", typeText: "Password Vault" },
        { label: "Walk the Footprint Gallery", next: "footprint_scene", typeText: "Footprint Gallery" },
        { label: "Ask Sweeney how she unmasked 'anonymous' data", next: "sweeney_deep", typeText: "Sweeney Deep Dive" },
      ],
    },

    detective_recovery_1: {
      location: "Data Detective Agency. Profile Complete",
      character: "sweeney",
      narrative: `Sweeney builds the puzzle from public posts alone. Address, schedule, habits. All visible.

"Still nothing to hide?"`,
      choicePrefix: "I will",
      choices: [
        { label: "Limit what's shared and review app permissions", next: "detective_win", integrity: 0, reputation: 0, typeText: "lock down permissions" },
      ],
    },

    lovelace_deep: {
      location: "Design Lab. Ada's Archive",
      character: "lovelace",
      enter: "A cabinet of punched cards. Ink and brass.",
      job: "Learn how Ada Lovelace designed the first computer program. So a machine could follow a human plan.",
      conflict: { graphic: "notes", title: "A machine that only did math", situation: "Charles Babbage designed a giant calculator of gears. Most people said: it will add numbers faster. Ada saw a second job hiding in the machine.", question: "What did Ada invent so humans could tell a machine what to do?" },
      narrative: `Ada Lovelace opens a drawer of punched cards. Holes that meant “add this, then that.”

"Babbage built the engine. I wrote the plan. In 1843 I described a sequence of steps the Analytical Engine could follow. The first computer program. I wasn't just speeding up arithmetic. I was giving humans a way to hand a machine a recipe."

She taps a card punched with a music-like pattern. "I also guessed the engine might one day weave music and pictures, not only numbers. That was the breakthrough: software. Instructions. A tool so people can make a machine solve a problem they already understand."

The hologram waits. Type the takeaway when you're ready.`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Ada wrote the first program so machines could follow a plan", next: "lovelace_deep_win", typeText: "Ada wrote the first program" },
      ],
    },

    lovelace_deep_win: {
      location: "Design Lab. Archive Sealed",
      character: "lovelace",
      narrative: `"That's it," Lovelace says. "A program is a human idea, written so a machine can help. Fancy gears don't matter if nobody wrote the plan."`,
      badge: "Lovelace Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    turing_deep: {
      location: "Data Vault. Turing's Archive",
      character: "turing",
      enter: "A file marked ENIGMA. Quiet fans. No rush.",
      job: "Learn how Alan Turing designed tools so people could read secret wartime messages. And later test what “thinking” means.",
      conflict: { graphic: "keys", title: "A code no person could outrun", situation: "In World War II, German Enigma machines scrambled messages every day. Soldiers and ships depended on those messages. Humans with pencils were too slow.", question: "What did Turing design to help people break the code in time?" },
      narrative: `Turing sets a battered Enigma folder on the table.

"The problem was speed. Enigma changed its disguise constantly. If we couldn't read the messages fast, people died. I helped design machines and methods. Bombes, later computers. So a team of humans could search huge possibility spaces and crack the code in hours, not months."

He flips to a later page. "After the war I asked a different design question. Instead of arguing 'Can a machine think?' I built a fair test: talk to it through a screen. If you can't tell the machine from a person, we have to take the question seriously. That Turing Test is a tool for talking about minds without cheating."

He nods at the hologram. "Codes first. Then a test that still helps people argue honestly."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Turing broke codes to save lives", next: "turing_deep_win", typeText: "Turing broke codes to save lives" },
      ],
    },

    turing_deep_win: {
      location: "Data Vault. Archive Sealed",
      character: "turing",
      narrative: `"Machines that help people read the truth. That's the job," Turing says. "The test came later. Same habit: design a tool, don't just argue."`,
      badge: "Turing Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    hopper_deep: {
      location: "Debugging Fleet. Hopper's Museum",
      character: "hopper",
      enter: "Manuals on the wall. English where there used to be only 1s and 0s.",
      job: "Learn how Grace Hopper designed a compiler so more humans could tell computers what to do.",
      conflict: { graphic: "loop", title: "Only the machine's language", situation: "Early programmers wrote in 1s and 0s. One typo crashed the night. Only a few people could even start. Good ideas died in translation.", question: "What did Hopper build so people could write in words?" },
      narrative: `Hopper slaps a glass case. Inside: a moth taped in a logbook. "That's the bug we pulled out of a relay in 1947. 'Debugging' started as a joke. It stuck because the work is real: find the mistake, don't blame the ghost."

She points at a wall of English-like code. "The bigger design was the compiler. Before that, you whispered to the machine in its language. I built a translator so humans could write something closer to words. And the computer would turn it into 1s and 0s. That isn't laziness. That's a door. More people get to have ideas if the tool speaks human first."

"That's the breakthrough: a bridge. People solve problems. The compiler carries the plan across."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Hopper taught computers to read English-like code", next: "hopper_deep_win", typeText: "Hopper taught computers English" },
      ],
    },

    hopper_deep_win: {
      location: "Debugging Fleet. Museum Sealed",
      character: "hopper",
      narrative: `"English-like code means the next good idea can come from someone who never memorized the machine," Hopper says. "That's the point of the tool."`,
      badge: "Hopper Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    johnson_deep: {
      location: "Sources Library. Johnson's Tables",
      character: "johnson",
      enter: "Hand-written trajectory sheets. Pencil graphite on every margin.",
      job: "Learn how Katherine Johnson designed flight paths so astronauts came home.",
      conflict: { graphic: "cities", title: "No second ocean", situation: "A capsule is falling. If the numbers are wrong, it misses the recovery ships by miles. There is no 'try again' in the Atlantic.", question: "What did Johnson do so humans could trust the path?" },
      narrative: `Katherine Johnson spreads a page of numbers she wrote by hand.

"NASA had machines. The astronauts still asked for me. John Glenn wanted the computer checked against a human who understood the problem. Not just a box that printed decimals. I calculated launch windows and re-entry paths for Mercury and Apollo. Friendship 7. Later, the moon work. One wrong digit and the capsule misses the water."

She doesn't puff up. "The breakthrough wasn't magic math. It was a human tool: careful steps, checked twice, designed so people survive. Machines calculate. Someone has to decide what the calculation is for. And whether the answer is safe enough to fly."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Johnson kept astronauts on course", next: "johnson_deep_win", typeText: "Johnson kept astronauts on course" },
      ],
    },

    johnson_deep_win: {
      location: "Sources Library. Wing Sealed",
      character: "johnson",
      narrative: `"Precision is a kindness when lives are on the line," Johnson says. "Check the path. Then let people come home."`,
      badge: "Johnson Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    babbage_deep: {
      location: "Network Closet. Babbage's Workshop",
      character: "babbage",
      enter: "Brass gears in a glass case. A table of numbers with a red X through one row.",
      job: "Learn how Charles Babbage designed a general-purpose computer so people wouldn't drown in bad math.",
      conflict: { graphic: "chart", title: "Tables that lied", situation: "Ships used printed math tables. Humans copied the numbers by hand. Tired copyists made errors. A wrong tide table can wreck a real ship.", question: "What did Babbage design so the machine could redo the math without yawning?" },
      narrative: `Babbage jabs a ruined table. "I was furious. People died on numbers a clerk copied wrong at 2 a.m. So I designed engines. First the Difference Engine, then the Analytical Engine. A machine of gears that could run different jobs, not just one sum."

"That was the idea of a general-purpose computer: one device, many plans. Ada later wrote a program for it. I designed the hardware so humans could stop betting their lives on tired handwriting."

The hologram shows a ship and a brass mill of wheels. "Help people solve the same problem, correctly, every time. That's the breakthrough."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Babbage designed a thinking engine of gears", next: "babbage_deep_win", typeText: "Babbage designed a thinking engine" },
      ],
    },

    babbage_deep_win: {
      location: "Network Closet. Workshop Sealed",
      character: "babbage",
      narrative: `"One engine. Many plans. Fewer wrecks," Babbage says. "That's a tool. Not a toy."`,
      badge: "Babbage Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    wright_deep: {
      location: "Simulation Studio. Wright's Sandbox",
      character: "wright",
      enter: "A tiny city on the table. A toy flood. No one gets wet.",
      job: "Learn how Will Wright designed SimCity so people could practice solving city problems without wrecking a real one.",
      conflict: { graphic: "cities", title: "You can't flood Denver for homework", situation: "Kids want to know: what if we add a power plant here? What if the river rises? In real life, those tests hurt people.", question: "What did Wright build so you can fail safely?" },
      narrative: `Will Wright spins a miniature downtown. Traffic jams. Then a flood. Then undo.

"I built SimCity. And later The Sims. Because some problems are too expensive to practice on real humans. A simulation is a sandbox: you try a design, watch what breaks, try again. That's a technology for thinking. Mayors, students, tinkerers. They get to see systems, not just read about them."

He shrugs at the hologram. "The breakthrough isn't the cute houses. It's permission to fail in a copy of the world so you get wiser before you touch the real one."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Wright built cities you can practice", next: "wright_deep_win", typeText: "Wright built cities you can practice" },
      ],
    },

    wright_deep_win: {
      location: "Simulation Studio. Sandbox Sealed",
      character: "wright",
      narrative: `"Practice in the copy," Wright says. "Then be kinder in the real city."`,
      badge: "Wright Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    meier_deep: {
      location: "Prototype Arena. Meier's Map",
      character: "meier",
      enter: "A world map under glass. A die. A stack of 'what if' cards.",
      job: "Learn how Sid Meier designed Civilization so people could practice history’s hard choices.",
      conflict: { graphic: "dice", title: "History is a one-take movie", situation: "You can't restart the Roman Empire after a bad decision. Textbooks tell you what happened. They rarely let you feel the fork.", question: "What did Meier design so a choice could be tested, fairly?" },
      narrative: `Sid Meier flicks the die, then covers it. "I designed Civilization so you could steer a people across time. Science or armies. Cities or wonders. You see consequences in an afternoon instead of a century."

"My design rule: if a choice isn't fun and fair to test, it isn't ready. That rule is a tool. It protects players from traps. And it teaches that good systems let humans try, learn, and try again."

He nods at the hologram. "The breakthrough is playable history: a sandbox for decisions, not a lecture that only has one ending."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Meier made history playable", next: "meier_deep_win", typeText: "Meier made history playable" },
      ],
    },

    meier_deep_win: {
      location: "Prototype Arena. Map Sealed",
      character: "meier",
      narrative: `"Fun and fair to test," Meier says. "That's how you help humans get smarter without wrecking the timeline."`,
      badge: "Meier Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    campbell_deep: {
      location: "Collaboration Bridge. Campbell's Story Desk",
      character: "campbell",
      enter: "Myths from a dozen cultures pinned to one map. Same shape, different faces.",
      job: "Learn how Joseph Campbell designed a map of stories. A cultural technology for seeing the hero's path.",
      conflict: { graphic: "meme", title: "A thousand faces, one shape", situation: "Fairy tales, movies, and myths look different. Underneath, the same beats keep showing up: a call, helpers, tests, a dark cave, a return with a gift.", question: "What did Campbell write so people could see that pattern on purpose?" },
      narrative: `Joseph Campbell pins another hero on the wall. Same path, new face.

"I spent years reading stories from all over the world. In 1949 I published <em>The Hero with a Thousand Faces</em>. I wasn't inventing a gadget. I was inventing a lens: the Hero's Journey. Call to adventure. Helpers. Tests. A low point. A return home carrying something useful."

"That map is a cultural technology. It helps writers build stories. And it helps you look at your own life, including online life, and ask: who am I becoming in this scene? You're in a story every time you post, join a chat, or walk away. The tool is the perspective. Once you can see the pattern, you can choose a better next step."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Campbell mapped the Hero's Journey", next: "campbell_deep_win", typeText: "Campbell mapped the Hero's Journey" },
      ],
    },

    campbell_deep_win: {
      location: "Collaboration Bridge. Story Desk Sealed",
      character: "campbell",
      narrative: `"A thousand faces. One useful map," Campbell says. "Use it. Then write the next scene on purpose."`,
      badge: "Campbell Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    crawford_deep: {
      location: "IP Chamber. Crawford's Playtest",
      character: "crawford",
      enter: "A game that doesn't keep score in points. It keeps score in what you chose.",
      job: "Learn how Chris Crawford designed games where your choices change the story. Practice for real decisions.",
      conflict: { graphic: "split", title: "A game that only shoots", situation: "Most games in his era rewarded speed and score. They didn't ask: what kind of person are you being? Players left with high scores and no practice at hard talks.", question: "What did Crawford build so a click could mean something?" },
      narrative: `Chris Crawford slides a controller aside. "I wanted games where your choices mattered. Not just your aim. Interactive storytelling. You pick a line. The world answers. That's a design for practicing being a person."

"Balance of Power, later story systems. The breakthrough was treating a game like a conversation. Same energy as the internet: every click is a vote. If the system is honest, you feel the consequence and get wiser without hurting a real classmate."

He taps the hologram. "I designed a tool for empathy-with-rehearsal. That's the technology: choices that teach."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Crawford made choices matter", next: "crawford_deep_win", typeText: "Crawford made choices matter" },
      ],
    },

    crawford_deep_win: {
      location: "IP Chamber. Playtest Sealed",
      character: "crawford",
      narrative: `"If the choice is real, the lesson sticks," Crawford says. "That's why this Gauntlet makes you type a path."`,
      badge: "Crawford Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    conway_deep: {
      location: "Crawford's Bureau. Conway's Grid",
      character: "conway",
      enter: "A grid of cells blinking on and off. No player. Just rules.",
      job: "Learn how John Conway designed the Game of Life so people could see how tiny rules grow huge patterns.",
      conflict: { graphic: "loop", title: "Three tiny laws", situation: "A cell lives or dies from its neighbors. That's almost the whole game. Somehow it makes gliders, cities, and chaos. Same vibe as a rumor in a group chat.", question: "What did Conway invent so humans could watch complexity hatch?" },
      narrative: `John Conway grins at a blinking grid. "I designed the Game of Life in 1970. Not a video game with a hero. A sandbox of cells. Born, survive, or die. Three little rules. Then you watch. Patterns walk. Some explode. Some vanish."

"The breakthrough is a thinking tool: emergence. Small rules, huge outcomes. You can see why one mean comment doesn't stay one mean comment. The neighborhood answers. Scientists, students, tinkerers still use Life to practice seeing systems."

He shrugs. "I gave humans a toy that tells the truth about crowds."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Conway showed small rules grow huge", next: "conway_deep_win", typeText: "Conway showed small rules grow" },
      ],
    },

    conway_deep_win: {
      location: "Systems Bureau. Grid Sealed",
      character: "conway",
      narrative: `"Watch the neighborhood," Conway says. "That's how you help people see a rumor before it eats the chat."`,
      badge: "Conway Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    lamarr_deep: {
      location: "Network Closet. Lamarr's Archive",
      character: "lamarr",
      enter: "A piano roll next to a radio. Notes that jump.",
      job: "Learn how Hedy Lamarr designed hopping radio so a signal could dodge jamming. A building block of Wi-Fi.",
      conflict: { graphic: "wifi", title: "A radio that stayed on one note", situation: "In World War II, a radio-guided torpedo used one frequency. Jam that note and the weapon goes deaf. Ships stay in danger.", question: "What did Lamarr invent so the signal could dodge the jammer?" },
      narrative: `Hedy Lamarr. Movie star by night, inventor by stubbornness. Unrolls a player-piano strip.

"George Antheil and I designed frequency hopping in 1942. The idea: don't sit on one radio channel. Jump. The jammer aims at yesterday's note while the real message has already moved. We meant it for torpedoes. Later engineers used the same idea in Wi-Fi, Bluetooth, and GPS."

She taps the café hologram. "That's the breakthrough: shared air is safer when the signal doesn't stand still. It still isn't private. Hopping hid a weapon. It does not hide your password on open Wi-Fi."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Lamarr taught signals to hop", next: "lamarr_deep_win", typeText: "Lamarr taught signals to hop" },
      ],
    },

    lamarr_deep_win: {
      location: "Network Closet. Archive Sealed",
      character: "lamarr",
      narrative: `"Jump the channel. Guard the login," Lamarr says. "Public air is still shared air."`,
      badge: "Lamarr Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    perlman_deep: {
      location: "Network Closet. Perlman's Switch",
      character: "perlman",
      enter: "Cables looping into a glowing knot. One extra plug and the room hums wrong.",
      job: "Learn how Radia Perlman designed a protocol so the internet doesn't loop forever and melt.",
      conflict: { graphic: "loop", title: "A loop that never sleeps", situation: "Plug two switches together the wrong way and the same packet races in a circle. The network fills with copies of itself. Emails die. Classrooms freeze.", question: "What did Perlman invent so extra cables don't eat the whole net?" },
      narrative: `Radia Perlman. People call her a mother of the internet; she just wanted the cables to behave. Draws a tree on the glass.

"I designed the spanning-tree protocol in the 1980s. Ethernet loves to loop. A loop is a rumor with hardware: the same packet, over and over, until the network melts. Spanning tree picks a safe path and turns extra links into backups. One spine. No forever-circle."

She shrugs at the hologram knot. "The breakthrough is a quiet tool: a rule that keeps a shared network from eating itself. That's digital citizenship at the cable layer. You don't see it. You notice when it's missing."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Perlman stopped networks from looping", next: "perlman_deep_win", typeText: "Perlman stopped networks from looping" },
      ],
    },

    perlman_deep_win: {
      location: "Network Closet. Switch Sealed",
      character: "perlman",
      narrative: `"One safe path. Extra cables as backup," Perlman says. "That's how a shared network stays a tool, not a tantrum."`,
      badge: "Perlman Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    hamilton_deep: {
      location: "Code Bay. Hamilton's Flight Deck",
      character: "hamilton",
      enter: "Stacks of printouts taller than a person. A moon on the wall.",
      job: "Learn how Margaret Hamilton designed Apollo flight software. And helped invent software engineering as a job that keeps people alive.",
      conflict: { graphic: "robot", title: "A landing with no extra RAM", situation: "Apollo 11 is descending. A computer alarm goes off. Too many jobs at once. If the software panics, the astronauts abort. Or worse.", question: "What did Hamilton's team design so the computer could drop extra work and still land?" },
      narrative: `Margaret Hamilton stands next to a pile of code printouts that once was taller than she was.

"My team wrote the software for the Apollo Guidance Computer. Tiny memory. No second chance. During the moon landing a 1202 alarm fired. The computer was overloaded. Our design had priorities: shed the less important jobs, keep the ones that land the ship. The astronauts stayed. The software did its job."

She taps a block of if/then notes. "The breakthrough wasn't just the landing. We treated software as engineering. Tests, documentation, people responsible. Because a bug at that speed is not a joke. Clear steps keep humans alive."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Hamilton's code saved a landing", next: "hamilton_deep_win", typeText: "Hamilton's code saved a landing" },
      ],
    },

    hamilton_deep_win: {
      location: "Code Bay. Flight Deck Sealed",
      character: "hamilton",
      narrative: `"Priorities. Tests. Names on the work," Hamilton says. "That's software engineering. A tool so people come home."`,
      badge: "Hamilton Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    sweeney_deep: {
      location: "Data Detective Agency. Sweeney's Case File",
      character: "sweeney",
      enter: "A 'de-identified' hospital printout. Three columns circled in red.",
      job: "Learn how Latanya Sweeney proved “anonymous” data can still name you.",
      conflict: { graphic: "profiles", title: "Three crumbs, one governor", situation: "A public health file stripped names. It still listed ZIP code, birth date, and gender. A reporter said the data was safe. Sweeney checked.", question: "What did she show about so-called anonymous records?" },
      narrative: `Latanya Sweeney slides a 1997 case file across the table.

"Massachusetts published hospital visits with names removed. They thought that was privacy. I showed that ZIP code, birth date, and gender were enough to find the governor in that file. And enough to uniquely identify most Americans. 'Anonymous' was a hope, not a design."

She fans three app cards. "The breakthrough is a warning tool: if the crumbs exist, someone can rebuild you. Digital citizenship is not 'I have nothing to hide.' It is asking who can join the crumbs. And saying no when the trail is too sharp."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Sweeney unmasked anonymous data", next: "sweeney_deep_win", typeText: "Sweeney unmasked anonymous data" },
      ],
    },

    sweeney_deep_win: {
      location: "Data Detective Agency. Case File Sealed",
      character: "sweeney",
      narrative: `"Privacy is control, not a pinky swear on a spreadsheet," Sweeney says. "If the crumbs exist, assume someone can name you."`,
      badge: "Sweeney Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    buolamwini_deep: {
      location: "AI Ethics Lab. Gender Shades Archive",
      character: "buolamwini",
      enter: "A white mask on a hook. Face-scan heat maps that fail on darker skin.",
      job: "Learn how Joy Buolamwini proved many face scanners fail on darker skin. Then built a league so people get a say.",
      conflict: { graphic: "faces", title: "The camera that needed a mask", situation: "A lab camera tracked faces. Unless the face was Joy's. She put on a white mask. Suddenly she existed to the machine. That's not a glitch. That's a dataset.", question: "What did Joy measure so companies couldn't call the scanner 'good enough'?" },
      narrative: `Joy Buolamwini hangs the white mask back on its hook.

"I was a graduate student at MIT. The face tracker couldn't see me until I wore a mask. So I measured it. Gender Shades tested commercial systems on many faces. Error rates jumped on darker skin. Especially women. The training set was a club. The model was a bouncer."

She opens the Algorithmic Justice League crest. "The breakthrough is a citizenship tool: audit the machine, publish the numbers, demand a fix before launch. Coded gaze isn't destiny. It's a design choice. And people get to vote."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Joy proved scanners miss faces", next: "buolamwini_deep_win", typeText: "Joy proved scanners miss faces" },
      ],
    },

    buolamwini_deep_win: {
      location: "AI Ethics Lab. Archive Sealed",
      character: "buolamwini",
      narrative: `"Test the whole room, not the club," Joy says. "Then publish. Sunlight is part of the tool."`,
      badge: "Buolamwini Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    west_deep: {
      location: "Hardware Graveyard. West's Earth Desk",
      character: "west",
      enter: "Satellite photos. A lumpy globe. A phone map that thinks it knows your block.",
      job: "Learn how Gladys West modeled the shape of the Earth so GPS could work. And why location is personal.",
      conflict: { graphic: "phones", title: "A planet that isn't a perfect ball", situation: "Satellites can time a signal. If you pretend Earth is a smooth orange, the map is off. Sometimes by a building, sometimes by a hillside. Missiles, ships, and later phones all need the real shape.", question: "What did West calculate so a location could be trusted?" },
      narrative: `Dr. Gladys West. Mathematician at a Navy lab, not a household name for decades. Sets a lumpy Earth on the desk.

"I spent years modeling the geoid: the real, slightly squashed, lumpy shape of the planet. That math went into GPS. Your phone's blue dot is standing on my numbers. The breakthrough is a location tool accurate enough to guide ships. And later, accurate enough to follow a person."

She glances at the discarded phone still buzzing with history. "That's the citizenship part. GPS is a gift until someone else owns your trail. Wipe devices. Ask who is collecting the dot. The Earth model was for navigation. It was not an invitation to track kids."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "West modeled Earth so GPS could work", next: "west_deep_win", typeText: "West modeled Earth for GPS" },
      ],
    },

    west_deep_win: {
      location: "Hardware Graveyard. Earth Desk Sealed",
      character: "west",
      narrative: `"The map is a tool," West says. "The trail it leaves is personal. Treat the dot like a diary."`,
      badge: "West Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    noble_deep: {
      location: "Media Chamber. Noble's Search Desk",
      character: "noble",
      enter: "A search bar. First page glowing. What didn't rank sits in the dark.",
      job: "Learn how Safiya U. Noble showed that search results and headlines are designed. Not a neutral mirror.",
      conflict: { graphic: "headlines", title: "The first page feels like truth", situation: "You type a question. Ten blue links appear. It feels like the world answered. Nobody told you a company ranked those links to keep you clicking.", question: "What did Noble write so people could see the ranking as a choice?" },
      narrative: `Dr. Safiya U. Noble opens a search that looks helpful. Until you read who it hurts.

"In 2018 I published <em>Algorithms of Oppression</em>. I studied what search engines show when you ask about people. Especially girls and women of color. The results weren't a mirror. They were a design. Ads, old stereotypes, and click-bait rose to the top. Kids treated page one like a fact sheet."

She fans the three headlines. "The breakthrough is a decode tool: ask who built the ranking, who gets paid if you believe it, and what got buried. Digital citizenship is not 'I found it online.' It is 'I checked whether the loudest result earned that spot.'"`,
      choicePrefix: "I learned that",
      choices: [
        { label: "Noble proved search isn't a mirror", next: "noble_deep_win", typeText: "Noble proved search isn't a mirror" },
      ],
    },

    noble_deep_win: {
      location: "Media Chamber. Search Desk Sealed",
      character: "noble",
      narrative: `"Rank is a choice," Noble says. "Decode the packaging. Then decide what you believe."`,
      badge: "Noble Scholar",
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
      job: "Pass the Golden Rules exam, then write your Digital Citizenship Oath.",
      conflict: { graphic: "oath", title: "The Arena", situation: "Mentors you met wait in the holo-ring. Five scenarios flash on the wall. Match each one to the right Golden Rule.", question: "Which rule fits each situation?" },
      narrative: `Mr. Phil's voice fills the Arena. The hologram shows the five Rules as empty rings until you prove you know them.

"Final exam first: five real situations. Pick the Golden Rule that actually applies. Not the one that sounds cool."

When you pass, you'll write your Digital Citizenship Oath in your own words.`,
      goldenRulesQuiz: true,
      typingChallenge: {
        mode: "composition",
        prompt: "Write a short Digital Citizenship Oath (3–5 sentences). Name the Golden Rules you will actually use: Design for people. Protect data. Guard your login. Think before you post. Decode media.",
        minWords: 30,
        next: "victory",
      },
      choices: [],
    },

    mentor_ending: {
      location: "DaVinci Dragons Mentor Hall",
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

    guide_deep: {
      location: "Briefing Room. Host's Archive",
      character: "guide",
      enter: "The alarms dim. Mr. Phil pulls up a folder labeled SIMULATORS.",
      job: "Learn why a typing gauntlet exists for digital citizenship — and what you're really practicing.",
      conflict: { graphic: "sim", title: "Practice before the real post", situation: "In class you can rewind a choice. Online you often cannot. The Gauntlet is a flight simulator for your reputation.", question: "What are you training when you type a path instead of clicking a button?" },
      narrative: `Mr. Phil leans on the holo-table. "I didn't build this because typing is the whole job. I built it because <strong>slowing down</strong> is the skill."

"When you type the path to a door, your brain has to read the choice, spell it, and commit. That's the same pause you need before you post, reply, or share a screenshot."

He taps the campus map. "Every room is a real conflict: privacy leaks, pile-ons, fake headlines, biased AI. The mentors aren't decoration. They're the people who solved versions of these problems."

"The breakthrough: citizenship isn't a poster on the wall. It's a habit. The Gauntlet is where you rehearse the habit until it feels normal."`,
      choicePrefix: "I learned that",
      choices: [
        { label: "The Gauntlet trains pause-before-you-post", next: "guide_deep_win", typeText: "The Gauntlet trains pause-before-you-post" },
      ],
    },

    guide_deep_win: {
      location: "Briefing Room. Archive Sealed",
      character: "guide",
      narrative: `"Type the path. Think on your feet. Then do the same thing when it counts," Mr. Phil says.`,
      badge: "Host Scholar",
      choicePrefix: "I will",
      choices: [
        { label: "Return to briefing", next: "start", typeText: "Briefing Room" },
        { label: "Enter the Final Trial", next: "final_trial", typeText: "Final Trial" },
      ],
    },

    mission_fail: {
      location: "DaVinci Dragons. Mission Suspended",
      character: "guide",
      ending: true,
      endingType: "fail",
      enter: "The alarms don't stop. The badge goes dark.",
      narrative: `Mr. Phil pulls the mission log off your screen. Too many wrong calls. Integrity collapsed.

<strong>The Golden Rules are still out there. But this run is over.</strong>

Wrong choices have real consequences online too. Play again: slower, sharper, and think before you click.`,
      choices: [
        { label: "Try again", next: "start", typeText: "try again" },
      ],
    },

    victory: {
      location: "DaVinci Dragons. Mission Complete",
      character: "guide",
      ending: true,
      endingType: "champion",
      enter: "The five Rules line up. The alarms finally go quiet.",
      narrative: `The five Golden Rules lock onto the main screen:

<strong>Design for people.</strong> <strong>Protect data.</strong> <strong>Guard your login.</strong>
<strong>Think before you post.</strong> <strong>Decode media.</strong>

Mr. Phil grins. "Gauntlet champion. You didn't mash the 'right' button. You thought like a citizen."

Play again. The side missions scramble. The Rules don't.`,
      choices: [
        { label: "Play again", next: "start", typeText: "play again" },
      ],
    },
  };

  window.TechTrailStory = { STORY, CHARACTERS, START_MISSIONS, GOLDEN_SPINE, MIN_GOLDEN_FOR_SPEEDRUN };
})();
