/**
 * The story of the night (0.30). When you wake, the chronicle becomes about
 * three pages of credits: where you walked, what hunted you, who you became,
 * what the dream took, what you carried out, and the tally.
 *
 * Every line is a template with slots: "{beast} fell on {land}." Slots carry a
 * kind (beast, arch, land, form, num, card, dream, dreamer, event) so the crawl
 * can glow them in their own colour. Templates are picked by a hash of the seed,
 * so the same night tells the same story and every other night tells its own.
 *
 * Output: [{ kind: "title" | "head" | "line" | "quote" | "gap", parts: [{ text, kind? }] }]
 */

const SUIT_NAME = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower", wild: "Wild" };
const LENGTH_NAME = { daydream: "a Daydream", nap: "a Nap", deep: "a Deep Sleep" };
const NUMBER = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

function hash(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function word(n) {
  return NUMBER[n] ?? String(n);
}

function plural(n, one, many = `${one}s`) {
  return n === 1 ? one : many;
}

/** "{a}, {b} and {c}" as slot-ready parts. */
function listParts(names, kind) {
  const out = [];
  names.forEach((name, i) => {
    if (i > 0) out.push({ text: i === names.length - 1 ? " and " : ", " });
    out.push({ text: name, kind });
  });
  return out;
}

function cardName(c) {
  if (!c) return "a card";
  if (c.s === "wild") return "a Wild";
  return `${SUIT_NAME[c.s] || ""} ${c.n}`.trim();
}

/** Fill "{slot}" templates. slots: { name: [kind, text] | parts[] }. */
function fill(template, slots = {}) {
  const parts = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(template))) {
    if (m.index > last) parts.push({ text: template.slice(last, m.index) });
    const slot = slots[m[1]];
    if (Array.isArray(slot) && slot.length && typeof slot[0] === "object") parts.push(...slot);
    else if (Array.isArray(slot)) parts.push({ text: String(slot[1]), kind: slot[0] });
    else parts.push({ text: String(slot ?? "") });
    last = re.lastIndex;
  }
  if (last < template.length) parts.push({ text: template.slice(last) });
  return parts;
}

