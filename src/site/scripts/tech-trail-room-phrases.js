/**
 * GTG — per-room typing phrases (one per room exit, track chosen at mission start).
 */
(() => {
  "use strict";

  const ROOM_PHRASES = {
    start: {
      citizen: {
        id: "briefing-citizen",
        title: "Mission briefing",
        meaning: "Five alarms. Five Golden Rules. Pick a door.",
        text: "Pick a room and recover all five Golden Rules of digital citizenship.",
        cadetText: "Recover the five Golden Rules.",
      },
      spark: {
        id: "briefing-spark",
        title: "SPARK briefing",
        meaning: "Show SPARK in every room you enter.",
        text: "SPARK means Success, Positive Attitude, Responsibility, and Kindness.",
        cadetText: "SPARK: Success, Attitude, Responsibility, Kindness.",
      },
    },
    design_lab: {
      citizen: {
        id: "design-lab",
        title: "Design for people",
        meaning: "Interview users before ship-it Friday.",
        text: "Interview real users before you ship an app nobody asked for.",
        cadetText: "Interview users before you ship.",
      },
      spark: {
        id: "spark-design",
        title: "SPARK · Success",
        meaning: "Success means trying the hard part: ask users first.",
        text: "Success in class means trying the hard part until it works.",
        cadetText: "Try the hard part in class.",
      },
    },
    data_vault: {
      citizen: {
        id: "vault-privacy",
        title: "Protect private data",
        meaning: "A locker leak is not content to share.",
        text: "Report a private leak. Do not repost screenshots of someone's info.",
        cadetText: "Report leaks. Do not repost.",
      },
      spark: {
        id: "spark-vault",
        title: "SPARK · Responsibility",
        meaning: "Own what you share and what you pass along.",
        text: "Responsibility means owning what you type, post, and share.",
        cadetText: "Own what you share online.",
      },
    },
    password_temple: {
      citizen: {
        id: "unique-2fa",
        title: "Guard your login",
        meaning: "Shared passwords and sticky notes fail audits.",
        text: "Use unique passwords and two factor authentication, or 2FA.",
        cadetText: "Unique passwords and 2FA.",
      },
      spark: {
        id: "spark-password",
        title: "SPARK · Responsibility",
        meaning: "Lock your accounts like you lock your locker.",
        text: "Responsibility in class means protecting your login and your work.",
        cadetText: "Protect your login in class.",
      },
    },
    footprint_scene: {
      citizen: {
        id: "footprint",
        title: "Think before you post",
        meaning: "A screenshot outlasts the group chat.",
        text: "Think before you post. The internet remembers.",
        cadetText: "The internet remembers.",
      },
      spark: {
        id: "spark-footprint",
        title: "SPARK · Kindness",
        meaning: "Kind posts age better than hot takes.",
        text: "Kindness in class means lifting others up online too.",
        cadetText: "Lift others up online.",
      },
    },
    media_chamber: {
      citizen: {
        id: "decode",
        title: "Decode media",
        meaning: "Three headlines. One event. Find the source.",
        text: "Decode the headline. Check the source before you share.",
        cadetText: "Check the source first.",
      },
      spark: {
        id: "spark-media",
        title: "SPARK · Positive Attitude",
        meaning: "Curiosity beats panic-sharing.",
        text: "Positive attitude means checking facts before you forward a rumor.",
        cadetText: "Check facts before you share.",
      },
    },
    prepare_phase: {
      citizen: {
        id: "prepare",
        title: "Name the problem",
        meaning: "Plain language beats buzzwords on the whiteboard.",
        text: "Name the real problem in plain language before you build.",
        cadetText: "Name the real problem first.",
      },
      spark: {
        id: "spark-prepare",
        title: "SPARK · Success",
        meaning: "A clear plan is the first win.",
        text: "Success in class starts with a plan you can explain out loud.",
        cadetText: "Start with a clear plan.",
      },
    },
    try_phase: {
      citizen: {
        id: "try-test",
        title: "Test honestly",
        meaning: "Real users behind the glass. Do not hide the bug.",
        text: "Watch where users get stuck. Do not patch the bug in secret.",
        cadetText: "Watch users. Do not hide bugs.",
      },
      spark: {
        id: "spark-try",
        title: "SPARK · Positive Attitude",
        meaning: "Mistakes in testing are data, not doom.",
        text: "Positive attitude in class: mistakes are data, not doom.",
        cadetText: "Mistakes are data in class.",
      },
    },
    debug_scene: {
      citizen: {
        id: "debug",
        title: "Debug the truth",
        meaning: "Trace the loop. Do not mash random lines.",
        text: "Read the error. Fix one thing at a time.",
        cadetText: "Fix one thing at a time.",
      },
      spark: {
        id: "spark-debug",
        title: "SPARK · Success",
        meaning: "Stick with the hard bug until the logic makes sense.",
        text: "Success in class means staying with the hard part until it works.",
        cadetText: "Stay with the hard part.",
      },
    },
    reflect_phase: {
      citizen: {
        id: "reflect",
        title: "Honest reflection",
        meaning: "Say what version two should fix. No spin.",
        text: "Write what worked, what failed, and what you would change next.",
        cadetText: "Write what you would change.",
      },
      spark: {
        id: "spark-reflect",
        title: "SPARK · Positive Attitude",
        meaning: "Honest feedback helps the whole team.",
        text: "Positive attitude means honest feedback that helps the team improve.",
        cadetText: "Give honest feedback in class.",
      },
    },
    code_bay: {
      citizen: {
        id: "code-steps",
        title: "Clear instructions",
        meaning: "The robot needs steps, not vibes.",
        text: "Write ordered steps with clear if and then decisions.",
        cadetText: "Write clear step by step instructions.",
      },
      spark: {
        id: "spark-code",
        title: "SPARK · Success",
        meaning: "Clear steps beat lucky guesses.",
        text: "Success in class means clear steps, not lucky guesses.",
        cadetText: "Use clear steps in class.",
      },
    },
    network_closet: {
      citizen: {
        id: "wifi",
        title: "Shared air",
        meaning: "Public Wi-Fi is a hallway. Look for HTTPS.",
        text: "Public Wi-Fi is shared. Look for HTTPS before you log in.",
        cadetText: "Look for HTTPS on public Wi-Fi.",
      },
      spark: {
        id: "spark-network",
        title: "SPARK · Responsibility",
        meaning: "Do not trade speed for security on a stranger's network.",
        text: "Responsibility means waiting for a trusted network when it matters.",
        cadetText: "Use a trusted network.",
      },
    },
    sources_library: {
      citizen: {
        id: "sources",
        title: "Check the source",
        meaning: "Find the original study before you react.",
        text: "Find the original source before you comment or repost.",
        cadetText: "Find the original source first.",
      },
      spark: {
        id: "spark-sources",
        title: "SPARK · Responsibility",
        meaning: "Credit the source, then share.",
        text: "Show SPARK: credit the source, then share.",
        cadetText: "Credit the source.",
      },
    },
    ip_chamber: {
      citizen: {
        id: "credit",
        title: "Credit and permission",
        meaning: "School projects still need real permission for music.",
        text: "Get real permission for music and art, or use a license you can prove.",
        cadetText: "Get real permission for art.",
      },
      spark: {
        id: "spark-ip",
        title: "SPARK · Responsibility",
        meaning: "Inspiration is not the same as permission.",
        text: "Show SPARK: credit the creator, then share.",
        cadetText: "Credit the creator.",
      },
    },
    collaboration_bridge: {
      citizen: {
        id: "collab",
        title: "Show up",
        meaning: "When chat turns mean, silence is a choice too.",
        text: "Back someone up in the thread and tell a trusted adult.",
        cadetText: "Back them up and tell an adult.",
      },
      spark: {
        id: "spark-collab",
        title: "SPARK · Kindness",
        meaning: "Help without doing their work for them.",
        text: "Show SPARK: help a classmate without copying their work.",
        cadetText: "Help, do not copy.",
      },
    },
    trajectory_scene: {
      citizen: {
        id: "verify-quote",
        meaning: "Famous quotes need citations, not vibes.",
        title: "Verify first",
        text: "Check reliable sources before you share a quote online.",
        cadetText: "Verify quotes before you share.",
      },
      spark: {
        id: "spark-trajectory",
        title: "SPARK · Responsibility",
        meaning: "Do not forward rumors with a disclaimer.",
        text: "Show SPARK: report a mean comment, do not pile on.",
        cadetText: "Report it. Do not pile on.",
      },
    },
    ai_ethics: {
      citizen: {
        id: "ai-fair",
        title: "Test for everyone",
        meaning: "A scanner that fails on some faces is not ready to ship.",
        text: "Test face tools on diverse faces before you launch them.",
        cadetText: "Test on diverse faces first.",
      },
      spark: {
        id: "spark-ai",
        title: "SPARK · Kindness",
        meaning: "Fair tools treat every student with respect.",
        text: "Kindness in class means tools that work for everyone in the room.",
        cadetText: "Build for everyone in class.",
      },
    },
    hardware_graveyard: {
      citizen: {
        id: "wipe-devices",
        title: "Wipe before discard",
        meaning: "Old phones still hold photos and messages.",
        text: "Wipe old devices the right way before they leave your hands.",
        cadetText: "Wipe devices before you discard them.",
      },
      spark: {
        id: "spark-hardware",
        title: "SPARK · Responsibility",
        meaning: "Someone else's data on old hardware is still your job to protect.",
        text: "Responsibility means wiping devices before they are tossed out.",
        cadetText: "Wipe devices before tossing them.",
      },
    },
    open_source: {
      citizen: {
        id: "oss-credit",
        title: "Restore credit",
        meaning: "Open source still has authors' names on it.",
        text: "Put the credits back where they belong before you call it new.",
        cadetText: "Restore the credits file.",
      },
      spark: {
        id: "spark-oss",
        title: "SPARK · Responsibility",
        meaning: "Sharing code means sharing credit.",
        text: "Show SPARK: credit the source, then share.",
        cadetText: "Credit the source.",
      },
    },
    bias_unit: {
      citizen: {
        id: "bias",
        title: "Check the pattern",
        meaning: "Same numbers can hide different outcomes.",
        text: "Demand a fairness audit when the model treats people differently.",
        cadetText: "Demand a fairness audit.",
      },
      spark: {
        id: "spark-bias",
        title: "SPARK · Positive Attitude",
        meaning: "Question charts that look fine at a glance.",
        text: "Positive attitude means asking if the results are fair for everyone.",
        cadetText: "Ask if results are fair.",
      },
    },
    data_detective: {
      citizen: {
        id: "detective",
        title: "Follow the data trail",
        meaning: "Three apps can build one profile.",
        text: "Explain how tiny data points can add up to a profile about someone.",
        cadetText: "Small clues can build a profile.",
      },
      spark: {
        id: "spark-detective",
        title: "SPARK · Responsibility",
        meaning: "I have nothing to hide is not the same as I have nothing to lose.",
        text: "Responsibility means explaining the trail when a friend says privacy does not matter.",
        cadetText: "Explain why privacy matters.",
      },
    },
    final_trial: {
      citizen: {
        id: "oath",
        title: "Digital Citizenship Oath",
        meaning: "Promise what you will actually do online.",
        text: "Be a good digital citizen. Pause before you post.",
        cadetText: "Pause before you post.",
      },
      spark: {
        id: "spark-final",
        title: "SPARK oath",
        meaning: "Carry SPARK into the hallway and the group chat.",
        text: "SPARK: Success, Positive Attitude, Responsibility, and Kindness.",
        cadetText: "SPARK in class and online.",
      },
    },
  };

  window.TechTrailRoomPhrases = { ROOM_PHRASES };
})();
