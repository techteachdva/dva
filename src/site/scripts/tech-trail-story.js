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
    { label: "Respond to a alert from the Data Vault", next: "data_vault" },
    { label: "Head for the Password Vault — security gate is locked", next: "password_temple" },
    { label: "Investigate strange output in the Code Bay", next: "code_bay" },
    { label: "Help stabilize the Network Closet", next: "network_closet" },
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
        { label: "Ask who will use this and what success looks like for them", next: "define_win" },
        { label: "Focus on adding features — adoption will follow", next: "define_fail" },
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
      ],
    },

    define_fail: {
      location: "Design Lab — Launch Day",
      character: "lovelace",
      narrative: `Launch day arrives. Three people open the app, frown, and leave. The lead checks analytics in silence.

Lovelace doesn't scold you — she rewinds the holo-tape. "Want to try the conversation you skipped?"`,
      choices: [
        { label: "Talk to potential users before changing anything else", next: "define_win" },
        { label: "Move on to the Code Bay instead", next: "code_bay" },
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

You could watch them, patch quietly, or call in help.`,
      rngBadge: { chance: 0.28, badge: "Lucky Roll", message: "The die lands on your number — Meier grins. \"Fortune favors the prepared.\"" },
      choices: [
        { label: "Sit with users, watch where they get stuck, take notes", next: "try_win" },
        { label: "Push the build live and hope nobody notices", next: "try_fail" },
        { label: "Call Grace Hopper's debugging team", next: "debug_scene" },
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

    try_fail: {
      location: "Prototype Arena — Support Queue",
      character: "meier",
      narrative: `Support tickets pile up. One user writes: "I liked the idea. I couldn't get in."

Meier resets the sim. "Same prototype. Different choice?"`,
      choices: [
        { label: "Watch users and document what breaks", next: "try_win" },
        { label: "Get Hopper's team to trace the bug", next: "debug_scene" },
      ],
    },

    debug_scene: {
      location: "Debugging Fleet · USS Hopper",
      character: "hopper",
      narrative: `Hopper taps the screen. "Infinite loop. Classic. You can guess, you can rewrite everything, or you can trace it line by line."

She's already pulled up the log.`,
      choices: [
        { label: "Walk through the logic step by step", next: "debug_win" },
        { label: "Delete the module and rebuild from scratch tonight", next: "debug_fail" },
        { label: "Change random lines until the error message changes", next: "debug_fail" },
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
      ],
    },

    debug_fail: {
      location: "Debugging Fleet — Still Spinning",
      character: "hopper",
      narrative: `"That made two bugs where there was one," Hopper says mildly. "Try the boring way — it works."`,
      choices: [
        { label: "Trace the logic carefully", next: "debug_win" },
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
        { label: "Use ordered steps with clear if/then decisions", next: "code_win" },
        { label: "Let it run random moves until something works", next: "code_fail" },
        { label: "Assume the robot will figure it out", next: "code_fail" },
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

    code_fail: {
      location: "Code Bay — Gridlock",
      character: "meier",
      narrative: `The robot spins, backs into a wall, stops. Meier caps the marker. "Precision beats luck with machines."`,
      choices: [
        { label: "Write clear step-by-step instructions", next: "code_win" },
      ],
    },

    network_closet: {
      location: "Network Closet · Packet Junction",
      character: "babbage",
      narrative: `Babbage adjusts a brass switch. "Your classmate just typed their password into a school project site — on café Wi‑Fi. No padlock icon in the browser."

They're asking you if it's fine because they'll only be a minute.`,
      choices: [
        { label: "Suggest waiting until they're on a trusted network", next: "network_win" },
        { label: "Say it's probably fine — they'll be quick", next: "network_fail" },
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

    network_fail: {
      location: "Network Closet — Packet Sniff",
      character: "babbage",
      narrative: `A training sim shows what an attacker on the same network can see. Unencrypted logins aren't private — even for a minute.`,
      choices: [
        { label: "Recommend a secure connection instead", next: "network_win" },
      ],
    },

    sources_library: {
      location: "Sources Library · Research Archives",
      character: "johnson",
      narrative: `Johnson slides a tablet across the desk. A viral post claims homework destroys brain cells — slick chart, no author, no link to the study.

Your friend already reposted it.`,
      choices: [
        { label: "Look for the original study before reacting", next: "sources_win" },
        { label: "Repost it — the chart looks official", next: "sources_fail" },
        { label: "Assume it's true because everyone shares it", next: "sources_fail" },
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
      ],
    },

    sources_fail: {
      location: "Sources Library — Correction Thread",
      character: "johnson",
      narrative: `Johnson pulls up the original thread. The claim unraveled in the comments — but not before it spread.

"Want to run the check you skipped?"`,
      choices: [
        { label: "Find the original source first", next: "sources_win" },
      ],
    },

    ip_chamber: {
      location: "IP Chamber · Copyright Vault",
      character: "crawford",
      narrative: `You're editing a video for class. The perfect song is on a random upload site — no license info, no credit line.

Your partner says, "Everyone uses it. We'll cut that part out if anyone complains."`,
      choices: [
        { label: "Find royalty-free music or get proper permission", next: "ip_win" },
        { label: "Use it — nobody will notice a school project", next: "ip_fail" },
        { label: "Crop out the watermark on a clip you found", next: "ip_fail" },
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

    ip_fail: {
      location: "IP Chamber — Takedown Notice",
      character: "crawford",
      narrative: `A takedown notice hits the project folder. "Copyright isn't about getting caught," Crawford says. "It's about respect."`,
      choices: [
        { label: "Replace it with licensed or royalty-free work", next: "ip_win" },
      ],
    },

    collaboration_bridge: {
      location: "Collaboration Bridge",
      character: "campbell",
      narrative: `Campbell points at a group chat on the railing display. Someone is being left out of a shared doc — then mocked when they ask why.

You're in the thread. Others are watching to see what you do.`,
      choices: [
        { label: "Back them up and loop in a trusted adult", next: "collab_win" },
        { label: "Stay out of it — not your project", next: "collab_fail" },
        { label: "Add a joke so you fit in", next: "collab_fail" },
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

    collab_fail: {
      location: "Collaboration Bridge — Reset",
      character: "campbell",
      narrative: `The chat keeps going. The excluded person stops typing. Campbell rewinds the scene quietly. "Same bridge. Different you?"`,
      choices: [
        { label: "Speak up and get an adult involved", next: "collab_win" },
      ],
    },

    trajectory_scene: {
      location: "Trajectory Analytics · NASA Sim",
      character: "johnson",
      narrative: `Johnson zooms in on a viral meme — bold quote, famous face, no source. It's already racking up shares.

"Accuracy is a habit," she says. "What do you do first?"`,
      choices: [
        { label: "Check whether the quote appears in reliable sources", next: "trajectory_win" },
        { label: "Share it before the moment passes", next: "trajectory_fail" },
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

    trajectory_fail: {
      location: "Trajectory Analytics — Correction Orbit",
      character: "johnson",
      narrative: `The quote spreads for an hour before fact-checkers catch it. Johnson replays the fork in the path.`,
      choices: [
        { label: "Verify before sharing next time", next: "trajectory_win" },
      ],
    },

    data_vault: {
      location: "Data Vault · ACME Sublevel 3",
      character: "turing",
      narrative: `Turing pulls up a forum thread. Someone posted a classmate's phone number and schedule "as a joke." It's climbing fast.

You have a screenshot. So does everyone else.`,
      choices: [
        { label: "Report it to a trusted adult — don't repost", next: "privacy_win" },
        { label: "Share the screenshot so people know to avoid them", next: "privacy_fail" },
        { label: "DM the poster to take it down yourself", next: "privacy_fail" },
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
      ],
    },

    privacy_fail: {
      location: "Data Vault — Spread Accelerates",
      character: "turing",
      narrative: `Each share widens the leak. Turing freezes the sim. "Harm scales fast online. Try the report route."`,
      choices: [
        { label: "Report to a trusted adult", next: "privacy_win" },
        { label: "Visit the Footprint Gallery", next: "footprint_scene" },
      ],
    },

    password_temple: {
      location: "Vault of Passwords · Security Gate",
      character: "guide",
      narrative: `The gate scans your habits, not your courage. A ghostly Babbage mutters: "Garbage in, garbage out."

A recruit ahead used one password everywhere — including their school email and a game account.`,
      choices: [
        { label: "Use unique passwords and turn on two-factor auth", next: "password_win" },
        { label: "Keep one strong password — easier to remember", next: "password_fail" },
        { label: "Share your login with your best friend for emergencies", next: "password_fail" },
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

    password_fail: {
      location: "Vault — Gate Closed",
      character: "guide",
      narrative: `The gate flickers red. A training clip shows how one cracked password unlocks three accounts. "Try again?"`,
      choices: [
        { label: "Set unique passwords with two-factor auth", next: "password_win" },
        { label: "Visit the Footprint Gallery", next: "footprint_scene" },
      ],
    },

    footprint_scene: {
      location: "Hall of Mirrors · Digital Footprint Gallery",
      character: "campbell",
      narrative: `Campbell holds up two drafts of the same post. One is a thoughtful reply. One tags someone for embarrassment — "just a joke."

"Which version still represents you in ten years?"`,
      choices: [
        { label: "Post the version you'd stand behind later", next: "footprint_win" },
        { label: "Post whatever gets the most reactions tonight", next: "footprint_fail" },
        { label: "Join the pile-on — everyone else is", next: "footprint_fail" },
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

    footprint_fail: {
      location: "Hall of Mirrors — Aftermath",
      character: "campbell",
      narrative: `"Likes fade," Campbell says. "Screenshots don't." He offers the draft again.`,
      choices: [
        { label: "Choose the post you'd stand behind", next: "footprint_win" },
        { label: "Head to the Media Chamber", next: "media_chamber" },
      ],
    },

    media_chamber: {
      location: "Media Decoding Chamber",
      character: "crawford",
      narrative: `Three headlines blink side by side about the same event — one breathless, one dry and sourced, one ALL CAPS with a question mark.

Your group chat is picking sides.`,
      choices: [
        { label: "Compare sources and evidence before picking one", next: "media_win" },
        { label: "Share the most shocking headline — it's moving fast", next: "media_fail" },
        { label: "Trust the one that sounds the most confident", next: "media_fail" },
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

    media_fail: {
      location: "Media Chamber — Noise Floor",
      character: "crawford",
      narrative: `"Who made it? What's the evidence? Who else covered it?" Crawford asks. "Run the checklist."`,
      choices: [
        { label: "Compare sources before sharing", next: "media_win" },
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