function titleCase(text) {
  return String(text).split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function maxBy(list, fn) {
  let best = null;
  let score = -Infinity;
  list.forEach((x) => {
    const s = fn(x);
    if (s > score) { score = s; best = x; }
  });
  return best;
}

function countBy(list, fn) {
  const map = new Map();
  list.forEach((x) => {
    const k = fn(x);
    if (k) map.set(k, (map.get(k) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function buildDreamStory(state, breakdown = null) {
  const key = `${state?.seed || ""}|${state?.gameId || ""}`;
  let n = 0;
  const pick = (salt, list) => list[hash(`${key}|${salt}|${(n += 1)}`) % list.length];

  const out = [];
  const title = (text) => out.push({ kind: "title", parts: [{ text }] });
  const head = (text) => out.push({ kind: "gap", parts: [] }, { kind: "head", parts: [{ text }] });
  const say = (template, slots) => {
    const parts = fill(template, slots).filter((p) => p.text !== "");
    if (parts[0]?.text) parts[0] = { ...parts[0], text: parts[0].text.charAt(0).toUpperCase() + parts[0].text.slice(1) };
    out.push({ kind: "line", parts });
  };
  const quote = (text) => out.push({ kind: "quote", parts: [{ text }] });

  const me = (state?.players || [])[0] || {};
  const dreamer = me.dreamer?.name || me.name || "the Dreamer";
  const chron = state?.chronicle || { events: [], visited: {}, firstVisit: [] };
  const ev = chron.events || [];
  const of = (t) => ev.filter((e) => e.t === t);
  const fights = of("fight");
  const won = fights.filter((f) => f.won);
  const lost = fights.filter((f) => !f.won);
  const afights = of("afight");
  const acquires = [...of("acquire")];
  const deaths = of("death");
  const forgets = of("forget");
  const dusks = of("dusk");
  const dreams = of("dream");
  const buys = of("buy");
  const sets = of("set");
  const wholes = of("whole");
  const arrivals = [...of("arrive")];
  const stats = state?.runStats || {};
  // Older saves have no chronicle: rebuild what we can from the rest of the state.
  if (!acquires.length) {
    (me.acquiredArchetypes || []).forEach((a) => {
      const land = (state.board || []).find((t) => t.id === a.landscapeId)?.name || "";
      acquires.push({ t: "acquire", arch: a.name, land, how: a.defeated ? "fight" : "set", set: "", c: Math.max(1, Math.ceil((a.arrivedRound || 1) / 3)) });
    });
  }
  if (!arrivals.length && state?.nightSpawns) {
    Object.values(state.nightSpawns).flat().forEach((s) => arrivals.push({ t: "arrive", beast: s.name, boss: s.boss }));
  }
  const fightTotals = { n: fights.length || (stats.fightsWon || 0) + (stats.fightsLost || 0), w: fights.length ? won.length : stats.fightsWon || 0, l: fights.length ? lost.length : stats.fightsLost || 0 };
  const felledLadder = (state?.bossesDefeated || []).map((id) => state?.endless?.beastCatalog?.[id]?.name || titleCase(id.replace(/-/g, " ")));
  const planDrawn = (state?.nightPlan?.length || 0) - (state?.dreamDeck?.length || 0);
  const cycles = Math.max(1, Math.ceil(planDrawn / 3), ...ev.map((e) => e.c || 1));
  const rounds = state?.round || 1;
  const lengthName = LENGTH_NAME[state?.lengthKey] || "a night";
  const minutes = Math.max(1, Math.round((Date.now() - (state?.gameStartedAt || Date.now())) / 60000));
  const endless = !!state?.endless;
  const triumph = !!state?.endlessTriumph;

  // ---- I. The falling -------------------------------------------------------------
  // The title always names Ainmos; the credits morph its letters into SOMNIA.
  title("A Night in Ainmos");
  say(pick("open", [
    "You lay down as {dreamer} and let {night} take you.",
    "{dreamer} closed their eyes, and {night} opened its own.",
    "It began, as dreams do, without a beginning. You were {dreamer}, and this was {night}.",
  ]), { dreamer: ["dreamer", dreamer], night: ["event", lengthName] });
  if (me.dreamer?.flavor) quote(`“${me.dreamer.flavor}”`);
  say(pick("length", [
    "{cycles} turned overhead, {rounds} Dreams deep, before the light came back.",
    "You lived {rounds} Dreams across {cycles}. Outside, perhaps {minutes} minutes passed.",
    "The night lasted {rounds} Dreams and {cycles}; the clock on the wall says {minutes} minutes. The clock is lying.",
  ]), {
    cycles: ["num", `${cycles} ${plural(cycles, "Cycle")}`],
    rounds: ["num", rounds],
    minutes: ["num", minutes],
  });

  // ---- II. The Dreamscape ---------------------------------------------------------
  const visits = Object.entries(chron.visited || {}).filter(([id]) => id !== "bed").sort((a, b) => b[1] - a[1]);
  const names = chron.visitNames || {};
  const firstWalk = (chron.firstVisit || [])[0];
  if (firstWalk || visits.length || stats.landscapesPlaced) {
    head(pick("h-land", ["The Dreamscape", "Where You Walked", "The Ground Beneath"]));
    if (firstWalk) {
      say(pick("first-walk", [
        "Your first steps off The Bed led into {land}.",
        "{land} was the first place to hold your weight.",
        "You stepped off The Bed and into {land}, and the dream became real.",
      ]), { land: ["land", firstWalk.name] });
    }
    const fav = visits[0];
    if (fav && fav[1] >= 2) {
      say(pick("fav", [
        "You kept coming back to {land}, {n} times in all, as if it knew your name.",
        "{land} pulled at you most. {n} visits. Something there was yours.",
        "Again and again, {n} times, the path bent back to {land}.",
      ]), { land: ["land", names[fav[0]] || fav[0]], n: ["num", fav[1]] });
    }
    const others = (chron.firstVisit || []).slice(1).map((v) => v.name).filter(Boolean);
    if (others.length >= 2) {
      const shown = others.slice(0, 4);
      say(pick("others", [
        "{list} passed beneath your feet.",
        "You crossed {list}, each stranger than the last.",
      ]), { list: listParts(shown, "land") });
    }
    if (visits.length) {
      say("In all you walked {n} of the twenty-four Landscapes{rest}.", {
        n: ["num", visits.length],
        rest: visits.length >= 20 ? ", nearly every corner of the dream" : visits.length <= 6 ? ", keeping to a small, careful world" : "",
      });
    }
    if (stats.landscapesPlaced) {
      say(pick("placed", [
        "With your own hands you set down {n} Landscapes, building the dream as you dreamed it.",
        "{n} Landscapes rose where you placed them.",
      ]), { n: ["num", stats.landscapesPlaced] });
    }
    if (!wholes.length && state?.dreamscapeResets) {
      say("{n}, the whole dream folded back into The Bed and began again.", { n: ["num", state.dreamscapeResets === 1 ? "Once" : `${word(state.dreamscapeResets)} times`] });
    }
    if (wholes.length) {
      say(wholes.length === 1
        ? "Once, every Landscape stood at the same time. {whole}. Then it folded, and began again."
        : "{n} times the dream stood {whole}, and {n} times it folded back into The Bed.", {
        whole: ["event", "The Dream was Whole"],
        n: ["num", word(wholes.length)],
      });
    }
  }

  // ---- II½. The night, Cycle by Cycle -------------------------------------------
  const byCycle = new Map();
  ev.forEach((e) => {
    if (!byCycle.has(e.c)) byCycle.set(e.c, []);
    byCycle.get(e.c).push(e);
  });
  const walks = (chron.firstVisit || []);
  if (byCycle.size >= 2) {
    head(pick("h-cycles", ["The Night, Cycle by Cycle", "How It Went", "The Long Way Through"]));
    [...byCycle.keys()].sort((a, b) => a - b).slice(0, 15).forEach((c) => {
      const list = byCycle.get(c);
      const bits = [];
      const walked = walks.filter((w) => Math.max(1, Math.ceil((w.r || 1) / 3)) === c).map((w) => w.name).slice(0, 2);
      if (walked.length) bits.push(fill("you found {l}", { l: listParts(walked, "land") }));
      const beat = [...new Set(list.filter((e) => e.t === "fight" && e.won).map((e) => e.beast))].slice(0, 2);
      if (beat.length) bits.push(fill(pick(`cb${c}`, ["you beat {b}", "{b} fell", "you put down {b}"]), { b: listParts(beat, "beast") }));
      const fled = [...new Set(list.filter((e) => e.t === "fight" && !e.won).map((e) => e.beast))].slice(0, 1);
      if (fled.length) bits.push(fill(pick(`cf${c}`, ["{b} beat you back", "you lost to {b}"]), { b: listParts(fled, "beast") }));
      const got = list.filter((e) => e.t === "acquire").map((e) => e.arch);
      if (got.length) bits.push(fill(pick(`ca${c}`, ["{a} joined you", "you won {a}"]), { a: listParts(got, "arch") }));
      if (list.some((e) => e.t === "death")) bits.push([{ text: "you died" }]);
      const lostLand = list.filter((e) => e.t === "forget").map((e) => e.land).slice(0, 2);
      if (lostLand.length) bits.push(fill(lostLand.length === 1 ? "{l} was Forgotten" : "{l} were Forgotten", { l: listParts(lostLand, "land") }));
      if (list.some((e) => e.t === "whole")) bits.push(fill("{w}", { w: ["event", "the Dream stood Whole"] }));
      if (!bits.length) {
        const dream = list.find((e) => e.t === "dream" && !/boss|beast|archetype/i.test(e.kind || ""));
        if (!dream) return;
        bits.push(fill("you endured {d}", { d: ["dream", dream.name] }));
      }
      const parts = [{ text: "Cycle " }, { text: String(c), kind: "num" }, { text: ": " }];
      bits.forEach((b, i) => {
        if (i > 0) parts.push({ text: i === bits.length - 1 ? ", and " : ", " });
        parts.push(...b);
      });
      parts.push({ text: "." });
      out.push({ kind: "line", parts });
    });
  }

  // ---- III. Beasts in the dark ----------------------------------------------------
  if (fightTotals.n || arrivals.length) {
    head(pick("h-beast", ["Beasts in the Dark", "What Hunted You", "Teeth and Shadows"]));
    const arrivedNames = [...new Set(arrivals.map((a) => a.beast))].slice(0, 4);
    if (arrivedNames.length >= 2) {
      say(pick("arrive", [
        "They came one by one: {list}.",
        "The night sent its beasts: {list}, and worse behind them.",
      ]), { list: listParts(arrivedNames, "beast") });
    }
    say(pick("record", [
      fightTotals.l ? "You stood and fought {n} times. You won {w}. You lost {l}." : "You stood and fought {n} times, and never once lost.",
      "{n} fights. {w} won, {l} lost, every one remembered.",
    ]), { n: ["num", fightTotals.n], w: ["num", fightTotals.w], l: ["num", fightTotals.l] });
    const first = won[0];
    if (first) {
      say(pick("first-win", [
        "Your first victory came on {land}, where {beast} fell to {cards}.",
        "On {land}, {beast} was the first to yield, broken by {cards}.",
      ]), {
        land: ["land", first.land],
        beast: ["beast", first.beast],
        cards: listParts((first.cards || []).map(cardName), "card"),
      });
    }
    const best = maxBy(won, (f) => (f.power || 0) * 10 - (f.dice || 0));
    if (best && best !== first) {
      say(pick("best-win", [
        "Your finest hour: {beast} at {power}, felled on {land}{form}.",
        "Nothing shone like the night {beast}, {power}, went down on {land}{form}.",
      ]), {
        beast: ["beast", best.beast],
        power: ["num", `Power ${best.power}`],
        land: ["land", best.land],
        form: best.form ? fill(" with a {f}", { f: ["form", best.form] }) : "",
      });
    }
    const nemesis = countBy(lost, (f) => f.beast)[0];
    if (nemesis && nemesis[1] >= 2) {
      say(pick("nemesis", [
        "{beast} beat you {n} times. You will dream of its face.",
        "{beast} was your nemesis: {n} fights, {n} defeats.",
      ]), { beast: ["beast", nemesis[0]], n: ["num", word(nemesis[1])] });
    } else if (lost.length) {
      const worst = maxBy(lost, (f) => f.power || 0);
      say("{beast} on {land} was the one that got away.", { beast: ["beast", worst.beast], land: ["land", worst.land] });
    }
    const felled = [...new Set([...won.map((f) => f.beast), ...(won.length ? [] : felledLadder)])];
    if (felled.length >= 3) {
      say(pick("felled", ["{list}: all of them fell before you.", "Remember their names: {list}."]), { list: listParts(felled.slice(0, 6), "beast") });
    }
    const lev = won.find((f) => f.id === "leviathan" || f.mega);
    if (lev) {
      say(pick("lev", [
        "And {beast} rose from the deep, and you sent it back down.",
        "When {beast} came up out of the black water, you were waiting.",
      ]), { beast: ["beast", lev.beast] });
    }
  }

  // ---- IV. The Archetypes ---------------------------------------------------------
  if (acquires.length) {
    head(pick("h-arch", ["The Faces You Gathered", "The Archetypes", "Who You Became"]));
    acquires.slice(0, 12).forEach((a, i) => {
      if (a.how === "set" && !a.set) {
        say(pick(`asetx${i}`, ["A finished set of Objects folded in on itself and became {arch}.", "Your Objects spiraled together, and {arch} stepped out of them."]), { arch: ["arch", a.arch] });
        return;
      }
      if (a.how === "set") {
        say(pick(`aset${i}`, [
          "The {set} pieces spiraled together, and from the dark stepped {arch}.",
          "You gave up the {set} set, and {arch} took its shape.",
        ]), { set: ["card", a.set || "set"], arch: ["arch", a.arch] });
        return;
      }
      const slots = { arch: ["arch", a.arch], land: ["land", a.land || "the Dreamscape"], cycle: ["num", `Cycle ${a.c}`] };
      if (!a.land) {
        say(pick(`archx${i}`, ["In {cycle}, {arch} joined you.", "{arch} answered in {cycle}.", "Then came {arch}."]), slots);
        return;
      }
      say(pick(`arch${i}`, i === 0 ? [
        "In {cycle}, on {land}, {arch} was the first to become part of you.",
        "{arch} came first, on {land}, in {cycle}.",
      ] : [
        "{cycle}: {arch}, on {land}.",
        "On {land}, {arch} joined you.",
        "{arch} found you on {land} in {cycle}.",
        "Then {arch}, met on {land}.",
        "{land} gave you {arch}.",
        "{arch} was waiting on {land}, as if it had always known.",
        "By {cycle} you had {arch} too, won on {land}.",
      ]), slots);
    });
    const lostArch = afights.filter((f) => !f.won);
    if (lostArch.length) {
      const stubborn = countBy(lostArch, (f) => f.arch)[0];
      say(pick("arch-lost", [
        "Not all of them came easily. {arch} refused you {n}.",
        "{arch} slipped away {n} before it let you near.",
      ]), { arch: ["arch", stubborn[0]], n: ["num", stubborn[1] === 1 ? "once" : `${word(stubborn[1])} times`] });
    }
    const brights = afights.filter((f) => f.won && f.side === "bright" && f.event).map((f) => f.event);
    if (brights.length) say("You turned {ev} to your side.", { ev: listParts([...new Set(brights)].slice(0, 3), "event") });
    const goal = state?.scoringGoalPoints || state?.goalPoints || 0;
    if (goal && acquires.length >= goal) {
      say(acquires.length >= 12
        ? pick("all12", ["All {n}. Every face of you, gathered in one place.", "{n} Archetypes. You are, for once, entirely yourself."])
        : "{n} Archetypes: enough to wake.", { n: ["num", word(acquires.length)] });
    }
  }

  // ---- V. What the dream took -----------------------------------------------------
  const duskTotal = dusks.reduce((s, d) => s + (d.count || 0), 0);
  const deathCount = deaths.length || me.deathCount || 0;
  if (deathCount || forgets.length || duskTotal || dreams.length) {
    head(pick("h-took", ["What the Dream Took", "The Price", "Losses"]));
    if (deathCount) {
      say(deathCount === 1
        ? pick("death1", ["You died once, {cause}, and woke on The Bed with your hands shaking.", "Once, you came apart {cause}. The Bed caught you."])
        : pick("deathN", ["You died {n} times. The first was {cause}.", "{n} times you fell out of the dream. It always let you back in."]), {
        n: ["num", word(deathCount)],
        cause: deaths[0]?.cause || "in the dark",
      });
    } else {
      say("You never died. Not once.", {});
    }
    if (forgets.length) {
      const lands = [...new Set(forgets.map((f) => f.land))];
      say(pick("forget", [
        forgets.length === 1 ? "{n} was Forgotten: {first}." : "{n} were Forgotten. {first} went first.",
        "The dream forgot {list}, and it did not ask you first.",
      ]), {
        n: ["num", `${forgets.length} ${plural(forgets.length, "Landscape")}`],
        first: ["land", lands[0]],
        list: listParts(lands.slice(0, 4), "land"),
      });
    }
    if (duskTotal) {
      const worst = maxBy(dusks, (d) => d.count || 0);
      say(pick("dusk", [
        "Dusk alone stole {n} Psyche from you.",
        "Every dusk took its toll: {n} Psyche, all told.",
      ]), { n: ["num", duskTotal] });
      if (worst?.count >= 4 && worst.beasts?.length) {
        say("The worst was Cycle {c}, when {list} stood at nightfall and took {n}.", {
          c: ["num", worst.c],
          list: listParts(worst.beasts.slice(0, 3), "beast"),
          n: ["num", worst.count],
        });
      }
    }
    const dreamNames = [...new Set(dreams.filter((d) => !/boss|beast|archetype/i.test(d.kind || "")).map((d) => d.name).filter((nm) => !/Archetype Stirs/i.test(nm)))];
    if (dreamNames.length >= 2) {
      say(pick("dreams", ["The Dreams themselves were cruel: {list}.", "You endured {list}."]), { list: listParts(dreamNames.slice(0, 4), "dream") });
    }
  }

  // ---- VI. What you carried -------------------------------------------------------
  const forms = Object.entries(stats.formsPlayed || {}).sort((a, b) => b[1] - a[1]);
  if (forms.length || buys.length || sets.length || stats.bestSpread) {
    head(pick("h-carry", ["What You Carried", "Your Hands", "Tools of the Trade"]));
    if (forms.length) {
      const [fav, times] = forms[0];
      say(pick("form", [
        "Your hands knew the {form} best: you made it {n}.",
        "When it mattered, you reached for the {form}, {n} in all.",
      ]), { form: ["form", fav[0].toUpperCase() + fav.slice(1)], n: ["num", times === 1 ? "once" : times === 2 ? "twice" : `${times} times`] });
    }
    const bs = stats.bestSpread;
    if (bs?.power) {
      say("Your greatest spread: {cards}, {form}, worth {p}{vs}.", {
        cards: listParts((bs.cards || []).map((c) => (c.suit ? `${SUIT_NAME[c.suit]} ${c.value}` : "Wild")), "card"),
        form: ["form", bs.form || "no Form"],
        p: ["num", `${bs.power} dice`],
        vs: bs.vs ? fill(" against {b}", { b: ["beast", bs.vs] }) : "",
      });
    }
    if (buys.length) {
      const last = [...new Set(buys.map((b) => b.name))].slice(-3);
      say(pick("buy", [
        buys.length === 1 ? "From the Lost & Found you took one thing: {list}." : "From the Lost & Found you took {n} things, {list} among them.",
        buys.length === 1 ? "The Lost & Found gave you {list}." : "The Lost & Found gave you {n} treasures, {list} the dearest.",
      ]), { n: ["num", buys.length], list: listParts(last, "card") });
    }
    sets.forEach((s) => say("You traded your {set} for {arch}, and never saw those pieces again.", { set: ["card", `${s.set} set`], arch: ["arch", s.arch] }));
  }

  // ---- VII. The tally -----------------------------------------------------------
  if (breakdown) {
    head("The Tally");
    say("Archetypes, twice over: {v}", { v: ["num", breakdown.archetypePoints] });
    if (breakdown.bossPoints) say("Beasts of the ladder, climbed: {v}", { v: ["num", breakdown.bossPoints] });
    if (breakdown.bestSpread) say("Your best spread: {v}", { v: ["num", breakdown.bestSpread] });
    if (breakdown.escapeBonus) say("For waking: {v}", { v: ["num", breakdown.escapeBonus] });
    if (breakdown.leviathans) say("Leviathans: {v}", { v: ["num", breakdown.leviathans] });
    const keep = (breakdown.objects || 0) + (breakdown.tokens || 0) + (breakdown.allies || 0);
    if (keep) say("What you carried out: {v}", { v: ["num", keep] });
    say("{total}", { total: ["num", `${breakdown.total} in all`] });
  }

  // ---- VIII. Waking ------------------------------------------------------------
  head(triumph ? "The Edge of the Dream" : endless ? "The Dream Goes On" : "Morning");
  if (triumph) {
    [
      "The last Leviathan fell, and behind it there was nothing. Not darkness. Nothing.",
      "And in the nothing you saw the seams: the hexes, the dice, the numbers that had always been there.",
      "This was never only your dream.",
      "Someone dreamed it first. They woke one night with it still in their hands, and they built it, piece by piece, so it would not fade.",
      "Then they gave it away, so that someone else could dream it too.",
    ].forEach((t) => say(t, {}));
    say("That someone else was you, wearing the face of {dreamer}.", { dreamer: ["dreamer", dreamer] });
    say("Every beast was a thought they had. Every Landscape, a room they once stood in. Every roll, a little of their luck, lent to you.", {});
    say("You played their dream all the way to its end. No one else's hands moved quite like yours.", {});
    say("Now wake up. {go}", { go: ["event", "Go dream something of your own."] });
  } else if (endless) {
    say(pick("endless", [
      "You woke, and chose not to stay awake. The dream was glad.",
      "Morning came, and you turned over and went back in.",
    ]), {});
    say("Somewhere past the last Leviathan, they say, the dream runs out of dream.", {});
    say("Not tonight.", {});
  } else {
    say(pick("wake", [
      "And then, gently, morning.",
      "Light at the edges. Birds. The weight of a blanket.",
      "You open your eyes, and for a moment you are still {dreamer}.",
    ]), { dreamer: ["dreamer", dreamer] });
    say(pick("wake2", [
      "The dream lets go of you slowly, the way a hand lets go of a hand.",
      "You will forget most of it by noon. Not all of it.",
    ]), {});
  }
  out.push({ kind: "gap", parts: [] });
  out.push({ kind: "quote", parts: [{ text: "Ainmos" }] });
  out.push({ kind: "line", parts: [{ text: "Thank you for dreaming." }] });
  return out;
}

/** Plain text of the story, for logs and tests. */
export function dreamStoryText(state, breakdown = null) {
  return buildDreamStory(state, breakdown).map((l) => l.parts.map((p) => p.text).join("")).join("\n");
}
