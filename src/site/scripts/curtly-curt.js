(function () {
  "use strict";

  // Change this passphrase before sharing the link with Curt
  const PASSPHRASE = "miserablesorcerer";
  const SESSION_KEY = "curtly-curt-auth";

  const QUESTIONS = [
    {
      category: "Steam & aliases",
      stem: 'Curt\'s Steam name is "egirl_inspector".',
      type: "tf",
      answer: false,
      explain:
        "False — it's egirl respecter (@saint_gut_free). Inspector was never canon.",
    },
    {
      category: "Steam & aliases",
      stem: "His usernames have included ratboy, miserable sorcerer, egirl respecter, and dicksvansanddykes.",
      type: "tf",
      answer: false,
      explain:
        "False — no dicksvansanddykes. Real aliases include ratboy, miserable sorcerer, egirl respecter, and cj snausages on Steam.",
    },
    {
      category: "Origin lore",
      stem: "Curt got his addiction for texting way back in AIM.",
      type: "tf",
      answer: true,
      explain: "True. The sacred art of being online was learned in the AOL era.",
    },
    {
      category: "Origin lore",
      stem: "Who was Curt's first crush?",
      type: "mc",
      choices: ["Stephanie", "Samantha", "Tiffany"],
      answer: "Tiffany",
      explain: "Tiffany. The OG.",
    },
    {
      category: "Childhood",
      stem: "Curt wasn't allowed to watch The Power Rangers.",
      type: "tf",
      answer: true,
      explain: "True. Morpher denied.",
    },
    {
      category: "Politics",
      stem: "Curt believes in communism.",
      type: "tf",
      answer: true,
      explain: "True. Read the theory, respect the struggle.",
    },
    {
      category: "Steam library",
      stem: "Which is NOT one of his top games?",
      type: "mc",
      choices: [
        "Warhammer: Rogue Trader",
        "Satisfactory",
        "The Binding of Isaac",
      ],
      answer: "Warhammer: Rogue Trader",
      explain:
        "Warhammer: Rogue Trader — not in the top rotation. Isaac and Satisfactory are mainstays on his profile.",
    },
    {
      category: "Steam library",
      stem: "Curt's least favorite game is Faster Than Light.",
      type: "tf",
      answer: false,
      explain:
        "False — FTL is literally his Steam Favorite Game (139+ hrs). Least favorite, he is not.",
    },
    {
      category: "FTL trivia",
      stem: "In FTL — Curt's Steam Favorite Game — what's the default starting ship?",
      type: "mc",
      choices: ["The Kestrel", "The Osprey", "The Raven", "The Basilisk"],
      answer: "The Kestrel",
      explain:
        "The Kestrel — a balanced Federation cruiser. Curt has launched hundreds from this hull.",
    },
    {
      category: "FTL trivia",
      stem: "In FTL, you're delivering vital data to the Federation while fleeing the Rebel fleet.",
      type: "tf",
      answer: true,
      explain:
        "True. Eight sectors, one flagship, infinite panic. The egirl respecter knows the route.",
    },
    {
      category: "Identity",
      stem: "What's Curt's middle name?",
      type: "mc",
      choices: ["Johnathan", "Joseph", "Jerome"],
      answer: "Johnathan",
      explain: "Johnathan. Curt J. Sullivan — the J is not decorative.",
    },
    {
      category: "Identity",
      stem: "Who was Curt's first celebrity crush?",
      type: "mc",
      choices: [
        "Bulma from Dragon Ball Z",
        "Sarah Michelle Gellar",
        "Pamela Andersen",
        "None",
      ],
      answer: "None",
      explain: "None of the above. Curt marched to a different drum.",
    },
    {
      category: "Culture",
      stem: "Curt loves Berserk.",
      type: "tf",
      answer: true,
      explain: "True. Griffith did nothing right, and Curt knows it.",
    },
    {
      category: "Culture",
      stem: "Curt is an avid reader of shitposts on Twitter.",
      type: "tf",
      answer: true,
      explain: "True. The timeline is his literature.",
    },
    {
      category: "Lore",
      stem: "Curt once won a huge stuffed animal at the State Fair.",
      type: "tf",
      answer: false,
      explain: "False. The plushie empire eluded him.",
    },
    {
      category: "Lore",
      stem: "Curt kisses and tells.",
      type: "tf",
      answer: true,
      explain: "True. The man does not gatekeep.",
    },
    {
      category: "Lore",
      stem: "Curt has seen The Odyssey.",
      type: "tf",
      answer: false,
      explain: "False. Homer's epic remains unwatched.",
    },
    {
      category: "Real life",
      stem: "Curt is an organ donor.",
      type: "tf",
      answer: true,
      explain: "True. Generous even in the afterlife.",
    },
    {
      category: "Real life",
      stem: "Curt maintains a membership at the YMCA.",
      type: "tf",
      answer: false,
      explain: "False. He's not a gym bro (in that specific way).",
    },
    {
      category: "Real life",
      stem: "Curt deleted Instagram.",
      type: "tf",
      answer: true,
      explain: "True. Logged off, touched grass (maybe).",
    },
    {
      category: "Steam library",
      stem: "Which game is NOT in his Steam library?",
      type: "mc",
      choices: [
        "Berry Bury Berry",
        "Hotline Miami",
        "Papers, Please",
        "Forbidden Solitaire",
      ],
      answer: "Forbidden Solitaire",
      explain: "Forbidden Solitaire — he does not own this one.",
    },
    {
      category: "Steam library",
      stem: "Curt's most-played game is Realm Grinder at 300 hours.",
      type: "tf",
      answer: false,
      explain: "False — it's Realm Grinder at 429 hours. Idle king behavior.",
    },
    {
      category: "Politics",
      stem: "Curt thinks Charlie Kirk was killed by Israel.",
      type: "tf",
      answer: false,
      explain: "False. He does not hold that belief.",
    },
    {
      category: "Tastes",
      stem: "Curt loves Baldur's Gate.",
      type: "tf",
      answer: true,
      explain: "True. Roll for initiative, roll for friendship.",
    },
    {
      category: "Tastes",
      stem: "Curt loves Brokeback Mountain.",
      type: "tf",
      answer: true,
      explain: "True. A masterpiece. He has taste.",
    },
    {
      category: "Tastes",
      stem: "Curt loves motorcycles.",
      type: "tf",
      answer: true,
      explain: "True. Two wheels, zero apologies.",
    },
    {
      category: "Tastes",
      stem: "Curt doesn't believe in therapy.",
      type: "tf",
      answer: false,
      explain: "False — he does believe in therapy. Take care of your brain.",
    },
  ];

  const RESULT_TIERS = [
    {
      min: 27,
      title: "Blood Brother",
      blurb:
        "You know Curt better than he knows himself. Disturbing. Impressive. The egirl respecter approves.",
    },
    {
      min: 22,
      title: "Inner Circle",
      blurb: "Solid dossier. You've earned a seat at the miserable sorcerer's table.",
    },
    {
      min: 17,
      title: "Steam Friend",
      blurb: "You know the highlights but missed some deep lore. Study the Berserk manga and try again.",
    },
    {
      min: 11,
      title: "Acquaintance",
      blurb: "You'd survive a group chat with Curt, but you wouldn't win trivia night.",
    },
    {
      min: 0,
      title: "Stranger Danger",
      blurb: "Who are you? Curt would like a word. And by a word, he means 27 corrections.",
    },
  ];

  const $ = (sel) => document.querySelector(sel);

  const gate = $("#gate");
  const intro = $("#intro");
  const quiz = $("#quiz");
  const results = $("#results");
  const gateForm = $("#gateForm");
  const gateInput = $("#gateInput");
  const gateError = $("#gateError");
  const startBtn = $("#startBtn");
  const qNum = $("#qNum");
  const qTotal = $("#qTotal");
  const progressBar = $("#progressBar");
  const scorePill = $("#scorePill");
  const qCategory = $("#qCategory");
  const qStem = $("#qStem");
  const choicesEl = $("#choices");
  const feedbackEl = $("#feedback");
  const nextBtn = $("#nextBtn");
  const resultTitle = $("#resultTitle");
  const resultScore = $("#resultScore");
  const resultBlurb = $("#resultBlurb");
  const missedWrap = $("#missedWrap");
  const missedList = $("#missedList");
  const resultTotal = $("#resultTotal");
  const retryBtn = $("#retryBtn");

  let currentIndex = 0;
  let score = 0;
  let answered = false;
  const missed = [];

  qTotal.textContent = QUESTIONS.length;
  if (resultTotal) resultTotal.textContent = QUESTIONS.length;

  function showPanel(panel) {
    [gate, intro, quiz, results].forEach((p) => p.classList.add("cc-hidden"));
    panel.classList.remove("cc-hidden");
  }

  function checkAuth() {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  }

  function grantAuth() {
    sessionStorage.setItem(SESSION_KEY, "1");
  }

  gateForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = gateInput.value.trim().toLowerCase();
    if (val === PASSPHRASE.toLowerCase()) {
      gateError.classList.add("cc-hidden");
      grantAuth();
      showPanel(intro);
    } else {
      gateError.classList.remove("cc-hidden");
      gateInput.value = "";
      gateInput.focus();
    }
  });

  startBtn.addEventListener("click", () => {
    currentIndex = 0;
    score = 0;
    missed.length = 0;
    showPanel(quiz);
    renderQuestion();
  });

  retryBtn.addEventListener("click", () => {
    currentIndex = 0;
    score = 0;
    missed.length = 0;
    showPanel(intro);
  });

  nextBtn.addEventListener("click", () => {
    currentIndex++;
    if (currentIndex >= QUESTIONS.length) {
      showResults();
    } else {
      renderQuestion();
    }
  });

  function normalize(val) {
    if (typeof val === "boolean") return val;
    return String(val).trim().toLowerCase();
  }

  function isCorrect(userAnswer, correctAnswer) {
    if (typeof correctAnswer === "boolean") {
      return userAnswer === correctAnswer;
    }
    return normalize(userAnswer) === normalize(correctAnswer);
  }

  function renderQuestion() {
    answered = false;
    const q = QUESTIONS[currentIndex];

    qNum.textContent = currentIndex + 1;
    const pct = ((currentIndex) / QUESTIONS.length) * 100;
    progressBar.style.width = pct + "%";
    scorePill.textContent = score + " correct";

    qCategory.textContent = q.category;
    qStem.textContent = q.stem;

    feedbackEl.classList.add("cc-hidden");
    feedbackEl.classList.remove("cc-feedback--good");
    nextBtn.classList.add("cc-hidden");
    nextBtn.disabled = true;

    choicesEl.innerHTML = "";

    if (q.type === "tf") {
      ["True", "False"].forEach((label) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cc-choice";
        btn.textContent = label;
        btn.dataset.value = label === "True" ? "true" : "false";
        btn.addEventListener("click", () => pickAnswer(btn, q));
        choicesEl.appendChild(btn);
      });
    } else {
      q.choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cc-choice";
        btn.textContent = choice;
        btn.dataset.value = choice;
        btn.addEventListener("click", () => pickAnswer(btn, q));
        choicesEl.appendChild(btn);
      });
    }
  }

  function pickAnswer(btn, q) {
    if (answered) return;
    answered = true;

    let userVal;
    if (q.type === "tf") {
      userVal = btn.dataset.value === "true";
    } else {
      userVal = btn.dataset.value;
    }

    const correct = isCorrect(userVal, q.answer);

    const allBtns = choicesEl.querySelectorAll(".cc-choice");
    allBtns.forEach((b) => (b.disabled = true));

    if (correct) {
      score++;
      btn.classList.add("cc-choice--correct");
      feedbackEl.textContent = "Correct. " + q.explain;
      feedbackEl.classList.add("cc-feedback--good");
    } else {
      btn.classList.add("cc-choice--wrong");
      feedbackEl.textContent = "Wrong. " + q.explain;
      missed.push({ stem: q.stem, explain: q.explain });

      allBtns.forEach((b) => {
        let bVal;
        if (q.type === "tf") {
          bVal = b.dataset.value === "true";
        } else {
          bVal = b.dataset.value;
        }
        if (isCorrect(bVal, q.answer)) {
          b.classList.add("cc-choice--reveal");
        }
      });
    }

    scorePill.textContent = score + " correct";
    feedbackEl.classList.remove("cc-hidden");
    nextBtn.classList.remove("cc-hidden");
    nextBtn.disabled = false;
    nextBtn.textContent =
      currentIndex + 1 >= QUESTIONS.length ? "See results" : "Next question";
  }

  function showResults() {
    progressBar.style.width = "100%";
    showPanel(results);

    resultScore.textContent = score;

    const tier =
      RESULT_TIERS.find((t) => score >= t.min) ||
      RESULT_TIERS[RESULT_TIERS.length - 1];
    resultTitle.textContent = tier.title;
    resultBlurb.textContent = tier.blurb;

    if (missed.length > 0) {
      missedWrap.classList.remove("cc-hidden");
      missedList.innerHTML = "";
      missed.forEach((m) => {
        const li = document.createElement("li");
        li.innerHTML =
          "<strong>" +
          escapeHtml(m.stem) +
          "</strong><br><span style='color:var(--cc-muted)'>" +
          escapeHtml(m.explain) +
          "</span>";
        missedList.appendChild(li);
      });
    } else {
      missedWrap.classList.add("cc-hidden");
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  if (checkAuth()) {
    showPanel(intro);
  } else {
    showPanel(gate);
  }
})();
